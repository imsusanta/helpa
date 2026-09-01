-- AI failover defaults
-- Keep existing custom models untouched. Only replace the deprecated
-- Cloudflare Llama 3.1 8B default that Helpa shipped previously.

insert into public.system_settings (key, value)
values (
  'system_cloudflare_model',
  '"@cf/meta/llama-3.3-70b-instruct-fp8-fast"'::jsonb
)
on conflict (key) do update
set value = excluded.value
where public.system_settings.value = '"@cf/meta/llama-3.1-8b-instruct"'::jsonb;

-- accounts.cloudflare_model column is created by a later migration in this
-- repo (AI provider columns); guard so this file also works on databases
-- where it doesn't exist yet.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'accounts'
      and column_name = 'cloudflare_model'
  ) then
    update public.accounts
    set cloudflare_model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
    where cloudflare_model = '@cf/meta/llama-3.1-8b-instruct';
  end if;
end
$$;
