-- Transactional WhatsApp Outbox:
-- Provides atomic enqueue (messages + whatsapp_outbox in one transaction)
-- and safe concurrent worker claiming (FOR UPDATE SKIP LOCKED with lease).

begin;

-- 1. Extend public.whatsapp_outbox with production columns
alter table public.whatsapp_outbox
  add column if not exists conversation_id uuid references public.conversations(id) on delete restrict,
  add column if not exists provider text not null default 'meta',
  add column if not exists max_attempts integer not null default 8,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists provider_message_id text,
  add column if not exists last_error_message text,
  add column if not exists sent_at timestamptz,
  add column if not exists dead_lettered_at timestamptz;

-- 2. Widen status check constraint to include all required states
alter table public.whatsapp_outbox
  drop constraint if exists whatsapp_outbox_status_check;

alter table public.whatsapp_outbox
  add constraint whatsapp_outbox_status_check
  check (status in ('pending', 'processing', 'retryable', 'retrying', 'sent', 'failed', 'dead_letter', 'cancelled', 'unknown'));

-- 3. Check constraints on attempts
alter table public.whatsapp_outbox
  drop constraint if exists whatsapp_outbox_attempt_count_check,
  drop constraint if exists whatsapp_outbox_max_attempts_check;

alter table public.whatsapp_outbox
  add constraint whatsapp_outbox_attempt_count_check check (attempt_count >= 0),
  add constraint whatsapp_outbox_max_attempts_check check (max_attempts > 0);

-- 4. Enable RLS and establish clean tenant access
alter table public.whatsapp_outbox enable row level security;
alter table public.whatsapp_outbox force row level security;

revoke all on table public.whatsapp_outbox from public, anon;
grant select on table public.whatsapp_outbox to authenticated;
grant all on table public.whatsapp_outbox to service_role;

drop policy if exists "service_role_manages_whatsapp_outbox" on public.whatsapp_outbox;
create policy "service_role_manages_whatsapp_outbox"
  on public.whatsapp_outbox
  for all
  to service_role
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

drop policy if exists "tenant_members_read_whatsapp_outbox" on public.whatsapp_outbox;
create policy "tenant_members_read_whatsapp_outbox"
  on public.whatsapp_outbox
  for select
  to authenticated
  using (
    account_id = (select (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid)
  );

-- 5. Indexes for claim queue performance and idempotency lookups
create index if not exists idx_whatsapp_outbox_claim
  on public.whatsapp_outbox (status, available_at, created_at)
  where status in ('pending', 'retryable', 'retrying');

create index if not exists idx_whatsapp_outbox_lease
  on public.whatsapp_outbox (lease_expires_at)
  where status = 'processing';

create index if not exists idx_whatsapp_outbox_message_id
  on public.whatsapp_outbox (message_id);

create index if not exists idx_whatsapp_outbox_conversation_id
  on public.whatsapp_outbox (conversation_id);

create index if not exists idx_whatsapp_outbox_provider_msg
  on public.whatsapp_outbox (provider_message_id)
  where provider_message_id is not null;

-- 6. Atomic enqueue function: commits messages row and whatsapp_outbox row in 1 transaction
create or replace function public.enqueue_whatsapp_outbound_message(
  p_account_id uuid,
  p_conversation_id uuid,
  p_idempotency_key text,
  p_provider text default 'meta',
  p_content_type text default 'text',
  p_content_text text default null,
  p_sender_type text default 'agent',
  p_media_url text default null,
  p_max_attempts integer default 8,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
  v_outbox_id uuid;
  v_existing_outbox_id uuid;
  v_existing_message_id uuid;
  v_existing_status text;
  v_existing_provider_msg_id text;
  v_conversation_account_id uuid;
begin
  -- Validate required inputs
  if p_account_id is null or p_conversation_id is null or p_idempotency_key is null or trim(p_idempotency_key) = '' then
    return jsonb_build_object(
      'ok', false,
      'error', 'INVALID_PARAMETERS',
      'message', 'account_id, conversation_id, and idempotency_key are required'
    );
  end if;

  -- Ensure conversation belongs to this tenant (fail-closed)
  select account_id
    into v_conversation_account_id
    from public.conversations
   where id = p_conversation_id;

  if v_conversation_account_id is null or v_conversation_account_id <> p_account_id then
    return jsonb_build_object(
      'ok', false,
      'error', 'CONVERSATION_NOT_FOUND',
      'message', 'Conversation not found or access denied for this tenant'
    );
  end if;

  -- Check if an outbox record with (account_id, idempotency_key) already exists
  select id, message_id, status, provider_message_id
    into v_existing_outbox_id, v_existing_message_id, v_existing_status, v_existing_provider_msg_id
    from public.whatsapp_outbox
   where account_id = p_account_id
     and idempotency_key = p_idempotency_key;

  if v_existing_outbox_id is not null then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'status', v_existing_status,
      'outbox_id', v_existing_outbox_id,
      'message_id', v_existing_message_id,
      'provider_message_id', v_existing_provider_msg_id
    );
  end if;

  -- Insert local outbound message in pending state
  insert into public.messages (
    account_id,
    conversation_id,
    direction,
    sender_type,
    content_type,
    content_text,
    media_url,
    status,
    created_at,
    updated_at
  ) values (
    p_account_id,
    p_conversation_id,
    'outbound',
    coalesce(p_sender_type, 'agent'),
    coalesce(p_content_type, 'text'),
    p_content_text,
    p_media_url,
    'pending',
    now(),
    now()
  ) returning id into v_message_id;

  -- Insert outbox delivery job in pending state
  insert into public.whatsapp_outbox (
    account_id,
    conversation_id,
    message_id,
    idempotency_key,
    provider,
    status,
    attempt_count,
    max_attempts,
    available_at,
    provider_result,
    created_at,
    updated_at
  ) values (
    p_account_id,
    p_conversation_id,
    v_message_id,
    p_idempotency_key,
    coalesce(p_provider, 'meta'),
    'pending',
    0,
    coalesce(p_max_attempts, 8),
    now(),
    coalesce(p_payload, '{}'::jsonb),
    now(),
    now()
  ) returning id into v_outbox_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'status', 'pending',
    'outbox_id', v_outbox_id,
    'message_id', v_message_id
  );

