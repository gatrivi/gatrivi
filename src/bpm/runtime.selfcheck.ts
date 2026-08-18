import { orderFulfillmentV1 } from './fixtures/orderFulfillment'
import { completeTask, startProcess } from './runtime'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

let state = startProcess(orderFulfillmentV1, {
  instanceId: 'instance-1',
  businessKey: 'order:TMM-1234',
  variables: { requiresPayment: false },
  now: '2026-08-17T23:00:00.000Z',
})

assert(state.instance.status === 'waiting', 'process should wait at first human task')
assert(state.tasks[0]?.title === 'Confirmar pedido', 'no-payment path should skip payment verification')

const firstTaskId = state.tasks[0].id
state = completeTask(orderFulfillmentV1, state, {
  taskId: firstTaskId,
  actorId: 'operator-1',
  now: '2026-08-17T23:01:00.000Z',
})

assert(state.tasks.at(-1)?.title === 'Preparar pedido', 'process should advance to preparation')

for (const title of ['Preparar pedido', 'Marcar listo', 'Entregar pedido']) {
  const task = state.tasks.find((candidate) => candidate.status === 'open')
  assert(task, `expected open task: ${title}`)
  assert(task.title === title, `expected ${title}, got ${task.title}`)
  state = completeTask(orderFulfillmentV1, state, {
    taskId: task.id,
    actorId: 'operator-1',
    now: '2026-08-17T23:02:00.000Z',
  })
}

assert(state.instance.status === 'completed', 'process should complete after delivery')
assert(
  state.events.some((event) => event.type === 'workflow.instance.completed.v1'),
  'completion event should be appended',
)

let duplicateRejected = false
try {
  completeTask(orderFulfillmentV1, state, { taskId: firstTaskId })
} catch {
  duplicateRejected = true
}
assert(duplicateRejected, 'completing a task twice must fail')

console.info('BPM runtime selfcheck passed')
