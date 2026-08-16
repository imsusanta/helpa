# Security Policy & Multi-Tenant Security Architecture

## Helpa by Helpa Studio

This document outlines the security controls, tenant isolation architecture, cryptographic safeguards, and vulnerability reporting procedures for Helpa.

---

## 1. Multi-Tenant Isolation Model

Tenant isolation is the primary architectural invariant of Helpa:

```
TENANT A (Workspace A)  ─►  ONLY ACCESSIBLE BY AUTHENTICATED USERS OF WORKSPACE A
TENANT B (Workspace B)  ─►  ONLY ACCESSIBLE BY AUTHENTICATED USERS OF WORKSPACE B
SUPER ADMIN             ─►  PLATFORM-LEVEL GOVERNANCE (Server-Side Authorization Required)
```

- **Server-Side Enforcement**: The client frontend is never trusted for workspace, role, or resource ownership. All queries filter strictly by the session's authenticated `account_id`.
- **IDOR Protection**: Insecure Direct Object Reference (IDOR) attacks are blocked via mandatory `assertTenantOwnership` checks. Access attempts to foreign resources return `403 Forbidden` and log high-severity security incidents.
- **Cross-Industry Isolation**: Workspaces are bounded by industry modules (_Health, Coaching, Solo Tutor, Salon, Real Estate_). A Health workspace cannot execute Salon or Real Estate operations.

---

## 2. Authentication & Server-Side Authorization (RBAC)

- **Role Hierarchy**: `owner` > `admin` > `staff` > `viewer`.
- **Super Admin**: Platform administration (`/admin`) is restricted server-side to `susantalohr@gmail.com` and verified `is_super_admin` profiles. Normal workspace users attempting access are denied with `403 Forbidden`.
- **Session Security**: Authenticated sessions utilize secure, HttpOnly, SameSite cookies with HTTPS enforcement.

---

## 3. Cryptography & Secret Management

- **Credentials at Rest**: WhatsApp access tokens and third-party secrets are encrypted with **AES-256-GCM** using a 256-bit encryption key (`ENCRYPTION_KEY`). GCM ensures ciphertext authenticity and integrity with a 16-byte authentication tag (`<iv-hex>:<ciphertext-hex>:<authTag-hex>`).
- **Zero Credential Leakage**:
  - API responses strip tokens, secrets, and raw keys.
  - Logs sanitize metadata and redact credentials, passwords, and sensitive identifiers.
  - Phone numbers are masked in logs (e.g. `+91******1234`).

---

## 4. Webhook Security & Idempotency

- **Meta / WhatsApp Webhooks**: Validated using SHA-256 HMAC signatures (`X-Hub-Signature-256`) against `WHATSAPP_APP_SECRET`.
- **Payment Webhooks**: Verified cryptographically with provider secrets.
- **Idempotency**: External event IDs are tracked to prevent duplicate message ingestion, duplicate payments, or repeated automation triggers.

---

## 5. Rate Limiting & Abuse Prevention

Sliding-window rate limiters are applied to sensitive endpoints:

- **Authentication**: 5 requests/min per IP.
- **AI Inference**: 60 requests/min per workspace with plan quota enforcement.
- **WhatsApp Dispatch**: 100 requests/min per workspace.
- **Webhooks**: 300 requests/min.
- **Admin APIs**: 120 requests/min.

---

## 6. Regulatory Compliance Disclaimer

> [!IMPORTANT]
> **Compliance & Legal Readiness Disclaimer**:
> Helpa includes foundational technical safeguards designed to support compliance with healthcare and data protection standards (e.g., India Digital Personal Data Protection Act (DPDP), HIPAA technical safeguards for access controls, encryption, and audit trails). However, software alone does not constitute certified legal compliance. Healthcare organizations and covered entities must execute appropriate Business Associate Agreements (BAAs), host on certified infrastructure, and complete organizational data governance audits.

---

## 7. Reporting a Vulnerability

If you discover a security vulnerability, please report it directly to:

**Susanta Lohar (Platform Owner)**  
Email: `susantalohr@gmail.com`

Please include:

1. Description of the vulnerability and potential impact.
2. Step-by-step reproduction instructions or proof-of-concept.
3. Relevant request headers/traces (without including real customer data).
