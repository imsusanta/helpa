# Voice implementation audit

Audit basis: latest fetched `main` (`17f3531`, 2026-08-10). The existing implementation was not production voice code: every provider returned local data or unconditional success.

## Existing providers and capabilities

| Provider   | Existing implementation                                                                                                          | Documented status after audit                                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ElevenLabs | Scaffolded class with fake agents/numbers, synthetic call IDs, unconditional webhook acceptance, and `true` transfer/end results | Real API adapter implemented for agents, phone numbers, SIP outbound calls, conversation status/transcripts, and signed post-call webhooks. Transfer/termination explicitly unsupported. |
| Sarvam AI  | Scaffolded class with fake agents/numbers, synthetic IDs/statuses and fake transfer/end                                          | Unavailable until an official public telephony API and webhook signature contract is documented.                                                                                         |
| xAI        | Scaffolded class with fake agents/numbers, synthetic IDs/statuses and fake transfer/end                                          | Unavailable until xAI documents a public telephony voice-agent API and webhook contract.                                                                                                 |

## Mock and fake-success paths found

- `src/core/providers/voice/elevenlabs-provider.ts`: `verifyWebhook()` returned `true`; agents and phone numbers were hard-coded; outbound/status IDs and completion values were generated locally; transcript was always null; transfer and end returned `true`.
- `src/core/providers/voice/sarvam-provider.ts` and `xai-provider.ts`: same patterns, plus payload `account_id` and arbitrary payload fields were trusted.
- `src/app/api/webhooks/voice/[provider]/route.ts`: generated an event ID from the current time, accepted a payload tenant ID, wrote through a Supabase-shaped adapter, and returned `{ success: true }` before any trustworthy tenant mapping.
- `src/queues/workers/multichannel-followup.ts`: called the old fake provider method without idempotency, authorization, consent, or persisted provider confirmation.

## Configuration gaps

The repository had no voice provider environment variables in `.env.local.example`, no webhook secret, no voice integration mapping, and no documented voice collections/indexes. `APPWRITE_API_KEY` is server-only in the new examples; no `NEXT_PUBLIC_*` secret is introduced.

## Existing webhook routes and lifecycle

The only voice route was `POST /api/webhooks/voice/[provider]`. It parsed JSON before meaningful verification, used `call_events` (not present in the Appwrite collection configuration), upserted a call with payload-provided tenant data, and returned success. There was no authenticated outbound dashboard route, no state transition validator, no command/idempotency record, no replay protection, and no trusted provider-number mapping.

## Tenant-isolation findings

- Tenant identity came from `payload.account_id`, with a hard-coded fallback.
- Provider classes accepted `clinicId` from callers and echoed it into normalized events.
- The webhook did not validate that the agent/phone number belonged to a unique tenant.
- The old call repository updated a document by ID without first checking its `accountId`.
- No voice API route validated an Appwrite session, Team role, contact ownership, or consent.

## Appwrite data model and indexes

Existing `APPWRITE_CONFIG` contained `calls` and `provider_events`, but not the required `voice_integrations` or `voice_commands`; the setup script provisioned collections with generic user permissions and did not provision voice attributes or indexes. The implementation adds the two collections and documents the required schema/indexes in `docs/VOICE_SETUP.md`. Raw webhook payloads are stored in Appwrite Storage and only a reference/hash is stored in `provider_events`.

## Provider features that cannot be implemented from documented APIs

ElevenLabs documents list agents, list phone numbers, SIP outbound initiation, get conversation details (including transcript), and HMAC post-call webhooks. Its documented API reference does not expose a general REST transfer or terminate operation for an existing SIP conversation; both are therefore typed unsupported errors. Sarvam AI and xAI do not currently document the required public telephony agent, phone-number, call-control, status/transcript, and signed-webhook contract used by this application.

## File-by-file implementation plan

1. Replace `src/core/providers/voice/*` with a typed provider contract, explicit capabilities/errors, a real ElevenLabs HTTP adapter, and honest unsupported providers.
2. Add `voice_integrations`, `voice_commands`, provider-event/call persistence helpers, tenant mapping, idempotency, and Appwrite-only storage in `src/infrastructure/appwrite/`.
3. Replace the voice webhook route with raw-body limits, HMAC/timestamp verification, payload hashing, storage, unique mapping, deduplication, normalized persistence, and safe responses.
4. Add authenticated `/api/voice/outbound`, deriving account/user/role from the verified Appwrite session and contact from the same tenant.
5. Add real voice fields/index provisioning to `scripts/setup-appwrite-db.ts` and safe provider health details to `/api/health`.
6. Update worker behavior so legacy unauthenticated/fake voice dispatch cannot initiate calls.
7. Add `docs/VOICE_SETUP.md`, README references, provider API references, tests for cryptographic/security/failure behavior, and an opt-in smoke-test script.

## Residual verification work

The repository’s wider migration still contains legacy names and compatibility adapters for non-voice CRM routes. This audit does not broaden the change into a CRM rewrite. CI must be run after the focused voice changes; Appwrite provisioning requires real deployment credentials and is intentionally not run automatically without them.
