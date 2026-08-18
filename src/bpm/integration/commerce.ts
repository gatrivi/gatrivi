import type { ProcessDefinition, RuntimeState } from '../domain'
import { orderFulfillmentV1 } from '../fixtures/orderFulfillment'
import { startProcess } from '../runtime'

export interface CommerceOrderCreatedEventV1 {
  specversion: '1.0'
  id: string
  source: 'tmm-store'
  type: 'commerce.order.created.v1'
  subject: string
  tenantid: string
  time: string
  datacontenttype: 'application/json'
  data: {
    orderId: string
    total: number
    paymentMethod: 'cash' | 'transfer' | 'mercadopago'
    paymentStatus: 'pending' | 'approved' | 'rejected'
    source: 'storefront' | 'demo' | 'admin' | 'unknown'
  }
}

export interface IngestedOrderProcess {
  event: CommerceOrderCreatedEventV1
  definition: ProcessDefinition
  state: RuntimeState
}

export function ingestCommerceOrderCreated(input: unknown): IngestedOrderProcess {
  const event = parseCommerceOrderCreatedEvent(input)
  const definition = definitionForTenant(event.tenantid)
  const requiresPayment =
    event.data.paymentMethod !== 'cash' && event.data.paymentStatus !== 'approved'

  const state = startProcess(definition, {
    instanceId: `order-fulfillment:${event.tenantid}:${event.data.orderId}`,
    businessKey: `order:${event.data.orderId}`,
    actorId: event.source,
    now: event.time,
    variables: {
      orderId: event.data.orderId,
      total: event.data.total,
      paymentMethod: event.data.paymentMethod,
      paymentStatus: event.data.paymentStatus,
      orderSource: event.data.source,
      requiresPayment,
      sourceEventId: event.id,
    },
  })

  return { event, definition, state }
}

export function parseCommerceOrderCreatedEvent(input: unknown): CommerceOrderCreatedEventV1 {
  if (!isRecord(input)) throw new Error('Commerce event must be an object')
  if (input.specversion !== '1.0') throw new Error('Unsupported CloudEvents specversion')
  if (input.source !== 'tmm-store') throw new Error('Unsupported event source')
  if (input.type !== 'commerce.order.created.v1') throw new Error('Unsupported event type')
  if (input.datacontenttype !== 'application/json') throw new Error('Unsupported content type')
  if (!isNonEmptyString(input.id)) throw new Error('Event id is required')
  if (!isNonEmptyString(input.subject) || !input.subject.startsWith('order/')) {
    throw new Error('Invalid event subject')
  }
  if (!isNonEmptyString(input.tenantid)) throw new Error('tenantid is required')
  if (!isNonEmptyString(input.time) || Number.isNaN(Date.parse(input.time))) {
    throw new Error('Event time must be ISO-compatible')
  }
  if (!isRecord(input.data)) throw new Error('Event data is required')

  const data = input.data
  if (!isNonEmptyString(data.orderId)) throw new Error('orderId is required')
  if (typeof data.total !== 'number' || !Number.isFinite(data.total) || data.total < 0) {
    throw new Error('total must be a non-negative finite number')
  }
  if (!isOneOf(data.paymentMethod, ['cash', 'transfer', 'mercadopago'] as const)) {
    throw new Error('Invalid paymentMethod')
  }
  if (!isOneOf(data.paymentStatus, ['pending', 'approved', 'rejected'] as const)) {
    throw new Error('Invalid paymentStatus')
  }
  if (!isOneOf(data.source, ['storefront', 'demo', 'admin', 'unknown'] as const)) {
    throw new Error('Invalid order source')
  }

  return input as unknown as CommerceOrderCreatedEventV1
}

function definitionForTenant(tenantId: string): ProcessDefinition {
  return {
    ...orderFulfillmentV1,
    id: `${tenantId}:order-fulfillment:v${orderFulfillmentV1.version}`,
    tenantId,
    graph: {
      nodes: orderFulfillmentV1.graph.nodes.map((node) => ({ ...node })),
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T)
}
