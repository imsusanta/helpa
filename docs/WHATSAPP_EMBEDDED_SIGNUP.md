# Meta WhatsApp Embedded Signup & Coexistence Integration Guide

## Helpa by Helpa Studio

This guide details the technical configuration, Meta App requirements, webhook architecture, and coexistence capabilities for **1-Click WhatsApp Onboarding** in Helpa. It is the single canonical reference for Embedded Signup (previously split across two overlapping guides).

---

## 1. Overview of 1-Click Connection Architecture

Helpa allows clinics and businesses to connect their official WhatsApp Business account in under 60 seconds with **Zero Manual Credential Entry**. It uses Meta's official **WhatsApp Embedded Signup Flow** with the Facebook JavaScript SDK and OAuth code exchange.

The user never manually handles or enters: WABA ID, Phone Number ID, permanent access tokens, webhook URLs, verify tokens, or app secrets.

```
┌─────────────────┐       ┌────────────────────────┐       ┌─────────────────┐
│  Client Admin   │ ────► │  Meta Embedded Signup  │ ────► │  Helpa Backend  │
│  (Settings UI)  │       │  (Business / Number)   │       │ (OAuth Callback)│
└─────────────────┘       └────────────────────────┘       └─────────────────┘
                                                                    │
                                   ┌────────────────────────────────┼────────────────────────────────┐
                                   ▼                                ▼                                ▼
                        Token Exchange & AES Encrypt       WABA Subscribed Apps             Phone Number Verify
                                   │                                │                                │
                                   └────────────────────────────────┼────────────────────────────────┘
                                                                    ▼
                                                       Encrypted DB Configuration
                                                                    ▼
                                                       Live Multi-Tenant Webhook
```

---

## 2. Meta App Configuration Requirements

