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
  add column if not exists encrypted_verify_token text,
  add column if not exists access_token text,
  add column if not exists "accountId" uuid generated always as (account_id) stored;

-- Legacy application paths may still submit an encrypted value as
-- access_token. Normalize that compatibility field into the canonical
-- encrypted_access_token column before persistence.
create or replace function public.sync_whatsapp_access_token()
returns trigger
language plpgsql
as $$
begin
  if new.encrypted_access_token is null and new.access_token is not null then
    new.encrypted_access_token := new.access_token;
  elsif new.access_token is null and new.encrypted_access_token is not null then
    new.access_token := new.encrypted_access_token;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_whatsapp_access_token on public.whatsapp_configs;
create trigger sync_whatsapp_access_token
before insert or update on public.whatsapp_configs
for each row execute function public.sync_whatsapp_access_token();

create index if not exists whatsapp_configs_waba_id_idx
  on public.whatsapp_configs (waba_id)
  where waba_id is not null;

commit;
