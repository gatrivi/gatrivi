export type ProcessStatus = 'draft' | 'published' | 'retired'
export type InstanceStatus = 'running' | 'waiting' | 'completed' | 'cancelled' | 'failed'
export type TaskStatus = 'open' | 'completed' | 'cancelled'

export type Primitive = string | number | boolean | null

export interface EqualsCondition {
  variable: string
  equals: Primitive
}

export interface GatewayBranch {
  targetNodeId: string
  condition?: EqualsCondition
}

export interface StartNode {
  id: string
  type: 'start'
  next: string
}

export interface EndNode {
  id: string
  type: 'end'
}

export interface HumanTaskNode {
  id: string
  type: 'humanTask'
  name: string
  next: string
  candidateRoles?: string[]
}

export interface ExclusiveGatewayNode {
  id: string
  type: 'exclusiveGateway'
  branches: GatewayBranch[]
}

export type ProcessNode = StartNode | EndNode | HumanTaskNode | ExclusiveGatewayNode

export interface ProcessGraph {
  nodes: ProcessNode[]
}

export interface ProcessDefinition {
  id: string
  tenantId: string
  key: string
  name: string
  version: number
  status: ProcessStatus
  graph: ProcessGraph
}

export interface ProcessInstance {
  id: string
  tenantId: string
  definitionId: string
  definitionKey: string
  definitionVersion: number
  businessKey: string
  status: InstanceStatus
  currentNodeId: string
  variables: Record<string, unknown>
  revision: number
  startedAt: string
  endedAt?: string
}

export interface HumanTask {
  id: string
  tenantId: string
  instanceId: string
  nodeId: string
  title: string
  status: TaskStatus
  candidateRoles?: string[]
  createdAt: string
  completedAt?: string
}

export interface ProcessEvent {
  id: string
  tenantId: string
  instanceId: string
  sequence: number
  type: string
  actorType: 'user' | 'system' | 'integration'
  actorId?: string
  nodeId?: string
  payload: Record<string, unknown>
  occurredAt: string
}

export interface RuntimeState {
  instance: ProcessInstance
  tasks: HumanTask[]
  events: ProcessEvent[]
}
