# WHATSAPP EXISTING BUSINESS CONNECTION & COEXISTENCE REPORT

## 1. Existing Implementation Found
- Helpa previously supported Meta Embedded Signup for onboarding WhatsApp Business accounts using the Meta JavaScript SDK (`FB.login`).
- However, the onboarding flow treated all setups identically, lacking explicit support and messaging for **WhatsApp Business App + Cloud API Coexistence**.
- The UI presented a single generic button without distinguishing between connecting an active mobile WhatsApp Business number and provisioning a new dedicated Cloud API number.
- Connection statuses were limited to binary `connected` / `disconnected` states without fine-grained visibility into Coexistence progress, health metrics, or Meta eligibility.

---

## 2. Root Cause of Previous Issues
- **Missing Coexistence Intent in Meta SDK**: The client-side `FB.login` configuration didn't pass `{ solution: 'coexistence', phone_flow: 'coexistence' }` in `extras.setup` when the user intended to preserve their existing WhatsApp Business mobile app.
- **Ambiguous UI Guidance**: Users were concerned that connecting to Helpa might overwrite or migrate their mobile phone number away from their physical WhatsApp Business App.
- **Inadequate Eligibility Handling**: When an account did not qualify for Coexistence, generic failure messages caused confusion.
- **Disconnect Ambiguity**: Disconnecting lacked reassuring confirmation that mobile WhatsApp registrations and Helpa conversation history would remain preserved.

---

## 3. Meta Flow Implemented
We implemented the official **Meta WhatsApp Embedded Signup Flow (SDK v2 / Session Info v3)**:
1. **User Initiation**: User navigates to `Settings → WhatsApp` and selects **Existing WhatsApp Business (Coexistence)**.
2. **Launch Meta Popup**: `launchWhatsAppEmbeddedSignup({ appId, configId, mode: 'coexistence' })` launches `FB.login` with:
   ```js
   extras: {
     feature: 'whatsapp_embedded_signup',
     version: 2,
     sessionInfoVersion: 3,
     setup: { solution: 'coexistence', phone_flow: 'coexistence' }
   }
   ```
3. **Meta Authentication**: The user logs in to Facebook, selects their Meta Business Account and WABA, and confirms their active WhatsApp Business phone number.
4. **Token & WABA Discovery**: Meta delivers an OAuth authorization code / access token and phone number ID to Helpa via secure postMessage.
5. **Server Handshake**: `/api/whatsapp/embedded-signup` exchanges the code for a permanent access token, verifies phone capability with Meta Graph API `v21.0`, encrypts the token at rest, and subscribes the WABA to Helpa webhooks.
6. **Health Verification**: Helpa confirms active messaging and webhook delivery, returning `coexistence_connected`.

---

## 4. Coexistence Implementation & Behavior
- **Number Preservation**: The existing phone number remains registered on the business's physical WhatsApp Business mobile app while simultaneously receiving and sending messages via Helpa's Cloud API webhook infrastructure.
- **Non-Destructive Routing**: Inbound customer messages delivered via Meta webhooks are ingested by Helpa, triggering AI copilot/autopilot responses, and synced to Helpa Inbox without interfering with mobile app access.
- **No Unofficial Tools**: 100% compliant with Meta WhatsApp Business Platform policies. Zero web scrapers, zero unofficial QR daemons.

---

## 5. Database & Schema Changes
In `whatsapp_config` / `whatsapp_configs`:
- `connection_type`: `'coexistence' | 'standard' | 'manual'`
- `coexistence_status`: `'eligible' | 'active' | 'pending' | 'not_eligible' | 'unknown'`
- `status`: Extended to support `'connected' | 'disconnected' | 'connecting' | 'coexistence_pending' | 'coexistence_connected' | 'action_required' | 'not_eligible' | 'error' | 'reconnect_required'`
- `platform_type`: String (e.g. `WHATSAPP_BUSINESS_APP`, `CLOUD_API`)
- `quality_rating`: String
- `last_health_check_at`: ISO timestamp
- `webhook_healthy`: Boolean
- `messaging_active`: Boolean

---

## 6. UI Changes in Settings → WhatsApp
1. **Two Clear Onboarding Options**:
   - **Option 1**: **Existing WhatsApp Business (Coexistence)** $\rightarrow$ *`Connect Existing WhatsApp Business`*
   - **Option 2**: **Connect WhatsApp (New Number / Direct API)** $\rightarrow$ *`Connect with Meta`*
   - **Option 3**: **Developer / Manual Setup**
2. **Official Copy & Reassurance**:
   - **Title**: `Connect your existing WhatsApp Business`
   - **Description**: `Keep your existing WhatsApp Business number and connect it to Helpa to manage conversations, automate replies, and use AI.`
   - **Reassurance Notice**: `Your existing WhatsApp Business number will be kept where Meta's supported Coexistence setup is available.`
   - **Disclaimer**: `Helpa uses Meta's official WhatsApp integration. Whether your existing WhatsApp Business account can be connected without changing your current setup depends on Meta's eligibility and supported Coexistence configuration.`