exception when unique_violation then
  -- Race condition: another transaction committed the same (account_id, idempotency_key)
  select id, message_id, status, provider_message_id
    into v_existing_outbox_id, v_existing_message_id, v_existing_status, v_existing_provider_msg_id
    from public.whatsapp_outbox
   where account_id = p_account_id
     and idempotency_key = p_idempotency_key;

  return jsonb_build_object(
    'ok', true,
    'duplicate', true,
    'status', coalesce(v_existing_status, 'processing'),
    'outbox_id', v_existing_outbox_id,
    'message_id', v_existing_message_id,
    'provider_message_id', v_existing_provider_msg_id
  );
end;
$$;

revoke all on function public.enqueue_whatsapp_outbound_message(uuid, uuid, text, text, text, text, text, text, integer, jsonb) from public, anon;
grant execute on function public.enqueue_whatsapp_outbound_message(uuid, uuid, text, text, text, text, text, text, integer, jsonb) to authenticated, service_role;

-- 7. Atomic claim function: concurrent workers claim with FOR UPDATE SKIP LOCKED
create or replace function public.claim_whatsapp_outbox_batch(
  p_worker_id text,
  p_batch_size integer default 20,
  p_lease_seconds integer default 120
)
returns table (
  id uuid,
  account_id uuid,
  conversation_id uuid,
  message_id uuid,
  idempotency_key text,
  provider text,
  attempt_count integer,
  max_attempts integer,
  payload jsonb,
  content_type text,
  content_text text,
  media_url text,
  sender_type text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease_duration interval;
begin
  v_lease_duration := (greatest(coalesce(p_lease_seconds, 120), 10) || ' seconds')::interval;

  return query
  with claimable as (
    select o.id as outbox_id
      from public.whatsapp_outbox o
     where (
       -- Ready jobs waiting for delivery
       (o.status in ('pending', 'retryable', 'retrying') and o.available_at <= now())
       or
       -- Stale claimed jobs whose worker crashed (lease expired)
       (o.status = 'processing' and o.lease_expires_at is not null and o.lease_expires_at < now())
     )
       and o.attempt_count < o.max_attempts
     order by o.available_at asc, o.created_at asc
     for update of o skip locked
     limit greatest(coalesce(p_batch_size, 20), 1)
  ),
  updated as (
    update public.whatsapp_outbox o
       set status = 'processing',
           locked_at = now(),
           locked_by = coalesce(p_worker_id, 'worker'),
           lease_expires_at = now() + v_lease_duration,
           attempt_count = o.attempt_count + 1,
           updated_at = now()
      from claimable c
     where o.id = c.outbox_id
    returning o.id, o.account_id, o.conversation_id, o.message_id, o.idempotency_key,
              o.provider, o.attempt_count, o.max_attempts, o.provider_result as payload
  )
  select u.id,
         u.account_id,
         u.conversation_id,
         u.message_id,
         u.idempotency_key,
         u.provider,
         u.attempt_count,
         u.max_attempts,
         u.payload,
         m.content_type,
         m.content_text,
         m.media_url,
         m.sender_type
    from updated u
    left join public.messages m on m.id = u.message_id and m.account_id = u.account_id;
end;
$$;

revoke all on function public.claim_whatsapp_outbox_batch(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_whatsapp_outbox_batch(text, integer, integer) to service_role;

commit;
