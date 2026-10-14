create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  display_name text,
  username text unique,
  bio text,
  country text,
  city text,
  avatar_url text,
  cover_url text,
  is_private boolean not null default false,
  verified boolean not null default false,
  language text not null default 'tr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null
);

create table public.role_permissions (
  role_id uuid references public.roles(id) on delete cascade,
  permission_id uuid references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id uuid references auth.users(id) on delete cascade,
  role_id uuid references public.roles(id) on delete cascade,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table public.user_blocks (
  blocker_id uuid references auth.users(id) on delete cascade,
  blocked_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.prayer_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  country_code text,
  country_name text,
  city text,
  district text,
  latitude double precision,
  longitude double precision,
  timezone text,
  method_id integer not null default 13,
  source text,
  updated_at timestamptz not null default now()
);

create table public.prayer_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prayer_date date not null,
  prayer_name text not null check (prayer_name in ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')),
  status text not null check (status in ('prayed', 'qada', 'unmarked')),
  unique (user_id, prayer_date, prayer_name)
);

create table public.quran_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  surah_number integer not null,
  ayah_number integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, surah_number, ayah_number)
);

create table public.personal_khatms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  current_page integer not null default 1,
  total_pages integer not null default 604,
  created_at timestamptz not null default now()
);

create table public.dhikr_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phrase text not null,
  count integer not null default 0,
  record_date date not null,
  unique (user_id, phrase, record_date)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  kind text not null default 'text',
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'private')),
  comments_enabled boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  url text not null,
  media_type text
);

create table public.post_likes (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.saved_posts (
  user_id uuid references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text,
  created_at timestamptz not null default now()
);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  cover_url text,
  visibility text not null default 'public',
  member_count integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid references public.circles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'moderator', 'member')),
  created_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table public.live_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  status text not null default 'live',
  created_at timestamptz not null default now()
);

create table public.live_room_members (
  room_id uuid references public.live_rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'listener',
  mic text not null default 'off',
  primary key (room_id, user_id)
);

create sequence public.report_ref_seq;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id uuid,
  reason text not null,
  details text,
  status text not null default 'received',
  priority text not null default 'normal',
  reference_code text unique,
  review_due_at timestamptz not null default (now() + interval '24 hours'),
  review_started_at timestamptz,
  assigned_moderator_id uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'social',
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.api_health_logs (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  status text not null,
  response_time_ms integer,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  target text,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  city text,
  starts_at timestamptz not null,
  visibility text not null default 'public',
  created_at timestamptz not null default now()
);

create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  city text,
  category text not null default 'other',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.mosques (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  source text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.family_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index posts_author_created_idx on public.posts (author_id, created_at desc);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index reports_status_idx on public.reports (status, priority, review_due_at);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

insert into public.roles (name) values
  ('super_admin'), ('admin'), ('moderator'), ('content_manager'), ('support')
on conflict (name) do nothing;

insert into public.permissions (key) values
  ('users.view'), ('users.manage'), ('posts.view'), ('posts.manage'), ('comments.manage'),
  ('reports.view'), ('reports.review'), ('reports.resolve'), ('communities.manage'),
  ('mosques.manage'), ('live_rooms.manage'), ('events.manage'), ('religious_content.manage'),
  ('notifications.send'), ('api_status.view'), ('system_settings.manage'), ('roles.manage')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name = 'super_admin'
on conflict do nothing;

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'super_admin'
  ) or exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid() and p.key = perm
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name in ('super_admin', 'admin', 'moderator', 'content_manager', 'support')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, display_name, username, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.assign_report_code()
returns trigger
language plpgsql
as $$
begin
  if new.reference_code is null then
    new.reference_code := 'SF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.report_ref_seq')::text, 6, '0');
  end if;
  if new.priority = 'urgent' then
    new.review_due_at := now() + interval '1 hour';
  end if;
  return new;
end;
$$;

create trigger reports_code before insert on public.reports
for each row execute function public.assign_report_code();

