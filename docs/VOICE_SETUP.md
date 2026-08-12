# Voice Agent System Setup & Production Guide

This guide details the setup, configuration, security rules, and production deployment procedure for the **WA CRM Voice Agent System**.

---

## 1. Supported Providers & Capability Matrix

**Verified Documentation**: [ElevenLabs Conversational AI SIP Outbound Call API](https://elevenlabs.io/docs/api-reference/conversational-ai/sip-trunk/outbound-call)  
**Verification Date**: August 12, 2026

| Feature / Capability     | ElevenLabs                                        | Sarvam AI                        | xAI (Grok)                       |
| :----------------------- | :------------------------------------------------ | :------------------------------- | :------------------------------- |
| **Outbound Calling**     | ✅ Supported (`/convai/sip-trunk/outbound-call`)  | ❌ `VOICE_OPERATION_UNSUPPORTED` | ❌ `VOICE_OPERATION_UNSUPPORTED` |
| **Post-Call Transcript** | ✅ Supported (`/convai/conversations/{id}`)       | ❌ `VOICE_OPERATION_UNSUPPORTED` | ❌ `VOICE_OPERATION_UNSUPPORTED` |
| **Signed Webhooks**      | ✅ Supported (`elevenlabs-signature` HMAC-SHA256) | ❌ `VOICE_OPERATION_UNSUPPORTED` | ❌ `VOICE_OPERATION_UNSUPPORTED` |
| **Call Transfer**        | ❌ `VOICE_OPERATION_UNSUPPORTED`                  | ❌ `VOICE_OPERATION_UNSUPPORTED` | ❌ `VOICE_OPERATION_UNSUPPORTED` |
| **Call Termination**     | ❌ `VOICE_OPERATION_UNSUPPORTED`                  | ❌ `VOICE_OPERATION_UNSUPPORTED` | ❌ `VOICE_OPERATION_UNSUPPORTED` |
| **Live Audio Streaming** | ❌ `VOICE_OPERATION_UNSUPPORTED`                  | ❌ `VOICE_OPERATION_UNSUPPORTED` | ❌ `VOICE_OPERATION_UNSUPPORTED` |

### ElevenLabs Official Outbound Call Contract

- **Endpoint**: `POST https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call`
- **Headers**:
  - `xi-api-key`: `<ELEVENLABS_API_KEY>`
  - `Content-Type`: `application/json`
- **Request Body**:
  ```json
  {
    "agent_id": "string",
    "agent_phone_number_id": "string",
    "to_number": "string",
    "conversation_initiation_client_data": {}
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "conversation_id": "conv_abc123"
  }
  ```

---

## 2. Environment Variables

Configure the following environment variables in your server environment (e.g. Vercel Project Settings or `.env.local`):

```bash
# ElevenLabs Conversational AI (Production Primary)
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=your_elevenlabs_agent_id
ELEVENLABS_PHONE_NUMBER_ID=your_elevenlabs_phone_number_id
ELEVENLABS_WEBHOOK_SECRET=your_elevenlabs_webhook_secret
ELEVENLABS_BASE_URL=https://api.elevenlabs.io/v1

# Sarvam AI (Unsupported Telephony)
SARVAM_API_KEY=
SARVAM_AGENT_ID=
SARVAM_PHONE_NUMBER_ID=
SARVAM_WEBHOOK_SECRET=

# xAI (Unsupported Telephony)
XAI_API_KEY=
XAI_VOICE_AGENT_ID=
XAI_PHONE_NUMBER_ID=
XAI_WEBHOOK_SECRET=
```

---

## 3. Appwrite Database Collections & Indexes

The Voice Agent System requires 4 collections in the Appwrite `wacrm_production` database:

1. `voice_integrations`:
   - Stores tenant voice provider configurations and server-side mapping.
   - Required Indexes: `accountId + provider` (unique), `provider + agentId + providerPhoneNumberId`.
2. `calls`:
   - Tracks real call lifecycle (`initiating` -> `in_progress` -> `completed` / `failed`).
   - Required Indexes: `accountId + externalCallId` (unique), `accountId + createdAt`.
3. `provider_events`:
   - Stores normalized webhook event logs and raw payload references.
   - Required Indexes: `provider + externalEventId` (unique), `accountId + receivedAt`.
4. `voice_commands`:
   - Enforces idempotent outbound call commands.
   - Required Indexes: `accountId + idempotencyKey` (unique).

---

## 4. Webhook Configuration in ElevenLabs Dashboard

1. Log into your **ElevenLabs Dashboard** (`elevenlabs.io`).
2. Navigate to **Conversational AI** -> **Webhooks**.
3. Set Webhook URL to:
   `https://www.helpa.studio/api/webhooks/voice/elevenlabs`
4. Copy the generated **Signing Secret** and save it in environment variable `ELEVENLABS_WEBHOOK_SECRET`.
5. Enable events: `call_initiation_success`, `call_initiation_failure`, `conversation_summary`.

---

## 5. Local Testing & Verification Procedure

### Running Tests

Execute the voice test suite to verify provider contracts, HMAC verification, replay windows, and error handling:

```bash
npm test -- src/tests/voice/voice-provider.test.ts
```

### Initiating an Outbound Call

Send an authenticated POST request with a unique `Idempotency-Key` header:

```bash
curl -X POST https://www.helpa.studio/api/voice/outbound \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: cmd_outbound_$(date +%s)" \
  -H "Cookie: a_session_6a79822b003adde92f63=YOUR_SESSION" \
  -d '{"contactId": "CONTACT_DOC_ID", "provider": "elevenlabs"}'
```

---

## 6. Production Rollback Procedure

If a provider API degrades or fails:

1. Disable the integration in Appwrite `voice_integrations` collection (`status = "disabled"`).
2. The health check `/api/health` will report `checks.voice.status: "not_configured"`.
3. Outbound calls will fail closed cleanly with `VOICE_PROVIDER_NOT_CONFIGURED` without impacting CRM or WhatsApp operations.
