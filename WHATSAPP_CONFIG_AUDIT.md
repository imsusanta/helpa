# WhatsApp Configuration Schema Audit Report

**Date**: 2026-08-13
**Branch**: `fix/p0-whatsapp-config-schema`
**Starting Commit SHA**: `658c45d757f6b5585609ec74bf8092505677c835`
**Production SHA**: `dc8d9e6eb8c8dfa4ceb0db6ff67ae58dcfb94098`
**Target Environment**: Appwrite (`https://sgp.cloud.appwrite.io/v1`, Project: `6a79822b003adde92f63`, Database: `helpa_main`)

---

## 1. Audit Summary & Discrepancy Findings

### Discrepancy 1: Collection Naming Mismatch

- **Old API queries**: Referred to `.from('whatsapp_config')` (singular) in legacy code.
- **Canonical Collection**: `whatsapp_configs` (plural) as defined in `APPWRITE_CONFIG.collections.whatsappConfigs`.

### Discrepancy 2: Attribute Naming Mismatch (snake_case vs. camelCase)

- **Legacy API Expectation**: `account_id`, `phone_number_id`, `waba_id`, `access_token`, `verify_token`, `registered_at`, `last_registration_error`, `subscribed_apps_at`.
- **Canonical Appwrite Document Model**: `accountId`, `phoneNumberId`, `wabaId`, `encryptedAccessToken`, `encryptedVerifyToken`, `status`, `registeredAt`, `lastRegistrationError`, `subscribedAppsAt`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `encryptionKeyVersion`.

### Discrepancy 3: Prohibited Fallback Identity

- **Legacy Fallback**: API routes fell back to `'default_account'` when session context was ambiguous.
- **Remediation**: Completely eliminated `'default_account'` fallbacks across all API routes, background workers, and UI hooks. Strict server-side resolution via session context and profiles DB lookup.

---

## 2. Canonical Document Schema Definition

| UI / API Request Field (snake_case) | Appwrite Canonical Field (camelCase) | Type     | Constraint / Default        |
| :---------------------------------- | :----------------------------------- | :------- | :-------------------------- |
| `account_id`                        | `accountId`                          | `string` | Indexed, Unique per account |
| `phone_number_id`                   | `phoneNumberId`                      | `string` | Indexed, Unique per phone   |
| `waba_id`                           | `wabaId`                             | `string` | Nullable                    |
| `access_token` (encrypted)          | `encryptedAccessToken`               | `string` | AES-256-GCM / CBC Encrypted |
| `verify_token` (encrypted)          | `encryptedVerifyToken`               | `string` | AES-256-GCM / CBC Encrypted |
| `status`                            | `status`                             | `string` | Default: `'disconnected'`   |
| `registered_at`                     | `registeredAt`                       | `string` | ISO Date String or Null     |
| `last_registration_error`           | `lastRegistrationError`              | `string` | Nullable                    |
| `subscribed_apps_at`                | `subscribedAppsAt`                   | `string` | ISO Date String or Null     |
| `created_at`                        | `createdAt`                          | `string` | ISO Date String             |
| `updated_at`                        | `updatedAt`                          | `string` | ISO Date String             |
| `created_by`                        | `createdBy`                          | `string` | User ID                     |
| `updated_by`                        | `updatedBy`                          | `string` | User ID                     |
| `encryption_key_version`            | `encryptionKeyVersion`               | `string` | Default: `'v1'`             |

---

## 3. Required Security & Isolation Rules

1. **No Plaintext Token Storage**: Access tokens and verify tokens must be encrypted server-side before persisting into `whatsapp_configs`.
2. **No Decrypted Tokens in API Output**: `GET /api/whatsapp/config` returns `has_access_token: boolean` and `has_verify_token: boolean` without revealing ciphertext or plaintext tokens.
3. **No Synthetic Accounts**: Require 401 (`AUTH_REQUIRED`) on missing session, 403 (`ACCOUNT_MEMBERSHIP_REQUIRED`) on missing membership, and 403 (`ROLE_REQUIRED`) for non-admin mutations.
