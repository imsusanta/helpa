-- ============================================================
-- Migration: 20260828010000_evolution_go_whatsapp_provider.sql
-- Purpose: Additive Evolution Go QR/linked-device columns on
--          public.whatsapp_configs. Existing Meta rows and RLS
--          policies are preserved. Encrypted credentials stay on
--          the table (admin RLS only) and are not published through
--          a public view.
-- ============================================================

begin;

alter table public.whatsapp_configs
  add column if not exists provider_instance_id text,
  add column if not exists provider_instance_name text,
  add column if not exists provider_token_encrypted text,
  add column if not exists connection_status text,
  add column if not exists webhook_secret_hash text;

-- Existing installations already store Meta provider strings. Keep those
-- values valid while adding evolution and legacy waha.
alter table public.whatsapp_configs
  drop constraint if exists whatsapp_configs_provider_check;

alter table public.whatsapp_configs
  add constraint whatsapp_configs_provider_check
  check (
    provider in (
      'meta',
      'meta_embedded_signup',
      'meta_manual_config',
      'evolution',
      'waha'
    )
  );

create index if not exists idx_whatsapp_configs_provider_instance_id
  on public.whatsapp_configs (provider_instance_id);

create index if not exists idx_whatsapp_configs_provider_account
  on public.whatsapp_configs (account_id, provider);

-- One Evolution Go instance may belong to at most one Helpa account.
create unique index if not exists whatsapp_configs_evolution_instance_uidx
  on public.whatsapp_configs (provider_instance_id)
  where provider = 'evolution'
    and provider_instance_id is not null;

create unique index if not exists whatsapp_configs_evolution_webhook_secret_uidx
  on public.whatsapp_configs (webhook_secret_hash)
  where provider = 'evolution'
    and webhook_secret_hash is not null;

comment on column public.whatsapp_configs.provider_instance_id is
  'Evolution Go instance UUID. Used for server-side tenant mapping; never trusted from webhook bodies.';
comment on column public.whatsapp_configs.provider_instance_name is
  'Opaque Evolution Go instance name. Does not contain tenant identifiers.';
comment on column public.whatsapp_configs.provider_token_encrypted is
  'AES-256-GCM ciphertext of the Evolution Go instance token. Server-only.';
comment on column public.whatsapp_configs.webhook_secret_hash is
  'SHA-256 hex digest of the per-connection webhook URL secret.';
comment on column public.whatsapp_configs.connection_status is
  'Provider-specific connection lifecycle (creating_instance, waiting_for_qr, waiting_for_scan, connected, disconnected, reconnect_required, error).';

commit;