Configure the following in the [Meta for Developers Portal](https://developers.facebook.com/):

1. **Meta App Type**: Business.
2. **Products Added**:
   - **WhatsApp**: API Setup & Quickstart.
   - **Facebook Login for Business**: Settings → _Login with the JavaScript SDK_ must be enabled (`Yes`).
   - Allowed Domains: `http://localhost:3000` (dev), `https://your-domain.com` (production).
3. **Configurations (Config ID)**:
   - Create a Configuration in Meta App Dashboard → WhatsApp → Embedded Signup.
   - Features: `WhatsApp Embedded Signup`, `WhatsApp Business Management`.
   - Permissions: `whatsapp_business_management`, `whatsapp_business_messaging`, `public_profile`.
4. **Webhooks** (WhatsApp → Configuration → Webhook):
   - Callback URL: `https://your-domain.com/api/whatsapp/webhook`
   - Verify Token: value of `META_WEBHOOK_VERIFY_TOKEN`.
   - Subscribe to fields: `messages`, `message_template_status_update`.
5. **Environment Variables**:
   ```env
   NEXT_PUBLIC_META_APP_ID="your_meta_app_id"
   NEXT_PUBLIC_META_CONFIG_ID="your_meta_config_id"
   META_APP_ID="your_meta_app_id"
   META_APP_SECRET="your_meta_app_secret"
   META_WEBHOOK_VERIFY_TOKEN="your_custom_verify_token"
   WHATSAPP_APP_SECRET="your_meta_app_secret"
   WHATSAPP_TOKEN_ENCRYPTION_KEY="64_char_hex_32_bytes"
   ENCRYPTION_KEY="32_byte_key"
   ```

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_META_APP_ID` | Client & Server | Meta App ID from Developer Portal |
| `NEXT_PUBLIC_META_CONFIG_ID` | Client (optional) | Embedded Signup Config ID from Facebook Login settings |
| `META_APP_ID` / `META_APP_SECRET` | Server only | Server copies of Meta App credentials |
| `META_WEBHOOK_VERIFY_TOKEN` | Server only | Secret matching the Meta webhook configuration |
| `WHATSAPP_TOKEN_ENCRYPTION_KEY` / `ENCRYPTION_KEY` | Server only | 64-char hex (32 bytes) key for AES-256-GCM token encryption |

> [!NOTE]
> For production users outside your Meta Business Organization, complete **App Review** for `whatsapp_business_messaging` and `whatsapp_business_management`, or verify your Meta Business Manager.

---

## 3. Architecture & Security Invariants

### 3.1 Cryptographic OAuth State Security
Every connection session begins by calling `POST /api/whatsapp/oauth/session`:
- Generates a 32-byte cryptographically secure random token (`crypto.randomBytes(32).toString('hex')`).
- Binds state strictly to the authenticated `account_id` and `user_id`.
- Stores state with a 15-minute expiration in Supabase `public.oauth_states`.
- Validates and marks state as `used_at` upon callback receipt, preventing CSRF, tenant confusion, and replay attacks.

### 3.2 AES-256-GCM Token Encryption at Rest
- Tokens are encrypted using authenticated `aes-256-gcm` (`<iv-hex>:<ciphertext-hex>:<authTag-hex>`).
- Plaintext access tokens are never returned in client API responses or printed in server logs.

### 3.3 Multi-Tenant Webhook Idempotency & Tenant Resolution
- Signature validated with HMAC-SHA256 (`X-Hub-Signature-256`) against `WHATSAPP_APP_SECRET` / `META_APP_SECRET`.
- Inbound messages map `phone_number_id` strictly to the owning workspace (`account_id`).
- Duplicate event deliveries are detected using the `public.webhook_events` table (`unique (provider, provider_event_id)`), so messages are never processed twice.

---

## 4. API Endpoints

- `POST /api/whatsapp/oauth/session` — creates a single-use OAuth state bound to the authenticated tenant.
- `POST /api/whatsapp/embedded-signup` — exchanges code for access token, auto-discovers WABA and Phone IDs, subscribes webhooks, encrypts token, and persists configuration in Supabase.
- `GET /api/whatsapp/config` — runs live health checks against Meta Graph API and returns masked connection status.
- `DELETE /api/whatsapp/config` — disconnects WhatsApp while safely preserving all historical CRM contacts and conversation history.
- `GET /api/whatsapp/webhook` — handles Meta webhook challenge verification.
- `POST /api/whatsapp/webhook` — receives inbound messages, verifies HMAC signature, checks idempotency, and dispatches to AI receptionist / CRM inbox.

---

## 5. WhatsApp Business App & Cloud API Coexistence

- **What is Coexistence?** Meta allows certain eligible WhatsApp Business phone numbers to operate in both the WhatsApp Business mobile app and the WhatsApp Cloud API simultaneously.
- **Eligibility**: the number must be registered under a WABA and the business must complete 2-step verification during embedded signup.
- **Behavior in Helpa**: outgoing and incoming messages sync between the mobile app and Helpa's real-time Inbox; the AI Receptionist / Copilot responds automatically without interrupting manual mobile conversations.

---

## 6. Disconnect & Reconnect Lifecycle

- **Reconnect**: preserves all historical conversations, contacts, patient/student records, and CRM timeline events while updating credentials and re-subscribing webhooks.
- **Disconnect**: safely disables outbound sending and clears credentials while preserving all CRM records and historical chats.
- **Duplicate Protection**: prevents binding the same phone number to multiple conflicting workspaces (a number belongs to exactly one tenant).

---

## 7. Local Development & Testing

```bash
cp .env.local.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # encryption key
npm run dev
ngrok http 3000   # expose webhook to Meta, set callback to https://<tunnel>/api/whatsapp/webhook
npm test && npm run test:integration
```

---

## 8. Troubleshooting

- **"Facebook SDK failed to load"** — pause ad-blockers (uBlock Origin, Brave Shields) on the domain.
- **"Login with JavaScript SDK is disabled"** — enable it in Meta Developer Console → Facebook Login for Business → Settings and whitelist your domain.
- **"OAuth state invalid / expired"** — reconnect by clicking "Connect WhatsApp" again (states expire after 15 minutes).
- **"Phone number already connected to another workspace"** — a WhatsApp number can only belong to one tenant; disconnect it from the previous workspace first.
