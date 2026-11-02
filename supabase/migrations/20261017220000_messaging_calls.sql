-- Advanced DM messaging + 1:1 call signaling (LiveKit room = call id).

-- Conversations / groups
alter table public.conversations
  add column if not exists title text,
  add column if not exists avatar_url text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists invite_code text unique;

alter table public.conversation_members
  add column if not exists muted_until timestamptz,
  add column if not exists role text not null default 'member',
  add column if not exists folder text,
  add column if not exists draft text,
  add column if not exists marked_unread boolean not null default false;

do $$ begin
  alter table public.conversation_members
    add constraint conversation_members_role_check
    check (role in ('owner', 'admin', 'member'));
exception when duplicate_object then null;
end $$;

-- Messages enrichment
alter table public.messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_for_everyone_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists pinned_at timestamptz,
  add column if not exists scheduled_for timestamptz,
  add column if not exists silent boolean not null default false,
  add column if not exists forwarded_from uuid references public.messages(id) on delete set null,
  add column if not exists duration_ms integer,
  add column if not exists meta jsonb not null default '{}'::jsonb;

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.message_hides (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.saved_messages (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create table if not exists public.chat_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Call state machine (server is source of truth)
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  media text not null check (media in ('audio', 'video')),
  status text not null default 'created'
    check (status in (
      'created', 'ringing', 'connecting', 'active', 'reconnecting',
      'ended', 'declined', 'missed', 'failed', 'cancelled'
    )),
  livekit_room text not null,
  answered_by uuid references auth.users(id) on delete set null,
  ended_by uuid references auth.users(id) on delete set null,
  end_reason text,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calls_callee_status_idx on public.calls (callee_id, status);
create index if not exists calls_caller_status_idx on public.calls (caller_id, status);
create index if not exists calls_conversation_created_idx on public.calls (conversation_id, created_at desc);
create index if not exists message_reactions_message_idx on public.message_reactions (message_id);
create index if not exists messages_scheduled_idx on public.messages (scheduled_for) where scheduled_for is not null;

alter table public.calls enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_hides enable row level security;
alter table public.saved_messages enable row level security;
alter table public.chat_folders enable row level security;

drop policy if exists calls_select on public.calls;
create policy calls_select on public.calls for select using (
  caller_id = auth.uid() or callee_id = auth.uid()
);

drop policy if exists calls_insert on public.calls;
create policy calls_insert on public.calls for insert with check (
  caller_id = auth.uid()
  and exists (
    select 1 from public.conversation_members m
    where m.conversation_id = calls.conversation_id and m.user_id = auth.uid()
  )
  and not public.is_blocked(caller_id, callee_id)
);

drop policy if exists calls_update on public.calls;
create policy calls_update on public.calls for update using (
  caller_id = auth.uid() or callee_id = auth.uid()
);

drop policy if exists message_reactions_all on public.message_reactions;
create policy message_reactions_all on public.message_reactions for all using (
  exists (
    select 1 from public.messages msg
    join public.conversation_members m on m.conversation_id = msg.conversation_id
    where msg.id = message_reactions.message_id and m.user_id = auth.uid()
  )
) with check (user_id = auth.uid());

drop policy if exists message_hides_own on public.message_hides;
create policy message_hides_own on public.message_hides for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists saved_messages_own on public.saved_messages;
create policy saved_messages_own on public.saved_messages for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists chat_folders_own on public.chat_folders;
create policy chat_folders_own on public.chat_folders for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Idempotent call transitions
create or replace function public.transition_call(
  p_call_id uuid,
  p_next text,
  p_reason text default null
) returns public.calls
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.calls;
  uid uuid := auth.uid();
  terminal text[] := array['ended', 'declined', 'missed', 'failed', 'cancelled'];
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select * into row from public.calls where id = p_call_id for update;
  if not found then raise exception 'not_found'; end if;
  if row.caller_id <> uid and row.callee_id <> uid then raise exception 'forbidden'; end if;

  -- Already terminal: return as-is (idempotent)
  if row.status = any(terminal) then
    return row;
  end if;

  if p_next = 'ringing' and row.status = 'created' then
    row.status := 'ringing';
  elsif p_next = 'connecting' and row.status in ('ringing', 'created') then
    if uid <> row.callee_id and uid <> row.caller_id then raise exception 'forbidden'; end if;
    if row.answered_by is not null and row.answered_by <> uid then
      raise exception 'answered_elsewhere';
    end if;
    row.status := 'connecting';
    row.answered_by := uid;
    row.answered_at := coalesce(row.answered_at, now());
  elsif p_next = 'active' and row.status in ('connecting', 'ringing', 'reconnecting') then
    row.status := 'active';
    row.started_at := coalesce(row.started_at, now());
    row.answered_at := coalesce(row.answered_at, now());
  elsif p_next = 'reconnecting' and row.status = 'active' then
    row.status := 'reconnecting';
  elsif p_next = 'declined' and row.status in ('created', 'ringing') then
    if uid <> row.callee_id then raise exception 'forbidden'; end if;
    row.status := 'declined';
    row.ended_by := uid;
    row.ended_at := now();
    row.end_reason := coalesce(p_reason, 'declined');
  elsif p_next = 'cancelled' and row.status in ('created', 'ringing') then
    if uid <> row.caller_id then raise exception 'forbidden'; end if;
    row.status := 'cancelled';
    row.ended_by := uid;
    row.ended_at := now();
    row.end_reason := coalesce(p_reason, 'cancelled');
  elsif p_next = 'missed' and row.status in ('created', 'ringing') then
    row.status := 'missed';
    row.ended_at := now();
    row.end_reason := coalesce(p_reason, 'timeout');
  elsif p_next = 'failed' then
    row.status := 'failed';
    row.ended_by := uid;
    row.ended_at := now();
    row.end_reason := coalesce(p_reason, 'failed');
  elsif p_next = 'ended' and row.status in ('connecting', 'active', 'reconnecting') then
    row.status := 'ended';
    row.ended_by := uid;
    row.ended_at := now();
    row.end_reason := coalesce(p_reason, 'hangup');
  else
    -- Illegal transition: ignore if already past, else fail softly by returning current
    return row;
  end if;

  row.updated_at := now();
  update public.calls set
    status = row.status,
    answered_by = row.answered_by,
    answered_at = row.answered_at,
    started_at = row.started_at,
    ended_by = row.ended_by,
    ended_at = row.ended_at,
    end_reason = row.end_reason,
    updated_at = row.updated_at
  where id = row.id;

  return row;
end;
$$;

create or replace function public.start_direct_call(
  p_conversation_id uuid,
  p_callee_id uuid,
  p_media text
) returns public.calls
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  call_id uuid := gen_random_uuid();
  row public.calls;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  if p_media not in ('audio', 'video') then raise exception 'invalid_media'; end if;
  if public.is_blocked(uid, p_callee_id) then raise exception 'blocked'; end if;
  if not exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = uid
  ) then raise exception 'forbidden'; end if;
  if not exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = p_callee_id
  ) then raise exception 'not_member'; end if;

  -- One active ringing/active call per pair
  update public.calls
  set status = 'missed', ended_at = now(), end_reason = 'superseded', updated_at = now()
  where status in ('created', 'ringing')
    and ((caller_id = uid and callee_id = p_callee_id) or (caller_id = p_callee_id and callee_id = uid));

  insert into public.calls (
    id, conversation_id, caller_id, callee_id, media, status, livekit_room
  ) values (
    call_id, p_conversation_id, uid, p_callee_id, p_media, 'ringing', 'call-' || call_id::text
  ) returning * into row;

  return row;