create or replace function public.sync_circle_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.circles
  set member_count = (select count(*) from public.circle_members where circle_id = coalesce(new.circle_id, old.circle_id))
  where id = coalesce(new.circle_id, old.circle_id);
  return null;
end;
$$;

create trigger circle_members_count
after insert or delete on public.circle_members
for each row execute function public.sync_circle_count();

create or replace function public.block_user(other_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or other_user = auth.uid() then
    raise exception 'Geçersiz engelleme';
  end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), other_user)
  on conflict do nothing;
  delete from public.follows
  where (follower_id = auth.uid() and following_id = other_user)
     or (follower_id = other_user and following_id = auth.uid());
end;
$$;

create or replace function public.get_or_create_direct_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
  created uuid;
begin
  if auth.uid() is null or other_user = auth.uid() then
    raise exception 'Geçersiz sohbet';
  end if;
  if public.is_blocked(auth.uid(), other_user) then
    raise exception 'Engellenen kullanıcıyla mesajlaşamazsın';
  end if;
  select c.id into existing
  from public.conversations c
  join public.conversation_members m1 on m1.conversation_id = c.id and m1.user_id = auth.uid()
  join public.conversation_members m2 on m2.conversation_id = c.id and m2.user_id = other_user
  where c.is_group = false
  limit 1;
  if existing is not null then
    return existing;
  end if;
  insert into public.conversations (is_group) values (false) returning id into created;
  insert into public.conversation_members (conversation_id, user_id) values (created, auth.uid()), (created, other_user);
  return created;
end;
$$;

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_blocks enable row level security;
alter table public.prayer_preferences enable row level security;
alter table public.prayer_tracking enable row level security;
alter table public.quran_bookmarks enable row level security;
alter table public.personal_khatms enable row level security;
alter table public.dhikr_records enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.saved_posts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.live_rooms enable row level security;
alter table public.live_room_members enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.api_health_logs enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.events enable row level security;
alter table public.help_requests enable row level security;
alter table public.mosques enable row level security;
alter table public.courses enable row level security;
alter table public.family_groups enable row level security;

create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or (
    not public.is_blocked(id, auth.uid())
    and (not is_private or exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = id and f.status = 'accepted'
    ) or public.is_staff())
  )
);
create policy profiles_update on public.profiles for update using (id = auth.uid() or public.has_permission('users.manage'));
create policy settings_own on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy roles_read on public.roles for select using (auth.uid() is not null);
create policy permissions_read on public.permissions for select using (public.has_permission('roles.manage'));
create policy role_permissions_read on public.role_permissions for select using (public.has_permission('roles.manage'));
create policy user_roles_select on public.user_roles for select using (user_id = auth.uid() or public.has_permission('roles.manage'));
create policy user_roles_write on public.user_roles for all using (public.has_permission('roles.manage')) with check (public.has_permission('roles.manage'));
create policy blocks_own on public.user_blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy prayer_prefs_own on public.prayer_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy prayer_tracking_own on public.prayer_tracking for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy bookmarks_own on public.quran_bookmarks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy khatm_own on public.personal_khatms for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dhikr_own on public.dhikr_records for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy posts_select on public.posts for select using (
  archived_at is null
  and not public.is_blocked(author_id, auth.uid())
  and (
    author_id = auth.uid()
    or visibility = 'public'
    or (visibility = 'followers' and exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = posts.author_id and f.status = 'accepted'
    ))
  )
);
create policy posts_insert on public.posts for insert with check (author_id = auth.uid());
create policy posts_update on public.posts for update using (author_id = auth.uid() or public.has_permission('posts.manage'));
create policy posts_delete on public.posts for delete using (author_id = auth.uid() or public.has_permission('posts.manage'));
create policy media_select on public.post_media for select using (exists (select 1 from public.posts p where p.id = post_id));
create policy media_write on public.post_media for insert with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy likes_all on public.post_likes for all using (auth.uid() is not null) with check (user_id = auth.uid());
create policy comments_select on public.comments for select using (deleted_at is null and auth.uid() is not null);
create policy comments_insert on public.comments for insert with check (author_id = auth.uid());
create policy comments_update on public.comments for update using (author_id = auth.uid() or public.has_permission('comments.manage'));
create policy follows_select on public.follows for select using (follower_id = auth.uid() or following_id = auth.uid() or status = 'accepted');
create policy follows_write on public.follows for insert with check (follower_id = auth.uid() and not public.is_blocked(follower_id, following_id));
create policy follows_delete on public.follows for delete using (follower_id = auth.uid() or following_id = auth.uid());
create policy saved_own on public.saved_posts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy conversations_member on public.conversations for select using (
  exists (select 1 from public.conversation_members m where m.conversation_id = id and m.user_id = auth.uid())
);
create policy members_select on public.conversation_members for select using (
  user_id = auth.uid() or exists (select 1 from public.conversation_members m where m.conversation_id = conversation_members.conversation_id and m.user_id = auth.uid())
);
create policy members_update on public.conversation_members for update using (user_id = auth.uid());
create policy messages_select on public.messages for select using (
  exists (select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid())
);
create policy messages_insert on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid())
);

