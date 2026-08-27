-- AI failover defaults
-- Keep existing custom models untouched. Only replace the deprecated
-- Cloudflare Llama 3.1 8B default that Helpa shipped previously.

insert into public.system_settings (key, value)
values (
  'system_cloudflare_model',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
)
on conflict (key) do update
set value = excluded.value
where public.system_settings.value = '@cf/meta/llama-3.1-8b-instruct';

update public.accounts
set cloudflare_model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
where cloudflare_model = '@cf/meta/llama-3.1-8b-instruct';
