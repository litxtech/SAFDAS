-- Support, reporting, child-safety queue, appeals, and moderation history.
-- Extends existing reports / user_blocks / admin_audit_logs without parallel stacks.

insert into public.permissions (key) values
  ('child_safety.view'),
  ('child_safety.review'),
  ('support.view'),
  ('support.resolve'),
  ('audit.view')
on conflict (key) do nothing;

-- Seed operational roles (super_admin already has all permissions).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'admin'
  and p.key in (
    'reports.view', 'reports.review', 'reports.resolve',
    'users.manage', 'posts.manage', 'live_rooms.manage',
    'support.view', 'support.resolve', 'audit.view'
  )
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'moderator'
  and p.key in (
    'reports.view', 'reports.review', 'reports.resolve',
    'posts.manage', 'live_rooms.manage', 'audit.view'
  )
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'support'
  and p.key in ('support.view', 'support.resolve', 'reports.view')
on conflict do nothing;

-- Dedicated child-safety officers: only super_admin + admin get CSAM queue by default.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('super_admin', 'admin')
  and p.key in ('child_safety.view', 'child_safety.review')
on conflict do nothing;

alter table public.profiles
  add column if not exists suspended_until timestamptz;

alter table public.reports
  add column if not exists case_kind text not null default 'content_report',
  add column if not exists reported_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists category text,
  add column if not exists public_outcome text,
  add column if not exists evidence_refs jsonb not null default '[]'::jsonb,
  add column if not exists escalation_at timestamptz,
  add column if not exists sensitive boolean not null default false,
  add column if not exists sla_first_response_hours integer,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reports drop constraint if exists reports_case_kind_check;
alter table public.reports
  add constraint reports_case_kind_check
  check (case_kind in ('content_report', 'support', 'child_safety', 'appeal'));

alter table public.reports drop constraint if exists reports_priority_check;
alter table public.reports
  add constraint reports_priority_check
  check (priority in ('P0', 'P1', 'P2', 'P3', 'urgent', 'normal'));

alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports
  add constraint reports_status_check
  check (status in (
    'received', 'waiting', 'in_review', 'needs_info',
    'action_taken', 'no_violation', 'closed', 'escalated'
  ));

update public.reports
set priority = case
  when priority = 'urgent' then 'P0'
  when priority = 'normal' then 'P2'
  else priority
end
where priority in ('urgent', 'normal');

update public.reports
set case_kind = 'child_safety',
    sensitive = true,
    priority = 'P0'
where reason = 'child_safety' and case_kind = 'content_report';

create table if not exists public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  note text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists report_events_report_idx on public.report_events (report_id, created_at);

create table if not exists public.report_appeals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  status text not null default 'received'
    check (status in ('received', 'in_review', 'upheld', 'overturned', 'closed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists reports_kind_status_idx on public.reports (case_kind, status, priority, created_at desc);
create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at desc);
create index if not exists reports_sensitive_idx on public.reports (sensitive) where sensitive = true;

create or replace function public.assign_report_code()
returns trigger
language plpgsql
as $$
begin
  if new.reference_code is null then
    new.reference_code := 'SF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.report_ref_seq')::text, 6, '0');
  end if;

  -- Normalize legacy priority values.
  if new.priority = 'urgent' then
    new.priority := 'P0';
  elsif new.priority = 'normal' or new.priority is null then
    new.priority := 'P2';
  end if;

  if new.reason = 'child_safety' or new.case_kind = 'child_safety' then
    new.case_kind := 'child_safety';
    new.sensitive := true;
    new.priority := 'P0';
  end if;

  if new.case_kind = 'support' and new.priority not in ('P0', 'P1') then
    new.priority := 'P3';
  end if;

  if new.priority = 'P0' then
    new.sla_first_response_hours := 1;
    new.review_due_at := now() + interval '1 hour';
    new.escalation_at := now();
  elsif new.priority = 'P1' then
    new.sla_first_response_hours := 24;
    new.review_due_at := now() + interval '24 hours';
  elsif new.priority = 'P3' then
    new.sla_first_response_hours := 72;
    new.review_due_at := now() + interval '72 hours';
  else
    new.priority := 'P2';
    new.sla_first_response_hours := 24;
    new.review_due_at := now() + interval '24 hours';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.log_report_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.report_events (report_id, actor_id, event_type, note, is_public)
  values (new.id, new.reporter_id, 'created', 'Başvuru alındı', true);

  if new.priority = 'P0' or new.case_kind = 'child_safety' then
    insert into public.report_events (report_id, actor_id, event_type, note, is_public)
    values (new.id, null, 'escalated', 'P0 / çocuk güvenliği — görevli ekibe eskalasyon', true);
    insert into public.admin_audit_logs (actor_id, action, target)
    values (new.reporter_id, 'report.escalated_p0', new.id::text);
  end if;

  return new;
