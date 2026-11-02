-- SAFDAŞ — HAYAT HİKÂYELERİ
-- Long-form user stories with pseudonymous publishing, linked Qur'an/dua content,
-- support interactions and moderation.
--
-- All public reads go through SECURITY DEFINER RPCs. The base tables are not
-- granted to clients so a pseudonymous story can never leak `author_id` through
-- a PostgREST projection, a realtime payload or a share query.

-- ── Categories ───────────────────────────────────────────────────────────────
create table if not exists public.story_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  name_tr text not null,
  name_en text,
  name_ar text,
  name_es text,
  icon text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists story_categories_updated on public.story_categories;
create trigger story_categories_updated
before update on public.story_categories
for each row execute function public.set_updated_at();

insert into public.story_categories (slug, name_tr, name_en, name_ar, name_es, icon, sort_order) values
  ('donum-noktasi', 'Hayatımın Dönüm Noktası', 'Turning point of my life', 'نقطة التحول في حياتي', 'El punto de inflexión de mi vida', 'flag', 1),
  ('sabir', 'Sabır ve Mücadele', 'Patience and struggle', 'الصبر والكفاح', 'Paciencia y lucha', 'shield', 2),
  ('yeniden-baslamak', 'Yeniden Başlamak', 'Starting over', 'البدء من جديد', 'Empezar de nuevo', 'refresh', 3),
  ('aile', 'Aile ve Sevdiklerim', 'Family and loved ones', 'العائلة والأحباء', 'Familia y seres queridos', 'people', 4),
  ('sukur', 'Şükür ve Mutluluk', 'Gratitude and joy', 'الشكر والسعادة', 'Gratitud y alegría', 'sunny', 5),
  ('pismanlik', 'Pişmanlık ve Dersler', 'Regret and lessons', 'الندم والدروس', 'Arrepentimiento y lecciones', 'leaf', 6),
  ('umut', 'Umut Veren Hikâyeler', 'Stories of hope', 'قصص الأمل', 'Historias de esperanza', 'sparkles', 7),
  ('hayat-tecrubesi', 'Hayat Tecrübelerim', 'My life experience', 'تجارب حياتي', 'Mi experiencia de vida', 'book', 8)
on conflict (slug) do nothing;

-- ── Stories ──────────────────────────────────────────────────────────────────
create or replace function public.story_alias(p_seed uuid)
returns text
language sql
immutable
as $$
  select (array[
    'Gönülden Bir Yolcu',
    'Sabırla Yürüyen',
    'Yeniden Başlayan',
    'Sessiz Tanık',
    'Umut Taşıyan',
    'Bir Yol Hikâyesi'
  ])[(abs(hashtext(p_seed::text)::bigint) % 6) + 1];
$$;

create table if not exists public.life_stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.story_categories(id) on delete set null,
  title text not null check (char_length(title) between 3 and 160),
  body text not null check (char_length(body) between 1 and 40000),
  cover_url text,
  pseudonymous boolean not null default false,
  alias text,
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden', 'removed')),
  comments_enabled boolean not null default true,
  contact_enabled boolean not null default true,
  support_enabled boolean not null default true,
  reading_minutes integer not null default 1 check (reading_minutes between 1 and 240),
  language text not null default 'tr',
  comment_count integer not null default 0,
  support_count integer not null default 0,
  bookmark_count integer not null default 0,
  report_count integer not null default 0,
  published_at timestamptz,
  hidden_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_stories_feed_idx
  on public.life_stories (status, published_at desc)
  where status = 'published';
create index if not exists life_stories_author_idx
  on public.life_stories (author_id, updated_at desc);
create index if not exists life_stories_category_idx
  on public.life_stories (category_id, published_at desc);

drop trigger if exists life_stories_updated on public.life_stories;
create trigger life_stories_updated
before update on public.life_stories
for each row execute function public.set_updated_at();

