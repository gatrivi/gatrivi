import type { ProcessDefinition } from '../domain'

export const orderFulfillmentV1: ProcessDefinition = {
  id: 'order-fulfillment:v1',
  tenantId: 'demo',
  key: 'order-fulfillment',
  name: 'Preparación y entrega de pedido',
  version: 1,
  status: 'published',
  graph: {
    nodes: [
      { id: 'start', type: 'start', next: 'payment-gate' },
      {
        id: 'payment-gate',
        type: 'exclusiveGateway',
        branches: [
          {
            targetNodeId: 'confirm-order',
            condition: { variable: 'requiresPayment', equals: false },
          },
          { targetNodeId: 'verify-payment' },
        ],
      },
      {
        id: 'verify-payment',
        type: 'humanTask',
        name: 'Verificar pago',
        next: 'confirm-order',
        candidateRoles: ['process_operator'],
      },
      {
        id: 'confirm-order',
        type: 'humanTask',
        name: 'Confirmar pedido',
        next: 'prepare-order',
        candidateRoles: ['process_operator'],
      },
      {
        id: 'prepare-order',
        type: 'humanTask',
        name: 'Preparar pedido',
        next: 'mark-ready',
        candidateRoles: ['process_operator'],
      },
      {
        id: 'mark-ready',
        type: 'humanTask',
        name: 'Marcar listo',
        next: 'deliver-order',
        candidateRoles: ['process_operator'],
      },
      {
        id: 'deliver-order',
        type: 'humanTask',
        name: 'Entregar pedido',
        next: 'end',
        candidateRoles: ['process_operator'],
      },
      { id: 'end', type: 'end' },
    ],
  },
}
