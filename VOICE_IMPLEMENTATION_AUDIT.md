# Voice System Implementation & Production Audit

This document provides a comprehensive audit of the voice-agent system in accordance with Phase 1 requirements, evaluating architecture, provider APIs, tenant isolation, webhook security, Appwrite data models, and feature support.

---

## 1. Existing Providers and Capabilities

| Provider       | Capabilities                                              | Documented Public API Status                                                                                                                       |
| :------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ElevenLabs** | `outboundCalling`, `postCallTranscript`, `signedWebhooks` | Fully supported via official Conversational AI API (`/convai/sip-trunk/outbound-call`, `/convai/conversations/{id}`, HMAC `elevenlabs-signature`). |
| **Sarvam AI**  | `VOICE_OPERATION_UNSUPPORTED`                             | Public API exposes TTS / STT REST endpoints; no public voice AI telephony or outbound agent call orchestration API exists.                         |
| **xAI (Grok)** | `VOICE_OPERATION_UNSUPPORTED`                             | Public API exposes Grok LLM completion/chat; no public outbound SIP telephony API or native voice agent webhooks exist.                            |

---

## 2. Comprehensive Audit Findings

### Provider Contract & Endpoint Discrepancies

- **Endpoint Mismatch**: Previously, `elevenlabs-provider.ts` targeted `/v1/convai/sip-trunk/outbound` instead of official `/v1/convai/sip-trunk/outbound-call`.
- **Payload Property Mismatch**: Implementation sent `to_number` instead of official field `to_phone_number`.
- **Response Validation**: Checked `body.conversation_id` but did not enforce `body.success === true`.
- **Capability Unsupported Guard**: `transferCall` and `terminateCall` correctly throw `VOICE_OPERATION_UNSUPPORTED` (501).

### Schema Drift & Persistence Gaps

- **Missing Attributes**: Appwrite `calls` collection lacked `version`, `transcriptReference`, and `recordingReference`. `provider_events` lacked `processingStartedAt`, `heartbeatAt`, `nextAttemptAt`, `processedAt`.
- **Indexes**: Required compound unique index `provider + agentId + providerPhoneNumberId` on `voice_integrations` and processing indexes on `provider_events`.

### State Machine & Call Lifecycle

- **Direct Status Mutations**: Outbound API and Webhook handler previously called `upsertCall` directly without validating transition rules (e.g. allowing terminal states to regress to active states).
- **Enforced Lifecycle Needed**: Implemented centralized `CallStateMachine` class managing `QUEUED` -> `INITIATING` -> `RINGING` -> `IN_PROGRESS` -> `COMPLETED` / `FAILED` transitions with versioning.

### Webhook Processing & Queue Outbox

- **Unqueued Events**: Webhooks marked records `processingStatus: 'queued'` but did not enqueue them to BullMQ `provider-events` queue.
- **Race Condition**: Parallel webhook deliveries could pass duplicate checks before record insertion.
- **Transcript Exposure**: Webhook handler put full raw transcript text into call metadata document instead of storing transcript privately in Appwrite Storage.

### Tenant Resolution & Authorization

- **Credential Encryption**: Server resolves `voice_integrations` via `accountId` + `provider`, decrypts credential references server-side, and instantiates provider without exposing keys to client.
- **Webhook Identity**: Webhooks resolve tenant using `provider` + `agentId` + `providerPhoneNumberId` and reject unmapped or ambiguous webhooks with HTTP 422.

---

## 3. Environment Variables

The system enforces consistent, unambiguous environment variables:

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
   - Attributes: `accountId`, `provider`, `externalEventId`, `eventType`, `payloadHash`, `rawPayloadReference`, `processingStatus`, `processingAttempts`, `lastErrorSanitized`, `receivedAt`, `processingStartedAt`, `heartbeatAt`, `nextAttemptAt`, `processedAt`
   - Indexes: `unique_provider_event` (`provider + externalEventId`), `idx_provider_events_account_received` (`accountId + receivedAt`), `idx_provider_events_status_next` (`processingStatus + nextAttemptAt`)
4. `voice_commands`:
   - Attributes: `accountId`, `commandType`, `idempotencyKey`, `commandFingerprint`, `externalCallId`, `status`, `resultReference`, `lastErrorSanitized`, `createdAt`, `updatedAt`
   - Indexes: `unique_command_idempotency` (`accountId + idempotencyKey`), `idx_commands_account_created` (`accountId + createdAt`)
