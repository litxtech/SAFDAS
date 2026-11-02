-- SAFDAŞ STUDIO: user Qur'an & dua recordings, listen analytics, moderation.

-- Permissions for studio moderation
insert into public.permissions (key)
values ('studio.moderate'), ('studio.manage')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('super_admin', 'admin', 'moderator', 'content_manager')
  and p.key in ('studio.moderate', 'studio.manage')
on conflict do nothing;

-- Core recording
create table if not exists public.studio_recordings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null check (content_type in ('quran', 'dua')),
  surah_number integer check (surah_number is null or (surah_number between 1 and 114)),
  ayah_start integer check (ayah_start is null or ayah_start >= 1),
  ayah_end integer check (ayah_end is null or ayah_end >= 1),
  dua_id text,
  title text not null,
  description text,
  audio_path text,
  audio_url text,
  cover_path text,
  cover_url text,
  mime_type text default 'audio/m4a',
  duration_seconds numeric(12, 3) not null default 0,
  visibility text not null default 'private'
    check (visibility in ('public', 'unlisted', 'private')),
  access_token text unique,
  status text not null default 'draft'
    check (status in (
      'draft', 'uploading', 'processing', 'pending_review',
      'published', 'hidden', 'rejected', 'deleted'
    )),
  comments_enabled boolean not null default true,
  ownership_confirmed boolean not null default false,
  reject_reason text,
  unique_listeners integer not null default 0,
  play_count integer not null default 0,
  like_count integer not null default 0,
  save_count integer not null default 0,
  share_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  deleted_at timestamptz,
  constraint studio_quran_fields check (
    content_type <> 'quran'
    or (surah_number is not null and ayah_start is not null and ayah_end is not null and ayah_end >= ayah_start)
  ),
  constraint studio_dua_fields check (
    content_type <> 'dua' or dua_id is not null
  )
);

create index if not exists studio_recordings_owner_idx
  on public.studio_recordings (owner_id, updated_at desc);
create index if not exists studio_recordings_discover_idx
  on public.studio_recordings (status, visibility, published_at desc)
  where status = 'published' and visibility = 'public' and deleted_at is null;
create index if not exists studio_recordings_content_idx
  on public.studio_recordings (content_type, status, unique_listeners desc);
create index if not exists studio_recordings_pending_idx
  on public.studio_recordings (status, created_at)
  where status = 'pending_review';

