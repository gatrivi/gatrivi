# BPM — Roadmap hasta nivel industria

## 0. Decisión arquitectónica

**TMM Store será el primer productor de procesos, no el host del motor BPM.**

TMM ya tiene el disparador ideal: pedidos reales y cambios de pago. El BPM debe vivir como bounded context propio para poder procesar también ventas CRM, presupuestos, soporte, onboarding, cobranzas, producción, aplicaciones laborales y cualquier otro flujo.

```text
TMM Store ─┐
CRM ───────┼──> Integration API / Events ──> BPM Runtime
Otros ─────┘                                  │
                                             ├─ Process definitions
                                             ├─ Process instances
                                             ├─ Human tasks
                                             ├─ Jobs / timers
                                             ├─ Audit log
                                             └─ Metrics / incidents
```

### Separación de responsabilidades

- **TMM Store:** catálogo, carrito, checkout, pedido, pago y experiencia del comprador.
- **CRM:** personas, empresas, leads, oportunidades, pipeline y actividad comercial.
- **BPM:** definición y ejecución de procesos, tareas humanas, automatizaciones, tiempos, reglas, auditoría y excepciones.
- **Compartido:** tenant, identidad, usuarios, roles, referencias externas y contratos de eventos.

No duplicar `Order`, `Contact` o `Deal` dentro del BPM. El BPM guarda una referencia de negocio (`businessKey` / `externalRef`) y las variables mínimas requeridas para ejecutar el proceso.

---

## 1. Objetivo final

Llegar a un motor de procesos suficientemente sólido para venderse como producto PyME sin quedar encerrados en una implementación casera imposible de evolucionar.

El objetivo de interoperabilidad es **BPMN 2.0.2** para modelado/importación/exportación del subconjunto ejecutable soportado. BPMN 2.0.2 sigue siendo la versión formal vigente de OMG. Para eventos entre productos se usará un envelope compatible con **CloudEvents 1.0**.

No es objetivo implementar de entrada cada símbolo de BPMN. Primero se construye un runtime pequeño y correcto; después se amplía el perfil ejecutable.

---

## 2. Principios no negociables

1. **Definiciones versionadas e inmutables**
   - Editar un proceso publicado crea una nueva versión.
   - Una instancia en ejecución queda fijada a la versión con la que empezó.

2. **Estado autoritativo en backend**
   - React nunca decide el estado real del proceso.
   - La UI envía comandos y renderiza el resultado.

3. **Transiciones atómicas**
   - Completar una tarea y avanzar el proceso debe ser una sola unidad lógica.
   - Ningún refresh, retry o webhook duplicado puede avanzar dos veces.

4. **Idempotencia**
   - Webhooks, comandos y workers aceptan `idempotencyKey` / `eventId`.
   - Repetir el mismo evento debe producir el mismo resultado observable.

5. **Auditoría append-only**
   - No perder quién hizo qué, cuándo, sobre qué instancia y desde qué estado.

6. **Multi-tenant desde dominio**
   - `tenantId` obligatorio en definiciones, instancias, tareas, jobs, eventos e índices.

7. **Separar flujo de negocio de integración**
   - Un proceso dice “cobrar pedido”.
   - Un adapter decide si eso llama Mercado Pago, WhatsApp, email o API externa.

8. **Fallas explícitas**
   - Retries, incidentes y dead-letter; nunca errores silenciosos.

---

## 3. Modelo de dominio

### 3.1 ProcessDefinition

```ts
interface ProcessDefinition {
  id: string;
  tenantId: string;
  key: string;              // order-fulfillment
  name: string;
  version: number;
  status: 'draft' | 'published' | 'retired';
  graph: ProcessGraph;
  bpmnXml?: string;
  checksum: string;
  createdAt: string;
  publishedAt?: string;
}
```

### 3.2 ProcessInstance

