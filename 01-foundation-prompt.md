# CRM/BPM MVP — Prompt 01: Foundation

Run this in Cursor's Composer/Agent panel using **Composer 2.5** (Cursor's own model, now the panel default) — it benchmarks close to Opus 4.7/GPT-5.5 max on coding tasks at a fraction of the cost, and it's specifically tuned for sustained multi-file work, which is exactly what a foundation prompt needs. Only manually swap to Opus/GPT-5.5 if it stalls on something specific.

---

```
Build the foundation for a new project: a lightweight CRM/BPM for small Argentine businesses (pymes). Standalone repo, separate from Tmm-store.

REUSE THESE PATTERNS from https://github.com/gatrivi/Tmm-store (branch `trabajo`) — architecture only, not the food-ordering domain:
- Stack: React 19 + Vite 6 + TypeScript + Tailwind v4
- Auth: SHA-256 hashed admin credentials via env vars (VITE_ADMIN_*_HASH), no paid auth provider
- Persistence: localStorage by default; Firestore when VITE_FIREBASE_* env vars are set, behind the same src/context abstraction so swapping backend never touches pages
- Multi-tenant: tenant from URL slug /t/:slug, or VITE_TENANT_ID fallback (mirrors Trufi's /s/:slug)
- Firestore rules: scope every read/write by tenantId, same shape as Trufi's firestore.rules
- Deploy: Vercel, vercel.json + api/ folder for any serverless functions
- Do NOT copy Storefront, CheckoutModal, MercadoPago, or WhatsApp-order code — only the plumbing.

DATA MODEL — TypeScript interfaces in src/types/:
- Contact: id, tenantId, name, phone, email, company, notes, createdAt
- Stage: id, tenantId, name, order, color (defaults: Nuevo, Contactado, Propuesta, Ganado, Perdido)
- Deal: id, tenantId, contactId, title, stageId, value, currency, createdAt, updatedAt
- Task: id, tenantId, contactId?, dealId?, title, dueDate, done

ROUTES:
- /login
- /t/:slug/dashboard → 4 stat cards: deals count, pipeline value, contacts count, pending tasks
- /t/:slug/pipeline → Kanban board, Deals grouped by Stage, drag-and-drop between columns
- /t/:slug/contacts → list + detail (linked deals & tasks shown on detail page)
- /t/:slug/tasks → list, filter pending/done

SEED: if no Firestore config, auto-seed localStorage on first load — tenant "demo", 5 contacts, 5 deals across stages, 4 tasks — so /t/demo/dashboard demos fully with zero setup.

LANGUAGE: all UI copy in Spanish, Rioplatense, informal "vos".

ALSO CREATE .cursor/rules/conventions.md (under 1 page): folder structure, naming, the model→service→context→page pattern for adding a new entity, Tailwind tokens used, and this rule — "when a task says edit one page/component, don't touch shared context, services, or types unless explicitly told to." Every future prompt in this project points back to this file.

ACCEPTANCE: run npm install, npm run dev, npm run build yourself. Fix any TS or runtime errors before finishing. App must boot with zero env vars configured.
```

---

## Next prompts (narrow scope, cheap models — write once this ships)
1. Pipeline: drag-and-drop polish + inline stage editing
2. Contact detail: activity timeline + notes
3. WhatsApp click-to-chat on contact card (wa.me link, no API)
4. Dashboard: date filters + simple charts
5. Optional: plan-gating (Basic/Pro) reusing Trufi's PlanContext pattern
