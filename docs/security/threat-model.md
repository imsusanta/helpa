# Helpa Security Threat Model

**Product:** Helpa — AI business communication platform and CRM
**Architecture:** Next.js 16 · Supabase PostgreSQL with RLS · Meta WhatsApp Cloud API

---

## Threat matrix

| Asset | Threat scenario | Mitigation | Verification | Residual risk |
| --- | --- | --- | --- | --- |
| **Patient PHI** | Cross-tenant data leakage via direct ID queries | PostgreSQL RLS policies scoping `account_id` through `account_members`, plus explicit server-side `.eq('account_id', accountId)` | `src/tests/security/tenant-isolation.test.ts` | Service-role key exposure bypassing RLS (mitigated with `server-only` imports) |
| **Inbound webhook** (`/api/whatsapp/webhook`) | Webhook forgery, replay, unauthorized injection | Constant-time HMAC-SHA256 verification (`verifyMetaWebhookSignature`) against `WHATSAPP_APP_SECRET`; fails closed | `src/tests/security/webhook-security.test.ts`, `e2e/security-headers-server.spec.ts` | Out-of-order Meta delivery, handled via event timestamps |
| **Meta and AI credentials** | Plaintext database leak revealing bearer tokens or API keys | AES-256-GCM authenticated encryption in `src/lib/whatsapp/encryption.ts` using `ENCRYPTION_KEY` | `src/lib/whatsapp/encryption.test.ts` | Host-level environment variable compromise |
| **Signed OPD tickets & PDFs** | Enumeration or unauthorized download of consultation slips | Short-lived HMAC tokens (`generatePdfToken` / `verifyPdfToken`) bound to `appointmentId` and `accountId` | `src/lib/pdf-signing.test.ts` | Patient forwarding a valid URL before expiry |
| **AI receptionist** | Prompt injection, unauthorized medical advice, prompt manipulation | Non-diagnostic system prompt guardrails, emergency keyword detection, structured JSON parsing | `src/tests/ai/ai-safety-eval.test.ts` | Novel adversarial injections, mitigated by human takeover |
| **Telemetry and logs** | Patient names, phone numbers, or secrets written to stdout | Structured JSON logger with recursive PII/PHI scrubbing (`src/lib/observability/logger.ts`) | `src/lib/observability/logger.test.ts` | Ad-hoc `console.log` bypassing the logger, checked by ESLint |
| **Browser and CDN caches** | Sensitive dashboard views cached in shared edge caches | `Cache-Control: private, no-store, no-cache, must-revalidate` on API routes and authenticated matchers | `src/tests/security/cache-control-headers.test.ts` | Misconfigured downstream reverse proxy ignoring headers |

---

## Compliance status

Helpa implements technical safeguards commonly expected under the India DPDP
Act and the HIPAA Security Rule: encryption at rest and in transit, tenant
access control, audit logging, PHI redaction, and signed short-lived document
access.

These controls are **self-attested and not independently audited.** Deploying
Helpa does not by itself make an installation DPDP- or HIPAA-compliant. An
independent security assessment is tracked in
[#81](https://github.com/imsusanta/helpa/issues/81) and should be completed
before live patient records are stored.

---

## Manual infrastructure checklist

- [ ] Verify Supabase automated daily backups and point-in-time recovery
      retention in the Supabase dashboard.
- [ ] Verify TLS termination and HSTS preloading on the production domain.
- [ ] Confirm all required environment variables validate at boot and no
      secrets appear in logs.
- [ ] Run 3–5 receptionist onboarding walkthroughs to catch access-control
      usability gaps.
- [ ] Commission annual third-party penetration testing before storing live
      clinical records.
