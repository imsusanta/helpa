begin;

create table if not exists public.automation_steps (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  parent_step_id uuid references public.automation_steps(id) on delete cascade,
  branch text check (branch in ('yes', 'no')),
  step_type text not null,
  step_config jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.automation_steps enable row level security;

create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  trigger_event text not null default '',
  steps_executed jsonb not null default '[]'::jsonb,
  status text not null check (status in ('success', 'partial', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);
alter table public.automation_logs enable row level security;

create table if not exists public.automation_pending_executions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  log_id uuid references public.automation_logs(id) on delete cascade,
  parent_step_id uuid references public.automation_steps(id) on delete set null,
  branch text check (branch in ('yes', 'no')),
  next_step_position integer not null default 0,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed')),
  run_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_automation_pending_due
  on public.automation_pending_executions(run_at) where status = 'pending';
create index if not exists idx_automation_pending_account
  on public.automation_pending_executions(account_id);
alter table public.automation_pending_executions enable row level security;

create unique index if not exists uq_pending_appointment_reminder
  on public.automation_pending_executions (
    automation_id,
    ((context ->> 'appointment_id'))
  )
  where status = 'pending'
    and (context ->> 'appointment_id') is not null;

commit;
