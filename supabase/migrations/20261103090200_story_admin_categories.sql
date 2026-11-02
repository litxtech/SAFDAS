-- SAFDAŞ — admin category list (includes disabled categories)
-- story_categories_list() intentionally hides inactive rows from readers; admins need
-- the full set so a disabled category can be edited or re-enabled without a new slug.

create or replace function public.admin_story_categories()
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
  return coalesce((
    select jsonb_agg(row order by row.sort_order, row.slug)
    from (
      select
        c.id, c.slug, c.name_tr, c.name_en, c.name_ar, c.name_es,
        c.icon, c.sort_order, c.active, c.updated_at,
        (select count(*) from public.life_stories s where s.category_id = c.id) as story_count
      from public.story_categories c
    ) row
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_story_categories() from public, anon;
grant execute on function public.admin_story_categories() to authenticated, service_role;
