# Independent Security Assessment — Assessor Handover Package

**Target Product:** Helpa (WhatsApp AI Receptionist & Patient CRM for Clinics)  
**Status:** `BLOCKED BY EXTERNAL ASSESSOR` (Awaiting engagement and formal retest by an accredited independent third-party security firm)  
**Repository:** `https://github.com/imsusanta/helpa`

---

## 1. Assessor Engagement & Qualifications Checklist

To complete this assessment, the external evaluator must provide:

- [ ] **Lead Assessor Name & Firm:** (e.g., CREST / OSCP / ISO 27001 accredited firm)
- [ ] **Healthcare & SaaS Expertise:** Summary of previous clinical data / Indian DPDP / HIPAA compliance audits.
- [ ] **Assessment Date & Signed Scope:** Formal engagement document with date bounds and testing windows.
- [ ] **Testing Methodology:** Combination of White-box code review, Black-box dynamic testing (DAST), and configuration audits.
- [ ] **Independent Findings & Retest Report:** Formal letterhead PDF confirming all High and Critical findings are remediated and verified.

---

## 2. Target Scope & Architecture Summary

| System Component | Technology Stack | Scope Details |
|---|---|---|
| **Web Frontend & API** | Next.js 16 (App Router), React 19, TypeScript | Session cookies, SSR Auth, role derivation, CSRF protection, Cache-Control. |
| **Database & Tenancy** | Supabase PostgreSQL 15 | Row Level Security (RLS) across 89 tables, tenant isolation via `account_id`, `security_invoker` views. |
| **Messaging Ingestion** | Meta WhatsApp Cloud API (v21.0) | HMAC-SHA256 signature verification, idempotency keys, rate limiting. |
| **AI Workflows** | OpenRouter / Gemini API | Pre-model safety guardrails, emergency `108`/`112` triage, non-diagnostic boundaries, prompt injection defense. |
| **Document Security** | jsPDF, Signed URLs | HMAC-SHA256 signed OPD tickets & lab reports with tamper-proof token expiration. |
| **Sensitive Data** | Cryptography (AES-256-GCM) | Encrypted storage for Meta App Secrets, WhatsApp tokens, and OAuth keys. |

---

## 3. Internal Security Controls & Verification Matrix

The following internal hardening controls have been implemented and verified via automated test suites. The assessor is requested to validate these implementations:

| # | Control Area | Implemented Mechanism | Code / Migration Reference | Automated Test Suite |
|:---:|---|---|---|---|
| **1** | **Tenant Isolation** | Strict PostgreSQL RLS on 100% of tables with subquery initplan caching. | `supabase/migrations/20260822123000_optimize_rls_performance.sql` | `src/tests/security/tenant-isolation.test.ts` |
| **2** | **Webhook Authenticity** | Fail-closed HMAC-SHA256 constant-time signature verification. | `src/lib/whatsapp/webhook-signature.ts` | `src/tests/security/webhook-security.test.ts` |
| **3** | **Role & Permissions** | Server-side role enforcement (Viewer, Agent, Admin, Owner, Super-Admin). | `src/lib/auth/admin.ts`, `src/lib/auth/rbac.ts` | `src/tests/super-admin.test.ts` |
| **4** | **AI Clinical Guardrails** | Automated emergency symptom detection and refusal of diagnostic advice. | `src/lib/ai/safety.ts` | `src/tests/ai/ai-safety-eval.test.ts` |
| **5** | **Cache & Leak Prevention** | `Cache-Control: private, no-store, no-cache, must-revalidate` on all 29+ private routes. | `next.config.ts` | `e2e/security-headers-server.spec.ts` |
| **6** | **Document Access** | HMAC-SHA256 token verification on OPD slips and lab reports. | `src/lib/pdf-signing.ts` | `src/tests/security/signed-urls.test.ts` |
| **7** | **Patient Privacy & DPDP** | Explicit consent status, one-click withdrawal, scrubbed PII export, and append-only `audit_logs`. | `supabase/migrations/049_patient_consent_and_audit.sql` | `src/tests/security/privacy-safety.test.ts` |
| **8** | **Outcome Privacy** | De-identified event logging with one-way SHA-256 subject hashing and attribute sanitization. | `src/lib/metrics/outcome-events.ts` | `src/tests/metrics/outcome-metrics.test.ts` |

---

## 4. Remediation Tracker & Verification Sign-Off

```text
================================================================================
 EXTERNAL AUDIT REMEDIATION TRACKER
================================================================================
 [SEC-01] Search Path Mutable Functions  : ✅ Remediated internally (Migration 20260822121500)
 [SEC-02] Security Definer Views        : ✅ Remediated internally (security_invoker = true)
 [SEC-03] Anon Execute Permissions      : ✅ Remediated internally (Revoked anon execute)
 [SEC-04] Cross-Tenant Body Tampering  : ✅ Remediated internally (Strict server-side account derivation)
 [SEC-05] Inbound Webhook Replay Storm  : ✅ Remediated internally (Idempotency ledger & deduplication)
 [SEC-06] Emergency AI Bypass           : ✅ Remediated internally (Pre-model regex & triage interception)
 [SEC-07] Third-Party Assessor Retest   : ⏳ AWAITING EXTERNAL FIRM SIGN-OFF
================================================================================
```

---

## 5. Contact & Staging Provisioning

To request staging access, credential bundles, and white-box source code access, contact:  
**Security Point of Contact:** Susanta Lohar (`susantalohar@gmail.com`)  
**Product Site:** `https://helpa.studio`