-- Draft / edit metadata (trim points stored client-side until re-encoded)
create table if not exists public.studio_recording_edits (
  recording_id uuid primary key references public.studio_recordings(id) on delete cascade,
  trim_start_ms integer not null default 0,
  trim_end_ms integer,
  gain_db numeric(6, 2) not null default 0,
  noise_reduction boolean not null default false,
  original_path text,
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_recording_reviews (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.studio_recordings(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('approve', 'reject', 'request_changes', 'hide', 'unhide')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists studio_recording_reviews_rec_idx
  on public.studio_recording_reviews (recording_id, created_at desc);

create table if not exists public.studio_recording_likes (
  recording_id uuid not null references public.studio_recordings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recording_id, user_id)
);

create table if not exists public.studio_recording_saves (
  recording_id uuid not null references public.studio_recordings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recording_id, user_id)
);

create table if not exists public.studio_recording_comments (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.studio_recordings(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists studio_recording_comments_idx
  on public.studio_recording_comments (recording_id, created_at desc)
  where deleted_at is null;

create table if not exists public.studio_recording_shares (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.studio_recordings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Playback events (every play attempt / progress)
create table if not exists public.studio_playback_events (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.studio_recordings(id) on delete cascade,
  listener_user_id uuid references public.profiles(id) on delete set null,
  listened_seconds numeric(12, 3) not null default 0,
  duration_seconds numeric(12, 3) not null default 0,
  completed boolean not null default false,
  counted_play boolean not null default false,
  counted_unique boolean not null default false,
  suspicious boolean not null default false,
  client_session_id text,
  created_at timestamptz not null default now()
);

create index if not exists studio_playback_events_rec_idx
  on public.studio_playback_events (recording_id, created_at desc);
create index if not exists studio_playback_events_listener_idx
  on public.studio_playback_events (listener_user_id, created_at desc);

-- Lifetime unique listeners (one row per account per recording)
create table if not exists public.studio_unique_listeners (
  recording_id uuid not null references public.studio_recordings(id) on delete cascade,
  listener_user_id uuid not null references public.profiles(id) on delete cascade,
  first_listened_at timestamptz not null default now(),
  last_listened_at timestamptz not null default now(),
  primary key (recording_id, listener_user_id)
);

-- Period unique listeners (daily / weekly / monthly buckets)
create table if not exists public.studio_period_listeners (
  recording_id uuid not null references public.studio_recordings(id) on delete cascade,
  listener_user_id uuid not null references public.profiles(id) on delete cascade,
  period_kind text not null check (period_kind in ('day', 'week', 'month')),
  period_key text not null,
  first_listened_at timestamptz not null default now(),
  primary key (recording_id, listener_user_id, period_kind, period_key)
);

create index if not exists studio_period_listeners_rank_idx
  on public.studio_period_listeners (period_kind, period_key, recording_id);

create table if not exists public.studio_recording_stats_daily (
  recording_id uuid not null references public.studio_recordings(id) on delete cascade,
  day date not null,
  plays integer not null default 0,
  unique_listeners integer not null default 0,
  likes integer not null default 0,
  primary key (recording_id, day)
);

create table if not exists public.studio_user_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  published_count integer not null default 0,
  unique_listeners integer not null default 0,
  play_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  visibility text not null default 'public'
    check (visibility in ('public', 'unlisted', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_collection_items (
  collection_id uuid not null references public.studio_collections(id) on delete cascade,
  recording_id uuid not null references public.studio_recordings(id) on delete cascade,
  sort_order integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (collection_id, recording_id)
);

create table if not exists public.studio_rankings (
  id uuid primary key default gen_random_uuid(),
  period_kind text not null check (period_kind in ('day', 'week', 'month', 'all')),
  period_key text not null,
  content_type text check (content_type in ('quran', 'dua', 'all')),
  country text,
  city text,
  recording_id uuid not null references public.studio_recordings(id) on delete cascade,
  unique_listeners integer not null default 0,
  rank integer not null,
  computed_at timestamptz not null default now()
);

create unique index if not exists studio_rankings_uniq_idx
  on public.studio_rankings (
    period_kind,
    period_key,
    content_type,
    (coalesce(country, '')),
    (coalesce(city, '')),
    recording_id
  );

create table if not exists public.studio_achievements (
  key text primary key,
  title_tr text not null,
  title_en text not null,
  description_tr text not null,
  description_en text not null,
  threshold integer,
  icon text
);

insert into public.studio_achievements (key, title_tr, title_en, description_tr, description_en, threshold, icon)
values
  ('first_recording', 'İlk Seslendirme', 'First Recording', 'İlk kaydın yayımlandı', 'Your first recording was published', 1, 'mic'),
  ('listeners_100', '100 Dinleyici', '100 Listeners', '100 benzersiz dinleyiciye ulaştın', 'Reached 100 unique listeners', 100, 'headset'),
  ('listeners_1000', '1.000 Dinleyici', '1,000 Listeners', '1.000 benzersiz dinleyiciye ulaştın', 'Reached 1,000 unique listeners', 1000, 'heart'),
  ('listeners_10000', '10.000 Dinleyici', '10,000 Listeners', '10.000 benzersiz dinleyiciye ulaştın', 'Reached 10,000 unique listeners', 10000, 'star'),
  ('week_voice', 'Haftanın Sesi', 'Voice of the Week', 'Haftalık sıralamada birincisin', 'Ranked #1 this week', null, 'trophy'),
  ('quran_reader', 'Kur''an Okuyucusu', 'Qur''an Reader', 'Onaylı Kur''an kayıtların yayımlandı', 'Published approved Qur''an recordings', 3, 'book')
on conflict (key) do nothing;

create table if not exists public.studio_user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null references public.studio_achievements(key) on delete cascade,
  recording_id uuid references public.studio_recordings(id) on delete set null,
  earned_at timestamptz not null default now(),
  notified boolean not null default false,
  primary key (user_id, achievement_key)
);

create table if not exists public.studio_reports (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.studio_recordings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (recording_id, reporter_id)
);

create table if not exists public.studio_moderation_logs (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid references public.studio_recordings(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.studio_settings (
  id int primary key default 1 check (id = 1),
  max_duration_seconds integer not null default 1800,
  max_file_bytes bigint not null default 52428800,
  moderation_required_quran boolean not null default true,
  moderation_required_dua boolean not null default true,
  daily_upload_limit integer not null default 10,
  min_listen_seconds integer not null default 30,
  allowed_mime_types text[] not null default array['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav', 'audio/x-caf'],
  updated_at timestamptz not null default now()
);

insert into public.studio_settings (id) values (1)
on conflict (id) do nothing;

-- Link social posts to studio recordings (same content id across shares)
alter table public.posts
  add column if not exists studio_recording_id uuid references public.studio_recordings(id) on delete set null;

create index if not exists posts_studio_recording_idx
  on public.posts (studio_recording_id)
  where studio_recording_id is not null;

-- Helpers
create or replace function public.studio_is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('studio.moderate') or public.has_permission('studio.manage') or public.is_staff();
$$;

create or replace function public.studio_can_view_recording(rec public.studio_recordings)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.studio_is_moderator()
    or (
      rec.deleted_at is null
      and (
        rec.owner_id = auth.uid()
        or (
          rec.status = 'published'
          and rec.visibility = 'public'
        )
        or (
          rec.status = 'published'
          and rec.visibility = 'unlisted'
          and auth.uid() is not null
        )
      )
    );
$$;

create or replace function public.studio_touch_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists studio_recordings_touch on public.studio_recordings;
create trigger studio_recordings_touch
  before update on public.studio_recordings
  for each row execute function public.studio_touch_updated();

create or replace function public.studio_iso_week_key(ts timestamptz default now())
returns text
language sql
immutable
as $$
  select to_char(ts at time zone 'utc', 'IYYY-"W"IW');
$$;

create or replace function public.studio_day_key(ts timestamptz default now())
returns text
language sql
immutable
as $$
  select to_char(ts at time zone 'utc', 'YYYY-MM-DD');
$$;

create or replace function public.studio_month_key(ts timestamptz default now())
returns text
language sql
immutable
as $$
  select to_char(ts at time zone 'utc', 'YYYY-MM');
$$;

-- Server-side valid listen: unique per account lifetime + period buckets
create or replace function public.studio_record_listen(
  p_recording_id uuid,
  p_listened_seconds numeric,
  p_client_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.studio_recordings;
  settings public.studio_settings;
  uid uuid := auth.uid();
  threshold numeric;
  counted_play boolean := false;
  counted_unique boolean := false;
  event_id uuid;
  recent_count integer;
  already_unique boolean := false;
begin
  if uid is null then
    raise exception 'auth required';
  end if;

  select * into rec from public.studio_recordings where id = p_recording_id for update;
  if not found or rec.deleted_at is not null or rec.status <> 'published' then
    raise exception 'recording unavailable';
  end if;

  if rec.visibility = 'private' and rec.owner_id <> uid and not public.studio_is_moderator() then
    raise exception 'forbidden';
  end if;

  select * into settings from public.studio_settings where id = 1;

  select count(*) into recent_count
  from public.studio_playback_events
  where recording_id = p_recording_id
    and listener_user_id = uid
    and created_at > now() - interval '1 minute';
  if recent_count >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  threshold := least(
    coalesce(settings.min_listen_seconds, 30)::numeric,
    greatest(1, coalesce(rec.duration_seconds, 0) * 0.5)
  );

  if p_listened_seconds >= threshold and rec.owner_id <> uid then
    counted_play := true;
    update public.studio_recordings set play_count = play_count + 1 where id = rec.id;

    select exists (
      select 1 from public.studio_unique_listeners
      where recording_id = rec.id and listener_user_id = uid
    ) into already_unique;

    if already_unique then
      update public.studio_unique_listeners
        set last_listened_at = now()
        where recording_id = rec.id and listener_user_id = uid;
    else
      with ins as (
        insert into public.studio_unique_listeners (recording_id, listener_user_id)
        values (rec.id, uid)
        on conflict do nothing
        returning recording_id
      )
      select exists(select 1 from ins) into counted_unique;

      if counted_unique then
        update public.studio_recordings
          set unique_listeners = unique_listeners + 1
          where id = rec.id;
      end if;
    end if;

    insert into public.studio_period_listeners (recording_id, listener_user_id, period_kind, period_key)
    values
      (rec.id, uid, 'day', public.studio_day_key()),
      (rec.id, uid, 'week', public.studio_iso_week_key()),
      (rec.id, uid, 'month', public.studio_month_key())
    on conflict do nothing;

    insert into public.studio_recording_stats_daily (recording_id, day, plays, unique_listeners)
    values (rec.id, (timezone('utc', now()))::date, 1, case when counted_unique then 1 else 0 end)
    on conflict (recording_id, day) do update
      set plays = public.studio_recording_stats_daily.plays + 1,
          unique_listeners = public.studio_recording_stats_daily.unique_listeners
            + case when counted_unique then 1 else 0 end;

    insert into public.studio_user_stats (user_id, play_count, unique_listeners, published_count)
    values (rec.owner_id, 1, case when counted_unique then 1 else 0 end, 0)
    on conflict (user_id) do update
      set play_count = public.studio_user_stats.play_count + 1,
          unique_listeners = public.studio_user_stats.unique_listeners
            + case when counted_unique then 1 else 0 end,
          updated_at = now();
  end if;

  insert into public.studio_playback_events (
    recording_id, listener_user_id, listened_seconds, duration_seconds,
    completed, counted_play, counted_unique, client_session_id
  ) values (
    rec.id, uid, greatest(0, p_listened_seconds), rec.duration_seconds,
    p_listened_seconds >= greatest(1, rec.duration_seconds * 0.9),
    counted_play, counted_unique, p_client_session_id
  ) returning id into event_id;

  return jsonb_build_object(
    'ok', true,
    'event_id', event_id,
    'counted_play', counted_play,
    'counted_unique', counted_unique,
    'threshold', threshold
  );
end;
$$;

revoke all on function public.studio_record_listen(uuid, numeric, text) from public;
grant execute on function public.studio_record_listen(uuid, numeric, text) to authenticated;

-- Submit for review / publish helper
create or replace function public.studio_submit_recording(p_recording_id uuid)
returns public.studio_recordings
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.studio_recordings;
  settings public.studio_settings;
  need_mod boolean;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  select * into rec from public.studio_recordings where id = p_recording_id for update;
  if not found or rec.owner_id <> auth.uid() then
    raise exception 'forbidden';
  end if;
  if rec.audio_url is null or rec.duration_seconds <= 0 then
    raise exception 'audio required';
  end if;
  if not rec.ownership_confirmed then
    raise exception 'ownership confirmation required';
  end if;
  if rec.status not in ('draft', 'rejected', 'hidden') then
    raise exception 'invalid status';
  end if;

  select * into settings from public.studio_settings where id = 1;
  need_mod := case
    when rec.content_type = 'quran' then settings.moderation_required_quran
    else settings.moderation_required_dua
  end;

  if need_mod and rec.visibility = 'public' then
    update public.studio_recordings
      set status = 'pending_review', reject_reason = null, updated_at = now()
      where id = rec.id
      returning * into rec;
  else
    update public.studio_recordings
      set status = 'published',
          published_at = coalesce(published_at, now()),
          reject_reason = null,
          updated_at = now()
      where id = rec.id
      returning * into rec;

    insert into public.studio_user_stats (user_id, published_count)
    values (rec.owner_id, 1)
    on conflict (user_id) do update
      set published_count = public.studio_user_stats.published_count + 1,
          updated_at = now();

    insert into public.studio_user_achievements (user_id, achievement_key, recording_id)
    values (rec.owner_id, 'first_recording', rec.id)
    on conflict do nothing;
  end if;

  return rec;
end;
$$;

revoke all on function public.studio_submit_recording(uuid) from public;
grant execute on function public.studio_submit_recording(uuid) to authenticated;

create or replace function public.studio_moderate_recording(
  p_recording_id uuid,
  p_action text,
  p_reason text default null
)
returns public.studio_recordings
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.studio_recordings;
begin
  if not public.studio_is_moderator() then
    raise exception 'forbidden';
  end if;
  if p_action not in ('approve', 'reject', 'hide', 'unhide') then
    raise exception 'invalid action';
  end if;

  select * into rec from public.studio_recordings where id = p_recording_id for update;
  if not found then
    raise exception 'not found';
  end if;

  if p_action = 'approve' then
    update public.studio_recordings
      set status = 'published',
          published_at = coalesce(published_at, now()),
          reject_reason = null,
          updated_at = now()
      where id = rec.id
      returning * into rec;
    perform public.notify_user(
      rec.owner_id, 'social',
      'Ses kaydın onaylandı ve yayımlandı.',
      'studio_approved', auth.uid(), rec.id
    );
  elsif p_action = 'reject' then
    update public.studio_recordings
      set status = 'rejected',
          reject_reason = p_reason,
          updated_at = now()
      where id = rec.id
      returning * into rec;
    perform public.notify_user(
      rec.owner_id, 'social',
      'Ses kaydın inceleme sonucunda yayımlanamadı.',
      'studio_rejected', auth.uid(), rec.id
    );
  elsif p_action = 'hide' then
    update public.studio_recordings
      set status = 'hidden', updated_at = now()
      where id = rec.id
      returning * into rec;
  elsif p_action = 'unhide' then
    update public.studio_recordings
      set status = 'published', updated_at = now()
      where id = rec.id and status = 'hidden'
      returning * into rec;
  end if;

  insert into public.studio_recording_reviews (recording_id, reviewer_id, action, reason)
  values (rec.id, auth.uid(), p_action, p_reason);

  insert into public.studio_moderation_logs (recording_id, actor_id, action, meta)
  values (rec.id, auth.uid(), p_action, jsonb_build_object('reason', p_reason));

  return rec;
end;
$$;

revoke all on function public.studio_moderate_recording(uuid, text, text) from public;
grant execute on function public.studio_moderate_recording(uuid, text, text) to authenticated;

create or replace function public.studio_soft_delete_recording(p_recording_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.studio_recordings;
begin
  select * into rec from public.studio_recordings where id = p_recording_id for update;
  if not found then
    return;
  end if;
  if rec.owner_id <> auth.uid() and not public.studio_is_moderator() then
    raise exception 'forbidden';
  end if;
  update public.studio_recordings
    set status = 'deleted',
        deleted_at = now(),
        visibility = 'private',
        updated_at = now()
    where id = p_recording_id;
end;
$$;

revoke all on function public.studio_soft_delete_recording(uuid) from public;
grant execute on function public.studio_soft_delete_recording(uuid) to authenticated;

-- RLS
alter table public.studio_recordings enable row level security;
alter table public.studio_recording_edits enable row level security;
alter table public.studio_recording_reviews enable row level security;
alter table public.studio_recording_likes enable row level security;
alter table public.studio_recording_saves enable row level security;
alter table public.studio_recording_comments enable row level security;
alter table public.studio_recording_shares enable row level security;
alter table public.studio_playback_events enable row level security;
alter table public.studio_unique_listeners enable row level security;
alter table public.studio_period_listeners enable row level security;
alter table public.studio_recording_stats_daily enable row level security;
alter table public.studio_user_stats enable row level security;
alter table public.studio_collections enable row level security;
alter table public.studio_collection_items enable row level security;
alter table public.studio_rankings enable row level security;
alter table public.studio_achievements enable row level security;
alter table public.studio_user_achievements enable row level security;
alter table public.studio_reports enable row level security;
alter table public.studio_moderation_logs enable row level security;
alter table public.studio_settings enable row level security;

drop policy if exists studio_recordings_select on public.studio_recordings;
create policy studio_recordings_select on public.studio_recordings
  for select using (public.studio_can_view_recording(studio_recordings));

drop policy if exists studio_recordings_insert on public.studio_recordings;
create policy studio_recordings_insert on public.studio_recordings
  for insert with check (owner_id = auth.uid());

drop policy if exists studio_recordings_update on public.studio_recordings;
create policy studio_recordings_update on public.studio_recordings
  for update using (owner_id = auth.uid() or public.studio_is_moderator())
  with check (owner_id = auth.uid() or public.studio_is_moderator());

drop policy if exists studio_recordings_delete on public.studio_recordings;
create policy studio_recordings_delete on public.studio_recordings
  for delete using (owner_id = auth.uid() or public.studio_is_moderator());

-- Prevent clients from bumping counters directly: revoke update of counter cols via trigger
create or replace function public.studio_guard_counters()
returns trigger
language plpgsql
as $$
begin
  -- Owners cannot forge listen counters or self-approve moderation.
  -- like/save/share/comment counters are maintained by security-definer triggers.
  if not public.studio_is_moderator() and auth.uid() = new.owner_id then
    new.unique_listeners := old.unique_listeners;
    new.play_count := old.play_count;
    if old.status = 'pending_review' and new.status = 'published' then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists studio_guard_counters on public.studio_recordings;
create trigger studio_guard_counters
  before update on public.studio_recordings
  for each row execute function public.studio_guard_counters();

drop policy if exists studio_edits_own on public.studio_recording_edits;
create policy studio_edits_own on public.studio_recording_edits
  for all using (
    exists (select 1 from public.studio_recordings r where r.id = recording_id and (r.owner_id = auth.uid() or public.studio_is_moderator()))
  ) with check (
    exists (select 1 from public.studio_recordings r where r.id = recording_id and r.owner_id = auth.uid())
  );

drop policy if exists studio_reviews_read on public.studio_recording_reviews;
create policy studio_reviews_read on public.studio_recording_reviews
  for select using (
    public.studio_is_moderator()
    or exists (select 1 from public.studio_recordings r where r.id = recording_id and r.owner_id = auth.uid())
  );

drop policy if exists studio_reviews_staff on public.studio_recording_reviews;
create policy studio_reviews_staff on public.studio_recording_reviews
  for insert with check (public.studio_is_moderator());

drop policy if exists studio_likes_select on public.studio_recording_likes;
create policy studio_likes_select on public.studio_recording_likes
  for select using (auth.uid() is not null);

drop policy if exists studio_likes_write on public.studio_recording_likes;
create policy studio_likes_write on public.studio_recording_likes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists studio_saves_own on public.studio_recording_saves;
create policy studio_saves_own on public.studio_recording_saves
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists studio_comments_select on public.studio_recording_comments;
create policy studio_comments_select on public.studio_recording_comments
  for select using (
    deleted_at is null
    and exists (select 1 from public.studio_recordings r where r.id = recording_id and public.studio_can_view_recording(r))
  );

drop policy if exists studio_comments_insert on public.studio_recording_comments;
create policy studio_comments_insert on public.studio_recording_comments
  for insert with check (author_id = auth.uid());

drop policy if exists studio_comments_update on public.studio_recording_comments;
create policy studio_comments_update on public.studio_recording_comments
  for update using (author_id = auth.uid() or public.studio_is_moderator());

drop policy if exists studio_shares_select on public.studio_recording_shares;
create policy studio_shares_select on public.studio_recording_shares
  for select using (auth.uid() is not null);

drop policy if exists studio_shares_insert on public.studio_recording_shares;
create policy studio_shares_insert on public.studio_recording_shares
  for insert with check (user_id = auth.uid());

drop policy if exists studio_playback_select on public.studio_playback_events;
create policy studio_playback_select on public.studio_playback_events
  for select using (
    listener_user_id = auth.uid()
    or public.studio_is_moderator()
    or exists (select 1 from public.studio_recordings r where r.id = recording_id and r.owner_id = auth.uid())
  );

-- No direct insert into playback / unique — only via RPC
drop policy if exists studio_unique_select on public.studio_unique_listeners;
create policy studio_unique_select on public.studio_unique_listeners
  for select using (
    listener_user_id = auth.uid()
    or public.studio_is_moderator()
    or exists (select 1 from public.studio_recordings r where r.id = recording_id and r.owner_id = auth.uid())
  );

drop policy if exists studio_period_select on public.studio_period_listeners;
create policy studio_period_select on public.studio_period_listeners
  for select using (
    listener_user_id = auth.uid()
    or public.studio_is_moderator()
    or exists (select 1 from public.studio_recordings r where r.id = recording_id and r.owner_id = auth.uid())
  );

drop policy if exists studio_stats_daily_select on public.studio_recording_stats_daily;
create policy studio_stats_daily_select on public.studio_recording_stats_daily
  for select using (
    public.studio_is_moderator()
    or exists (select 1 from public.studio_recordings r where r.id = recording_id and r.owner_id = auth.uid())
  );

drop policy if exists studio_user_stats_select on public.studio_user_stats;
create policy studio_user_stats_select on public.studio_user_stats
  for select using (true);

drop policy if exists studio_collections_select on public.studio_collections;
create policy studio_collections_select on public.studio_collections
  for select using (
    visibility = 'public' or owner_id = auth.uid() or public.studio_is_moderator()
  );

drop policy if exists studio_collections_write on public.studio_collections;
create policy studio_collections_write on public.studio_collections
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists studio_collection_items_select on public.studio_collection_items;
create policy studio_collection_items_select on public.studio_collection_items
  for select using (
    exists (
      select 1 from public.studio_collections c
      where c.id = collection_id
        and (c.visibility = 'public' or c.owner_id = auth.uid() or public.studio_is_moderator())
    )
  );

drop policy if exists studio_collection_items_write on public.studio_collection_items;
create policy studio_collection_items_write on public.studio_collection_items
  for all using (
    exists (select 1 from public.studio_collections c where c.id = collection_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.studio_collections c where c.id = collection_id and c.owner_id = auth.uid())
  );

drop policy if exists studio_rankings_select on public.studio_rankings;
create policy studio_rankings_select on public.studio_rankings
  for select using (true);

drop policy if exists studio_achievements_select on public.studio_achievements;
create policy studio_achievements_select on public.studio_achievements
  for select using (true);

drop policy if exists studio_user_achievements_select on public.studio_user_achievements;
create policy studio_user_achievements_select on public.studio_user_achievements
  for select using (true);

drop policy if exists studio_reports_insert on public.studio_reports;
create policy studio_reports_insert on public.studio_reports
  for insert with check (reporter_id = auth.uid());

drop policy if exists studio_reports_select on public.studio_reports;
create policy studio_reports_select on public.studio_reports
  for select using (reporter_id = auth.uid() or public.studio_is_moderator());

drop policy if exists studio_reports_staff on public.studio_reports;
create policy studio_reports_staff on public.studio_reports
  for update using (public.studio_is_moderator());

drop policy if exists studio_mod_logs_staff on public.studio_moderation_logs;
create policy studio_mod_logs_staff on public.studio_moderation_logs
  for select using (public.studio_is_moderator());

drop policy if exists studio_settings_select on public.studio_settings;
create policy studio_settings_select on public.studio_settings
  for select using (auth.uid() is not null);

drop policy if exists studio_settings_staff on public.studio_settings;
create policy studio_settings_staff on public.studio_settings
  for update using (public.has_permission('studio.manage') or public.is_staff());

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('studio-audio', 'studio-audio', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists studio_audio_read on storage.objects;
create policy studio_audio_read on storage.objects
  for select using (bucket_id = 'studio-audio');

drop policy if exists studio_audio_insert on storage.objects;
create policy studio_audio_insert on storage.objects
  for insert with check (
    bucket_id = 'studio-audio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists studio_audio_update on storage.objects;
create policy studio_audio_update on storage.objects
  for update using (
    bucket_id = 'studio-audio'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.studio_is_moderator())
  ) with check (
    bucket_id = 'studio-audio'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.studio_is_moderator())
  );

drop policy if exists studio_audio_delete on storage.objects;
create policy studio_audio_delete on storage.objects
  for delete using (
    bucket_id = 'studio-audio'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.studio_is_moderator())
  );

-- Keep denormalized like/save counters in sync (owners cannot bump via RLS update)
create or replace function public.studio_sync_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.studio_recordings
      set like_count = like_count + 1
      where id = new.recording_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.studio_recordings
      set like_count = greatest(0, like_count - 1)
      where id = old.recording_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists studio_likes_sync on public.studio_recording_likes;
create trigger studio_likes_sync
  after insert or delete on public.studio_recording_likes
  for each row execute function public.studio_sync_like_count();

create or replace function public.studio_sync_save_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.studio_recordings
      set save_count = save_count + 1
      where id = new.recording_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.studio_recordings
      set save_count = greatest(0, save_count - 1)
      where id = old.recording_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists studio_saves_sync on public.studio_recording_saves;
create trigger studio_saves_sync
  after insert or delete on public.studio_recording_saves
  for each row execute function public.studio_sync_save_count();

-- Achievement thresholds on unique listener growth
create or replace function public.studio_check_listener_achievements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.unique_listeners >= 100 and (old.unique_listeners is null or old.unique_listeners < 100) then
    insert into public.studio_user_achievements (user_id, achievement_key, recording_id)
    values (new.owner_id, 'listeners_100', new.id)
    on conflict do nothing;
    perform public.notify_user(
      new.owner_id, 'social',
      'Seslendirmen 100 farklı dinleyiciye ulaştı!',
      'studio_listeners_100', null, new.id
    );
  end if;
  if new.unique_listeners >= 1000 and (old.unique_listeners is null or old.unique_listeners < 1000) then
    insert into public.studio_user_achievements (user_id, achievement_key, recording_id)
    values (new.owner_id, 'listeners_1000', new.id)
    on conflict do nothing;
    perform public.notify_user(
      new.owner_id, 'social',
      'Seslendirmen 1.000 farklı dinleyiciye ulaştı!',
      'studio_listeners_1000', null, new.id
    );
  end if;
  if new.unique_listeners >= 10000 and (old.unique_listeners is null or old.unique_listeners < 10000) then
    insert into public.studio_user_achievements (user_id, achievement_key, recording_id)
    values (new.owner_id, 'listeners_10000', new.id)
    on conflict do nothing;
    perform public.notify_user(
      new.owner_id, 'social',
      'Seslendirmen 10.000 farklı dinleyiciye ulaştı!',
      'studio_listeners_10000', null, new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists studio_listener_achievements on public.studio_recordings;
create trigger studio_listener_achievements
  after update of unique_listeners on public.studio_recordings
  for each row execute function public.studio_check_listener_achievements();
