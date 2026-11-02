-- Fix "Database error saving new user": harden auth → profiles trigger.
-- Common causes: username unique clash, null auth.uid() under RLS, empty username.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  uname text;
  display text;
  n integer := 0;
begin
  base := lower(nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), ''));
  if base is null then
    base := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;

  uname := base;
  while exists (
    select 1 from public.profiles p where lower(p.username) = lower(uname)
  ) loop
    n := n + 1;
    uname := left(base, 16) || '_' || n::text;
    exit when n > 100;
  end loop;

  display := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'display_name',
        new.raw_user_meta_data->>'name',
        ''
      )
    ),
    ''
  );
  if display is null then
    display := trim(
      coalesce(new.raw_user_meta_data->>'first_name', '') || ' ' || coalesce(new.raw_user_meta_data->>'last_name', '')
    );
    display := nullif(display, '');
  end if;
  if display is null then
    display := uname;
  end if;

  insert into public.profiles (id, first_name, last_name, display_name, username, avatar_url)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), ''),
    display,
    uname,
    nullif(trim(coalesce(new.raw_user_meta_data->>'avatar_url', '')), '')
  )
  on conflict (id) do update set
    first_name = coalesce(excluded.first_name, public.profiles.first_name),
    last_name = coalesce(excluded.last_name, public.profiles.last_name),
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    username = coalesce(public.profiles.username, excluded.username),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

alter function public.handle_new_user() owner to postgres;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to postgres, service_role;

-- Auth hook role (hosted Supabase)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
  end if;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Belt-and-suspenders: allow authenticated self-insert if client retries profile creation
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert
  with check (id = auth.uid());

drop policy if exists settings_insert_own on public.user_settings;
create policy settings_insert_own on public.user_settings
  for insert
  with check (user_id = auth.uid());

-- Public username check for signup (bypass private-profile RLS)
create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles p
    where lower(p.username) = lower(nullif(trim(candidate), ''))
  );
$$;

alter function public.username_available(text) owner to postgres;
grant execute on function public.username_available(text) to anon, authenticated, service_role;
