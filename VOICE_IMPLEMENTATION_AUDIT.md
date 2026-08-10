# Voice System Implementation & Production Audit

This document provides a comprehensive audit of the voice-agent system in accordance with Phase 1 requirements, evaluating architecture, provider APIs, tenant isolation, webhook security, Appwrite data models, and feature support.

---

## 1. Existing Providers and Capabilities

| Provider       | Capabilities                                              | Documented Public API Status                                                                                                                       |
| :------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ElevenLabs** | `outboundCalling`, `postCallTranscript`, `signedWebhooks` | Fully supported via official Conversational AI API (`/convai/sip-trunk/outbound-call`, `/convai/conversations/{id}`, HMAC `elevenlabs-signature`). |
| **Sarvam AI**  | `VOICE_OPERATION_UNSUPPORTED`                             | Public API exposes TTS / STT REST endpoints; no public voice AI telephony or outbound agent call orchestration API exists.                         |
| **xAI (Grok)** | `VOICE_OPERATION_UNSUPPORTED` / `signedWebhooks`          | Public API exposes Grok LLM completion/chat; no public outbound SIP telephony API or native voice agent webhooks exist.                            |

---

## 2. Audit Findings: Scaffolding, Mock Methods & Vulnerabilities

### Mock Methods & Fake Success Paths

- **Previous Scaffolding**: Earlier revisions contained synthetic ID generators (`xai_call_...`, `waha_msg_...`) or returned `mock_*` URLs when APIs failed.
- **Current Hardened State**: All fake success paths have been eliminated. Providers throw `VoiceProviderError` with typed status codes (e.g. 501 `VOICE_OPERATION_UNSUPPORTED`, 503 `VOICE_PROVIDER_NOT_CONFIGURED`, 401 `VOICE_SIGNATURE_INVALID`).

### Webhook & Tenant Isolation Analysis

- **Route Whitelisting**: `/api/webhooks/voice/` is whitelisted in `src/proxy.ts` for public provider callback receipt.
- **Signature Security**: Webhooks require signature verification (`elevenlabs-signature`, `x-xai-signature`). Unsigned or invalid requests return **HTTP 401 Unauthorized**.
- **Server-Side Tenant Resolution**: Webhook handlers **never** trust `payload.account_id`. Tenant identity (`accountId`) is resolved via `voiceRepository.findUniqueTenant()`, matching the provider, `agentId`, and `providerPhoneNumberId` to a trusted `voice_integrations` document in Appwrite.
- **Payload & Deduplication**: Payloads are checked for size (< 1 MB) and deduplicated via `provider` + `externalEventId` before persisting raw JSON to Appwrite Storage (`webhookPayloads` bucket) and event metadata to Appwrite Databases (`providerEvents`).

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
   - Indexes: `accountId + provider` (unique), `provider + agentId + providerPhoneNumberId`
2. `calls`:
   - Attributes: `accountId`, `provider`, `externalCallId`, `direction`, `status`, `fromMasked`, `toMasked`, `contactId`, `leadId`, `agentId`, `startedAt`, `answeredAt`, `endedAt`, `durationSeconds`, `failureCode`, `failureMessageSanitized`, `transcriptStatus`, `recordingStatus`, `createdAt`, `updatedAt`
   - Indexes: `accountId + externalCallId` (unique), `accountId + createdAt`, `provider + externalCallId`
3. `provider_events`:
   - Attributes: `accountId`, `provider`, `externalEventId`, `eventType`, `payloadHash`, `rawPayloadReference`, `processingStatus`, `processingAttempts`, `lastErrorSanitized`, `receivedAt`, `processedAt`
   - Indexes: `provider + externalEventId` (unique), `accountId + receivedAt`
4. `voice_commands`:
   - Attributes: `accountId`, `commandType`, `idempotencyKey`, `commandFingerprint`, `externalCallId`, `status`, `resultReference`, `lastErrorSanitized`, `createdAt`, `updatedAt`
   - Indexes: `accountId + idempotencyKey` (unique)

---

## 5. File-by-File Implementation & Verification Plan

1. **`src/core/providers/voice/voice-provider.interface.ts`**:
   - Maintain strict `VoiceProvider` interface, capability flags, `VoiceErrorCode`, `VoiceProviderError`, and typed result contracts.
2. **`src/core/providers/voice/elevenlabs-provider.ts`**:
   - Implement real ElevenLabs Conversational AI REST calls with `xi-api-key`, HMAC-SHA256 signature verification (`elevenlabs-signature`), replay window checks, and error code parsing.
3. **`src/core/providers/voice/sarvam-provider.ts` & `xai-provider.ts`**:
   - Return typed `VOICE_OPERATION_UNSUPPORTED` (501) for unsupported telephony operations.
4. **`src/app/api/webhooks/voice/[provider]/route.ts`**:
   - Perform raw body signature verification, deduplication, server-side tenant mapping, raw payload storage in Appwrite Storage, and call status upserts.
5. **`src/app/api/voice/outbound/route.ts`**:
   - Require `requireRole('agent')`, enforce idempotency header, validate contact consent, call ElevenLabs outbound API, and record command/call state.
6. **`src/app/api/health/route.ts`**:
   - Report honest voice provider health status based on `elevenlabs-provider.ts` validation without fake active status.
7. **`docs/VOICE_SETUP.md`**:
   - Document complete setup, environment variables, webhook configuration, and testing procedures.
