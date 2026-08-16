# Meta WhatsApp Embedded Signup & Coexistence Integration Guide

## Helpa by Helpa Studio

This guide details the technical configuration, Meta App requirements, webhook architecture, and coexistence capabilities for **1-Click WhatsApp Onboarding** in Helpa.

---

## 1. Overview of 1-Click Connection Architecture

Helpa uses Meta's official **WhatsApp Embedded Signup Flow** with the Facebook JavaScript SDK and OAuth code exchange.

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

1. **Meta App Type**: Business.
2. **Products Added**:
   - **WhatsApp**: API Setup & Quickstart.
   - **Facebook Login for Business**: Settings → *Login with the JavaScript SDK* must be enabled (`Yes`).
   - Allowed Domains: `https://your-domain.com`, `https://*.appwrite.network`.
3. **Configurations (Config ID)**:
   - Create a Configuration in Meta App Dashboard → WhatsApp → Embedded Signup.
   - Features: `WhatsApp Embedded Signup`, `WhatsApp Business Management`.
   - Permissions: `whatsapp_business_management`, `whatsapp_business_messaging`.
4. **Environment Variables**:
   ```env
   NEXT_PUBLIC_META_APP_ID="your_meta_app_id"
   NEXT_PUBLIC_META_CONFIG_ID="your_meta_config_id"
   META_APP_SECRET="your_meta_app_secret"
   WHATSAPP_APP_SECRET="your_meta_app_secret"
   ENCRYPTION_KEY="32_byte_hex_encryption_key"
   ```

---

## 3. Webhook Architecture & Idempotency

- **Callback URL**: `https://your-domain.com/api/whatsapp/webhook`
- **Verify Token**: Configured in App Dashboard matching platform verify token.
- **Security & Multi-Tenant Mapping**:
  - Signature validated with HMAC-SHA256 (`X-Hub-Signature-256`) against `WHATSAPP_APP_SECRET`.
  - Inbound messages map `phone_number_id` strictly to the owning workspace (`account_id`).
  - Idempotency cache drops duplicate message events.

---

## 4. WhatsApp Business App & Cloud API Coexistence

- **What is Coexistence?** Meta allows certain eligible WhatsApp Business phone numbers to operate in both the WhatsApp Business mobile app and the WhatsApp Cloud API simultaneously.
- **Eligibility**:
  - Phone number must be registered as a WhatsApp Business Account (WABA).
  - Business must complete 2-step verification during embedded signup.
- **Behavior in Helpa**:
  - Outgoing and incoming messages sync between the mobile app and Helpa's real-time Inbox.
  - Helpa AI Receptionist / Copilot responds automatically without interrupting manual mobile conversations.

---

## 5. Disconnect & Reconnect Lifecycle

- **Reconnect**: Preserves all historical conversations, contacts, patient records, student records, and CRM timeline events while updating credentials and re-subscribing webhooks.
- **Disconnect**: Safely disables outbound sending and clears credentials while preserving all CRM records and historical chats.
- **Duplicate Protection**: Prevents binding the same phone number to multiple conflicting workspaces.
