-- Extend privacy-safe observation events and add a service-role heartbeat
-- table so Helpa can collect a 30-day production window. This does not
-- start an observation period or publish any measured results.

begin;

alter table public.product_outcome_events
  drop constraint if exists product_outcome_events_event_name_check;

alter table public.product_outcome_events
  add constraint product_outcome_events_event_name_check
  check (
    event_name in (
      'inbound_message_received',
      'first_response_sent',
      'outbound_message_sent',
      'booking_confirmed',
      'automation_eligible',
      'automation_completed',
      'staff_takeover',
      'automation_error',
      'appointment_completed',
      'patient_return_completed',
      'message_delivery_failed',
      'webhook_failed',
      'ai_failed',
      'worker_failed',
      'integration_failed'
    )
  );

comment on constraint product_outcome_events_event_name_check
  on public.product_outcome_events is
  'Allowlisted product and reliability event names. Raw events stay server-only.';

create table if not exists public.operational_heartbeats (
  service_name text primary key
    check (
      service_name in (
        'whatsapp-outbox-worker',
        'voice-outbox-worker'
      )
    ),
  last_seen_at timestamptz not null default now(),
  status text not null default 'ok'
    check (status in ('ok', 'error')),
  details jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(details) = 'object'
      and not (
        details ?| array[
          'token',
          'secret',
          'password',
          'key',
          'phone',
          'email',
          'message',
          'message_body'
        ]
      )
    )
);

comment on table public.operational_heartbeats is
  'Non-identifying worker liveness. No tenant or patient data.';

alter table public.operational_heartbeats enable row level security;
alter table public.operational_heartbeats force row level security;

revoke all on table public.operational_heartbeats from public, anon, authenticated;
grant select, insert, update on table public.operational_heartbeats to service_role;

drop policy if exists "service_role_manages_operational_heartbeats"
  on public.operational_heartbeats;
create policy "service_role_manages_operational_heartbeats"
  on public.operational_heartbeats
  for all
  to service_role
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

commit;