end;
$$;

create or replace function public.create_group_conversation(
  p_title text,
  p_member_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  mid uuid;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  insert into public.conversations (is_group, title, created_by, invite_code)
  values (true, nullif(trim(p_title), ''), uid, encode(gen_random_bytes(9), 'hex'))
  returning id into cid;
  insert into public.conversation_members (conversation_id, user_id, role)
  values (cid, uid, 'owner');
  foreach mid in array coalesce(p_member_ids, '{}') loop
    if mid is distinct from uid and not public.is_blocked(uid, mid) then
      insert into public.conversation_members (conversation_id, user_id, role)
      values (cid, mid, 'member')
      on conflict do nothing;
    end if;
  end loop;
  return cid;
end;
$$;

create or replace function public.delete_message_for_everyone(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  msg public.messages;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select * into msg from public.messages where id = p_message_id;
  if not found then raise exception 'not_found'; end if;
  if msg.sender_id <> auth.uid() then raise exception 'forbidden'; end if;
  if msg.created_at < now() - interval '48 hours' then raise exception 'too_old'; end if;
  update public.messages
  set deleted_at = now(),
      deleted_for_everyone_at = now(),
      body = null,
      media_url = null
  where id = p_message_id;
end;
$$;

grant execute on function public.transition_call(uuid, text, text) to authenticated;
grant execute on function public.start_direct_call(uuid, uuid, text) to authenticated;
grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;
grant execute on function public.delete_message_for_everyone(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.calls;
exception when duplicate_object then null;
when undefined_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.message_reactions;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
