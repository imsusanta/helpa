-- Align the durable WhatsApp outbox schema with the production service.
begin;

alter table public.whatsapp_outbox
  alter column message_id drop not null,
  add column if not exists conversation_id uuid,
  add column if not exists contact_id uuid,
  add column if not exists message_type text not null default 'text',
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists meta_message_id text,
  add column if not exists error_message text;

alter table public.whatsapp_outbox
  drop constraint if exists whatsapp_outbox_status_check;

alter table public.whatsapp_outbox
  add constraint whatsapp_outbox_status_check
  check (
    status in (
      'pending',
      'processing',
      'sent',
      'retrying',
      'reconciliation_required',
      'dead_letter',
      'unknown'
    )
  );

create index if not exists whatsapp_outbox_reconciliation_idx
  on public.whatsapp_outbox (status, available_at)
  where status in ('pending', 'retrying', 'reconciliation_required');

alter table public.whatsapp_outbox enable row level security;

drop policy if exists whatsapp_outbox_select on public.whatsapp_outbox;
create policy whatsapp_outbox_select
  on public.whatsapp_outbox
  for select
  to authenticated
  using (public.is_active_account_member(account_id));

commit;
