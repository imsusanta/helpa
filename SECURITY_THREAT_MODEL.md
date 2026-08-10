# Helpa Security Threat Model

**Product:** Helpa — WhatsApp AI Receptionist & Patient Engagement CRM  
**Target Architecture:** Next.js 16, Appwrite PostgreSQL with RLS, Meta WhatsApp Cloud API

---

## 🔒 Threat Model Matrix

| Asset                                                  | Threat Scenario                                                                      | Existing Mitigation                                                                                                                          | Verification Evidence                                                                                   | Residual Risk                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Patient Protected Health Information (PHI)**         | Unauthorized cross-tenant data leakage via direct ID queries.                        | PostgreSQL Row Level Security (RLS) policies enforcing `account_id = auth.jwt() -> account_id` + server-side `.eq('account_id', accountId)`. | `src/tests/security/tenant-isolation.test.ts` (Section 2 & 4).                                          | Admin/Service-role key exposure bypassing RLS (mitigated via `server-only` imports).       |
| **Inbound Webhook Endpoint (`/api/whatsapp/webhook`)** | Malicious webhook forgery, replay attacks, or unauthorized data injection.           | HMAC-SHA256 constant-time signature verification (`verifyMetaWebhookSignature`) with `META_APP_SECRET`. Fails closed.                        | `src/tests/security/webhook-security.test.ts` and Playwright E2E `e2e/security-headers-server.spec.ts`. | Out-of-order Meta event delivery (handled via event timestamps).                           |
| **Meta Cloud API & AI API Credentials**                | Plaintext database leak revealing Meta bearer tokens or OpenRouter keys.             | AES-256-GCM authenticated encryption in `src/lib/whatsapp/encryption.ts` using `ENCRYPTION_KEY`.                                             | `src/lib/whatsapp/encryption.test.ts` (15 unit tests).                                                  | Environment variable compromise on host server.                                            |
| **Digital OPD Tickets & PDF Downloads**                | Public enumeration or unauthorized downloading of patient consultation slips.        | Short-lived HMAC-signed tokens (`generatePdfToken` / `verifyPdfToken`) bound to `appointmentId` and `accountId`.                             | `src/lib/pdf-signing.test.ts` and `e2e/security-headers-server.spec.ts`.                                | Patient forwarding PDF URL to unintended third party before token expiry.                  |
| **AI Receptionist Copilot**                            | Prompt injection, unauthorized medical diagnosis, or patient prompt manipulation.    | Strict non-diagnostic system prompt guardrails, emergency keyword detection, and structured JSON parsing.                                    | `src/tests/ai/ai-safety-eval.test.ts` (Evaluation Suite).                                               | Novel, complex adversarial prompt injections (mitigated via human doctor takeover button). |
| **Production Telemetry & Application Logs**            | Patient names, phone numbers, or passwords written to stdout or third-party loggers. | Structured JSON logger in `src/lib/observability/logger.ts` with automatic recursive PII/PHI scrubbing.                                      | `src/lib/observability/logger.test.ts` (5 tests).                                                       | Custom `console.log` invocations bypassing the central logger (checked via ESLint).        |
| **Browser Cache & Edge CDN Proxies**                   | Caching sensitive patient records or dashboard views in shared edge/browser caches.  | `Cache-Control: private, no-store, no-cache, must-revalidate` set across all API routes and authenticated page matchers.                     | `src/tests/security/cache-control-headers.test.ts` & Playwright server-level headers test.              | Misconfigured downstream reverse proxy ignoring HTTP headers.                              |

---

## 🛠 Manual Infrastructure Verification Checklist

- [ ] Verify Appwrite Automated Daily Backups and 30-day Point-in-Time Recovery (PITR) in Appwrite Dashboard -> Database -> Backups.
- [ ] Verify SSL/TLS Certificate Termination and HSTS Preloading on production CDN domain.
- [ ] Conduct 3-5 clinic receptionist user onboarding walkthroughs.
- [ ] Perform annual third-party external penetration testing before storing live production clinical records.