create policy circles_select on public.circles for select using (visibility = 'public' or owner_id = auth.uid() or public.is_staff());
create policy circles_insert on public.circles for insert with check (owner_id = auth.uid());
create policy circles_update on public.circles for update using (owner_id = auth.uid() or public.has_permission('communities.manage'));
create policy circle_members_select on public.circle_members for select using (auth.uid() is not null);
create policy circle_members_insert on public.circle_members for insert with check (user_id = auth.uid() or public.has_permission('communities.manage'));
create policy rooms_select on public.live_rooms for select using (auth.uid() is not null);
create policy rooms_insert on public.live_rooms for insert with check (host_id = auth.uid());
create policy room_members_all on public.live_room_members for all using (auth.uid() is not null) with check (user_id = auth.uid() or public.has_permission('live_rooms.manage'));

create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid());
create policy reports_select on public.reports for select using (reporter_id = auth.uid() or public.has_permission('reports.view'));
create policy reports_update on public.reports for update using (public.has_permission('reports.review'));
create policy notifications_own on public.notifications for select using (user_id = auth.uid());
create policy notifications_update on public.notifications for update using (user_id = auth.uid());
create policy api_insert on public.api_health_logs for insert with check (auth.uid() is not null);
create policy api_select on public.api_health_logs for select using (public.has_permission('api_status.view') or public.is_staff());
create policy audit_select on public.admin_audit_logs for select using (public.is_staff());
create policy events_select on public.events for select using (visibility = 'public' or host_id = auth.uid());
create policy events_insert on public.events for insert with check (host_id = auth.uid());
create policy help_select on public.help_requests for select using (auth.uid() is not null);
create policy help_insert on public.help_requests for insert with check (owner_id = auth.uid());
create policy mosques_select on public.mosques for select using (auth.uid() is not null);
create policy mosques_write on public.mosques for all using (public.has_permission('mosques.manage')) with check (public.has_permission('mosques.manage'));
create policy courses_select on public.courses for select using (published or public.has_permission('religious_content.manage'));
create policy courses_write on public.courses for all using (public.has_permission('religious_content.manage')) with check (public.has_permission('religious_content.manage'));
create policy family_own on public.family_groups for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('covers', 'covers', true),
  ('post-media', 'post-media', true)
on conflict (id) do nothing;

create policy storage_read on storage.objects for select using (bucket_id in ('avatars', 'covers', 'post-media'));
create policy storage_write on storage.objects for insert with check (
  bucket_id in ('avatars', 'covers', 'post-media')
  and auth.uid()::text = (storage.foldername(name))[1]
);
create policy storage_update on storage.objects for update using (
  bucket_id in ('avatars', 'covers', 'post-media')
  and auth.uid()::text = (storage.foldername(name))[1]
);

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.live_room_members;
exception
  when duplicate_object then null;
end $$;