create table if not exists public.story_media (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.life_stories(id) on delete cascade,
  url text not null,
  media_type text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.story_linked_content (
  story_id uuid primary key references public.life_stories(id) on delete cascade,
  content_kind text not null check (content_kind in ('quran', 'dua')),
  content_key text not null check (public.worship_content_key_valid(content_key)),
  label text,
  reciter_id text,
  created_at timestamptz not null default now(),
  check (split_part(content_key, ':', 1) = content_kind)
);

create index if not exists story_linked_content_key_idx
  on public.story_linked_content (content_key);

create table if not exists public.story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.life_stories(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.story_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1200),
  deleted_at timestamptz,
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists story_comments_story_idx
  on public.story_comments (story_id, created_at desc);

create table if not exists public.story_supports (
  story_id uuid not null references public.life_stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create index if not exists story_supports_user_idx on public.story_supports (user_id, created_at desc);

create table if not exists public.story_bookmarks (
  story_id uuid not null references public.life_stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create index if not exists story_bookmarks_user_idx on public.story_bookmarks (user_id, created_at desc);

create table if not exists public.story_contact_requests (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.life_stories(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'blocked', 'cancelled')),
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> recipient_id)
);

create index if not exists story_contact_requests_recipient_idx
  on public.story_contact_requests (recipient_id, status, created_at desc);
create unique index if not exists story_contact_requests_single_pending_idx
  on public.story_contact_requests (requester_id, recipient_id)
  where status = 'pending';

create table if not exists public.story_moderation_records (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.life_stories(id) on delete cascade,
  moderator_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists story_moderation_story_idx
  on public.story_moderation_records (story_id, created_at desc);

-- ── Counters ─────────────────────────────────────────────────────────────────
create or replace function public.story_sync_counts(p_story uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.life_stories s
  set comment_count = (
        select count(*) from public.story_comments c
        where c.story_id = p_story and c.deleted_at is null and c.hidden_at is null
      ),
      support_count = (select count(*) from public.story_supports sp where sp.story_id = p_story),
      bookmark_count = (select count(*) from public.story_bookmarks b where b.story_id = p_story)
  where s.id = p_story;
$$;

create or replace function public.trg_story_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.story_sync_counts(coalesce(new.story_id, old.story_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists story_comments_count on public.story_comments;
create trigger story_comments_count
after insert or delete on public.story_comments
for each row execute function public.trg_story_comments_count();

create or replace function public.trg_story_supports_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.story_sync_counts(coalesce(new.story_id, old.story_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists story_supports_count on public.story_supports;
create trigger story_supports_count
after insert or delete on public.story_supports
for each row execute function public.trg_story_supports_count();

create or replace function public.trg_story_bookmarks_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.story_sync_counts(coalesce(new.story_id, old.story_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists story_bookmarks_count on public.story_bookmarks;
create trigger story_bookmarks_count
after insert or delete on public.story_bookmarks
for each row execute function public.trg_story_bookmarks_count();

-- ── RLS: no direct client table access ───────────────────────────────────────
alter table public.story_categories enable row level security;
alter table public.life_stories enable row level security;
alter table public.story_media enable row level security;
alter table public.story_linked_content enable row level security;
alter table public.story_comments enable row level security;
alter table public.story_supports enable row level security;
alter table public.story_bookmarks enable row level security;
alter table public.story_contact_requests enable row level security;
alter table public.story_moderation_records enable row level security;

drop policy if exists story_categories_read on public.story_categories;
create policy story_categories_read on public.story_categories
  for select using (active or public.is_staff());

revoke all on public.story_categories from anon;
grant select on public.story_categories to authenticated;

revoke all on public.life_stories from anon, authenticated;
revoke all on public.story_media from anon, authenticated;
revoke all on public.story_linked_content from anon, authenticated;
revoke all on public.story_comments from anon, authenticated;
revoke all on public.story_supports from anon, authenticated;
revoke all on public.story_bookmarks from anon, authenticated;
revoke all on public.story_contact_requests from anon, authenticated;
revoke all on public.story_moderation_records from anon, authenticated;

-- ── Read helpers ─────────────────────────────────────────────────────────────
create or replace function public.story_client_config()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'enabled', public.live_setting_bool('story_enabled', true),
    'daily_publish_limit', public.live_setting_int('story_daily_publish_limit', 5),
    'comment_daily_limit', public.live_setting_int('story_comment_daily_limit', 100),
    'contact_daily_limit', public.live_setting_int('story_contact_daily_limit', 10),
    'pending_contact_limit', public.live_setting_int('story_pending_contact_limit', 5),
    'contact_cooldown_days', public.live_setting_int('story_contact_cooldown_days', 14)
  );
$$;

create or replace function public.story_categories_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row order by row.sort_order, row.slug), '[]'::jsonb)
  from (
    select id, slug, name_tr, name_en, name_ar, name_es, icon, sort_order
    from public.story_categories
    where active
  ) row;
$$;

create or replace function public.story_can_read(p_story uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.life_stories s
    where s.id = p_story
      and (
        (s.status = 'published' and not public.is_blocked(s.author_id, p_uid))
        or s.author_id = p_uid
        or public.is_staff()
      )
  );
$$;

-- ── Feed ─────────────────────────────────────────────────────────────────────
create or replace function public.stories_feed(
  p_tab text default 'new',
  p_category uuid default null,
  p_cursor timestamptz default null,
  p_limit integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tab text := lower(coalesce(p_tab, 'new'));
  safe_limit integer := least(greatest(coalesce(p_limit, 12), 1), 30);
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  if not public.live_setting_bool('story_enabled', true) then
    return '[]'::jsonb;
  end if;

  return coalesce((
    with preferred as (
      select distinct s.category_id
      from public.story_supports sp
      join public.life_stories s on s.id = sp.story_id
      where sp.user_id = uid and s.category_id is not null
      union
      select distinct s.category_id
      from public.story_bookmarks b
      join public.life_stories s on s.id = b.story_id
      where b.user_id = uid and s.category_id is not null
      union
      select distinct s.category_id
      from public.story_comments c
      join public.life_stories s on s.id = c.story_id
      where c.author_id = uid and c.deleted_at is null and s.category_id is not null
    )
    select jsonb_agg(row order by row.sort_rank desc, row.sort_date desc)
    from (
      select
        s.id,
        s.title,
        left(regexp_replace(s.body, '\s+', ' ', 'g'), 200) as excerpt,
        s.cover_url,
        s.category_id,
        c.slug as category_slug,
        c.name_tr, c.name_en, c.name_ar, c.name_es,
        case when s.pseudonymous then coalesce(s.alias, public.story_alias(s.id))
             else coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Bir yazar') end as author_name,
        case when s.pseudonymous then null else p.avatar_url end as author_avatar,
        case when s.pseudonymous then null else p.username end as author_username,
        s.pseudonymous,
        s.reading_minutes,
        s.published_at,
        s.comment_count,
        s.support_count,
        s.support_enabled,
        lc.content_kind as linked_kind,
        lc.content_key as linked_key,
        lc.label as linked_label,
        exists (select 1 from public.story_bookmarks b where b.story_id = s.id and b.user_id = uid) as saved,
        s.author_id = uid as own,
        case when tab = 'for_you' then (s.category_id in (select category_id from preferred)) else false end as sort_rank,
        coalesce(s.published_at, s.created_at) as sort_date
      from public.life_stories s
      join public.profiles p on p.id = s.author_id
      left join public.story_categories c on c.id = s.category_id
      left join public.story_linked_content lc on lc.story_id = s.id
      where s.status = 'published'
        and not public.is_blocked(s.author_id, uid)
        and (p_category is null or s.category_id = p_category)
        and (p_cursor is null or coalesce(s.published_at, s.created_at) < p_cursor)
        and (tab <> 'saved' or exists (
          select 1 from public.story_bookmarks b where b.story_id = s.id and b.user_id = uid
        ))
      order by coalesce(s.published_at, s.created_at) desc
      limit safe_limit
    ) row
  ), '[]'::jsonb);
end;
$$;

create or replace function public.story_detail(p_story uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  if not public.story_can_read(p_story, uid) then
    raise exception 'Hikâye bulunamadı';
  end if;
  select jsonb_build_object(
    'id', s.id,
    'title', s.title,
    'body', s.body,
    'cover_url', s.cover_url,
    'category_id', s.category_id,
    'category_slug', c.slug,
    'category_names', jsonb_build_object(
      'tr', c.name_tr, 'en', c.name_en, 'ar', c.name_ar, 'es', c.name_es
    ),
    'author_name', case when s.pseudonymous then coalesce(s.alias, public.story_alias(s.id))
                        else coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Bir yazar') end,
    'author_avatar', case when s.pseudonymous then null else p.avatar_url end,
    'author_username', case when s.pseudonymous then null else p.username end,
    'pseudonymous', s.pseudonymous,
    'status', s.status,
    'comments_enabled', s.comments_enabled,
    'contact_enabled', s.contact_enabled,
    'support_enabled', s.support_enabled,
    'reading_minutes', s.reading_minutes,
    'comment_count', s.comment_count,
    'support_count', s.support_count,
    'bookmark_count', s.bookmark_count,
    'published_at', s.published_at,
    'updated_at', s.updated_at,
    'own', s.author_id = uid,
    'saved', exists (select 1 from public.story_bookmarks b where b.story_id = s.id and b.user_id = uid),
    'supported', exists (select 1 from public.story_supports sp where sp.story_id = s.id and sp.user_id = uid),
    'linked', (
      select jsonb_build_object(
        'kind', lc.content_kind, 'key', lc.content_key,
        'label', lc.label, 'reciter_id', lc.reciter_id
      ) from public.story_linked_content lc where lc.story_id = s.id
    )
  ) into result
  from public.life_stories s
  join public.profiles p on p.id = s.author_id
  left join public.story_categories c on c.id = s.category_id
  where s.id = p_story;
  return result;
end;
$$;

create or replace function public.story_my_stories()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  return coalesce((
    select jsonb_agg(row order by row.updated_at desc)
    from (
      select
        s.id, s.title, s.status, s.cover_url, s.pseudonymous,
        s.reading_minutes, s.comment_count, s.support_count,
        s.published_at, s.updated_at, s.hidden_reason,
        lc.content_key as linked_key, lc.content_kind as linked_kind, lc.label as linked_label
      from public.life_stories s
      left join public.story_linked_content lc on lc.story_id = s.id
      where s.author_id = uid
      order by s.updated_at desc
      limit 100
    ) row
  ), '[]'::jsonb);
end;
$$;

-- ── Write ────────────────────────────────────────────────────────────────────
create or replace function public.story_save(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  story_id uuid := nullif(p_payload->>'id', '')::uuid;
  existing public.life_stories%rowtype;
  v_title text := nullif(trim(coalesce(p_payload->>'title', '')), '');
  v_body text := nullif(trim(coalesce(p_payload->>'body', '')), '');
  v_cover text := nullif(trim(coalesce(p_payload->>'cover_url', '')), '');
  v_status text := lower(coalesce(p_payload->>'status', 'draft'));
  v_category uuid := nullif(p_payload->>'category_id', '')::uuid;
  v_pseudonymous boolean := coalesce((p_payload->>'pseudonymous')::boolean, false);
  v_comments boolean := coalesce((p_payload->>'comments_enabled')::boolean, true);
  v_contact boolean := coalesce((p_payload->>'contact_enabled')::boolean, true);
  v_support boolean := coalesce((p_payload->>'support_enabled')::boolean, true);
  linked jsonb := p_payload->'linked';
  linked_kind text;
  linked_key text;
  linked_label text;
  linked_reciter text;
  minutes integer;
  publish_limit integer;
  published_today integer;
  alias_value text;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  if not public.live_setting_bool('story_enabled', true) then
    raise exception 'Hayat Hikâyeleri şu anda kapalı';
  end if;
  if v_title is null or char_length(v_title) < 3 then
    raise exception 'Başlık en az 3 karakter olmalı';
  end if;
  if char_length(v_title) > 160 then
    raise exception 'Başlık çok uzun';
  end if;
  if v_body is null then
    raise exception 'Hikâye metni boş olamaz';
  end if;
  if char_length(v_body) > 40000 then
    raise exception 'Hikâye metni çok uzun';
  end if;
  if v_status not in ('draft', 'published') then
    raise exception 'Geçersiz yayın durumu';
  end if;
  if v_status = 'published' and char_length(v_body) < 120 then
    raise exception 'Yayınlamak için hikâye en az 120 karakter olmalı';
  end if;
  if v_cover is not null and (char_length(v_cover) > 1000 or v_cover !~* '^https?://') then
    raise exception 'Kapak görseli geçersiz';
  end if;
  if v_category is not null and not exists (
    select 1 from public.story_categories where id = v_category and active
  ) then
    raise exception 'Kategori bulunamadı';
  end if;

  if story_id is not null then
    select * into existing from public.life_stories where id = story_id for update;
    if existing.id is null or existing.author_id <> uid then
      raise exception 'Hikâye bulunamadı';
    end if;
    if existing.status = 'removed' then
      raise exception 'Kaldırılan hikâye düzenlenemez';
    end if;
    if existing.status = 'hidden' and v_status = 'published' then
      raise exception 'Moderasyon incelemesi tamamlanmadan hikâye yeniden yayınlanamaz';
    end if;
  end if;

  if linked is not null and jsonb_typeof(linked) = 'object' then
    linked_kind := lower(coalesce(linked->>'kind', ''));
    linked_key := nullif(trim(coalesce(linked->>'key', '')), '');
    linked_label := nullif(left(trim(coalesce(linked->>'label', '')), 160), '');
    linked_reciter := nullif(left(trim(coalesce(linked->>'reciter_id', '')), 80), '');
    if linked_kind not in ('quran', 'dua') then
      raise exception 'İlgili içerik türü geçersiz';
    end if;
    if linked_key is null
       or not public.worship_content_key_valid(linked_key)
       or split_part(linked_key, ':', 1) <> linked_kind then
      raise exception 'İlgili içerik kimliği geçersiz';
    end if;
  end if;

  alias_value := case when v_pseudonymous then coalesce(existing.alias, public.story_alias(coalesce(story_id, gen_random_uuid()))) else null end;
  minutes := greatest(1, least(240, ceil(array_length(regexp_split_to_array(v_body, '\s+'), 1) / 200.0)::integer));

  if story_id is null then
    if v_status = 'published' then
      select count(*) into published_today
      from public.life_stories
      where author_id = uid and published_at > now() - interval '24 hours';
      publish_limit := public.live_setting_int('story_daily_publish_limit', 5);
      if published_today >= publish_limit then
        raise exception 'Günlük hikâye yayınlama sınırına ulaştın';
      end if;
    end if;
    insert into public.life_stories (
      author_id, category_id, title, body, cover_url, pseudonymous, alias,
      status, comments_enabled, contact_enabled, support_enabled,
      reading_minutes, published_at
    ) values (
      uid, v_category, v_title, v_body, v_cover, v_pseudonymous, alias_value,
      v_status, v_comments, v_contact, v_support,
      minutes, case when v_status = 'published' then now() else null end
    ) returning id into story_id;
  else
    if v_status = 'published' and existing.status <> 'published' then
      select count(*) into published_today
      from public.life_stories
      where author_id = uid and published_at > now() - interval '24 hours' and id <> story_id;
      publish_limit := public.live_setting_int('story_daily_publish_limit', 5);
      if published_today >= publish_limit then
        raise exception 'Günlük hikâye yayınlama sınırına ulaştın';
      end if;
    end if;
    update public.life_stories set
      category_id = v_category,
      title = v_title,
      body = v_body,
      cover_url = v_cover,
      pseudonymous = v_pseudonymous,
      alias = alias_value,
      status = v_status,
      comments_enabled = v_comments,
      contact_enabled = v_contact,
      support_enabled = v_support,
      reading_minutes = minutes,
      published_at = case
        when v_status = 'published' then coalesce(existing.published_at, now())
        else existing.published_at
      end,
      hidden_reason = case when v_status = 'published' then null else hidden_reason end
    where id = story_id;
  end if;

  if linked_kind is not null then
    insert into public.story_linked_content (story_id, content_kind, content_key, label, reciter_id)
    values (story_id, linked_kind, linked_key, linked_label, linked_reciter)
    on conflict (story_id) do update set
      content_kind = excluded.content_kind,
      content_key = excluded.content_key,
      label = excluded.label,
      reciter_id = excluded.reciter_id;
  else
    delete from public.story_linked_content where story_id = story_id;
  end if;

  return jsonb_build_object('id', story_id, 'status', v_status, 'reading_minutes', minutes);
end;
$$;

create or replace function public.story_set_status(p_story uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.life_stories%rowtype;
  next_status text := lower(coalesce(p_status, ''));
  published_today integer;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  select * into existing from public.life_stories where id = p_story for update;
  if existing.id is null or existing.author_id <> uid then
    raise exception 'Hikâye bulunamadı';
  end if;
  if next_status not in ('draft', 'published') then
    raise exception 'Geçersiz durum';
  end if;
  if existing.status = 'removed' then
    raise exception 'Kaldırılan hikâye değiştirilemez';
  end if;
  if existing.status = 'hidden' and next_status = 'published' then
    raise exception 'Moderasyon incelemesi tamamlanmadan hikâye yeniden yayınlanamaz';
  end if;
  if next_status = 'published' and existing.status <> 'published' then
    select count(*) into published_today
    from public.life_stories
    where author_id = uid and published_at > now() - interval '24 hours' and id <> p_story;
    if published_today >= public.live_setting_int('story_daily_publish_limit', 5) then
      raise exception 'Günlük hikâye yayınlama sınırına ulaştın';
    end if;
    update public.life_stories
    set status = 'published', published_at = coalesce(published_at, now()), hidden_reason = null
    where id = p_story;
  else
    update public.life_stories set status = next_status where id = p_story;
  end if;
  return jsonb_build_object('id', p_story, 'status', next_status);
end;
$$;

create or replace function public.story_delete(p_story uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  author uuid;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  select author_id into author from public.life_stories where id = p_story;
  if author is null then
    raise exception 'Hikâye bulunamadı';
  end if;
  if author <> uid and not public.is_staff() then
    raise exception 'Yetkin yok';
  end if;
  if author <> uid then
    insert into public.story_moderation_records (story_id, moderator_id, action, reason)
    values (p_story, uid, 'delete', 'Yönetici tarafından silindi');
    insert into public.admin_audit_logs (actor_id, action, target)
    values (uid, 'story_delete', p_story::text);
  end if;
  delete from public.life_stories where id = p_story;
  return jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.story_toggle_bookmark(p_story uuid, p_saved boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  if not public.story_can_read(p_story, uid) then
    raise exception 'Hikâye bulunamadı';
  end if;
  if coalesce(p_saved, true) then
    insert into public.story_bookmarks (story_id, user_id) values (p_story, uid)
    on conflict do nothing;
  else
    delete from public.story_bookmarks where story_id = p_story and user_id = uid;
  end if;
  return jsonb_build_object(
    'saved', coalesce(p_saved, true),
    'bookmark_count', (select bookmark_count from public.life_stories where id = p_story)
  );
end;
$$;

create or replace function public.story_support(p_story uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  story public.life_stories%rowtype;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  select * into story from public.life_stories where id = p_story;
  if story.id is null or not public.story_can_read(p_story, uid) then
    raise exception 'Hikâye bulunamadı';
  end if;
  if not story.support_enabled then
    raise exception 'Bu hikâye için destek kapalı';
  end if;
  insert into public.story_supports (story_id, user_id) values (p_story, uid)
  on conflict do nothing;
  if story.author_id <> uid then
    perform public.notify_user(
      story.author_id,
      'social',
      public.actor_label(uid) || ' senin için dua etti.',
      'story_support',
      uid,
      p_story
    );
  end if;
  return jsonb_build_object(
    'supported', true,
    'support_count', (select support_count from public.life_stories where id = p_story)
  );
end;
$$;

create or replace function public.story_comments_list(
  p_story uuid,
  p_limit integer default 30,
  p_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  if not public.story_can_read(p_story, uid) then
    raise exception 'Hikâye bulunamadı';
  end if;
  return coalesce((
    select jsonb_agg(row order by row.created_at)
    from (
      select
        c.id,
        c.parent_id,
        c.body,
        c.created_at,
        c.author_id,
        case
          when s.pseudonymous and c.author_id = s.author_id
            then coalesce(s.alias, public.story_alias(s.id))
          else coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Bir kullanıcı')
        end as author_name,
        case when s.pseudonymous and c.author_id = s.author_id then null else p.avatar_url end as author_avatar,
        c.author_id = uid as own
      from public.story_comments c
      join public.life_stories s on s.id = c.story_id
      join public.profiles p on p.id = c.author_id
      where c.story_id = p_story
        and c.deleted_at is null
        and c.hidden_at is null
        and (p_before is null or c.created_at < p_before)
        and not public.is_blocked(c.author_id, uid)
      order by c.created_at desc
      limit safe_limit
    ) row
  ), '[]'::jsonb);
end;
$$;

create or replace function public.story_add_comment(
  p_story uuid,
  p_body text,
  p_parent uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  story public.life_stories%rowtype;
  body text := nullif(trim(coalesce(p_body, '')), '');
  total_today integer;
  comment_id uuid;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  if body is null or char_length(body) > 1200 then
    raise exception 'Yorum geçersiz';
  end if;
  select * into story from public.life_stories where id = p_story;
  if story.id is null or not public.story_can_read(p_story, uid) then
    raise exception 'Hikâye bulunamadı';
  end if;
  if story.status <> 'published' then
    raise exception 'Bu hikâyeye yorum yapılamaz';
  end if;
  if not story.comments_enabled and story.author_id <> uid and not public.is_staff() then
    raise exception 'Bu hikâyede yorumlar kapalı';
  end if;
  if p_parent is not null and not exists (
    select 1 from public.story_comments where id = p_parent and story_id = p_story and deleted_at is null
  ) then
    raise exception 'Yanıtlanan yorum bulunamadı';
  end if;
  select count(*) into total_today
  from public.story_comments
  where author_id = uid and created_at > now() - interval '24 hours';
  if total_today >= public.live_setting_int('story_comment_daily_limit', 100) then
    raise exception 'Günlük yorum sınırına ulaştın';
  end if;
  insert into public.story_comments (story_id, author_id, parent_id, body)
  values (p_story, uid, p_parent, body)
  returning id into comment_id;
  if story.author_id <> uid then
    perform public.notify_user(
      story.author_id,
      'social',
      public.actor_label(uid) || ' hikâyene yorum yaptı.',
      'story_comment',
      uid,
      p_story
    );
  end if;
  return jsonb_build_object('id', comment_id, 'comment_count', (select comment_count from public.life_stories where id = p_story));
end;
$$;

create or replace function public.story_delete_comment(p_comment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  comment public.story_comments%rowtype;
  story_author uuid;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  select * into comment from public.story_comments where id = p_comment;
  if comment.id is null then
    raise exception 'Yorum bulunamadı';
  end if;
  select author_id into story_author from public.life_stories where id = comment.story_id;
  if comment.author_id <> uid and story_author <> uid and not public.is_staff() then
    raise exception 'Yetkin yok';
  end if;
  update public.story_comments set deleted_at = now() where id = p_comment;
  return jsonb_build_object('deleted', true);
end;
$$;

-- ── Contact requests ─────────────────────────────────────────────────────────
create or replace function public.story_request_contact(
  p_story uuid,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  story public.life_stories%rowtype;
  message text := nullif(trim(coalesce(p_message, '')), '');
  sent_today integer;
  pending_count integer;
  recent_decline timestamptz;
  request_id uuid;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  select * into story from public.life_stories where id = p_story;
  if story.id is null or story.status <> 'published' then
    raise exception 'Hikâye bulunamadı';
  end if;
  if story.author_id = uid then
    raise exception 'Kendi hikâyene istek gönderemezsin';
  end if;
  if not story.contact_enabled then
    raise exception 'Yazar özel iletişime kapalı';
  end if;
  if story.pseudonymous then
    raise exception 'Takma adla paylaşılan hikâyelerde özel iletişim kapalıdır';
  end if;
  if public.is_blocked(uid, story.author_id) then
    raise exception 'Bu kullanıcıya istek gönderilemez';
  end if;
  if message is not null and char_length(message) > 500 then
    raise exception 'Mesaj çok uzun';
  end if;

  select count(*) into sent_today
  from public.story_contact_requests
  where requester_id = uid and created_at > now() - interval '24 hours';
  if sent_today >= public.live_setting_int('story_contact_daily_limit', 10) then
    raise exception 'Günlük iletişim isteği sınırına ulaştın';
  end if;
  select count(*) into pending_count
  from public.story_contact_requests
  where requester_id = uid and status = 'pending';
  if pending_count >= public.live_setting_int('story_pending_contact_limit', 5) then
    raise exception 'Bekleyen çok fazla isteğin var';
  end if;
  select max(responded_at) into recent_decline
  from public.story_contact_requests
  where requester_id = uid and recipient_id = story.author_id and status in ('declined', 'blocked');
  if recent_decline is not null
     and recent_decline > now() - make_interval(days => greatest(public.live_setting_int('story_contact_cooldown_days', 14), 0)) then
    raise exception 'Yazar isteğini yeni reddetti, bir süre tekrar deneyemezsin';
  end if;

  insert into public.story_contact_requests (story_id, requester_id, recipient_id, message)
  values (p_story, uid, story.author_id, message)
  returning id into request_id;

  perform public.notify_user(
    story.author_id,
    'social',
    public.actor_label(uid) || ' "' || left(story.title, 60) || '" hikâyen için iletişim isteği gönderdi.',
    'story_contact_request',
    uid,
    request_id
  );
  return jsonb_build_object('request_id', request_id, 'status', 'pending');
exception
  when unique_violation then
    raise exception 'Bu yazara zaten bekleyen bir isteğin var';
end;
$$;

create or replace function public.story_incoming_contact_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  return coalesce((
    select jsonb_agg(row order by row.created_at desc)
    from (
      select
        r.id, r.story_id, r.message, r.status, r.created_at,
        s.title as story_title,
        r.requester_id as peer_id,
        coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Bir okuyucu') as peer_name,
        p.avatar_url as peer_avatar
      from public.story_contact_requests r
      join public.life_stories s on s.id = r.story_id
      join public.profiles p on p.id = r.requester_id
      where r.recipient_id = uid and r.status = 'pending'
        and not public.is_blocked(uid, r.requester_id)
      limit 30
    ) row
  ), '[]'::jsonb);
end;
$$;

create or replace function public.story_outgoing_contact_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  return coalesce((
    select jsonb_agg(row order by row.created_at desc)
    from (
      select
        r.id, r.story_id, r.status, r.created_at, r.responded_at,
        s.title as story_title
      from public.story_contact_requests r
      join public.life_stories s on s.id = r.story_id
      where r.requester_id = uid and r.created_at > now() - interval '30 days'
      order by r.created_at desc
      limit 30
    ) row
  ), '[]'::jsonb);
end;
$$;

create or replace function public.story_respond_contact(p_request uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  req public.story_contact_requests%rowtype;
  conversation uuid;
  action text := lower(coalesce(p_action, ''));
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  select * into req from public.story_contact_requests where id = p_request for update;
  if req.id is null or req.recipient_id <> uid then
    raise exception 'İstek bulunamadı';
  end if;
  if req.status <> 'pending' then
    raise exception 'Bu istek artık beklemede değil';
  end if;
  if action = 'accept' then
    begin
      conversation := public.get_or_create_direct_conversation(req.requester_id);
    exception when others then
      conversation := null;
    end;
    update public.story_contact_requests
    set status = 'accepted', responded_at = now(), conversation_id = conversation
    where id = req.id;
    perform public.notify_user(
      req.requester_id,
      'social',
      public.actor_label(uid) || ' iletişim isteğini kabul etti.',
      'story_contact_accepted',
      uid,
      req.id
    );
    return jsonb_build_object('status', 'accepted', 'conversation_id', conversation);
  end if;
  if action = 'decline' then
    update public.story_contact_requests set status = 'declined', responded_at = now() where id = req.id;
    return jsonb_build_object('status', 'declined');
  end if;
  if action = 'block' then
    insert into public.user_blocks (blocker_id, blocked_id)
    values (uid, req.requester_id)
    on conflict do nothing;
    update public.story_contact_requests
    set status = 'blocked', responded_at = now()
    where id = req.id and status = 'pending';
    return jsonb_build_object('status', 'blocked');
  end if;
  raise exception 'Geçersiz işlem';
end;
$$;

create or replace function public.story_report(
  p_story uuid,
  p_reason text,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  story public.life_stories%rowtype;
  allowed text[] := array['harassment','hate','violence','sexual','spam','scam','fake','privacy','copyright','child_safety','other'];
  reason text := lower(coalesce(p_reason, 'other'));
  report_id uuid;
  auto_hide integer;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  if not (reason = any(allowed)) then
    reason := 'other';
  end if;
  select * into story from public.life_stories where id = p_story;
  if story.id is null then
    raise exception 'Hikâye bulunamadı';
  end if;
  if story.author_id = uid then
    raise exception 'Kendi hikâyeni bildiremezsin';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reported_user_id, reason, details)
  values (
    uid, 'life_story', story.id, story.author_id, reason,
    nullif(left(trim(coalesce(p_details, '')), 1000), '')
  )
  returning id into report_id;

  update public.life_stories set report_count = report_count + 1 where id = p_story;
  auto_hide := public.live_setting_int('story_auto_hide_reports', 3);
  if auto_hide > 0 then
    update public.life_stories
    set status = 'hidden', hidden_reason = 'Otomatik inceleme eşiği'
    where id = p_story and status = 'published' and report_count >= auto_hide;
  end if;
  return jsonb_build_object('report_id', report_id);
end;
$$;

-- ── Admin ────────────────────────────────────────────────────────────────────
create or replace function public.admin_set_stories_enabled(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Yetkin yok';
  end if;
  insert into public.live_story_settings (key, value)
  values ('story_enabled', to_jsonb(coalesce(p_enabled, false)))
  on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.admin_audit_logs (actor_id, action, target)
  values (auth.uid(), 'stories_toggle', case when p_enabled then 'on' else 'off' end);
  return jsonb_build_object('enabled', coalesce(p_enabled, false));
end;
$$;

create or replace function public.admin_stories_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Yetkin yok';
  end if;
  return jsonb_build_object(
    'enabled', public.live_setting_bool('story_enabled', true),
    'published', (select count(*) from public.life_stories where status = 'published'),
    'drafts', (select count(*) from public.life_stories where status = 'draft'),
    'hidden', (select count(*) from public.life_stories where status = 'hidden'),
    'removed', (select count(*) from public.life_stories where status = 'removed'),
    'reported_open', (
      select count(*) from public.life_stories where report_count > 0 and status in ('published', 'hidden')
    ),
    'comments', (select count(*) from public.story_comments where deleted_at is null and hidden_at is null),
    'pending_contact_requests', (select count(*) from public.story_contact_requests where status = 'pending')
  );
end;
$$;

create or replace function public.admin_stories_search(
  p_query text default null,
  p_category uuid default null,
  p_status text default null,
  p_reported boolean default null,
  p_linked text default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  term text := nullif(trim(coalesce(p_query, '')), '');
  linked_term text := nullif(trim(coalesce(p_linked, '')), '');
begin
  if not public.is_staff() then
    raise exception 'Yetkin yok';
  end if;
  return coalesce((
    select jsonb_agg(row order by row.updated_at desc)
    from (
      select
        s.id, s.title, s.status, s.pseudonymous, s.report_count,
        s.comment_count, s.support_count, s.created_at, s.updated_at, s.published_at,
        s.author_id,
        coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Kullanıcı') as author_name,
        p.username as author_username,
        c.slug as category_slug, c.name_tr as category_name,
        lc.content_key as linked_key, lc.label as linked_label,
        (select count(*) from public.reports r
          where r.target_type = 'life_story' and r.target_id = s.id
            and r.status in ('received','waiting','in_review','needs_info','escalated')) as open_reports
      from public.life_stories s
      left join public.profiles p on p.id = s.author_id
      left join public.story_categories c on c.id = s.category_id
      left join public.story_linked_content lc on lc.story_id = s.id
      where (term is null or s.title ilike '%' || term || '%' or s.body ilike '%' || term || '%'
             or p.username ilike '%' || term || '%' or p.display_name ilike '%' || term || '%')
        and (p_category is null or s.category_id = p_category)
        and (p_status is null or p_status = 'all' or s.status = p_status)
        and (p_reported is null or not p_reported or s.report_count > 0)
        and (linked_term is null or lc.content_key ilike '%' || linked_term || '%'
             or lc.label ilike '%' || linked_term || '%')
      order by s.updated_at desc
      limit least(greatest(coalesce(p_limit, 30), 1), 100)
      offset greatest(coalesce(p_offset, 0), 0)
    ) row
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_story_detail(p_story uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Yetkin yok';
  end if;
  return (
    select jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'body', s.body,
      'cover_url', s.cover_url,
      'status', s.status,
      'pseudonymous', s.pseudonymous,
      'alias', s.alias,
      'author_id', s.author_id,
      'author_name', coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Kullanıcı'),
      'author_username', p.username,
      'category_id', s.category_id,
      'category_name', c.name_tr,
      'reading_minutes', s.reading_minutes,
      'report_count', s.report_count,
      'comment_count', s.comment_count,
      'support_count', s.support_count,
      'hidden_reason', s.hidden_reason,
      'created_at', s.created_at,
      'updated_at', s.updated_at,
      'published_at', s.published_at,
      'linked', (
        select jsonb_build_object('kind', lc.content_kind, 'key', lc.content_key, 'label', lc.label, 'reciter_id', lc.reciter_id)
        from public.story_linked_content lc where lc.story_id = s.id
      ),
      'reports', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id, 'reason', r.reason, 'details', r.details,
          'status', r.status, 'created_at', r.created_at, 'reference_code', r.reference_code
        ) order by r.created_at desc)
        from public.reports r
        where r.target_type = 'life_story' and r.target_id = s.id
      ), '[]'::jsonb),
      'moderation', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', m.id, 'action', m.action, 'reason', m.reason, 'created_at', m.created_at
        ) order by m.created_at desc)
        from public.story_moderation_records m
        where m.story_id = s.id
      ), '[]'::jsonb)
    )
    from public.life_stories s
    left join public.profiles p on p.id = s.author_id
    left join public.story_categories c on c.id = s.category_id
    where s.id = p_story
  );
end;
$$;

create or replace function public.admin_story_moderate(
  p_story uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  action text := lower(coalesce(p_action, ''));
  reason text := nullif(trim(coalesce(p_reason, '')), '');
  story public.life_stories%rowtype;
  next_status text;
begin
  if not public.is_staff() then
    raise exception 'Yetkin yok';
  end if;
  select * into story from public.life_stories where id = p_story for update;
  if story.id is null then
    raise exception 'Hikâye bulunamadı';
  end if;
  if action not in ('hide', 'restore', 'remove', 'clear_reports') then
    raise exception 'Geçersiz işlem';
  end if;
  if action in ('hide', 'remove') and (reason is null or char_length(reason) < 3) then
    raise exception 'Gerekçe zorunlu';
  end if;

  if action = 'clear_reports' then
    update public.life_stories set report_count = 0 where id = p_story;
  else
    next_status := case action when 'hide' then 'hidden' when 'restore' then 'published' else 'removed' end;
    update public.life_stories
    set status = next_status,
        hidden_reason = case when next_status = 'published' then null else reason end,
        published_at = case
          when next_status = 'published' then coalesce(published_at, now())
          else published_at
        end
    where id = p_story;
  end if;

  insert into public.story_moderation_records (story_id, moderator_id, action, reason)
  values (p_story, uid, action, reason);
  insert into public.admin_audit_logs (actor_id, action, target)
  values (uid, 'story_' || action, p_story::text);

  perform public.notify_user(
    story.author_id,
    'security',
    case action
      when 'hide' then 'Hikâyen moderasyon incelemesi için geçici olarak gizlendi.'
      when 'restore' then 'Hikâyen yeniden yayında.'
      when 'remove' then 'Hikâyen topluluk kuralları gereği yayından kaldırıldı.'
      else 'Hikâyenle ilgili bildirimler incelendi.'
    end,
    'story_moderation',
    uid,
    p_story
  );

  return jsonb_build_object('status', case when action = 'clear_reports' then story.status else next_status end);
end;
$$;

create or replace function public.admin_story_category_save(
  p_id uuid,
  p_slug text,
  p_name_tr text,
  p_name_en text default null,
  p_name_ar text default null,
  p_name_es text default null,
  p_icon text default null,
  p_sort_order integer default 0,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text := lower(regexp_replace(trim(coalesce(p_slug, '')), '[^a-z0-9-]+', '-', 'g'));
  category_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Yetkin yok';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,60}$' then
    raise exception 'Kategori adresi geçersiz';
  end if;
  if nullif(trim(coalesce(p_name_tr, '')), '') is null then
    raise exception 'Kategori adı zorunlu';
  end if;
  if p_id is null then
    insert into public.story_categories (slug, name_tr, name_en, name_ar, name_es, icon, sort_order, active)
    values (v_slug, trim(p_name_tr), nullif(trim(p_name_en), ''), nullif(trim(p_name_ar), ''), nullif(trim(p_name_es), ''), nullif(trim(p_icon), ''), coalesce(p_sort_order, 0), coalesce(p_active, true))
    on conflict (slug) do update set
      name_tr = excluded.name_tr, name_en = excluded.name_en,
      name_ar = excluded.name_ar, name_es = excluded.name_es,
      icon = excluded.icon, sort_order = excluded.sort_order, active = excluded.active
    returning id into category_id;
  else
    update public.story_categories set
      slug = v_slug,
      name_tr = trim(p_name_tr),
      name_en = nullif(trim(p_name_en), ''),
      name_ar = nullif(trim(p_name_ar), ''),
      name_es = nullif(trim(p_name_es), ''),
      icon = nullif(trim(p_icon), ''),
      sort_order = coalesce(p_sort_order, sort_order),
      active = coalesce(p_active, active)
    where id = p_id
    returning id into category_id;
    if category_id is null then
      raise exception 'Kategori bulunamadı';
    end if;
  end if;
  insert into public.admin_audit_logs (actor_id, action, target)
  values (auth.uid(), 'story_category_save', category_id::text);
  return jsonb_build_object('id', category_id);
end;
$$;

create or replace function public.admin_story_category_remove(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Yetkin yok';
  end if;
  update public.story_categories set active = false where id = p_id;
  insert into public.admin_audit_logs (actor_id, action, target)
  values (auth.uid(), 'story_category_disable', p_id::text);
  return jsonb_build_object('active', false);
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.story_alias(uuid)',
    'public.story_client_config()',
    'public.story_categories_list()',
    'public.story_can_read(uuid, uuid)',
    'public.stories_feed(text, uuid, timestamptz, integer)',
    'public.story_detail(uuid)',
    'public.story_my_stories()',
    'public.story_save(jsonb)',
    'public.story_set_status(uuid, text)',
    'public.story_delete(uuid)',
    'public.story_toggle_bookmark(uuid, boolean)',
    'public.story_support(uuid)',
    'public.story_comments_list(uuid, integer, timestamptz)',
    'public.story_add_comment(uuid, text, uuid)',
    'public.story_delete_comment(uuid)',
    'public.story_request_contact(uuid, text)',
    'public.story_incoming_contact_requests()',
    'public.story_outgoing_contact_requests()',
    'public.story_respond_contact(uuid, text)',
    'public.story_report(uuid, text, text)',
    'public.admin_set_stories_enabled(boolean)',
    'public.admin_stories_stats()',
    'public.admin_stories_search(text, uuid, text, boolean, text, integer, integer)',
    'public.admin_story_detail(uuid)',
    'public.admin_story_moderate(uuid, text, text)',
    'public.admin_story_category_save(uuid, text, text, text, text, text, text, integer, boolean)',
    'public.admin_story_category_remove(uuid)',
    'public.story_sync_counts(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;
