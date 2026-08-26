# UI Feature Parity Audit

## Scope and safety baseline

- Source baseline: `main` at `e455b1458f327d59b2b4bf4e853acf88defbb42d`.
- Implementation branch: `feat/complete-existing-ui-features`.
- Runtime contract: Next.js/TypeScript; Supabase Auth and Database only; Appwrite Sites hosting only.
- Historical note: this audit inspected `tmqlzsyqlprioeoowmtk` (`ap-southeast-1`). That project is retired. Current Helpa production is `zsxhtcprjllesptvxlyq` (`https://zsxhtcprjllesptvxlyq.supabase.co`).
- The live public schema contains 89 tables and RLS is enabled on all 89.
- No production migration was applied during this audit.

## Executive summary

The checked-in UI contains real product surfaces for authentication, dashboard reporting, contacts, CRM, clinical workflows, messaging, WhatsApp, marketing, automation, billing, account administration, platform administration, and eight industry modules. The audit found a mixture of complete API-backed flows, partial flows, misleading navigation, simulated integrations, client-derived authorization state, unsafe multi-step client mutations, and generic vertical pages that write sample data or reuse unrelated tables.

The highest-priority defects are:

1. Appwrite Auth/Database/Storage compatibility paths and SDK dependencies remain although production is Supabase-only.
2. Super-admin and module state are partly derived in the browser instead of exclusively from persisted server-authorized state.
3. Live Supabase migration history was ahead of source control by two migrations.
4. Several integration cards simulate successful connection/disconnection.
5. Generic industry pages create sample prerequisites and write to unrelated tables.
6. Contact deletion is a non-atomic browser-side cascade.
7. Dashboard cards contain hard-coded zeroes and a fabricated non-zero pipeline fallback.
8. Several visible links resolve to missing or misleading routes/settings sections.

## Architecture inventory

### Application routes

Dashboard route families audited:

`admin`, `admissions`, `agents`, `appointments`, `automations`, `billing`, `bookings`, `broadcasts`, `classes`, `contacts`, `courses`, `customers`, `dashboard`, `departments`, `doctors`, `follow-ups`, `inbox`, `integrations`, `invoices`, `knowledge-base`, `lab-reports`, `leads`, `members`, `memberships`, `orders`, `packages`, `patients`, `pipelines`, `properties`, `quotations`, `reservations`, `services`, `settings`, `site-visits`, `staff`, `students`, `tables`, `tasks`, `teachers`, and `trainers`.

Public/auth routes audited:

`/`, `/contact`, `/privacy`, `/terms`, `/refund`, `/login`, `/signup`, `/forgot-password`, and `/join/[token]`.

API route families audited:

`account`, `admin`, `ai`, `appointments`, `auth`, `automations`, `billing`, `broadcasts`, `campaigns`, `contacts`, `cron`, `customers`, `dashboard`, `deals`, `departments`, `doctors`, `flows`, `followups`, `health`, `inbox`, `invitations`, `invoices`, `lab-reports`, `leads`, `notifications`, `patients`, `pipelines`, `plans`, `quotations`, `saved-filters`, `search`, `settings`, `tasks`, `upload`, `voice`, `webhooks`, and `whatsapp`.

### Tenant and authorization model

- Canonical membership: `account_members` plus account/profile compatibility lookups.
- Canonical tenant key: `account_id`.
- Roles: viewer/member-equivalent, agent, admin, owner, plus persisted `profiles.is_super_admin` for platform administration.
- Route handlers must derive account and role from the authenticated Supabase user. Browser account IDs are never authorization evidence.
- Service-role access is server-only.

## Feature-parity matrix

