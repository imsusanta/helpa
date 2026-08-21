# Meta WhatsApp Embedded Signup & 1-Click Connection Guide

This document outlines the architecture, configuration, and developer workflows for Helpa's production-ready Meta WhatsApp Embedded Signup integration.

---

## 1. Overview & User Experience

Helpa allows clinics and businesses to connect their official WhatsApp Business account in under 60 seconds with **Zero Manual Credential Entry**.

```
Helpa Settings / Onboarding
       ↓
[ Connect WhatsApp ]
       ↓
Meta Embedded Signup Popup (Facebook SDK)
       ↓
Select Meta Business Manager & WhatsApp Phone Number
       ↓
Automatic Backend Exchange & Verification
       ↓
🟢 WhatsApp Connected
```

The user never manually handles or enters:
- WABA ID
- Phone Number ID
- Permanent Access Tokens
- Webhook URLs or Verify Tokens
- App Secrets

---

## 2. Meta Developer Console Setup (Manual Steps)

To enable Embedded Signup for your Helpa deployment, configure the following in the [Meta for Developers Portal](https://developers.facebook.com/):

### Step 2.1: Create & Configure Meta App
1. Go to **My Apps** → **Create App**.
2. Select **Business** as the App Type.
3. Name your app (e.g. `Helpa CRM`).
4. Add the following products to your app:
   - **WhatsApp** (WhatsApp Business Platform)
   - **Facebook Login for Business**

### Step 2.2: Configure Facebook Login for Business
1. Under **Facebook Login for Business** → **Settings**:
   - Enable **Login with JavaScript SDK**: `Yes`
   - Add your domain to **Allowed Domains for the JavaScript SDK**:
     - Local development: `http://localhost:3000`
     - Production: `https://your-domain.com` (e.g. `https://crm.helpa.app`)
2. Under **Configurations** (Embedded Signup Configuration):
   - Create a Configuration ID (or use default).
   - Ensure the solution includes **WhatsApp Embedded Signup**.
   - Note down the `Configuration ID` for `NEXT_PUBLIC_META_CONFIG_ID`.

### Step 2.3: Required Meta Scopes & Permissions
During Embedded Signup, Helpa requests the following official scopes:
- `whatsapp_business_management`: Manage WABA, phone numbers, message templates, and subscriptions.
- `whatsapp_business_messaging`: Send and receive messages on behalf of the business.
- `public_profile`: Basic account validation.

> [!NOTE]
> For production users outside your Meta Business Organization, complete **App Review** for `whatsapp_business_messaging` and `whatsapp_business_management`, or verify your Meta Business Manager.

### Step 2.4: Configure Webhooks in Meta Console
1. Under **WhatsApp** → **Configuration** → **Webhook**:
   - **Callback URL**: `https://your-domain.com/api/whatsapp/webhook`
   - **Verify Token**: Set to the value of `META_WEBHOOK_VERIFY_TOKEN` (configured in your server environment).
2. Click **Verify and Save**.
3. Under **Webhook Fields**, subscribe to:
   - `messages` (inbound chats, media, voice notes, buttons, reactions)
   - `message_template_status_update` (template approvals / rejections)

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
- Encryption key is supplied via `WHATSAPP_TOKEN_ENCRYPTION_KEY` (or `ENCRYPTION_KEY`).

### 3.3 Multi-Tenant Webhook Idempotency & Tenant Resolution
- Inbound webhooks are resolved strictly by Meta `phone_number_id` to the owning workspace.
- Duplicate event deliveries are detected using the `public.webhook_events` table in Supabase (`unique (provider, provider_event_id)`), ensuring messages are never processed twice.
- Webhook payloads are verified against HMAC-SHA256 signatures (`x-hub-signature-256`) using `META_APP_SECRET`.

---

## 4. Environment Variables

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_META_APP_ID` | **Client & Server** | Meta App ID from Developer Portal |
| `NEXT_PUBLIC_META_CONFIG_ID` | **Client (Optional)** | Embedded Signup Config ID from Facebook Login settings |
| `META_APP_ID` | **Server Only** | Server copy of Meta App ID |
| `META_APP_SECRET` | **Server Only** | Meta App Secret (App Settings → Basic) |
| `META_WEBHOOK_VERIFY_TOKEN` | **Server Only** | Custom secret matching Meta Webhook configuration |
| `WHATSAPP_TOKEN_ENCRYPTION_KEY` | **Server Only** | 64-char hex key (32 bytes) for AES-256-GCM token encryption |

---

## 5. API Endpoints

- `POST /api/whatsapp/oauth/session`: Creates a single-use OAuth state bound to the authenticated tenant.
- `POST /api/whatsapp/embedded-signup`: Exchanges code for access token, auto-discovers WABA and Phone IDs, subscribes webhooks, encrypts token, and persists configuration in Supabase.
- `GET /api/whatsapp/config`: Runs live health checks against Meta Graph API and returns masked connection status.
- `DELETE /api/whatsapp/config`: Disconnects WhatsApp while safely preserving all historical CRM contacts and conversation history.
- `GET /api/whatsapp/webhook`: Handles Meta webhook challenge verification.
- `POST /api/whatsapp/webhook`: Receives inbound WhatsApp messages, verifies HMAC signature, checks idempotency, and dispatches to AI receptionist / CRM inbox.

---

## 6. Local Development & Testing

1. Set up your `.env.local` with Supabase and Meta credentials:
   ```bash
   cp .env.local.example .env.local
   ```
2. Generate an encryption key if not present:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Expose your local webhook to Meta using a tunnel (e.g. ngrok or Cloudflare Tunnel):
   ```bash
   ngrok http 3000
   ```
   Set your Meta Webhook URL to `https://your-tunnel.ngrok.io/api/whatsapp/webhook`.

5. Run automated test suites:
   ```bash
   npm test
   npm run test:integration
   ```

---

## 7. Troubleshooting

- **"Facebook SDK failed to load"**: Ensure ad-blockers (uBlock Origin, Brave Shields) are paused on the domain.
- **"Login with JavaScript SDK is disabled"**: In Meta Developer Console → Facebook Login for Business → Settings, turn ON "Login with JavaScript SDK" and whitelist your domain.
- **"OAuth state invalid / expired"**: Reconnect by clicking "Connect WhatsApp" again.
- **"Phone number already connected to another workspace"**: A WhatsApp phone number can only belong to one tenant. Disconnect it from the previous workspace first.
