-- Secure customer-facing access token for travel proposals.

begin;

alter table public.quotations
  add column if not exists public_token text;

create unique index if not exists uq_quotations_public_token
  on public.quotations(public_token)
  where public_token is not null;

commit;