end;
$$;

drop trigger if exists reports_created_event on public.reports;
create trigger reports_created_event
after insert on public.reports
for each row execute function public.log_report_created();

create or replace function public.can_view_child_safety()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('child_safety.view') or public.has_permission('child_safety.review');
$$;

drop function if exists public.admin_set_report_status(uuid, text);

create or replace function public.admin_set_report_status(
  target uuid,
  next_status text,
  public_note text default null,
  internal_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  row public.reports%rowtype;
begin
  if actor is null or not public.has_permission('reports.review') then
    raise exception 'reports.review yetkisi gerekli';
  end if;

  select * into row from public.reports where id = target for update;
  if not found then
    raise exception 'Şikâyet bulunamadı';
  end if;

  if row.sensitive and not public.can_view_child_safety() then
    raise exception 'Çocuk güvenliği kaydına erişim yetkisi yok';
  end if;

  if next_status not in ('waiting', 'in_review', 'needs_info', 'action_taken', 'no_violation', 'closed', 'escalated') then
    raise exception 'Geçersiz durum';
  end if;

  update public.reports
  set status = next_status,
      review_started_at = case
        when next_status in ('in_review', 'escalated') then coalesce(review_started_at, now())
        else review_started_at
      end,
      resolved_at = case
        when next_status in ('action_taken', 'no_violation', 'closed') then now()
        else resolved_at
      end,
      public_outcome = coalesce(public_note, public_outcome),
      assigned_moderator_id = actor,
      updated_at = now()
  where id = target;

  insert into public.report_events (report_id, actor_id, event_type, note, is_public)
  values (target, actor, 'status_' || next_status, coalesce(public_note, internal_note), public_note is not null);

  if internal_note is not null and (public_note is null or public_note <> internal_note) then
    insert into public.report_events (report_id, actor_id, event_type, note, is_public)
    values (target, actor, 'internal_note', internal_note, false);
  end if;

  insert into public.notifications (user_id, category, body)
  values (
    row.reporter_id,
    'security',
    'Başvurunuzun durumu güncellendi: ' || coalesce(row.reference_code, target::text)
  );

  insert into public.admin_audit_logs (actor_id, action, target)
  values (actor, 'report.' || next_status, target::text);
end;
$$;

create or replace function public.admin_assign_report(target uuid, moderator uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  sens boolean;
begin
  if actor is null or not public.has_permission('reports.review') then
    raise exception 'reports.review yetkisi gerekli';
  end if;
  select sensitive into sens from public.reports where id = target;
  if not found then raise exception 'Şikâyet bulunamadı'; end if;
  if sens and not public.can_view_child_safety() then
    raise exception 'Çocuk güvenliği kaydına erişim yetkisi yok';
  end if;
  update public.reports
  set assigned_moderator_id = moderator,
      status = case when status = 'received' then 'waiting' else status end,
      updated_at = now()
  where id = target;
  insert into public.report_events (report_id, actor_id, event_type, note, is_public)
  values (target, actor, 'assigned', 'Moderatöre atandı', true);
  insert into public.admin_audit_logs (actor_id, action, target)
  values (actor, 'report.assign', target::text || ':' || moderator::text);
end;
$$;

create or replace function public.admin_warn_user(target uuid, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.has_permission('users.manage') then
    raise exception 'users.manage yetkisi gerekli';
  end if;
  insert into public.notifications (user_id, category, body)
  values (target, 'security', coalesce(nullif(trim(reason), ''), 'Topluluk kuralları uyarısı aldınız.'));
  insert into public.admin_audit_logs (actor_id, action, target)
  values (actor, 'user.warn', target::text);
end;
$$;

create or replace function public.admin_suspend_user(target uuid, hours integer default 72)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.has_permission('users.manage') then
    raise exception 'users.manage yetkisi gerekli';
  end if;
  if target = actor then
    raise exception 'Kendi hesabına bu işlem uygulanamaz';
  end if;
  update public.profiles
  set suspended_until = now() + make_interval(hours => greatest(hours, 1))
  where id = target;
  insert into public.notifications (user_id, category, body)
  values (target, 'security', 'Hesabınız geçici olarak askıya alındı.');
  insert into public.admin_audit_logs (actor_id, action, target)
  values (actor, 'user.suspend', target::text || ':' || hours::text);
end;
$$;

create or replace function public.submit_report_appeal(target uuid, body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  appeal_id uuid;
  row public.reports%rowtype;
begin
  if actor is null then raise exception 'Oturum gerekli'; end if;
  select * into row from public.reports where id = target;
  if not found then raise exception 'Başvuru bulunamadı'; end if;
  if row.reporter_id <> actor and row.reported_user_id <> actor then
    raise exception 'Bu başvuruya itiraz edemezsiniz';
  end if;
  if row.status not in ('action_taken', 'no_violation', 'closed') then
    raise exception 'İtiraz yalnızca sonuçlanmış başvurularda açılabilir';
  end if;
  insert into public.report_appeals (report_id, user_id, body)
  values (target, actor, trim(body))
  returning id into appeal_id;
  insert into public.report_events (report_id, actor_id, event_type, note, is_public)
  values (target, actor, 'appeal_opened', 'İtiraz açıldı', true);
  insert into public.admin_audit_logs (actor_id, action, target)
  values (actor, 'report.appeal', target::text);
  return appeal_id;
end;
$$;

alter table public.report_events enable row level security;
alter table public.report_appeals enable row level security;

drop policy if exists report_events_select on public.report_events;
create policy report_events_select on public.report_events for select using (
  exists (
    select 1 from public.reports r
    where r.id = report_id
      and (
        (r.reporter_id = auth.uid() and report_events.is_public = true)
        or (public.has_permission('reports.view') and (not r.sensitive or public.can_view_child_safety()))
      )
  )
);

drop policy if exists report_appeals_insert on public.report_appeals;
create policy report_appeals_insert on public.report_appeals for insert
with check (user_id = auth.uid());

drop policy if exists report_appeals_select on public.report_appeals;
create policy report_appeals_select on public.report_appeals for select using (
  user_id = auth.uid() or public.has_permission('reports.view')
);

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select using (
  reporter_id = auth.uid()
  or (
    public.has_permission('reports.view')
    and (not sensitive or public.can_view_child_safety())
  )
  or (
    case_kind = 'support'
    and public.has_permission('support.view')
  )
);

-- Staff must not pull raw sensitive evidence via default selects of unrelated roles.
drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update using (
  public.has_permission('reports.review')
  and (not sensitive or public.can_view_child_safety())
);

grant execute on function public.admin_assign_report(uuid, uuid) to authenticated;
grant execute on function public.admin_warn_user(uuid, text) to authenticated;
grant execute on function public.admin_suspend_user(uuid, integer) to authenticated;
grant execute on function public.submit_report_appeal(uuid, text) to authenticated;
grant execute on function public.can_view_child_safety() to authenticated;
