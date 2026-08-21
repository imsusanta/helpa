begin;

-- Canonical WhatsApp connection fields used by the Supabase-backed
-- Embedded Signup flow. The base tenant migration creates whatsapp_configs
-- with the minimum phone/token fields; these columns keep the connection
-- record extensible without reintroducing the legacy whatsapp_config table.
alter table public.whatsapp_configs
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists waba_id text,
  add column if not exists status text not null default 'disconnected',
  add column if not exists connection_type text not null default 'standard',
  add column if not exists verify_token text,
  add column if not exists registered_at timestamptz,
  add column if not exists connected_at timestamptz,
  add column if not exists subscribed_apps_at timestamptz,
  add column if not exists last_health_check_at timestamptz,
  add column if not exists last_webhook_at timestamptz,
  add column if not exists last_message_at timestamptz,
  add column if not exists last_registration_error text,
  add column if not exists display_phone_number text,
  add column if not exists phone_number text,
  add column if not exists verified_name text,
  add column if not exists business_name text,
  add column if not exists coexistence_status text,
  add column if not exists webhook_healthy boolean not null default false,
  add column if not exists messaging_active boolean not null default false,
  add column if not exists encrypted_verify_token text;

-- The canonical schema already requires encrypted_access_token. Keep the
-- token encrypted at rest; no plaintext access_token column is introduced.

create index if not exists whatsapp_configs_waba_id_idx
  on public.whatsapp_configs (waba_id)
  where waba_id is not null;

commit;
