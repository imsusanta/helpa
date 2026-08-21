# Voice System Implementation & Production Audit

This document provides a comprehensive audit of the voice-agent system in accordance with production-hardening requirements, evaluating architecture, provider APIs, tenant isolation, webhook security, Appwrite data models, and feature support.

---

## 1. Existing Providers and Capabilities

| Provider       | Capabilities                                              | Documented Public API Status                                                                                                                                   |
| :------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ElevenLabs** | `outboundCalling`, `postCallTranscript`, `signedWebhooks` | Fully supported via official Conversational AI API (`POST /v1/convai/sip-trunk/outbound-call`, `GET /convai/conversations/{id}`, HMAC `elevenlabs-signature`). |
| **Sarvam AI**  | `VOICE_OPERATION_UNSUPPORTED`                             | Public API exposes TTS / STT REST endpoints; no public voice AI telephony or outbound agent call orchestration API exists.                                     |
| **xAI (Grok)** | `VOICE_OPERATION_UNSUPPORTED`                             | Public API exposes Grok LLM completion/chat; no public outbound SIP telephony API or native voice agent webhooks exist.                                        |

---

## 2. Production Audit Findings & Remediations

### 1. Provider Contract & Payload Field (`to_number`)

- **Endpoint**: `/v1/convai/sip-trunk/outbound-call`
- **Request Payload**: Explicitly uses `to_number` per official ElevenLabs documentation (`https://elevenlabs.io/docs/api-reference/sip-trunk/outbound-call`).
- **Headers**: `xi-api-key`, `Content-Type: application/json`
- **Response Validation**: Enforces `body.success === true` and extracts `conversation_id`.
- **Capability Guard**: `transferCall` and `terminateCall` throw `VOICE_OPERATION_UNSUPPORTED` (501).

### 2. Zero-Trust Credential Resolver (`resolveTenantVoiceConfig`)

- Server-only resolver loads enabled `voice_integrations` document for `accountId` + `provider`.
- Enforces strict security:
  - **Rejects unencrypted plaintext JSON** references starting with `{`.
  - Decrypts credentials server-side using AES-256-GCM without exposing keys to clients, logs, or response payloads.
  - **No production fallback to global environment credentials** during production tenant requests (`options.allowBootstrap` is false by default).
  - Sanitizes all error messages to avoid leaking account IDs, integration IDs, or credential references.
  - Supports key versioning (`keyVersion: 'v1'`).

### 3. Single Call Document Guarantee & Reconciliation Honesty

- Atomically claims idempotency key in `voice_commands`.
- Creates **one** `calls` document in `queued` state.
- Transitions call state to `initiating`.
- Initiates remote ElevenLabs call.
- Updates that **same** document ID with `externalCallId` and provider metadata.
- If status update fails after remote initiation, queues a durable reconciliation event in `provider_events`. If reconciliation persistence fails, throws a typed server error (`VOICE_PROVIDER_PERSISTENCE_FAILED`, status 500)—never swallows persistence errors or returns fake success.

### 4. Fail-Closed Webhook & Storage Persistence

- Validates HMAC signature (`elevenlabs-signature` with `t=` timestamp and `v0=` hash) within 300s replay window.
- Stores raw webhook payload in private Appwrite Storage bucket `webhookPayloads`. Fails closed (HTTP 500) if Storage write fails.
- Atomically creates `provider_events` document with SHA-256 `payloadHash`.
- Pre-checks duplicate event IDs before uploading to Storage to avoid orphan files.
- On duplicate race condition (Appwrite 409 conflict): cleans up redundant raw payload and transcript files from Storage. Returns 200 on matching hash; 409 on hash mismatch.

### 5. Durable Appwrite Outbox Worker & Persistent Heartbeat

- Replaced external queues with Appwrite-native `AppwriteVoiceOutboxWorker`.
- Statuses: `queued`, `processing`, `retrying`, `processed`, `dead_letter`.
- Worker downloads raw payload from private Appwrite Storage bucket and verifies SHA-256 `payloadHash` before processing.
- Includes atomic lease claiming, 60s lease expiry recovery, and bounded exponential backoff.
- Persists worker heartbeat in Appwrite collection `worker_health` containing `workerId`, `commitSha`, `startedAt`, `lastHeartbeatAt`, `lastScanAt`, `lastSuccessAt`, `lastFailureCode`, `processedCount`, `retryCount`, and `deadLetterCount`.

