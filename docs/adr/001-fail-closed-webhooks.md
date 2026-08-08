# ADR 001: Fail-Closed Webhook Verification and GCM Encryption Upgrade

## Status

Accepted and Enforced (2026-08)

## Context

Inbound WhatsApp messages and statuses arrive over public internet at `POST /api/whatsapp/webhook`. Under earlier architectures, signature warnings were logged without terminating the request, allowing unauthenticated payloads to invoke downstream background workers. Furthermore, Meta verify tokens were encrypted with legacy CBC cipher.

## Decision

1. **Unconditional Rejection**: All inbound `POST` requests without a valid HMAC-SHA256 `x-hub-signature-256` matching `process.env.META_APP_SECRET` are rejected immediately with `401 Unauthorized` (`{ error: 'Invalid webhook signature' }`).
2. **Byte-Accurate Signature Validation**: Body bytes are read as raw text before parsing JSON to prevent re-encoding signature mismatches.
3. **Opportunistic GCM Upgrade**: Verification tokens stored in legacy format are automatically upgraded to AES-256-GCM during subscription verification.

## Consequences

- **Positive**: Zero unauthenticated payloads reach database or AI handlers.
- **Positive**: Cryptographic tokens use authenticated encryption with tamper detection.
- **Negative**: Operators must ensure `META_APP_SECRET` is configured in production environment.