```ts
interface ProcessInstance {
  id: string;
  tenantId: string;
  definitionId: string;
  definitionKey: string;
  definitionVersion: number;
  businessKey: string;      // order:TMM-1234
  status: 'running' | 'waiting' | 'completed' | 'cancelled' | 'failed';
  variables: Record<string, unknown>;
  revision: number;         // optimistic concurrency
  startedAt: string;
  endedAt?: string;
}
```

### 3.3 ExecutionToken

Necesario cuando aparezcan forks paralelos, joins, subprocesses o múltiples caminos activos.

```ts
interface ExecutionToken {
  id: string;
  instanceId: string;
  nodeId: string;
  status: 'active' | 'waiting' | 'completed' | 'cancelled';
  parentTokenId?: string;
}
```

### 3.4 HumanTask

```ts
interface HumanTask {
  id: string;
  tenantId: string;
  instanceId: string;
  nodeId: string;
  title: string;
  status: 'open' | 'claimed' | 'completed' | 'cancelled';
  assigneeId?: string;
  candidateRoles?: string[];
  priority?: number;
  dueAt?: string;
  formSchema?: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}
```

### 3.5 Job

Automatizaciones, timers y trabajo retryable.

```ts
interface Job {
  id: string;
  tenantId: string;
  instanceId: string;
  nodeId: string;
  type: 'service-task' | 'timer' | 'message';
  status: 'queued' | 'leased' | 'done' | 'failed' | 'dead';
  runAt: string;
  attempts: number;
  maxAttempts: number;
  leaseUntil?: string;
  payload: Record<string, unknown>;
}
```

### 3.6 Incident

Toda falla que agota retries o requiere intervención humana crea un incidente visible y auditable.

---

## 4. Nodo ejecutable v1

El primer perfil debe soportar:

```text
StartEvent
  ↓
UserTask
  ↓
ServiceTask
  ↓
ExclusiveGateway
  ├─ condición A
  └─ condición B
  ↓
TimerCatchEvent
  ↓
EndEvent
```

Orden de ampliación:

1. start/end events
2. human task
3. service task
4. exclusive gateway
5. timer
6. message/webhook catch
7. parallel gateway + execution tokens
8. subprocess
9. boundary timer/error events
10. event subprocess / advanced BPMN sólo si existe necesidad real

---

## 5. Runtime

Toda modificación ocurre mediante comandos explícitos.

### Comandos base

- `StartProcess`
- `CompleteTask`
- `ClaimTask`
- `AssignTask`
- `CancelInstance`
- `SignalInstance`
- `CorrelateMessage`
- `RetryJob`
- `ResolveIncident`

### Regla

```text
Command
  ↓ validate tenant + permission
  ↓ load definition + instance
  ↓ validate current state
  ↓ execute transition
  ↓ persist state
  ↓ append audit event
  ↓ write outbox events
  ↓ commit
```

Un comando nunca llama directamente una integración externa dentro de la misma transacción. Genera un job/outbox item y un worker lo procesa.

---

## 6. Persistencia

### MVP/demo

Puede mantenerse localStorage/Firestore únicamente para la UI/demo del CRM existente.

### Runtime real

Para el BPM autoritativo conviene **PostgreSQL** por:

- transacciones;
- locking / optimistic concurrency;
- consultas operativas e históricas;
- jobs ordenados por `runAt`;
- índices por tenant/estado/assignee;
- constraints de unicidad para idempotencia;
- JSONB para variables sin perder estructura relacional.

Firestore puede seguir siendo backend de otros módulos. No debe forzarse una única base de datos para todos los bounded contexts.

### Tablas objetivo

```text
process_definitions
process_instances
execution_tokens
human_tasks
jobs
incidents
process_events
outbox
message_subscriptions
```

Índices mínimos:

- `(tenant_id, key, version)` unique en definiciones
- `(tenant_id, business_key)` en instancias
- `(tenant_id, status, created_at)` en instancias
- `(tenant_id, assignee_id, status, due_at)` en tasks
- `(status, run_at)` en jobs
- `(tenant_id, event_id)` unique para dedupe

---

## 7. Integración TMM

TMM ya posee pedidos y webhook de Mercado Pago. Ése será el primer flujo end-to-end.