| Area / visible surface | UI-to-code path | Supabase objects / provider | Required scope | Status | Confirmed gap / action |
|---|---|---|---|---|---|
| Login | `/login` → `/api/auth/login` | Supabase Auth | Public, rate limited | Partially implemented | API is real; UI retained obsolete Appwrite secret storage guard and did not submit remember-browser preference. |
| Signup | `/signup` → `/api/auth/signup` | Auth, accounts, profiles, account_members, tenant_modules | Public, rate limited | Partially implemented | Real creation flow; post-signup synchronization swallows failures and UI retained obsolete Appwrite secret storage guard. |
| Logout/session restore | Auth provider → `/api/auth/me`, `/api/auth/logout` | Supabase Auth | Authenticated user | Partially implemented | Client previously fell back to Appwrite and cleared UI state even when logout failed. |
| Password reset | `/forgot-password` → auth reset API | Supabase Auth | Public, rate limited | Fully implemented | Verify deployment redirect URL and email configuration in staging. |
| Invitations | `/join/[token]`, invitation APIs | account_invitations, account_members | Token + authenticated user | Partially implemented | Validate replay, expiry, target-email, and cross-tenant test coverage. |
| User/profile settings | Settings profile → account profile/avatar APIs | profiles, accounts, Supabase Storage | Authenticated member | Partially implemented | Service-role write is server-side; validate upload MIME/size and tenant path ownership. |
| Roles/modules | Members/settings → account APIs | account_members, tenant_modules | Admin/owner | Partially implemented | Browser previously used hard-coded enabled modules; now changed to fail-closed server data. |
| Platform admin | `/admin/*` | accounts, profiles, plans, platform_payments, usage_tracking, system_settings | Persisted super admin | Partially implemented | Email-derived client/server shortcuts were present; must rely only on persisted role. |
| Global sidebar | Dashboard shell/sidebar | Route links + module/role state | Tenant + role | Partially implemented | Several entries point to missing/misleading destinations; module state was hard-coded. |
| Global header usage | Header | dashboard/usage APIs | Tenant | UI-only | WhatsApp, Calling, Offer, Total and Low status are fixed; Refresh has no handler. |
| Quick Create | Header menu | List routes | Tenant + mutation role | Broken | Most actions navigate to lists instead of opening/starting the named creation workflow. |
| Dashboard metrics | Dashboard dispatcher/client → metrics API | CRM, messaging, appointment and billing aggregates | Tenant | Partially implemented | Hard-coded stage/source values and `totalPipeline || 1` fabricate results. |
| Dashboard follow-ups | Dashboard card | follow-up/task data | Tenant | UI-only | Static empty state rather than current tenant data. |
| Contacts CRUD | `/contacts`, contact APIs and browser queries | contacts, tags, custom fields/values, notes, channels | Tenant, agent+ mutations | Partially implemented | Core CRUD exists; delete/bulk delete are non-transactional browser cascades. |
| Contact search/filter | Contacts page | contacts and related tables | Tenant | Partially implemented | Smart filters run over loaded page rather than complete filtered dataset. |
| Contact CSV import/export | Contacts page/APIs | contacts | Tenant, agent+ | Partially implemented | Export reports success on navigation without validating generated file; import validation needs full error reporting. |
| Leads/pipelines/deals | Leads/pipelines pages and APIs | leads, pipelines, pipeline_stages, deals, activities, notes | Tenant, agent+ | Partially implemented | Main CRUD exists; validate stage changes, pagination, idempotency and audit coverage. |
| Patients/privacy | Patients APIs/pages | patients, consent tables | Tenant, clinical roles | Partially implemented | Verify export, withdrawal, consent and retention paths end to end. |
| Conversations/inbox | `/inbox` and inbox APIs | conversations, messages, reactions, channels | Tenant, messaging role | Partially implemented | Retry, attachment storage, assignment and delivery-state paths need provider-failure coverage. |
| WhatsApp configuration | Settings/integrations and WhatsApp APIs | whatsapp_config, templates, provider events | Admin/owner | Requires external credentials | Must fail with actionable configuration errors when Meta settings are absent. |
| WhatsApp broadcasts | `/broadcasts/*` and APIs | broadcasts, recipients, outbox/provider events | Tenant, agent+ | Partially implemented | Live migration adds paused state; verify resume, delivery logs, retry and idempotency. |
| Appointments | `/appointments` and APIs | appointments, patients/contacts, integrations | Tenant, clinical roles | Partially implemented | Creation is real; confirmation is fire-and-forget and UI may report WhatsApp success after failure. |
| Follow-ups/tasks | `/follow-ups`, `/tasks`, APIs | tasks/follow-up jobs | Tenant, agent+ | Partially implemented | CRUD exists; `/tasks` duplicates follow-ups and outbound target state is disconnected. |
| Billing/invoices | Billing pages/APIs | invoices, items, payments, plans, usage | Tenant, billing role | Partially implemented | New bill form exposes status but POST forces `unpaid`; payment/webhook behavior must never be simulated. |
| Quotations | Quotations pages/APIs/RPC | quotations, items, conversion RPC | Tenant, agent+ | Partially implemented | Atomic conversion RPC exists; validate duplicate and cross-tenant paths. |
| Automations | `/automations`, child routes and APIs | automations, steps, logs, pending executions | Tenant, agent+/admin activation | Partially implemented | Finish new/edit/run-history routes and scheduler/idempotency verification. |
| Flows | Flow components/APIs | flows, nodes, runs, run events | Tenant, agent+ | Partially implemented | Validate node persistence, execution error display and retry semantics. |
| AI settings | Settings AI | accounts AI fields | Admin/owner | Partially implemented | Live-only migration was recovered; validate that execution pipeline reads master switch/style/handoff fields. |
| Integrations catalog | `/integrations` | clinic_integrations/provider-specific APIs | Tenant, admin | Broken | Instagram and Messenger use timers/local state; Webhooks card is always active; Lead Ads reuses Messenger. |
| Lead forms | Integrations card | lead_forms, form_submissions | Tenant; public token submission | Partially implemented | UI showed a hard-coded form/embed/preview despite live tables; connect to live forms and secure public submission. |
| Calendly | Settings/integration APIs | calendly_connections, event types | Tenant, admin | Requires external credentials | Verify OAuth credentials, encrypted storage, revoke and webhook validation. |
| Voice | Settings/integrations/voice APIs | provider config/events | Tenant, admin | Requires external credentials | ElevenLabs/Sarvam/xAI credentials and signed webhooks required; no simulated success. |
| Notifications/reminders | Header/settings/APIs/jobs | notifications, reminder/follow-up jobs | Tenant | Partially implemented | Verify unread state, delivery, retries, idempotency and accessible errors. |
| Knowledge base | `/knowledge-base`, settings KB/API | knowledge base objects | Tenant, agent+ | Partially implemented | Validate upload/parser failure paths and tenant isolation. |
| Generic industry entities | admissions, agents, bookings, classes, courses, customers, members, memberships, orders, packages, properties, reservations, services, site visits, staff, students, tables, teachers, trainers | Multiple industry tables | Tenant, role | Broken | Generic page maps entities to unrelated tables, generates random IDs/dummy phones, and creates sample prerequisites. Must use canonical APIs/tables without fake data. |
| Doctors/departments/labs | Clinical pages/APIs | hospital_doctors, departments, lab reports | Tenant, clinical role | Partially implemented | Confirm CRUD, upload, patient linkage and privacy behavior. |
| Dead destinations | `/forms`, `/templates`, `/api-docs`, `/chatbot`, `/faq-bot`, `/ai-assistant`, billing subroutes, `/campaigns` | None or mismatched page | Varies | Broken | Implement the expected existing surface or route the action to the correct existing surface without changing labels. |
| Accessibility | Existing components | N/A | All users | Partially implemented | Verify names for icon buttons, modal focus, announced errors/loading and input error linkage. |

