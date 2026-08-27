-- Travel Proposal layer for the existing quotation engine.
-- Keeps quotations/invoices compatible while adding travel-specific structured data.

begin;

alter table public.quotations
  add column if not exists travel_details jsonb;

create index if not exists idx_quotations_travel_details
  on public.quotations using gin (travel_details);

commit;
