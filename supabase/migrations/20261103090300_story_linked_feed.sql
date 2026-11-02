-- Adds an optional linked-content filter so the Dua Yolculuğu surface can show
-- stories that reference the Qur'an surah or dua the user is currently hearing.
create or replace function public.stories_feed(
  p_tab text default 'new',
  p_category uuid default null,
  p_cursor timestamptz default null,
  p_limit integer default 12,
  p_linked_key text default null
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
  linked text := nullif(trim(coalesce(p_linked_key, '')), '');
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
        and (linked is null or lc.content_key = linked)
        and (tab <> 'saved' or exists (
          select 1 from public.story_bookmarks b where b.story_id = s.id and b.user_id = uid
        ))
      order by coalesce(s.published_at, s.created_at) desc
      limit safe_limit
    ) row
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.stories_feed(text, uuid, timestamptz, integer, text) from public;
grant execute on function public.stories_feed(text, uuid, timestamptz, integer, text) to authenticated;