### Eventos de entrada

```text
commerce.order.created.v1
commerce.payment.approved.v1
commerce.payment.rejected.v1
commerce.order.cancelled.v1
```

Envelope recomendado:

```json
{
  "specversion": "1.0",
  "id": "evt_...",
  "source": "tmm-store",
  "type": "commerce.order.created.v1",
  "subject": "order/TMM-1234",
  "tenantid": "pizza-g",
  "time": "2026-08-17T22:00:00Z",
  "data": {
    "orderId": "TMM-1234",
    "total": 22500,
    "paymentMethod": "mercadopago"
  }
}
```

### Primer proceso

```text
Pedido creado
   ↓
¿requiere pago?
   ├─ no ─────────────┐
   └─ sí              │
       ↓              │
Esperar pago          │
       ↓              │
Pago aprobado ────────┘
       ↓
Confirmar pedido
       ↓
Preparar
       ↓
Listo
       ↓
Entregar
       ↓
Fin
```

### Eventos BPM hacia afuera

```text
workflow.instance.started.v1
workflow.task.created.v1
workflow.task.completed.v1
workflow.instance.completed.v1
workflow.incident.created.v1
```

TMM puede mostrar el estado operativo derivado sin poseer la lógica de transición.

---

## 8. Integración CRM

CRM y BPM siguen siendo módulos distintos aunque puedan compartir aplicación y navegación.

Ejemplos:

```text
CRM deal.won
   ↓
BPM onboarding cliente
   ↓
Crear sitio
   ↓
Solicitar material
   ↓
QA
   ↓
Publicar
```

```text
CRM lead.created
   ↓
BPM outreach sequence
   ↓
contactar → esperar → follow-up → cerrar
```

La etapa de un deal puede disparar un proceso; una tarea BPM puede aparecer en la bandeja general del CRM. Eso no convierte el pipeline CRM en workflow engine.

---

## 9. Autorización

### Roles base

- `tenant_admin`
- `process_designer`
- `process_operator`
- `worker`
- `viewer`

### Permisos separados

- diseñar/publicar proceso;
- iniciar/cancelar instancia;
- ver variables sensibles;
- completar/reasignar tareas;
- reintentar jobs;
- resolver incidentes;
- consultar auditoría.

En user tasks se soportarán `assignee`, `candidateUsers` y `candidateRoles`.

---

## 10. Auditoría

Cada cambio relevante produce un evento append-only:

```ts
interface ProcessEvent {
  id: string;
  tenantId: string;
  instanceId: string;
  sequence: number;
  type: string;
  actorType: 'user' | 'system' | 'integration';
  actorId?: string;
  nodeId?: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}
```

Nunca editar el historial. Correcciones generan nuevos eventos.

Auditar al menos:

- instance started/completed/cancelled;
- node entered/left;
- task created/claimed/reassigned/completed;
- timer created/fired;
- external event correlated;
- job attempted/failed/dead;
- incident opened/resolved;
- variable mutations sensibles;
- process publication.

---

## 11. Timers y workers

Los timers no deben depender de una pestaña abierta ni de `setTimeout` del frontend.

Worker:

```text
SELECT jobs ready
  ↓ lease atomically
execute
  ├─ success → done
  └─ failure → exponential backoff
                  ↓
             max attempts
                  ↓
               incident
```

Requisitos:

- lease con expiración;
- restart-safe;
- retries con backoff + jitter;
- idempotencia del handler;
- dead-letter/incident;
- métricas de backlog y fallas.

En producción el worker debe correr en un proceso persistente (p. ej. servicio Node separado); no depender exclusivamente del ciclo de vida de funciones serverless de Vercel.

---

## 12. Reglas y decisiones

### v1

Condiciones JSON/AST seguras; no `eval`.

```json
{
  "op": "and",
  "args": [
    { "op": "eq", "left": { "var": "paymentStatus" }, "right": "approved" },
    { "op": "gte", "left": { "var": "total" }, "right": 10000 }
  ]
}
```

### v2

Decision tables y expresión tipo FEEL.

