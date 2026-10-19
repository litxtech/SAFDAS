-- Video live streams on top of live_rooms (voice rooms keep mode='voice')

alter table public.live_rooms
  add column if not exists mode text not null default 'voice',
  add column if not exists category text not null default 'all',
  add column if not exists privacy text not null default 'public',
  add column if not exists recording boolean not null default false,
  add column if not exists cover_url text,
  add column if not exists guest_id uuid references public.profiles(id) on delete set null,
  add column if not exists viewer_count integer not null default 0,
  add column if not exists like_count integer not null default 0,
  add column if not exists livekit_room text,
  add column if not exists host_heartbeat_at timestamptz,
  add column if not exists ended_at timestamptz;

update public.live_rooms set livekit_room = id::text where livekit_room is null;

alter table public.live_room_members
  add column if not exists chat_muted boolean not null default false,
  add column if not exists banned boolean not null default false,
  add column if not exists joined_at timestamptz not null default now();

create table if not exists public.live_room_comments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists live_room_comments_room_created_idx
  on public.live_room_comments (room_id, created_at desc);

create table if not exists public.live_room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  expires_at timestamptz not null default (now() + interval '60 seconds'),
  created_at timestamptz not null default now()
);

create index if not exists live_room_invites_invitee_idx
  on public.live_room_invites (invitee_id, status);

create table if not exists public.live_metrics (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.live_rooms(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  event text not null,
  value_ms integer,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.live_room_comments enable row level security;
alter table public.live_room_invites enable row level security;
alter table public.live_metrics enable row level security;

drop policy if exists live_comments_select on public.live_room_comments;
create policy live_comments_select on public.live_room_comments
  for select using (auth.uid() is not null);

drop policy if exists live_comments_insert on public.live_room_comments;
create policy live_comments_insert on public.live_room_comments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.live_room_members m
      where m.room_id = live_room_comments.room_id
        and m.user_id = auth.uid()
        and m.banned = false
        and m.chat_muted = false
    )
  );

drop policy if exists live_comments_delete on public.live_room_comments;
create policy live_comments_delete on public.live_room_comments
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.live_rooms r
      where r.id = live_room_comments.room_id and r.host_id = auth.uid()
    )
    or public.has_permission('live_rooms.manage')
  );

drop policy if exists live_invites_select on public.live_room_invites;
create policy live_invites_select on public.live_room_invites
  for select using (auth.uid() = host_id or auth.uid() = invitee_id);

drop policy if exists live_metrics_insert on public.live_metrics;
create policy live_metrics_insert on public.live_metrics
  for insert with check (user_id = auth.uid());

drop policy if exists live_metrics_select on public.live_metrics;
create policy live_metrics_select on public.live_metrics
  for select using (user_id = auth.uid() or public.has_permission('live_rooms.manage'));

