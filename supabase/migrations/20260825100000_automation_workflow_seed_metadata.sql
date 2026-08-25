begin;

alter table public.automations
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_automations_seed_metadata
  on public.automations ((metadata ->> 'workflow_seed_key'))
  where (metadata ->> 'helpa_seeded_workflow') = 'true';

commit;