### v3

Compatibilidad DMN sólo cuando haya reglas suficientemente complejas como para justificarla. No acoplar BPMN y decisiones desde el MVP.

---

## 13. Diseñador visual

No construir canvas propio desde cero si puede evitarse.

Objetivo:

- drag/drop de nodos;
- propiedades laterales;
- validation errors antes de publicar;
- zoom/pan mobile/desktop;
- import/export BPMN XML;
- representación interna normalizada independiente del canvas;
- diff entre versiones.

El editor nunca escribe directamente sobre una definición publicada.

---

## 14. BPMN

Referencia de interoperabilidad: [OMG BPMN 2.0.2](https://www.omg.org/spec/BPMN/2.0.2/).

### Perfil ejecutable inicial

Mapear sólo elementos soportados y rechazar explícitamente procesos que usen elementos no ejecutables por nuestro runtime.

```text
BPMN startEvent          → StartEvent
BPMN endEvent            → EndEvent
BPMN userTask            → HumanTask
BPMN serviceTask         → ServiceTask
BPMN exclusiveGateway    → ExclusiveGateway
BPMN parallelGateway     → ParallelGateway
BPMN intermediateCatch   → Timer/MessageCatch
BPMN subProcess          → SubProcess
```

Regla de importación: **nunca aceptar silenciosamente semántica que no podemos ejecutar**.

---

## 15. Observabilidad

### Dashboard operativo

- instancias activas/completadas/fallidas;
- tareas vencidas;
- tiempo medio por etapa;
- SLA breach count;
- jobs pendientes/fallidos;
- incidentes abiertos;
- throughput por proceso;
- bottlenecks.

### Telemetría técnica

- `correlationId` / `traceId`;
- structured logs;
- command duration;
- transition duration;
- queue latency;
- retry count;
- exception rate.

---

## 16. API pública

### Commands

```text
POST /api/process-definitions/:key/start
POST /api/process-instances/:id/cancel
POST /api/tasks/:id/claim
POST /api/tasks/:id/complete
POST /api/messages/:name/correlate
POST /api/incidents/:id/retry
```

### Queries

```text
GET /api/process-definitions
GET /api/process-instances
GET /api/process-instances/:id
GET /api/tasks?assignee=me
GET /api/incidents
GET /api/process-instances/:id/history
```

Toda mutación admite `Idempotency-Key`.

No exponer tablas ni repositorios como API pública.

---

# 17. Roadmap por fases

## Fase 0 — Contratos

**Meta:** evitar que TMM y CRM se acoplen accidentalmente.

- crear package/tipos compartidos de eventos;
- definir `businessKey` y `externalRef`;
- envelope CloudEvents-compatible;
- eventos TMM v1;
- schema validation;
- tests contractuales.

**Exit:** un pedido TMM puede producir `commerce.order.created.v1` validado sin conocer internals del BPM.

---

## Fase 1 — Mini BPM usable

**Meta:** reemplazar estados hardcodeados por proceso ejecutable.

- ProcessDefinition + version;
- ProcessInstance;
- start/end;
- human task;
- exclusive gateway;
- task inbox;
- audit básico;
- integración con pedido TMM.

**Exit:** `pedido → confirmar → preparar → listo → entregar` funciona sólo mediante el runtime.

---

## Fase 2 — Runtime confiable

**Meta:** que no pierda ni duplique trabajo.

- backend autoritativo;
- PostgreSQL;
- optimistic concurrency;
- idempotency keys;
- outbox;
- service tasks;
- worker;
- timers persistentes;
- retries + incidents;
- RBAC;
- audit completo.

**Exit:** reiniciar frontend/backend/worker o repetir webhooks no corrompe una instancia.

---

## Fase 3 — Motor general

**Meta:** dejar de ser “gestor de pedidos” y convertirse en BPM.

- parallel gateways;
- execution tokens;
- message correlation;
- subprocesses;
- boundary timers/errors;
- assignment rules;
- SLA/escalations;
- variables tipadas/schema;
- process migration policy;
- API estable.

**Exit:** el mismo runtime ejecuta pedidos TMM, onboarding y outreach CRM sin lógica especial por dominio.

---

## Fase 4 — Model driven

**Meta:** procesos editables sin programar.

- diseñador visual;
- forms en human tasks;
- process validation;
- drafts/publish/retire;
- version diff;
- import/export BPMN;
- execution profile documentado;
- simulation/test fixtures.

**Exit:** un operador puede modelar y publicar un flujo nuevo sin tocar código del runtime.

---

## Fase 5 — Industry standard

**Meta:** producto serio y operable.

- BPMN 2.0.2 compatible para el perfil soportado;
- versionado inmutable;
- full history/audit;
- RBAC multi-tenant;
- idempotent API/events;
- durable timers/jobs;
- retries/incidents;
- SLA/escalation;
- designer + validation;
- OpenAPI;
- webhooks/event subscriptions;
- observability;
- backup/restore probado;
- rate limiting;
- security review;
- load/recovery tests;
- export de definiciones e historial;
- documentación de operación.

**Exit:** un proceso puede sobrevivir deploys, retries, workers duplicados y cambios de versión sin perder integridad ni trazabilidad.

---

## 18. Pruebas obligatorias

### Semántica

- no puede completarse una task dos veces;
- gateway toma exactamente los caminos válidos;
- parallel join espera todos los tokens requeridos;
- timer dispara una vez;
- message correlation encuentra la instancia correcta;
- proceso terminado no acepta comandos inválidos.

### Concurrencia

- dos operadores completando la misma task: uno gana, uno recibe conflict;
- dos workers reclamando el mismo job: sólo uno obtiene lease;
- webhook repetido: una sola transición.

### Recovery

- crash después de commit pero antes de publicar evento;
- crash después de llamar integración externa;
- worker muere con lease activo;
- deploy con timers pendientes;
- restore desde backup.

### Tenant isolation

- ningún query, task, process o event cruza tenant;
- tests automáticos de permisos y repository filters.

---

## 19. Definition of Done industria

No llamar “industry standard” al BPM hasta que cumpla simultáneamente:

- [ ] definiciones versionadas/inmutables;
- [ ] runtime backend transaccional;
- [ ] idempotencia end-to-end;
- [ ] human + service tasks;
- [ ] gateways exclusivos y paralelos;
- [ ] durable timers;
- [ ] message correlation;
- [ ] subprocesses;
- [ ] retries + incidents;
- [ ] RBAC multi-tenant;
- [ ] audit append-only;
- [ ] SLA/escalations;
- [ ] diseñador y validación;
- [ ] BPMN import/export del perfil soportado;
- [ ] API + webhooks documentados;
- [ ] observabilidad y métricas;
- [ ] backup/restore probado;
- [ ] pruebas de concurrencia y recovery;
- [ ] seguridad y aislamiento tenant verificados.

---

## 20. Qué construir ahora

Orden inmediato recomendado:

1. Extraer en TMM un evento `commerce.order.created.v1` al confirmar un pedido.
2. Crear en CRM/BPM un módulo de dominio sin React (`src/bpm/domain`).
3. Implementar `ProcessDefinition`, `ProcessInstance`, `HumanTask` y `ProcessEvent`.
4. Crear un runtime puro en memoria para probar semántica.
5. Ejecutar como primer fixture `order-fulfillment`.
6. Añadir persistencia backend real.
7. Recién entonces conectar la UI de inbox/process view.

**No empezar por el canvas.** Primero hacer correcto el motor. El diseñador visual es una capa sobre semántica ya estable.

---

## 21. Decisión final

```text
TMM Store = primer caso real + productor
CRM       = interfaz comercial + task surface
BPM       = motor independiente
```

Pueden vivir bajo la misma suite y compartir login/tenant/navigation, pero deben conservar fronteras de dominio y contratos explícitos.

Eso permite empezar barato con pedidos de TMM y terminar con un BPM reutilizable sin reescribirlo cuando aparezca el segundo proceso real.
