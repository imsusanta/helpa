# Voice System Implementation & Production Audit

This document provides a comprehensive audit of the voice-agent system in accordance with production-hardening requirements, evaluating architecture, provider APIs, tenant isolation, webhook security, Appwrite data models, and feature support.

---

## 1. Existing Providers and Capabilities

| Provider       | Capabilities                                              | Documented Public API Status                                                                                                                                     |
| :------------- | :-------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ElevenLabs** | `outboundCalling`, `postCallTranscript`, `signedWebhooks` | Fully supported via official Conversational AI API (`POST /v1/convai/sip-trunk/outbound-call`, `GET /convai/conversations/{id}`, HMAC `elevenlabs-signature`). |
| **Sarvam AI**  | `VOICE_OPERATION_UNSUPPORTED`                             | Public API exposes TTS / STT REST endpoints; no public voice AI telephony or outbound agent call orchestration API exists.                                       |
| **xAI (Grok)** | `VOICE_OPERATION_UNSUPPORTED`                             | Public API exposes Grok LLM completion/chat; no public outbound SIP telephony API or native voice agent webhooks exist.                                         |

---

## 2. Production Audit Findings & Fixes

### 1. Provider Contract & Payload Field (`to_number`)
- **Endpoint**: `/v1/convai/sip-trunk/outbound-call`
- **Request Payload**: Explicitly uses `to_number` per official ElevenLabs documentation (`https://elevenlabs.io/docs/api-reference/sip-trunk/outbound-call`).
- **Headers**: `xi-api-key`, `Content-Type: application/json`
- **Response Validation**: Enforces `body.success === true` and extracts `conversation_id`.
- **Capability Guard**: `transferCall` and `terminateCall` throw `VOICE_OPERATION_UNSUPPORTED` (501).

### 2. Tenant Credentials Resolver (`resolveTenantVoiceConfig`)
- Server-only resolver loads enabled `voice_integrations` document for `accountId` + `provider`.
- Decrypts credentials server-side using AES-256-GCM without exposing keys to clients, logs, or response payloads.
- Fails closed if integration is missing, disabled, malformed, or undecryptable.

### 3. Single Call Document Guarantee
- Atomically claims idempotency key in `voice_commands`.
- Creates **one** `calls` document in `queued` state.
- Transitions call state to `initiating`.
- Initiates remote ElevenLabs call.
- Updates that **same** document ID with `externalCallId` and provider metadata—never creates a duplicate call document.

### 4. Fail-Closed Webhook & Storage Persistence
- Validates HMAC signature (`elevenlabs-signature` with `t=` timestamp and `v0=` hash) within 300s replay window.
- Stores raw webhook payload in private Appwrite Storage bucket `webhookPayloads`. Fails closed (HTTP 500) if Storage write fails.
- Atomically creates `provider_events` document with SHA-256 `payloadHash`.
- Handles duplicates: HTTP 200 on matching hash; HTTP 409 on hash mismatch.

### 5. Appwrite-Only Outbox Worker Model (No Redis / No BullMQ)
- Replaced external queues with Appwrite-native `AppwriteVoiceOutboxWorker`.
- Statuses: `queued`, `processing`, `retrying`, `processed`, `dead_letter`.
- Includes atomic lease claiming, 60s lease expiry recovery, and bounded exponential backoff.

### 6. State Machine Enforcement
- All call status transitions pass through `CallStateMachine.canTransition()`.
- Terminal call states (`completed`, `failed`, `busy`, `no_answer`, `cancelled`) are locked against regressive status changes.

### 7. Private & Tenant-Scoped Transcripts
- Raw transcript text is stored in private Storage bucket `webhookPayloads`. Only references (`transcriptReference`) are stored on call documents.
- Endpoint `GET /api/voice/calls/[callId]/transcript` requires authenticated tenant membership and returns `Cache-Control: private, no-store`.

### 8. Safe & Honest Health Endpoint
- `GET /api/voice/health` reports status (`not_configured`, `misconfigured`, `connected`, `degraded`, `unavailable`), provider reachability, outbox counts, worker heartbeat, and commit SHA (`0fea4f7`).
- Never exposes secrets, keys, phone numbers, or patient details.

---

## 3. Environment Variables

```bash
# ElevenLabs Conversational AI
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
ELEVENLABS_PHONE_NUMBER_ID=
ELEVENLABS_WEBHOOK_SECRET=
ELEVENLABS_BASE_URL=https://api.elevenlabs.io/v1

# Sarvam AI (Unsupported Telephony)
SARVAM_API_KEY=
SARVAM_AGENT_ID=
SARVAM_PHONE_NUMBER_ID=
SARVAM_WEBHOOK_SECRET=

# xAI (Grok - Unsupported Telephony)
XAI_API_KEY=
XAI_VOICE_AGENT_ID=
XAI_PHONE_NUMBER_ID=
XAI_WEBHOOK_SECRET=
```

---

## 4. Appwrite Data Model & Collections

The voice system uses 4 dedicated Appwrite Database collections:

1. `voice_integrations`:
   - Attributes: `accountId`, `provider`, `encryptedCredentialsReference`, `agentId`, `providerPhoneNumberId`, `phoneNumberMasked`, `status`, `capabilities`, `createdAt`, `updatedAt`
   - Indexes: `unique_voice_integration` (`provider + agentId + providerPhoneNumberId`), `unique_account_provider` (`accountId + provider`), `idx_voice_account_status` (`accountId + status`)
2. `calls`:
   - Attributes: `accountId`, `provider`, `externalCallId`, `direction`, `status`, `fromMasked`, `toMasked`, `contactId`, `leadId`, `agentId`, `startedAt`, `answeredAt`, `endedAt`, `durationSeconds`, `failureCode`, `failureMessageSanitized`, `transcriptStatus`, `recordingStatus`, `transcriptReference`, `recordingReference`, `version`, `createdAt`, `updatedAt`
   - Indexes: `unique_account_external_call` (`accountId + externalCallId`), `idx_calls_account_created` (`accountId + createdAt`), `idx_calls_account_status` (`accountId + status`), `idx_calls_provider_external` (`provider + externalCallId`)
3. `provider_events`:
   - Attributes: `accountId`, `provider`, `externalEventId`, `eventType`, `payloadHash`, `rawPayloadReference`, `processingStatus`, `processingAttempts`, `maxAttempts`, `lastErrorSanitized`, `receivedAt`, `processingStartedAt`, `lockOwner`, `lockExpiresAt`, `heartbeatAt`, `nextAttemptAt`, `processedAt`, `deadLetteredAt`
   - Indexes: `unique_provider_event` (`provider + externalEventId`), `idx_provider_events_account_received` (`accountId + receivedAt`), `idx_provider_events_status_next` (`processingStatus + nextAttemptAt`)
4. `voice_commands`:
   - Attributes: `accountId`, `commandType`, `idempotencyKey`, `commandFingerprint`, `externalCallId`, `status`, `resultReference`, `lastErrorSanitized`, `createdAt`, `updatedAt`
   - Indexes: `unique_command_idempotency` (`accountId + idempotencyKey`), `idx_commands_account_created` (`accountId + createdAt`)
