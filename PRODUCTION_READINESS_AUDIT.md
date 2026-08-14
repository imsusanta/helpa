# Helpa Production Readiness Security & Architecture Audit

**Target System**: Helpa WhatsApp AI Receptionist & Patient Engagement CRM  
**Repository**: `https://github.com/imsusanta/helpa`  
**Production Host**: `https://www.helpa.studio`  
**Starting Baseline Commit SHA**: `f5493494ab6f8c396e5876bf3ae89633ea19b54e`  
**Branch**: `fix/p0-full-production-readiness`  
**Appwrite Endpoint**: `https://sgp.cloud.appwrite.io/v1`  
**Appwrite Project ID**: `6a79822b003adde92f63`  
**Appwrite Database ID**: `helpa_main`  
**Audit Date**: 2026-08-14  
**Initial Assessment**: **NO-GO**

---

## 1. Executive Summary

This audit evaluates Helpa against enterprise healthcare multi-tenancy, strict data isolation, zero-loss messaging reliability, and Appwrite backend architecture requirements.

---

## 2. Detailed Audit Findings

### [P0 - Critical] Finding 1: Unscoped Cross-Tenant Fallback Queries in Messaging Routes

- **Affected Files**:
  - `src/app/api/whatsapp/send/route.ts`
  - `src/app/api/whatsapp/webhook/route.ts`
- **Vulnerability / Exploit Scenario**:
  When resolving conversation IDs or querying WhatsApp configuration rows, fallback queries previously fetched documents without filtering strictly by `accountId` or scanned collections in memory. In a multi-tenant environment, a malicious tenant could potentially supply a `conversation_id` belonging to another clinic and trigger outbound dispatches or state mutations across tenant boundaries.
- **Remediation**:
  Enforce explicit `.eq('accountId', accountId)` on all `conversations`, `contacts`, `whatsapp_configs`, and `messages` queries. Add in-memory assertion verification `String(c.accountId) === String(accountId)`. Return `404 Not Found` / `ACCESS_DENIED` without leaking resource existence.

---

### [P0 - Critical] Finding 2: Inconsistent Schema Casing & Attribute Stripping

- **Affected Files**:
  - `scripts/setup-appwrite-db.ts`
  - `src/app/api/whatsapp/config/route.ts`
  - `src/app/api/whatsapp/webhook/process-message.ts`
  - `src/app/api/whatsapp/webhook/contact-service.ts`
  - `src/app/api/whatsapp/webhook/conversation-service.ts`
- **Vulnerability / Exploit Scenario**:
  Appwrite Cloud enforces strict camelCase schema attributes (`accountId`, `phoneNumberId`, `wabaId`, `encryptedAccessToken`, `encryptedVerifyToken`, `status`, `registeredAt`, `lastRegistrationError`, `subscribedAppsAt`, `createdAt`, `updatedAt`). Runtime code passing snake_case keys (`account_id`, `user_id`, `verify_token`, `ai_chat_enabled`) triggered schema validation errors, causing silent attribute stripping or failed webhook persistence.
- **Remediation**:
  Normalize `whatsapp_configs`, `contacts`, `conversations`, and `messages` to strict canonical camelCase attributes. Remove dual-casing hacks and auto-healing deletion loops. Add unique indexes on `['accountId']` and `['phoneNumberId']`.

---

### [P1 - High] Finding 3: Non-Durable Outbound Messaging (Pre-Meta Send Outbox Absence)

- **Affected Files**:
  - `src/app/api/whatsapp/send/route.ts`
  - `src/app/api/whatsapp/broadcast/route.ts`
- **Vulnerability / Exploit Scenario**:
  Outbound WhatsApp messages were dispatched directly to Meta Graph API prior to committing a durable outbox record in Appwrite. If the application server crashed or experienced a database timeout immediately after Meta accepted the payload, the message was delivered to the recipient but lost in CRM history, breaking idempotency and causing duplicate re-sends.
- **Remediation**:
  Implement an Appwrite-backed Outbox pattern (`outbound_outbox` collection) with states: `pending`, `processing`, `sent`, `retrying`, `dead_letter`, `reconciliation_required`. Persist intent before calling Meta API, enforce `(accountId, idempotencyKey)` uniqueness, and verify durable state before returning success.

---

### [P1 - High] Finding 4: Residual BullMQ / Redis Dependencies Violating Single-Backend Principle

- **Affected Files**:
  - `package.json`
  - `scripts/worker.ts`
  - `src/queues/producers/`
  - `src/queues/workers/`
- **Vulnerability / Exploit Scenario**:
  The presence of BullMQ and ioredis introduced Valkey Glide module resolution warnings during Next.js webpack builds and created architectural ambiguity between Redis-based queues and Appwrite collections.
- **Remediation**:
  Completely remove `bullmq` and `ioredis` from `package.json`. Migrate all appointment reminder, follow-up, and event processing jobs to native Appwrite collections (`provider_events`, `outbound_outbox`, `followups`).

---

### [P2 - Medium] Finding 5: Stale Hardcoded Commit SHA in Health Endpoint Probes

- **Affected Files**:
  - `src/app/api/health/route.ts`
  - `src/app/api/voice/health/route.ts`
  - `src/lib/voice/voice-outbox-worker.ts`
- **Vulnerability / Exploit Scenario**:
  Fallback commit SHA strings were hardcoded (e.g. `'cf5425fc...'`), causing health check endpoints on production deployments to report an obsolete commit hash.
- **Remediation**:
  Dynamically inject `NEXT_PUBLIC_COMMIT_SHA` at build time in `next.config.ts` from git or deployment environment variables, with clean fallback to `'development'`.

---

### [P2 - Medium] Finding 6: Storage Bucket Access and Privacy Safeguards

- **Affected Files**:
  - `src/infrastructure/appwrite/storage-manifest.ts`
  - `scripts/verify-appwrite-storage.ts`
- **Vulnerability / Exploit Scenario**:
  Storage buckets (`avatars`, `chat-media`, `voice-transcripts`, `webhook-payloads`, `pdf-tickets`) must never allow unauthenticated public read/write access.
- **Remediation**:
  Enforce `isPublic: false` across all buckets. Ensure all file uploads and downloads pass through server-side authenticated routes with strict tenant validation, file type inspection, and size limits.

---

## 3. Production Readiness Decision Matrix

| Gate        | Requirement                                                 | Status         |
| ----------- | ----------------------------------------------------------- | -------------- |
| **Gate 1**  | Branch isolation (`fix/p0-full-production-readiness`)       | ✅ Verified    |
| **Gate 2**  | Appwrite-only durable architecture (No Redis/BullMQ)        | 🔄 In Progress |
| **Gate 3**  | Zero-bypass tenant isolation on all queries                 | 🔄 In Progress |
| **Gate 4**  | Canonical WhatsApp schema (14 camelCase fields)             | 🔄 In Progress |
| **Gate 5**  | Pre-Meta durable Outbox pattern                             | 🔄 In Progress |
| **Gate 6**  | Hardened webhook HMAC-SHA256 verification & dedupe          | 🔄 In Progress |
| **Gate 7**  | Private Storage buckets (5/5)                               | 🔄 In Progress |
| **Gate 8**  | Green CI suite (format, lint, typecheck, tests, build, e2e) | 🔄 In Progress |
| **Gate 9**  | Production SHA matching merged branch                       | 🔄 In Progress |
| **Gate 10** | Voice feature-flagged / honestly reported                   | 🔄 In Progress |

**Current Decision**: **NO-GO** (Pending execution and automated verification of all 10 gates).
