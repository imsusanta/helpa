create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;

-- No public write access. Super Admin API uses the service-role client after
-- authorization. Keep reads restricted to authenticated users; secrets are
-- never returned by the admin GET endpoint.
drop policy if exists "system_settings_public_read" on public.system_settings;
drop policy if exists "Allow public read access to system_settings" on public.system_settings;

create policy "system_settings_authenticated_read"
on public.system_settings
for select
to authenticated
using (true);

insert into public.system_settings (key, value) values
  ('system_ai_provider', '"openrouter"'::jsonb),
  ('system_ai_fallback_provider', '"none"'::jsonb),
  ('system_openrouter_model', '"google/gemini-2.5-flash"'::jsonb),
  ('system_orcarouter_model', '"orcarouter/auto"'::jsonb),
  ('system_cloudflare_model', '"@cf/meta/llama-3.1-8b-instruct"'::jsonb),
  ('system_openrouter_enabled', '"true"'::jsonb),
  ('system_orcarouter_enabled', '"true"'::jsonb),
  ('system_cloudflare_enabled', '"true"'::jsonb),
  ('system_feature_routing', '{}'::jsonb)
on conflict (key) do nothing;

create index if not exists idx_system_settings_key on public.system_settings(key);
