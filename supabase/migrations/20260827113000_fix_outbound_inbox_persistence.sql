-- Fix outbound WhatsApp messages disappearing from Inbox.
-- Safe/idempotent migration: adds the canonical provider ID when needed,
-- repairs the tenant-scoped uniqueness guard, and adds the exact index used
-- by the Inbox conversation message query.

begin;

alter table public.messages
  add column if not exists account_id uuid;

alter table public.messages
  add column if not exists conversation_id uuid;

alter table public.messages
  add column if not exists direction text;

alter table public.messages
  add column if not exists sender_type text;

alter table public.messages
  add column if not exists message_id text;

alter table public.messages
  add column if not exists provider_message_id text;

alter table public.messages
  add column if not exists content_type text;

alter table public.messages
  add column if not exists content_text text;

alter table public.messages
  add column if not exists status text;

alter table public.messages
  add column if not exists created_at timestamptz not null default now();

alter table public.messages
  add column if not exists updated_at timestamptz not null default now();

-- Older outbound rows can have message_id but no provider_message_id.
update public.messages
set provider_message_id = message_id
where provider_message_id is null
  and message_id is not null;

-- Outbound rows must be recognizable by the Inbox normalizer.
update public.messages
set direction = 'outbound'
where direction is null
  and sender_type in ('agent', 'bot');

-- Backfill account ownership from the parent conversation when possible.
update public.messages m
set account_id = c.account_id
from public.conversations c
where m.conversation_id = c.id
  and m.account_id is null
  and c.account_id is not null;

-- The Inbox filters by conversation_id and sorts by created_at. This index
-- prevents the message lookup from becoming a table scan as inbox volume grows.
create index if not exists idx_messages_conversation_created_at
  on public.messages (conversation_id, created_at);

-- Provider IDs are unique within a workspace/account. Existing duplicate
-- rows must not abort deployment, so create the unique guard only when the
-- current data permits it.
do $$
begin
  create unique index if not exists messages_account_provider_message_unique
    on public.messages (account_id, provider_message_id)
    where account_id is not null and provider_message_id is not null;
exception
  when unique_violation then
    raise warning 'Skipping outbound provider uniqueness index because duplicate provider_message_id rows already exist.';
end $$;

commit;
