# Helpa Test Plan

**Runners:** Vitest (unit and integration) · Playwright (end-to-end)

---

## 1. Commands

```bash
npm run lint             # ESLint, zero warnings allowed
npm run typecheck        # tsc --noEmit, strict mode
npm run format:check     # Prettier verification
npm test                 # Vitest unit and module suites
npm run test:integration # Tenant isolation and security suites
npm run test:e2e         # Playwright end-to-end specs
```

---

## 2. Test topology

```
src/
 ├── tests/
 │    ├── security/
 │    │    ├── webhook-security.test.ts        (HMAC fail-closed, tampered signature)
 │    │    ├── tenant-isolation.test.ts        (cross-tenant reads, role matrix)
 │    │    ├── signed-urls.test.ts             (signed OPD token verification, expiry)
 │    │    └── cache-control-headers.test.ts   (no-store on private routes)
 │    ├── ai/                                  (safety evaluation, tool calling)
 │    ├── health-module.test.ts                (clinical workflows)
 │    ├── coaching-module.test.ts
 │    ├── tutor-module.test.ts
 │    ├── salon-module.test.ts
 │    ├── real-estate-module.test.ts
 │    ├── core-whatsapp.test.ts
 │    ├── core-ai.test.ts
 │    ├── core-billing.test.ts
 │    └── super-admin.test.ts
 └── lib/
      ├── automations/engine.test.ts           (tenant isolation in dispatch)
      ├── auth/invitations.test.ts             (redemption and expiry)
      ├── auth/roles.test.ts                   (owner > admin > staff > viewer)
      ├── contacts/dedupe.test.ts              (phone normalization, dedupe)
      ├── whatsapp/webhook-signature.test.ts   (constant-time HMAC compare)
      └── whatsapp/encryption.test.ts          (AES-256-GCM round trip)

e2e/
 ├── auth-and-invites.spec.ts                  (signup, login, invites, role gating)
 ├── clinical-workflows.spec.ts                (patient registration → OPD ticket)
 └── security-headers-server.spec.ts           (server-level header assertions)
```

---

## 3. Security-critical assertions

| Suite | Assertions |
| --- | --- |
| Webhook signature | Missing secret rejected (fail-closed); tampered body rejected; invalid signature rejected |
| Tenant isolation | Account A cannot read or mutate Account B records; `viewer` cannot write |
| Signed PDF tokens | Valid signature accepted; expired token rejected; tampered resource ID rejected |
| RBAC | `hasMinRole` hierarchy enforced across `viewer`, `staff`, `admin`, `owner` |
| Token cryptography | AES-256-GCM round trip, corrupted ciphertext rejected, IV uniqueness |
| Phone normalization | E.164 normalization, `+91` handling, local prefix variants |
| Cache headers | `private, no-store` present on every authenticated response |

---

## 4. End-to-end critical paths

| ID | Scenario |
| --- | --- |
| E2E-01 | Signup and account creation |
| E2E-02 | Team invitation and role gating |
| E2E-03 | Inbound webhook ingestion and idempotency |
| E2E-04 | Doctor and department setup |
| E2E-05 | Appointment booking and signed ticket generation |
| E2E-06 | Lab report upload and automated WhatsApp dispatch |
| E2E-07 | Unauthenticated access redirects to `/login` |
| E2E-08 | Cross-account direct URL access denied (403/404) |

---

## 5. Merge requirements

A change may merge only when lint, typecheck, format check, unit tests,
integration tests, and the production build all pass. CI enforces these gates
in `.github/workflows/ci.yml`; security-relevant changes should also add or
update a suite in `src/tests/security/`.
