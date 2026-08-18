import type {
  EqualsCondition,
  HumanTask,
  ProcessDefinition,
  ProcessEvent,
  ProcessNode,
  RuntimeState,
} from './domain'

export interface StartProcessInput {
  instanceId: string
  businessKey: string
  variables?: Record<string, unknown>
  actorId?: string
  now?: string
}

export interface CompleteTaskInput {
  taskId: string
  variables?: Record<string, unknown>
  actorId?: string
  now?: string
}

export function startProcess(definition: ProcessDefinition, input: StartProcessInput): RuntimeState {
  if (definition.status !== 'published') {
    throw new Error(`Process definition ${definition.key}@${definition.version} is not published`)
  }

  const starts = definition.graph.nodes.filter((node) => node.type === 'start')
  if (starts.length !== 1) throw new Error('A process must contain exactly one start node')

  const now = input.now ?? new Date().toISOString()
  const state: RuntimeState = {
    instance: {
      id: input.instanceId,
      tenantId: definition.tenantId,
      definitionId: definition.id,
      definitionKey: definition.key,
      definitionVersion: definition.version,
      businessKey: input.businessKey,
      status: 'running',
      currentNodeId: starts[0].id,
      variables: { ...(input.variables ?? {}) },
      revision: 1,
      startedAt: now,
    },
    tasks: [],
    events: [],
  }

  appendEvent(state, 'workflow.instance.started.v1', starts[0].id, now, 'integration', input.actorId)
  return settle(definition, state, now)
}

export function completeTask(
  definition: ProcessDefinition,
  currentState: RuntimeState,
  input: CompleteTaskInput,
): RuntimeState {
  const state = copyState(currentState)
  const task = state.tasks.find((candidate) => candidate.id === input.taskId)

  if (!task) throw new Error(`Task ${input.taskId} does not exist`)
  if (task.status !== 'open') throw new Error(`Task ${input.taskId} is already ${task.status}`)
  if (state.instance.status !== 'waiting') throw new Error('Process instance is not waiting for a task')
  if (task.nodeId !== state.instance.currentNodeId) throw new Error('Task is not active for the current node')

  const node = findNode(definition, task.nodeId)
  if (node.type !== 'humanTask') throw new Error('Active task does not point to a human task node')

  const now = input.now ?? new Date().toISOString()
  task.status = 'completed'
  task.completedAt = now
  state.instance.variables = { ...state.instance.variables, ...(input.variables ?? {}) }
  state.instance.currentNodeId = node.next
  state.instance.status = 'running'
  state.instance.revision += 1

  appendEvent(state, 'workflow.task.completed.v1', node.id, now, 'user', input.actorId, {
    taskId: task.id,
  })

  return settle(definition, state, now)
}

function settle(definition: ProcessDefinition, state: RuntimeState, now: string): RuntimeState {
  let hops = 0
  const maxHops = Math.max(definition.graph.nodes.length * 2, 4)

  while (state.instance.status === 'running') {
    if (hops++ > maxHops) throw new Error('Process exceeded automatic transition limit')

    const node = findNode(definition, state.instance.currentNodeId)

    switch (node.type) {
      case 'start':
        state.instance.currentNodeId = node.next
        break

      case 'exclusiveGateway': {
        const branch = node.branches.find((candidate) =>
          candidate.condition ? matches(candidate.condition, state.instance.variables) : false,
        ) ?? node.branches.find((candidate) => !candidate.condition)

        if (!branch) throw new Error(`No branch matched gateway ${node.id}`)
        state.instance.currentNodeId = branch.targetNodeId
        break
      }

      case 'humanTask': {
        const existing = state.tasks.find(
          (task) => task.nodeId === node.id && task.instanceId === state.instance.id && task.status === 'open',
        )

        if (!existing) {
          const task: HumanTask = {
            id: `${state.instance.id}:${node.id}:${state.tasks.length + 1}`,
            tenantId: state.instance.tenantId,
            instanceId: state.instance.id,
            nodeId: node.id,
            title: node.name,
            status: 'open',
            candidateRoles: node.candidateRoles,
            createdAt: now,
          }
          state.tasks.push(task)
          appendEvent(state, 'workflow.task.created.v1', node.id, now, 'system', undefined, {
            taskId: task.id,
          })
        }

        state.instance.status = 'waiting'
        break
      }

      case 'end':
        state.instance.status = 'completed'
        state.instance.endedAt = now
        appendEvent(state, 'workflow.instance.completed.v1', node.id, now, 'system')
        break
    }
  }

  return state
}

function matches(condition: EqualsCondition, variables: Record<string, unknown>): boolean {
  return variables[condition.variable] === condition.equals
}

function findNode(definition: ProcessDefinition, nodeId: string): ProcessNode {
  const node = definition.graph.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) throw new Error(`Process node ${nodeId} does not exist`)
  return node
}

function appendEvent(
  state: RuntimeState,
  type: string,
  nodeId: string | undefined,
  occurredAt: string,
  actorType: ProcessEvent['actorType'],
  actorId?: string,
  payload: Record<string, unknown> = {},
): void {
  const sequence = state.events.length + 1
  state.events.push({
    id: `${state.instance.id}:event:${sequence}`,
    tenantId: state.instance.tenantId,
    instanceId: state.instance.id,
    sequence,
    type,
    actorType,
    actorId,
    nodeId,
    payload,
    occurredAt,
  })
}

function copyState(state: RuntimeState): RuntimeState {
  return {
    instance: {
      ...state.instance,
      variables: { ...state.instance.variables },
    },
    tasks: state.tasks.map((task) => ({ ...task, candidateRoles: task.candidateRoles?.slice() })),
    events: state.events.map((event) => ({ ...event, payload: { ...event.payload } })),
  }
}
