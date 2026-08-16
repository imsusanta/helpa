# Helpa Production Readiness & Pre-Flight Checklist

Use this checklist prior to rolling out new versions or onboarding high-volume enterprise tenants.

---

## 1. Environment & Secrets Configuration

- [ ] `AUTH_PROVIDER="supabase"` and `DATABASE_PROVIDER="supabase"` are set in production environment.
- [ ] `MIGRATION_MODE="cutover"` is configured.
- [ ] `ENCRYPTION_KEY` is a 64-character (32-byte) cryptographically secure hex string.
- [ ] `WHATSAPP_APP_SECRET` matches Meta App Dashboard settings.
- [ ] `NEXT_PUBLIC_META_APP_ID` and `NEXT_PUBLIC_META_CONFIG_ID` are configured.
- [ ] `OPENROUTER_API_KEY` is set with appropriate balance/limits.

---

## 2. Database & Migrations

- [ ] Run `npm run supabase:validate` to ensure migration manifest integrity.
- [ ] Verify Row Level Security (RLS) is enabled on all tables in PostgreSQL.
- [ ] Confirm indexes on `(account_id, created_at)` and `(account_id, status)` for high-frequency queries.

---

## 3. Webhooks & Messaging

- [ ] Webhook URL registered in Meta App Dashboard: `https://<your-domain>/api/whatsapp/webhook`.
- [ ] Verify Token set and tested.
- [ ] HMAC signature validation enabled (`X-Hub-Signature-256`).
- [ ] Test message roundtrip via `/api/whatsapp/broadcast` or live sandbox.

---

## 4. Security & Compliance Safeguards

- [ ] Verify zero secrets committed to Git repository via Gitleaks scan.
- [ ] Verify `Cache-Control: private, no-store` on all authenticated and PHI API responses.
- [ ] Ensure all phone numbers and sensitive data are redacted in telemetry logs.
- [ ] Super Admin access restricted to authorized emails (`susantalohr@gmail.com`).