### 6. Strict Central State Machine Enforcement

- All call status mutations go through `CallStateMachine.validateTransition()` in `VoiceRepository`.
- Invalid or regressive status transitions throw typed error `VOICE_INVALID_STATE_TRANSITION` (HTTP 422).
- Terminal call states (`completed`, `failed`, `busy`, `no_answer`, `cancelled`) are locked against regressive status changes.
- Records audit metadata: `previousState`, `targetState`, `version`, `updatedAt`.

### 7. Private & Tenant-Scoped Transcripts

- Raw transcript text is stored in private Storage bucket `webhookPayloads`. Only references (`transcriptReference`) are stored on call documents.
- Endpoint `GET /api/voice/calls/[callId]/transcript` requires authenticated tenant membership and returns `Cache-Control: private, no-store`.

### 8. Dynamic & Honest Health Endpoint

- `GET /api/voice/health` dynamically queries Appwrite collections (`calls`, `provider_events`, `voice_commands`, `voice_integrations`, `worker_health`) and Storage buckets (`webhookPayloads`).
- Derives worker readiness and heartbeat health directly from the persisted `worker_health` collection in Appwrite (< 120s freshness).
- Never hardcodes success values or exposes secrets, keys, phone numbers, or patient details.

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

The voice system uses 5 dedicated Appwrite Database collections:

1. `voice_integrations`:
   - Attributes: `accountId`, `provider`, `encryptedCredentialsReference`, `agentId`, `providerPhoneNumberId`, `phoneNumberMasked`, `status`, `capabilities`, `keyVersion`, `createdAt`, `updatedAt`
   - Indexes: `unique_voice_integration` (`provider + agentId + providerPhoneNumberId`), `unique_account_provider` (`accountId + provider`), `idx_voice_account_status` (`accountId + status`)
2. `calls`:
   - Attributes: `accountId`, `provider`, `externalCallId`, `direction`, `status`, `fromMasked`, `toMasked`, `contactId`, `leadId`, `agentId`, `startedAt`, `answeredAt`, `endedAt`, `durationSeconds`, `failureCode`, `failureMessageSanitized`, `transcriptStatus`, `recordingStatus`, `transcriptReference`, `recordingReference`, `previousState`, `version`, `createdAt`, `updatedAt`
   - Indexes: `unique_account_external_call` (`accountId + externalCallId`), `idx_calls_account_created` (`accountId + createdAt`), `idx_calls_account_status` (`accountId + status`), `idx_calls_provider_external` (`provider + externalCallId`)
3. `provider_events`:
   - Attributes: `accountId`, `provider`, `externalEventId`, `eventType`, `payloadHash`, `rawPayloadReference`, `processingStatus`, `processingAttempts`, `maxAttempts`, `lastErrorSanitized`, `receivedAt`, `processingStartedAt`, `lockOwner`, `lockExpiresAt`, `heartbeatAt`, `nextAttemptAt`, `processedAt`, `deadLetteredAt`
   - Indexes: `unique_provider_event` (`provider + externalEventId`), `idx_provider_events_account_received` (`accountId + receivedAt`), `idx_provider_events_status_next` (`processingStatus + nextAttemptAt`)
4. `voice_commands`:
   - Attributes: `accountId`, `commandType`, `idempotencyKey`, `commandFingerprint`, `externalCallId`, `status`, `resultReference`, `lastErrorSanitized`, `createdAt`, `updatedAt`
   - Indexes: `unique_command_idempotency` (`accountId + idempotencyKey`), `idx_commands_account_created` (`accountId + createdAt`)
5. `worker_health`:
   - Attributes: `workerId`, `commitSha`, `startedAt`, `lastHeartbeatAt`, `lastScanAt`, `lastSuccessAt`, `lastFailureCode`, `processedCount`, `retryCount`, `deadLetterCount`, `updatedAt`
   - Indexes: `unique_worker_id` (`workerId`)