3. **Live Health Overview Panel**:
   - Displays WhatsApp status (`● Connected`), Connection Type (`Existing WhatsApp Business / Coexistence`), Webhook (`● Healthy`), Messaging (`● Active`), and Last Checked timestamp.
   - Quick action triggers: `[ Open Inbox ]`, `[ Test Connection ]`, `[ Reconnect ]`, and `[ Disconnect ]`.
4. **Safe Disconnect Modal**:
   - Clearly reassures the user before disconnecting:
     - WhatsApp Business account & mobile app remain active.
     - Business phone number will NOT be deleted.
     - Contacts and conversation history in Helpa are safely preserved.

---

## 7. Security & Tenant Isolation
- **Encryption at Rest**: Access tokens and webhook verify tokens are encrypted using AES-256-GCM via `encrypt()` before saving to Appwrite/PostgreSQL.
- **Tenant Isolation**: Each config row is strictly indexed and queried by `account_id`. A single phone number ID cannot be claimed by multiple tenant workspaces.
- **Zero Client Credential Exposure**: Tokens are masked as `••••••••••••••••` and never returned in API payloads to the browser.
- **Webhook Signature Verification**: Webhook payloads are cryptographically verified using SHA-256 HMAC against `META_APP_SECRET`.

---

## 8. Webhook & Messaging Verification
- **Inbound Event Pipeline**:
  `WhatsApp Mobile / Customer` $\rightarrow$ `Meta Graph API` $\rightarrow$ `Helpa Webhook (/api/whatsapp/webhook)` $\rightarrow$ `Tenant Account Context` $\rightarrow$ `Conversation Record` $\rightarrow$ `AI Autopilot / Inbox`.
- **Outbound Message Pipeline**:
  `Helpa Inbox / AI Engine` $\rightarrow$ `Meta Graph API (/v21.0/{phone_number_id}/messages)` $\rightarrow$ `Customer WhatsApp`.

---

## 9. Automated Test Results
- **Coexistence Test Suite**: `npx vitest run src/tests/whatsapp/existing-business-coexistence.test.ts` $\rightarrow$ **5 / 5 PASSED**
- **Full Test Suite**: `npm test` $\rightarrow$ **89 / 89 test suites PASSED, 800 / 800 tests PASSED**
- **TypeScript Type Check**: `npx tsc --noEmit` $\rightarrow$ **0 errors**
- **ESLint**: `npm run lint` $\rightarrow$ **0 warnings, 0 errors**
- **Next.js Production Build**: `npm run build` $\rightarrow$ **Compiled 106 routes successfully**

---

## 10. Manual Testing Instructions (With a Real Meta Business Account)
1. Navigate to **Settings → WhatsApp** in Helpa.
2. Select the **Existing WhatsApp Business (Coexistence)** card.
3. Click **Connect Existing WhatsApp Business**.
4. In the Meta Embedded Signup modal:
   - Log in with your Facebook account associated with your WhatsApp Business.
   - Choose your Meta Business Portfolio.
   - Select your existing WhatsApp Business Account and active mobile number.
   - Review and grant messaging & business management permissions.
5. Once Meta completes the flow, the popup closes and Helpa verifies the connection.
6. Verify that the **WhatsApp Business Connected ✓** card displays your verified business name and phone number with **Existing Business / Coexistence** status.
7. Send a test message from a customer phone number to your WhatsApp Business number.
8. Open **Helpa Inbox** (`/inbox`) and verify the incoming conversation and AI response.
9. Reply from Helpa Inbox and verify the customer receives the response.

---

## 11. Meta Configuration Required in App Dashboard
To use Meta Embedded Signup in production:
1. Go to **developers.facebook.com → My Apps → [Your App]**.
2. Under **Facebook Login for Business → Settings**:
   - Ensure **Login with the JavaScript SDK** is set to **Yes**.
   - Add your Helpa domain (e.g. `https://your-helpa-domain.com`) to **Allowed Domains for the JavaScript SDK**.
3. Under **WhatsApp → Quickstart / Configuration**:
   - Ensure Webhook URL is set to `https://your-helpa-domain.com/api/whatsapp/webhook` with the `messages` subscription active.

---

## 12. Known Meta Eligibility Limitations
- **Phone Number Tier**: Phone numbers currently in restricted or unverified status in Meta Business Manager may require business verification before Meta enables Coexistence.
- **Landlines & Interactive IVRs**: Fixed-line numbers that cannot receive SMS/voice OTPs directly must complete Meta manual verification.
- **Regional Rollout**: Meta Coexistence availability is determined dynamically by Meta for Developers based on country and WABA account tier. If ineligible, Helpa displays a non-destructive informational message without prompting users to delete their accounts.
