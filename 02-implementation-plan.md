# CRM/BPM MVP — Plan maestro

## 1. Objetivo

Entregar un CRM/BPM liviano para pymes argentinas, usable sin configuración externa y preparado para cambiar de localStorage a Firestore sin modificar las páginas.

## 2. Estado actual

- Scaffold React 19 + Vite 6 + TypeScript + Tailwind v4 creado.
- Rutas implementadas: login, dashboard, pipeline, contactos, detalle de contacto y tareas.
- Seed demo: 5 contactos, 5 negocios, 4 tareas y 5 etapas.
- Persistencia localStorage funcional mediante `CrmContext`.
- Build y smoke test del servidor dev aprobados.
- Pendiente: autenticación SHA-256 real, backend Firestore opcional y guard de rutas.

## 3. Fases de implementación

### Fase A — Base técnica

- Mantener `src/types` como única fuente de interfaces de dominio.
- Separar repositorios de datos de React: `storage.ts` para localStorage y `firestore.ts` para Firestore.
- Exponer desde el contexto las mismas operaciones, independientemente del backend.
- Resolver tenant desde `/t/:slug`; usar `VITE_TENANT_ID` únicamente como fallback.

### Fase B — Autenticación

- Añadir `VITE_ADMIN_USERNAME_HASH` y `VITE_ADMIN_PASSWORD_HASH`.
- Hashear entradas con `crypto.subtle.digest('SHA-256', ...)` y comparar en memoria.
- Guardar sólo un estado de sesión local, nunca la contraseña ni su hash.
- Proteger `/t/:slug/*`; redirigir a `/login` cuando no exista sesión.
- Mantener el acceso demo explícito sólo cuando no haya credenciales configuradas.

### Fase C — Firestore

- Añadir configuración Firebase sólo cuando existan todas las variables `VITE_FIREBASE_*`.
- Crear repositorio con colecciones `contacts`, `stages`, `deals` y `tasks`.
- Aplicar `tenantId` a toda lectura y escritura; consultar siempre con `where('tenantId', '==', tenant)`.
- Reusar el seed sólo para localStorage; Firestore no debe crear datos silenciosamente.
- Validar reglas con usuario autenticado y tenant coincidente.

### Fase D — Producto MVP

- Dashboard: cuatro métricas y resumen de pipeline/tareas.
- Pipeline: columnas por etapa, arrastre de negocios y actualización persistida.
- Contactos: búsqueda, detalle, negocios y tareas vinculados.
- Tareas: filtros pendientes/hechas/todas y cambio de estado.
- Todos los textos deben permanecer en español rioplatense, con “vos”.

### Fase E — Calidad y entrega

- Añadir estados vacíos, errores de persistencia y loading donde corresponda.
- Verificar responsive en viewport móvil y escritorio.
- Mantener `vercel.json` para fallback SPA y `firestore.rules` versionado.
- No incorporar Storefront, checkout, Mercado Pago ni pedidos por WhatsApp.

## 4. Contratos principales

```ts
interface CrmRepository {
  load(tenantId: string): Promise<CrmData>;
  save(tenantId: string, data: CrmData): Promise<void>;
}
```

El contexto selecciona el repositorio una sola vez. Las páginas sólo usan `useCrm()` y no conocen el backend.

## 5. Pruebas de aceptación

- `npm install` termina sin errores.
- `npm run build` termina sin errores TypeScript/Vite.
- Sin variables de entorno, `/t/demo/dashboard` inicia y muestra los datos seed.
- Login válido permite entrar; credenciales inválidas no crean sesión.
- Usuario sin sesión vuelve a `/login` al visitar una ruta protegida.
- Arrastrar un negocio cambia de etapa y sobrevive a un refresh.
- Completar una tarea y filtrar por estado produce resultados correctos.
- Contacto muestra sólo sus negocios y tareas.
- Con Firebase configurado, ninguna lectura/escritura cruza tenants.
- Vercel sirve rutas profundas sin devolver 404.

## 6. Orden de trabajo

1. Extraer el contrato de repositorio y conservar localStorage como implementación por defecto.
2. Implementar autenticación y protección de rutas.
3. Implementar repositorio Firestore y actualizar reglas.
4. Añadir estados vacíos/error/loading y pruebas de comportamiento.
5. Ejecutar build, smoke test, revisión responsive y checklist de despliegue.

## 7. Fuera de alcance

Pagos, automatizaciones WhatsApp, multiusuario avanzado, permisos por rol, reportes complejos, aplicación móvil nativa y sincronización offline avanzada.
