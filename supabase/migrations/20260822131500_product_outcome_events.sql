-- Privacy-safe, versioned source events for independently verifiable product outcomes.
-- This migration creates the measurement foundation only; it does not publish
-- results or claim that a complete observation window exists.
begin;

create table if not exists public.product_outcome_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  event_name text not null check (
    event_name in (
      'inbound_message_received',
      'first_response_sent',
      'booking_confirmed',
      'automation_eligible',
      'automation_completed',
      'staff_takeover',
      'automation_error',
      'appointment_completed',
      'patient_return_completed'
    )
  ),
  event_version smallint not null default 1 check (event_version = 1),
  occurred_at timestamptz not null,
  source_id text not null check (length(source_id) between 16 and 200),
  subject_hash text check (
    subject_hash is null or subject_hash ~ '^[a-f0-9]{64}$'
  ),
  is_synthetic boolean not null default false,
  is_test_tenant boolean not null default false,
  attributes jsonb not null default '{}'::jsonb check (
    jsonb_typeof(attributes) = 'object'
    and not (
      attributes ?| array[
        'name',
        'patient_name',
        'patient_id',
        'phone',
        'phone_number',
        'email',
        'message',
        'message_body'
      ]
    )
  ),
  recorded_at timestamptz not null default now(),
  unique (account_id, event_name, event_version, source_id)
);

comment on table public.product_outcome_events is
  'Versioned, de-identified source events for audited product outcome calculations.';
comment on column public.product_outcome_events.source_id is
  'Opaque idempotency identifier; must not contain patient data.';
comment on column public.product_outcome_events.subject_hash is
  'Optional one-way HMAC/sha256 identity used only for cohort deduplication.';

create index if not exists product_outcome_events_account_window_idx
  on public.product_outcome_events (account_id, occurred_at desc)
  where is_synthetic = false and is_test_tenant = false;

create index if not exists product_outcome_events_metric_window_idx
  on public.product_outcome_events (event_name, occurred_at desc)
  where is_synthetic = false and is_test_tenant = false;

alter table public.product_outcome_events enable row level security;
alter table public.product_outcome_events force row level security;

revoke all on table public.product_outcome_events from public, anon, authenticated;
grant select, insert on table public.product_outcome_events to service_role;

-- No client-facing policy is intentional. Collection and reporting run only in
-- trusted server jobs, and public reporting requires a separately reviewed,
-- aggregate-only publication path.
drop policy if exists "service_role_collects_product_outcomes"
  on public.product_outcome_events;
create policy "service_role_collects_product_outcomes"
  on public.product_outcome_events
  for all
  to service_role
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

commit;
