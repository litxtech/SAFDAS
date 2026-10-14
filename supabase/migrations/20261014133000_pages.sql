create table if not exists public.group_khatms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now()
);

create table if not exists public.group_khatm_members (
  khatm_id uuid references public.group_khatms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (khatm_id, user_id)
);

create table if not exists public.group_khatm_assignments (
  id uuid primary key default gen_random_uuid(),
  khatm_id uuid not null references public.group_khatms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  juz integer not null check (juz between 1 and 30),
  status text not null default 'assigned' check (status in ('assigned', 'reading', 'done')),
  unique (khatm_id, juz)
);

create table if not exists public.worship_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (collection_id, post_id)
);

create table if not exists public.hajj_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  step_key text not null,
  note text,
  done boolean not null default false,
  unique (user_id, step_key)
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prayer boolean not null default true,
  social boolean not null default true,
  security boolean not null default true
);

create table if not exists public.fasting_records (
  user_id uuid references auth.users(id) on delete cascade,
  fast_date date not null,
  status text not null check (status in ('fasted', 'missed', 'excused')),
  primary key (user_id, fast_date)
);

alter table public.group_khatms enable row level security;
alter table public.group_khatm_members enable row level security;
alter table public.group_khatm_assignments enable row level security;
alter table public.worship_journal enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.hajj_notes enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.fasting_records enable row level security;

create policy group_khatms_select on public.group_khatms for select using (
  visibility = 'public' or owner_id = auth.uid() or exists (
    select 1 from public.group_khatm_members m where m.khatm_id = id and m.user_id = auth.uid()
  )
);
create policy group_khatms_insert on public.group_khatms for insert with check (owner_id = auth.uid());
create policy group_khatm_members_select on public.group_khatm_members for select using (auth.uid() is not null);
create policy group_khatm_members_insert on public.group_khatm_members for insert with check (user_id = auth.uid());
create policy group_khatm_assignments_select on public.group_khatm_assignments for select using (auth.uid() is not null);
create policy group_khatm_assignments_write on public.group_khatm_assignments for all using (
  user_id = auth.uid() or exists (select 1 from public.group_khatms k where k.id = khatm_id and k.owner_id = auth.uid())
) with check (user_id = auth.uid());
create policy journal_own on public.worship_journal for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy collections_own on public.collections for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy collection_items_own on public.collection_items for all using (
  exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
) with check (
  exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
);
create policy hajj_own on public.hajj_notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notification_prefs_own on public.notification_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fasting_own on public.fasting_records for all using (user_id = auth.uid()) with check (user_id = auth.uid());
