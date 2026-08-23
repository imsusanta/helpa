# External Security Review & Independent Verification Status

**Date:** 2026-08-23  
**Status:** `BLOCKED BY EXTERNAL ASSESSOR` (Internal hardening complete; awaiting independent third-party audit and formal retest sign-off)  
**Related Issue:** #81  
**Handover Package:** [`docs/EXTERNAL_SECURITY_REVIEW_PACKAGE.md`](./EXTERNAL_SECURITY_REVIEW_PACKAGE.md)

---

## 1. Executive Summary

Internal security engineering has resolved all identified database security advisor warnings, function search path vulnerabilities, view invoker privileges, tenant isolation boundaries, and AI guardrail requirements. 

However, in accordance with our strict evidence-based policy, **internal remediation and self-authored test suites do not constitute independent third-party proof**. Full compliance and formal rating require an accredited external security firm to perform a black-box/white-box audit and sign off on the retest.

---

## 2. Independent Assessor Requirements (Pending External Sign-Off)

| Field | Required Proof | Status |
|---|---|:---:|
| **Assessor / Firm Name** | Accredited cybersecurity firm (e.g. CREST, OSCP certified team) | ⏳ Pending engagement |
| **Healthcare Experience** | Demonstrable SaaS & healthcare compliance audit history | ⏳ Pending engagement |
| **Engagement Scope** | Signed assessment scope covering Next.js, Supabase RLS, WhatsApp API, AI guardrails | ⏳ Pending engagement |
| **Testing Methodology** | Dual-track: White-box code review + Black-box penetration testing | ⏳ Pending engagement |
| **Retest & Letter of Attestation** | Dated report confirming zero High / Critical vulnerabilities | ⏳ Pending engagement |

---

## 3. Internal Engineering Hardening Summary

The following internal fixes are implemented and verified in source control:

1. **Security Definer Views**:
   - `public.account_members` and `public.whatsapp_configs` set to `WITH (security_invoker = true)`.
2. **Function Search Path Mutable**:
   - Explicit `SET search_path = public, pg_temp` enforced on all functions across schema `public`.
3. **Revocation of Public Function Execution**:
   - `anon` and `public` execute permissions revoked on all internal triggers and helper functions.
4. **Tenant Isolation & RLS Coverage**:
   - 100% of public tables enforce RLS with subquery initplan performance optimization.
5. **AI Safety Interception**:
   - Centralized emergency detection (`108`/`112` triage) and diagnostic refusal active before LLM invocation.

---

## 4. Next Steps to Unblock

1. Commission an independent third-party cybersecurity firm to execute the audit defined in [`EXTERNAL_SECURITY_REVIEW_PACKAGE.md`](./EXTERNAL_SECURITY_REVIEW_PACKAGE.md).
2. Attach the signed evaluation report and letter of attestation to this document.
3. Update issue #81 only after the external firm signs off on the final retest.
