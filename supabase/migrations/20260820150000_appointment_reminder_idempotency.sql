begin;

create unique index if not exists uq_pending_appointment_reminder
  on public.automation_pending_executions (
    automation_id,
    ((context ->> 'appointment_id'))
  )
  where status = 'pending'
    and (context ->> 'appointment_id') is not null;

commit;
