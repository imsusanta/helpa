# Helpa Comprehensive Test Plan

**Document Version:** 1.0.0  
**Test Runners:** Vitest (Unit & Integration) + Playwright (End-to-End Browser Automation)  

---

## 1. Test Architecture Overview

```
src/
 ├── tests/
 │    └── security/
 │         ├── webhook-security.test.ts   (HMAC fail-closed, tampered signature rejection)
 │         ├── tenant-isolation.test.ts   (Cross-tenant isolation, role permission matrix)
 │         └── signed-urls.test.ts        (Signed OPD token verification & expiry)
 └── lib/
      ├── automations/engine.test.ts      (Tenant isolation in automation dispatch)
      ├── auth/invitations.test.ts        (Invitation redemption & expiry)
      ├── auth/roles.test.ts              (Role hierarchy: owner > admin > agent > viewer)
      ├── contacts/dedupe.test.ts         (Contact phone normalization & deduplication)
      ├── whatsapp/webhook-signature.test.ts (Constant-time HMAC comparison)
      └── whatsapp/encryption.test.ts     (AES-256-GCM token encryption & decryption)

e2e/
 ├── auth-and-invites.spec.ts             (Signup, login, team invitations, role gating)
 └── clinical-workflows.spec.ts           (Patient registration, appointment booking, OPD tickets)
```

---

## 2. Unit & Integration Test Suites (448 Tests Passed)

| Test Suite | File Path | Focus & Assertions |
|---|---|---|
| **Webhook Signature Verification** | `src/lib/whatsapp/webhook-signature.test.ts` | Missing secret rejection (fail-closed), tampered body rejection, invalid signature rejection. |
| **Multi-Tenant Boundary Isolation** | `src/tests/security/tenant-isolation.test.ts` | Account A cannot read/mutate Account B records; Viewer cannot perform write operations. |
| **Signed OPD PDF Tokens** | `src/tests/security/signed-urls.test.ts` | Valid signature accepted, expired token rejected, tampered resource ID rejected. |
| **Role-Based Access Control** | `src/lib/auth/roles.test.ts` | `hasMinRole` hierarchy enforcement across `viewer`, `agent`, `admin`, `owner`. |
| **Token Cryptography** | `src/lib/whatsapp/encryption.test.ts` | AES-256-GCM encryption, corrupted ciphertext rejection, IV uniqueness. |
| **Phone Number Normalization** | `src/lib/whatsapp/phone-utils.test.ts` | E.164 normalization, Indian standard formatting (`+91`), local prefixes. |

---

## 3. End-to-End (E2E) Critical Path Matrix

1. **E2E-01**: Clinic Signup and Account Creation.
2. **E2E-02**: Team Member Invitation & Role Gating Verification.
3. **E2E-03**: Inbound WhatsApp Webhook Ingestion & Idempotency.
4. **E2E-04**: Doctor & OPD Department Setup.
5. **E2E-05**: Live Patient Appointment Booking & Digital Ticket Generation.
6. **E2E-06**: Pathology Lab Report Upload & Automated WhatsApp Dispatch.
7. **E2E-07**: Unauthenticated Access Redirection to `/login`.
8. **E2E-08**: Cross-Account Direct URL Access Prevention (404/403).
