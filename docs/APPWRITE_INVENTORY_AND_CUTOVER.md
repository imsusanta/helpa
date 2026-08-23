# Appwrite Inventory, Cutover Verification & Deprecation Plan

**Status:** `IN ROLLBACK-SAFETY WINDOW` (Supabase is canonical primary; legacy Appwrite compatibility facades remain isolated in rollback mode pending human cutover sign-off)  
**Related Issue:** #82  
**Target Cutover:** Irreversible Appwrite removal upon independent human confirmation of all 10 cutover gates.

---

## 1. Complete Inventory of Appwrite Assets & References

### A. NPM Dependencies (`package.json`)
- `appwrite: "^26.2.0"` (Client SDK)
- `node-appwrite: "^28.0.0"` (Server SDK)

### B. Compatibility Facades & Runtime Wrappers
- `src/lib/appwrite-compat.ts` (Client wrapper redirecting queries to Supabase client)
- `src/lib/appwrite-server-compat.ts` (Server wrapper redirecting queries to Supabase admin client)
- `src/infrastructure/appwrite/config.ts` (Legacy Appwrite project endpoint & key resolution)
- `src/infrastructure/appwrite/storage-manifest.ts` (Legacy bucket schema definitions)

### C. Infrastructure Scripts
- `scripts/setup-appwrite-db.ts`
- `scripts/verify-appwrite-db.ts`
- `scripts/verify-appwrite-storage.ts`
- `scripts/migrate-whatsapp-schema.ts`

### D. Security Headers & CSP (`next.config.ts`)
- `img-src`: `https://*.appwrite.io https://*.appwrite.network`
- `media-src`: `https://*.appwrite.io https://*.appwrite.network`
- `connect-src`: `https://*.appwrite.io https://*.appwrite.network wss://*.appwrite.network`

### E. Client Storage / Cookies
- `src/app/(auth)/login/page.tsx`: Legacy fallback check `localStorage.setItem('appwrite_session', ...)`
- `src/app/(auth)/signup/page.tsx`: Legacy fallback check `localStorage.setItem('appwrite_session', ...)`

### F. Tests & Test Mocks
- `src/tests/appwrite/compat-security-audit.test.ts`
- `src/tests/appwrite/compat-security.test.ts`
- `src/tests/appwrite/repositories.test.ts`
- `src/tests/integration/appwrite-isolation.integration.test.ts`
- `src/tests/security/appwrite-security-unit.test.ts`

---

## 2. Mandatory Cutover Gates Checklist

Before the final removal PR is executed, every gate must have verifiable proof:

| Gate # | Cutover Gate | Required Proof | Verification Status |
|:---:|---|---|:---:|
| **1** | **Supabase Auth Parity** | Email/password sign-up, sign-in, session restore, password reset operating 100% on Supabase Auth. | ✅ Verified (`src/tests/onboarding-client.test.ts`) |
| **2** | **Role & Module Parity** | `account_members` and `tenant_modules` resolved from PostgreSQL with fail-closed permissions. | ✅ Verified (`src/tests/super-admin.test.ts`) |
| **3** | **Data Integrity** | Accounts, profiles, contacts, conversations, and appointments schemas verified on Supabase. | ✅ Verified (`npm run supabase:validate`) |
| **4** | **Cross-Tenant Authorization** | Automated cross-tenant query and mutation rejection verified. | ✅ Verified (`src/tests/tenant-isolation.test.ts`) |
| **5** | **Session Lifecycle** | Remember-browser enabled/disabled, logout server revocation verified. | ✅ Verified (`e2e/security-and-session.spec.ts`) |
| **6** | **WhatsApp Webhook & Outbox** | Inbound webhook signature verification and async outbox queue processing on PostgreSQL. | ✅ Verified (`src/tests/security/webhook-security.test.ts`) |
| **7** | **Storage & Document Signing** | OPD slips and lab reports signed with HMAC tokens and served from Supabase / Node runtime. | ✅ Verified (`src/tests/security/signed-urls.test.ts`) |
| **8** | **Backup & PITR Restore** | Verification of Supabase point-in-time recovery and snapshot restoration. | ⏳ Pending human operational drill |
| **9** | **Rollback Window Sign-Off** | Formal confirmation that no active tenants rely on Appwrite fallback. | ⏳ Pending human approval |
| **10** | **Irreversible Cutover Approval** | Explicit operator confirmation to execute final dependency removal. | ⏳ Pending human confirmation |

---

## 3. Post-Approval Removal Execution Plan

Upon human confirmation of Gates 8–10, a single atomic PR will execute:
1. `npm uninstall appwrite node-appwrite`
2. Remove `src/lib/appwrite-compat.ts` and `src/lib/appwrite-server-compat.ts` (replace remaining import references directly with `@/lib/supabase/client` and `@/lib/supabase/server`).
3. Remove `src/infrastructure/appwrite/` directory.
4. Remove legacy scripts: `scripts/setup-appwrite-db.ts`, `scripts/verify-appwrite-*.ts`.
5. Remove `https://*.appwrite.io` and `https://*.appwrite.network` CSP allowances from `next.config.ts`.
6. Remove obsolete Appwrite test files and update documentation.
7. Run complete quality validation: `npm ci && npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build && npm run test:e2e`.
