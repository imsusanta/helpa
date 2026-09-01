# Evolution Go WhatsApp integration

Helpa can send and receive WhatsApp messages through **Evolution Go
v0.7.2** as a QR / linked-device provider. This sits beside the existing
Meta Cloud API integration. Meta Embedded Signup, inbox, CRM, AI,
appointments, automations, RLS, and historical messages stay unchanged.

Verified contracts come from
[`evolution-foundation/evolution-go@0.7.2`](https://github.com/evolution-foundation/evolution-go/releases/tag/0.7.2)
(`pkg/routes/routes.go`, Swagger, `pkg/middleware/auth_middleware.go`).
Do **not** use Evolution API Node.js routes (`/instance/{name}/qrcode`,
`instanceName`, `WHATSAPP-BAILEYS`).

## Architecture

```
Helpa features
    |
Unified WhatsApp service / send routes / automations
    |
Provider resolver (canonical whatsapp_configs.provider)
    |----------------------|
Meta Cloud API        Evolution Go v0.7.2
    |                      |
Embedded Signup       QR linked-device instance
```

Provider selection is always the tenant’s **server-side**
`whatsapp_configs` row:

| Stored `provider` | Runtime kind |
| --- | --- |
| empty / `meta` / `meta_embedded_signup` / `meta_manual_config` | `meta` |
| `evolution` | `evolution` |
| `waha` | `waha` (legacy, still supported) |
| anything else | fail closed — never routed to Meta |

## Deployment topology

Run Evolution Go as a **separate container** from Next.js. Keep its
Postgres databases (`evogo_auth`, `evogo_users`) out of Helpa’s Supabase
`public` schema.

Pin the image:

```text
evoapicloud/evolution-go:0.7.2
```

Do not use `latest` in production.

Example stack: `docker/evolution-go/docker-compose.yml`.

```bash
export EVOLUTION_GO_GLOBAL_API_KEY="$(openssl rand -hex 32)"
export EVOLUTION_POSTGRES_PASSWORD="$(openssl rand -hex 24)"
docker compose -f docker/evolution-go/docker-compose.yml up -d
curl -fsS "http://127.0.0.1:8080/server/ok"
```

Point Helpa at that service with the environment variables below.
Production URLs must be HTTPS. Production `EVOLUTION_GO_BASE_URL` must
be a durable public HTTPS origin that Vercel Functions can reach.
`localhost`, a developer laptop, and ephemeral tunnels (for example
trycloudflare) are not valid production hosts.

## Required Evolution Go version

**0.7.2.** Auth header is `apikey`.

Administrative instance routes use `EVOLUTION_GO_GLOBAL_API_KEY`:

- `POST /instance/create` body `{ name, token, instanceId? }`
- `DELETE /instance/delete/:instanceId`
- `GET /instance/info/:instanceId`

Instance-token routes:

- `POST /instance/connect` body `{ webhookUrl, subscribe[], rabbitmqEnable, websocketEnable, natsEnable }`
- `GET /instance/qr`
- `GET /instance/status`
- `POST /instance/reconnect`
- `POST /instance/disconnect`
- `DELETE /instance/logout`
- `POST /send/text` body `{ number, text, formatJid }`
- `POST /send/media` body `{ number, url, type, caption, filename, formatJid }`
- `POST /send/button` body `{ number, title, description, footer, buttons[], formatJid }` — reply buttons only (up to 3)

Helpa subscribes to `MESSAGE`, `CONNECTION`, `READ_RECEIPT`, `QRCODE`, `GROUP`.
Evolution Go v0.7.2 webhooks are unsigned JSON POSTs; Helpa authenticates
them with a high-entropy URL secret.

## Environment variables

All server-only. Never use a `NEXT_PUBLIC_` prefix.

| Variable | Purpose |
| --- | --- |
| `EVOLUTION_GO_BASE_URL` | Origin of the Evolution Go service |
| `EVOLUTION_GO_GLOBAL_API_KEY` | Global admin `apikey` |
| `EVOLUTION_GO_WEBHOOK_BASE_URL` | Public Helpa origin used to build `/api/webhooks/evolution/{secret}` |
| `EVOLUTION_GO_TIMEOUT_MS` | Optional per-request timeout (3s–120s, default 30s; capped at 3.5s on Vercel) |
| `EVOLUTION_GO_SESSION_BUDGET_MS` | Optional whole QR session budget (3s–120s; default 5s on Vercel so Helpa returns JSON before a platform HTML 502) |

`WHATSAPP_TOKEN_ENCRYPTION_KEY` (or `ENCRYPTION_KEY`) encrypts the
tenant instance token with AES-256-GCM before persistence.

## Database

Apply this additive migration on the Helpa Supabase project **before**
the first QR connect (Dashboard → SQL Editor, or
`npm run supabase:migrate`):

`supabase/migrations/20260828010000_evolution_go_whatsapp_provider.sql`

It adds `provider_instance_id`, `provider_instance_name`,
`provider_token_encrypted`, `connection_status`, and `webhook_secret_hash`
to `whatsapp_configs`. Existing Meta rows stay unchanged. If those
columns are missing, QR connect now fails with that file path instead of
saving a half-written config.

## License activation

Evolution Go requires a license. v0.7.2 can auto-activate when
`EVOLUTION_OPERATOR_EMAIL` matches the email used for the first manual
registration (`/v1/register/auto`). If that email is not registered yet,
complete the manager license flow once, then restart.

Helpa does not embed or proxy license keys.

## Connection lifecycle

1. An account admin chooses **Connect with QR** in Settings.
2. Helpa authorizes the admin and rate-limits the session route.
3. If an Evolution instance already exists for the account, Helpa reuses
   it. It does not create a second instance.
4. Otherwise Helpa creates the instance with the global API key, stores
   the encrypted instance token, and connects with that token.
5. Helpa returns the real QR from `GET /instance/qr`. The browser never
   calls Evolution Go. If the Vercel function budget is almost exhausted,
   Helpa returns `creating_instance` / `waiting_for_qr` JSON instead of
   waiting; the panel poll finishes connect + QR on the next GET.
6. The UI polls `GET /api/whatsapp/qr/session` until connected,
   disconnected, expired, or unmounted.
7. After scan, Helpa stores the linked phone/identity and sets
   `provider=evolution`.
8. Inbound webhooks enter the existing inbox + AI pipeline.
9. Outbound replies use `EvolutionGoProvider`.

Disconnect logs out/deletes the Evolution instance and clears only
Evolution credentials. Contacts, conversations, messages, appointments,
and audit history stay.

If Meta is already live (`connected` / `coexistence_connected`), QR
connect returns HTTP 409. Disconnect Meta first.

## Webhook configuration

Callback URL (tenant-specific secret, hashed at rest):

```text
{EVOLUTION_GO_WEBHOOK_BASE_URL}/api/webhooks/evolution/{secret}
```

- Tenant mapping uses `webhook_secret_hash` + `provider_instance_id`.
- `account_id` / `tenant_id` in the JSON body are ignored.
- Duplicate deliveries are idempotent via `provider_events` and external
  message IDs.
- From-me / outbound events do not create inbound inbox rows.
- Receipt events update message status only.

## Operational health checks

- Helpa: Settings → WhatsApp → Test Health, or
  `GET /api/whatsapp/config` as an authenticated admin.
- Evolution: `GET {EVOLUTION_GO_BASE_URL}/server/ok`.
- Reconnect is explicit (`POST /api/whatsapp/qr/session` with
  `{ "action": "reconnect" }`). Health checks never destroy and recreate
  instances.

## Secret rotation

1. Generate a new `EVOLUTION_GO_GLOBAL_API_KEY` on Evolution Go and in
   Helpa. Existing instance tokens stay valid until regenerated.
2. To rotate a tenant instance token, unlink the QR device and connect
   again. Helpa issues a new token and webhook secret.
3. After rotation, old webhook URLs return 403.

## Backup and restore

- Back up Helpa’s Supabase database (including `whatsapp_configs`) and
  Evolution’s `evogo_auth` / `evogo_users` databases separately.
- Restoring Helpa without Evolution (or the reverse) leaves QR sessions
  in `reconnect_required` until the matching instance exists.
- Encrypted instance tokens are useless without
  `WHATSAPP_TOKEN_ENCRYPTION_KEY`.

## Known limitations

- Evolution Go is a linked-device connection, not the Meta Cloud API.
- Meta-approved message templates are **not** sent on Evolution.
  `sendTemplate` returns an explicit unsupported-operation error and is
  never silently routed to Meta.
- Interactive buttons/lists are flattened to numbered text on Evolution.
- Passkey / WebAuthn pairing (v0.7.2 Shortcake flow) is owned by
  Evolution Go; Helpa surfaces pairing codes when present.
- `simulate_paired` exists only for test/demo (`NODE_ENV=test` or
  `ALLOW_WHATSAPP_QR_SIMULATION=true`) and is forbidden in production.
- On Vercel, QR session handlers cap Evolution I/O so they can return
  JSON before the platform kills the invocation with an HTML 502. Raise
  `EVOLUTION_GO_SESSION_BUDGET_MS` only when the function `maxDuration`
  is comfortably larger than that budget.
- WAHA remains in the tree for backward compatibility and is not removed
  by this integration.

## Meta official templates vs Evolution linked-device mode

| | Official WhatsApp (Meta) | Connect with QR (Evolution) |
| --- | --- | --- |
| Setup | Embedded Signup | Scan QR as a linked device |
| Templates | Meta-approved templates | Not available |
| Identity | WhatsApp Business Cloud number | The phone that scanned the QR |
| Webhooks | Meta-signed Cloud API webhooks | URL secret to Helpa |
| Best for | Official business messaging | Linking an existing personal/business app |

## Rollback

1. Disconnect QR workspaces from Settings (or
   `DELETE /api/whatsapp/qr/session`).
2. Unset the three `EVOLUTION_GO_*` variables and redeploy Helpa.
3. Stop the Evolution Go container.
4. Leave the additive migration in place; unused columns are nullable
   and do not change Meta rows.
5. To revert application code, deploy the previous Helpa revision. Meta
   connections are unaffected.

## Manual verification checklist

- [ ] Meta Embedded Signup still connects and sends.
- [ ] QR connect shows a real Evolution QR (not a synthetic Helpa image).
- [ ] Scan links the device; inbox receives an inbound text.
- [ ] Reply from Helpa uses the instance `apikey`, not the global key.
- [ ] Template send on an Evolution workspace returns 422.
- [ ] Tenant A cannot poll or disconnect Tenant B.
- [ ] Disconnect leaves conversation history intact.
- [ ] Browser network tab never shows Evolution Go or instance tokens.
