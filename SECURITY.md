# Security Policy and Architecture

Helpa is a multi-tenant SaaS application. This document summarizes its intended security boundaries and explains how to report vulnerabilities. It is not a certification or an independent security assessment.

## Tenant isolation

- The server derives workspace and account context from the authenticated session.
- Client-supplied tenant identifiers are not trusted as authorization decisions.
- Supabase Row Level Security and server-side ownership checks are defense-in-depth controls.
- Cross-tenant access attempts should fail closed and be recorded as security events.

## Authentication and authorization

- Supabase is the canonical authentication and database provider.
- Workspace roles follow `owner > admin > staff > viewer`.
- Platform administration requires a persisted, server-verified `profiles.is_super_admin` value.
- Email addresses, client flags, and request parameters must never independently grant administrator access.

## Cryptography and secrets

- Provider tokens and sensitive credentials are encrypted with AES-256-GCM before persistence.
- Production encryption keys and service credentials must be stored as secret environment variables and rotated after suspected exposure.
- Secrets, access tokens, passwords, and sensitive patient identifiers must be removed or redacted from logs and API responses.

## Webhook and abuse protection

- Webhook requests must be authenticated using the provider's documented signature scheme before processing.
- Idempotency keys prevent duplicate external events, payments, and outbound messages.
- Sensitive endpoints use rate limiting and fail-closed authorization.

## Compliance statement

Helpa contains technical safeguards that may support privacy and healthcare-security programs. Deploying Helpa does not by itself provide HIPAA, DPDP, or other legal certification. Operators remain responsible for contracts, hosting controls, retention policies, incident response, audits, and applicable legal requirements.

## Reporting a vulnerability

Do not report vulnerabilities in public issues. Use:

- [GitHub Private Vulnerability Reporting](https://github.com/imsusanta/helpa/security/advisories/new)
- Email: `susantalohr@gmail.com` with `[Helpa security]` in the subject

Do not include real customer or patient data in reports. See [`.github/SECURITY.md`](.github/SECURITY.md) for scope, response targets, and safe-harbor terms.
