import { ingestCommerceOrderCreated } from './commerce'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const pendingMp = ingestCommerceOrderCreated({
  specversion: '1.0',
  id: 'order.created:pizza-g:TMM-1234',
  source: 'tmm-store',
  type: 'commerce.order.created.v1',
  subject: 'order/TMM-1234',
  tenantid: 'pizza-g',
  time: '2026-08-17T22:00:00.000Z',
  datacontenttype: 'application/json',
  data: {
    orderId: 'TMM-1234',
    total: 22500,
    paymentMethod: 'mercadopago',
    paymentStatus: 'pending',
    source: 'storefront',
  },
})

assert(pendingMp.definition.tenantId === 'pizza-g', 'definition must stay tenant-scoped')
assert(pendingMp.state.instance.businessKey === 'order:TMM-1234', 'business key must reference order')
assert(pendingMp.state.tasks[0]?.title === 'Verificar pago', 'pending MP must wait for payment verification')
assert(
  pendingMp.state.instance.variables.sourceEventId === 'order.created:pizza-g:TMM-1234',
  'source event id must be retained for idempotency/audit',
)

const cash = ingestCommerceOrderCreated({
  specversion: '1.0',
  id: 'order.created:pizza-g:TMM-1235',
  source: 'tmm-store',
  type: 'commerce.order.created.v1',
  subject: 'order/TMM-1235',
  tenantid: 'pizza-g',
  time: '2026-08-17T22:01:00.000Z',
  datacontenttype: 'application/json',
  data: {
    orderId: 'TMM-1235',
    total: 12000,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    source: 'storefront',
  },
})

assert(cash.state.tasks[0]?.title === 'Confirmar pedido', 'cash must skip payment verification')

console.info('BPM commerce integration selfcheck passed')