create or replace function public.refresh_live_viewer_count(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.live_rooms
  set viewer_count = (
    select count(*)::integer from public.live_room_members
    where room_id = target and banned = false
  )
  where id = target;
end;
$$;

create or replace function public.start_live_video(
  p_title text,
  p_category text default 'all',
  p_privacy text default 'public',
  p_recording boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  if char_length(trim(p_title)) < 3 then raise exception 'title_too_short'; end if;

  -- end any leftover live from this host
  update public.live_rooms
  set status = 'ended', ended_at = now(), guest_id = null
  where host_id = uid and status = 'live' and mode = 'video';

  insert into public.live_rooms (
    title, host_id, status, mode, category, privacy, recording, livekit_room, host_heartbeat_at
  ) values (
    trim(p_title),
    uid,
    'live',
    'video',
    coalesce(nullif(trim(p_category), ''), 'all'),
    case when p_privacy in ('public', 'followers', 'private') then p_privacy else 'public' end,
    coalesce(p_recording, false),
    null,
    now()
  ) returning id into rid;

  update public.live_rooms set livekit_room = 'live-' || rid::text where id = rid;

  insert into public.live_room_members (room_id, user_id, role, mic)
  values (rid, uid, 'host', 'on')
  on conflict (room_id, user_id) do update set role = 'host', mic = 'on', banned = false;

  perform public.refresh_live_viewer_count(rid);
  return rid;
end;
$$;

create or replace function public.end_live_video(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  host uuid;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select host_id into host from public.live_rooms where id = p_room;
  if host is null then raise exception 'not_found'; end if;
  if host <> uid and not public.has_permission('live_rooms.manage') then
    raise exception 'forbidden';
  end if;

  update public.live_rooms
  set status = 'ended', ended_at = now(), guest_id = null, viewer_count = 0
  where id = p_room and status <> 'ended';

  update public.live_room_invites
  set status = 'expired'
  where room_id = p_room and status = 'pending';
end;
$$;

create or replace function public.join_live_video(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  room record;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select * into room from public.live_rooms where id = p_room;
  if room.id is null then raise exception 'not_found'; end if;
  if room.status <> 'live' then raise exception 'ended'; end if;

  if exists (
    select 1 from public.live_room_members
    where room_id = p_room and user_id = uid and banned = true
  ) then
    raise exception 'banned';
  end if;

  insert into public.live_room_members (room_id, user_id, role, mic)
  values (
    p_room,
    uid,
    case when room.host_id = uid then 'host' when room.guest_id = uid then 'guest' else 'listener' end,
    case when room.host_id = uid or room.guest_id = uid then 'on' else 'off' end
  )
  on conflict (room_id, user_id) do update
    set banned = false,
        role = case
          when excluded.role = 'host' then 'host'
          when public.live_rooms.guest_id is not distinct from uid then 'guest'
          when public.live_room_members.role in ('host', 'guest') then public.live_room_members.role
          else 'listener'
        end;

  -- fix guest role from room.guest_id
  if room.guest_id = uid then
    update public.live_room_members set role = 'guest', mic = coalesce(nullif(mic, 'off'), 'on')
    where room_id = p_room and user_id = uid;
  end if;
  if room.host_id = uid then
    update public.live_room_members set role = 'host', mic = 'on'
    where room_id = p_room and user_id = uid;
    update public.live_rooms set host_heartbeat_at = now() where id = p_room;
  end if;

  perform public.refresh_live_viewer_count(p_room);
end;
$$;

create or replace function public.leave_live_video(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  room record;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select * into room from public.live_rooms where id = p_room;
  if room.id is null then return; end if;

  if room.host_id = uid then
    perform public.end_live_video(p_room);
    return;
  end if;

  if room.guest_id = uid then
    update public.live_rooms set guest_id = null where id = p_room;
    update public.live_room_members
    set role = 'listener', mic = 'off'
    where room_id = p_room and user_id = uid;
  else
    delete from public.live_room_members where room_id = p_room and user_id = uid;
  end if;

  perform public.refresh_live_viewer_count(p_room);
end;
$$;

create or replace function public.live_host_heartbeat(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  update public.live_rooms
  set host_heartbeat_at = now()
  where id = p_room and host_id = auth.uid() and status = 'live';
end;
$$;

create or replace function public.invite_live_guest(p_room uuid, p_invitee uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  room record;
  iid uuid;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select * into room from public.live_rooms where id = p_room;
  if room.id is null or room.status <> 'live' or room.mode <> 'video' then raise exception 'not_found'; end if;
  if room.host_id <> uid then raise exception 'forbidden'; end if;
  if room.guest_id is not null then raise exception 'guest_occupied'; end if;
  if p_invitee = uid then raise exception 'invalid'; end if;

  update public.live_room_invites
  set status = 'cancelled'
  where room_id = p_room and status = 'pending';

  insert into public.live_room_invites (room_id, host_id, invitee_id)
  values (p_room, uid, p_invitee)
  returning id into iid;
  return iid;
end;
$$;

create or replace function public.respond_live_invite(p_invite uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv record;
  room record;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select * into inv from public.live_room_invites where id = p_invite;
  if inv.id is null then raise exception 'not_found'; end if;
  if inv.invitee_id <> uid then raise exception 'forbidden'; end if;
  if inv.status <> 'pending' then raise exception 'invalid'; end if;
  if inv.expires_at < now() then
    update public.live_room_invites set status = 'expired' where id = p_invite;
    raise exception 'expired';
  end if;

  select * into room from public.live_rooms where id = inv.room_id;
  if room.id is null or room.status <> 'live' then
    update public.live_room_invites set status = 'expired' where id = p_invite;
    raise exception 'ended';
  end if;

  if not p_accept then
    update public.live_room_invites set status = 'declined' where id = p_invite;
    return inv.room_id;
  end if;

  if room.guest_id is not null and room.guest_id <> uid then
    raise exception 'guest_occupied';
  end if;

  update public.live_room_invites set status = 'accepted' where id = p_invite;
  update public.live_rooms set guest_id = uid where id = inv.room_id;
  insert into public.live_room_members (room_id, user_id, role, mic)
  values (inv.room_id, uid, 'guest', 'on')
  on conflict (room_id, user_id) do update set role = 'guest', mic = 'on', banned = false, chat_muted = false;

  return inv.room_id;
end;
$$;

create or replace function public.remove_live_guest(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  room record;
  gid uuid;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select * into room from public.live_rooms where id = p_room;
  if room.host_id <> uid and not public.has_permission('live_rooms.manage') then
    raise exception 'forbidden';
  end if;
  gid := room.guest_id;
  update public.live_rooms set guest_id = null where id = p_room;
  if gid is not null then
    update public.live_room_members
    set role = 'listener', mic = 'off'
    where room_id = p_room and user_id = gid;
  end if;
end;
$$;

create or replace function public.moderate_live_member(
  p_room uuid,
  p_user uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  room record;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select * into room from public.live_rooms where id = p_room;
  if room.host_id <> uid and not public.has_permission('live_rooms.manage') then
    raise exception 'forbidden';
  end if;
  if p_user = room.host_id then raise exception 'invalid'; end if;

  if p_action = 'mute_chat' then
    update public.live_room_members set chat_muted = true where room_id = p_room and user_id = p_user;
  elsif p_action = 'unmute_chat' then
    update public.live_room_members set chat_muted = false where room_id = p_room and user_id = p_user;
  elsif p_action = 'kick' then
    delete from public.live_room_members where room_id = p_room and user_id = p_user;
    if room.guest_id = p_user then
      update public.live_rooms set guest_id = null where id = p_room;
    end if;
    perform public.refresh_live_viewer_count(p_room);
  elsif p_action = 'ban' then
    insert into public.live_room_members (room_id, user_id, role, mic, banned)
    values (p_room, p_user, 'listener', 'off', true)
    on conflict (room_id, user_id) do update set banned = true, role = 'listener', mic = 'off';
    if room.guest_id = p_user then
      update public.live_rooms set guest_id = null where id = p_room;
    end if;
    perform public.refresh_live_viewer_count(p_room);
  elsif p_action = 'mute_mic' then
    update public.live_room_members set mic = 'off' where room_id = p_room and user_id = p_user;
  elsif p_action = 'unmute_mic' then
    update public.live_room_members set mic = 'on' where room_id = p_room and user_id = p_user;
  else
    raise exception 'invalid_action';
  end if;
end;
$$;

create or replace function public.expire_stale_lives()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.live_rooms
  set status = 'ended', ended_at = now(), guest_id = null
  where status = 'live'
    and mode = 'video'
    and host_heartbeat_at is not null
    and host_heartbeat_at < now() - interval '45 seconds';

  update public.live_room_invites
  set status = 'expired'
  where status = 'pending' and expires_at < now();
end;
$$;

create or replace function public.bump_live_like(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  update public.live_rooms set like_count = like_count + 1 where id = p_room and status = 'live';
end;
$$;

-- Fix join_live_video guest role update (avoid invalid table ref in upsert)
create or replace function public.join_live_video(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  room record;
  next_role text := 'listener';
  next_mic text := 'off';
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select * into room from public.live_rooms where id = p_room;
  if room.id is null then raise exception 'not_found'; end if;
  if room.status <> 'live' then raise exception 'ended'; end if;

  if exists (
    select 1 from public.live_room_members
    where room_id = p_room and user_id = uid and banned = true
  ) then
    raise exception 'banned';
  end if;

  if room.host_id = uid then
    next_role := 'host';
    next_mic := 'on';
  elsif room.guest_id = uid then
    next_role := 'guest';
    next_mic := 'on';
  end if;

  insert into public.live_room_members (room_id, user_id, role, mic)
  values (p_room, uid, next_role, next_mic)
  on conflict (room_id, user_id) do update
    set role = excluded.role,
        mic = case when excluded.role in ('host', 'guest') then excluded.mic else public.live_room_members.mic end,
        banned = false;

  if room.host_id = uid then
    update public.live_rooms set host_heartbeat_at = now() where id = p_room;
  end if;

  perform public.refresh_live_viewer_count(p_room);
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.live_room_comments;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.live_room_invites;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.live_rooms;
exception when duplicate_object then null;
end $$;

grant execute on function public.start_live_video(text, text, text, boolean) to authenticated;
grant execute on function public.end_live_video(uuid) to authenticated;
grant execute on function public.join_live_video(uuid) to authenticated;
grant execute on function public.leave_live_video(uuid) to authenticated;
grant execute on function public.live_host_heartbeat(uuid) to authenticated;
grant execute on function public.invite_live_guest(uuid, uuid) to authenticated;
grant execute on function public.respond_live_invite(uuid, boolean) to authenticated;
grant execute on function public.remove_live_guest(uuid) to authenticated;
grant execute on function public.moderate_live_member(uuid, uuid, text) to authenticated;
grant execute on function public.expire_stale_lives() to authenticated;
grant execute on function public.bump_live_like(uuid) to authenticated;
grant execute on function public.refresh_live_viewer_count(uuid) to authenticated;

grant select, insert, delete on table public.live_room_comments to authenticated;
grant select on table public.live_room_invites to authenticated;
grant select, insert on table public.live_metrics to authenticated;