## Live schema and migration reconciliation

Production migration history contained two versions missing from source control:

- `20260822160000_automation_ai_module`
- `20260823120000_marketing_module`

The exact statement arrays were recovered from `supabase_migrations.schema_migrations` and committed as historical migrations. They are already applied in production and were **not** reapplied.

No new production DDL is proposed until code-to-schema usage is fully reconciled. Candidate future migrations, only after tests and review:

1. An atomic tenant-scoped contact deletion RPC with explicit child-table handling, authorization, and audit event.
2. Constraints/indexes justified by the final filtered contact and job-claim query patterns.
3. Canonicalization only where overlapping `real_estate_*` and `realestate_*` usage is proven; no destructive rename/drop.

## Credential-gated features

- Meta/WhatsApp: app ID, app secret, embedded-signup config ID, verify token, encrypted access token.
- Voice providers: ElevenLabs, Sarvam and/or xAI API credentials, agent/phone identifiers, webhook secrets.
- Calendly: OAuth client configuration and webhook secret.
- Redis: durable rate limiting/job coordination if production topology requires it.
- Payment provider: verified credentials and webhook secret for any live upgrade/payment action.

Missing configuration must produce an actionable existing-style error. It must never set a connected state or return success.

## Product-decision blockers

- Whether billing currency labels should remain USD or align with existing INR surfaces. Labels cannot change without approval.
- Whether `/tasks` is intentionally an alias for follow-ups or requires a distinct task surface.
- Which canonical table family owns overlapping real-estate entities.
- Exact intended destination/behavior for the visible Calls, Campaign Reports and Broadcast Logs labels.
- Whether product-facing API documentation belongs inside the current settings security surface or at `/api-docs`.

## Security and regression risks

- Service-role clients can bypass RLS; every server operation must derive and filter the account before use.
- Converting client cascades to RPCs changes failure semantics and requires transaction/idempotency tests.
- Removing Appwrite compatibility may expose previously hidden imports; CI must include a prohibited-import/runtime scan.
- Provider retries can duplicate outbound messages/payments unless idempotency keys are enforced.
- Public forms/webhooks require strict validation, rate limiting, signature/token verification, and minimal error disclosure.
- Module/role fail-closed behavior can hide UI when configuration rows are absent; onboarding must create canonical rows atomically.
- Migration history reconciliation files must not be reapplied to production blindly.

## Verification checklist

Before review-ready status:

- formatting, lint, TypeScript, unit and integration tests;
- tenant-isolation and authorization tests across viewer, agent, admin, owner, super admin and another tenant;
- migration validation without production mutation;
- production build and Playwright critical paths;
- secret scan and prohibited Appwrite SDK/runtime import scan;
- desktop/mobile visual comparison and keyboard/focus verification;
- Appwrite Sites deployment check with no Appwrite Database/Auth/Storage runtime dependency.
