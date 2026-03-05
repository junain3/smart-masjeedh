-- User roles and invitations for Smart Masjeedh

-- Stores per-user role within a masjid (Super Admin / Staff / Editor)
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null,
  user_id uuid not null,
  email text,
  role text not null check (role in ('super_admin', 'co_admin', 'staff', 'editor')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (masjid_id, user_id)
);

-- Optional: index by masjid for faster lookups
create index if not exists idx_user_roles_masjid on public.user_roles (masjid_id);

-- Invitation requests by email, before the user signs up
create table if not exists public.role_invitations (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null,
  email text not null,
  role text not null check (role in ('staff', 'editor')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now()
);

create index if not exists idx_role_invitations_masjid on public.role_invitations (masjid_id);

-- =========================
-- RLS
-- =========================

alter table public.user_roles enable row level security;
alter table public.role_invitations enable row level security;

-- Helper: treat masjid owner/co-admin as admins.
-- NOTE: Adjust roles here if you introduce co_admin/main_admin.
create or replace function public.is_masjid_admin(_masjid_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.masjid_id = _masjid_id
      and ur.user_id = auth.uid()
      and ur.role in ('super_admin', 'co_admin')
  );
$$;

-- Helper: check a feature permission for the current user in a masjid.
-- Default allow unless explicitly set to false.
create or replace function public.has_masjid_permission(_masjid_id uuid, _key text)
returns boolean
language sql
stable
as $$
  select (
    public.is_masjid_admin(_masjid_id)
    or coalesce(
      (select (ur.permissions ->> _key)::boolean
       from public.user_roles ur
       where ur.masjid_id = _masjid_id
         and ur.user_id = auth.uid()
       limit 1),
      true
    )
  );
$$;

-- user_roles: users can read their own row
drop policy if exists user_roles_select_self on public.user_roles;
create policy user_roles_select_self
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

-- user_roles: bootstrap - allow masjid owner to create their initial super_admin row
drop policy if exists user_roles_bootstrap_owner on public.user_roles;
create policy user_roles_bootstrap_owner
on public.user_roles
for insert
to authenticated
with check (masjid_id = auth.uid() and user_id = auth.uid() and role = 'super_admin');

-- user_roles: admins can manage roles within their masjid
drop policy if exists user_roles_select_admin on public.user_roles;
create policy user_roles_select_admin
on public.user_roles
for select
to authenticated
using (public.is_masjid_admin(masjid_id));

drop policy if exists user_roles_insert_admin on public.user_roles;
create policy user_roles_insert_admin
on public.user_roles
for insert
to authenticated
with check (public.is_masjid_admin(masjid_id));

drop policy if exists user_roles_update_admin on public.user_roles;
create policy user_roles_update_admin
on public.user_roles
for update
to authenticated
using (public.is_masjid_admin(masjid_id))
with check (public.is_masjid_admin(masjid_id));

drop policy if exists user_roles_delete_admin on public.user_roles;
create policy user_roles_delete_admin
on public.user_roles
for delete
to authenticated
using (public.is_masjid_admin(masjid_id));

-- role_invitations: admins can create/view/manage invites for their masjid
drop policy if exists invites_insert_admin on public.role_invitations;
create policy invites_insert_admin
on public.role_invitations
for insert
to authenticated
with check (public.is_masjid_admin(masjid_id));

drop policy if exists invites_select_admin on public.role_invitations;
create policy invites_select_admin
on public.role_invitations
for select
to authenticated
using (public.is_masjid_admin(masjid_id));

drop policy if exists invites_update_admin on public.role_invitations;
create policy invites_update_admin
on public.role_invitations
for update
to authenticated
using (public.is_masjid_admin(masjid_id))
with check (public.is_masjid_admin(masjid_id));

drop policy if exists invites_delete_admin on public.role_invitations;
create policy invites_delete_admin
on public.role_invitations
for delete
to authenticated
using (public.is_masjid_admin(masjid_id));

-- =========================
-- Core app tables (optional) - tenant isolation + permissions
-- =========================

-- families
do $$
begin
  if to_regclass('public.families') is not null then
    execute 'alter table public.families enable row level security';
    execute 'drop policy if exists families_select_tenant on public.families';
    execute 'create policy families_select_tenant on public.families for select to authenticated using (exists (select 1 from public.user_roles ur where ur.masjid_id = families.masjid_id and ur.user_id = auth.uid()))';
    execute 'drop policy if exists families_insert_perm on public.families';
    execute 'create policy families_insert_perm on public.families for insert to authenticated with check (public.has_masjid_permission(masjid_id, ''members''))';
    execute 'drop policy if exists families_update_perm on public.families';
    execute 'create policy families_update_perm on public.families for update to authenticated using (public.has_masjid_permission(masjid_id, ''members'')) with check (public.has_masjid_permission(masjid_id, ''members''))';
    execute 'drop policy if exists families_delete_perm on public.families';
    execute 'create policy families_delete_perm on public.families for delete to authenticated using (public.has_masjid_permission(masjid_id, ''members''))';
  end if;
end $$;

-- members
do $$
begin
  if to_regclass('public.members') is not null then
    execute 'alter table public.members enable row level security';
    execute 'drop policy if exists members_select_tenant on public.members';
    execute 'create policy members_select_tenant on public.members for select to authenticated using (exists (select 1 from public.user_roles ur where ur.masjid_id = members.masjid_id and ur.user_id = auth.uid()))';
    execute 'drop policy if exists members_insert_perm on public.members';
    execute 'create policy members_insert_perm on public.members for insert to authenticated with check (public.has_masjid_permission(masjid_id, ''members''))';
    execute 'drop policy if exists members_update_perm on public.members';
    execute 'create policy members_update_perm on public.members for update to authenticated using (public.has_masjid_permission(masjid_id, ''members'')) with check (public.has_masjid_permission(masjid_id, ''members''))';
    execute 'drop policy if exists members_delete_perm on public.members';
    execute 'create policy members_delete_perm on public.members for delete to authenticated using (public.has_masjid_permission(masjid_id, ''members''))';
  end if;
end $$;

-- transactions (accounts)
do $$
begin
  if to_regclass('public.transactions') is not null then
    execute 'alter table public.transactions enable row level security';
    execute 'drop policy if exists transactions_select_tenant on public.transactions';
    execute 'create policy transactions_select_tenant on public.transactions for select to authenticated using (exists (select 1 from public.user_roles ur where ur.masjid_id = transactions.masjid_id and ur.user_id = auth.uid()))';
    execute 'drop policy if exists transactions_insert_perm on public.transactions';
    execute 'create policy transactions_insert_perm on public.transactions for insert to authenticated with check (public.has_masjid_permission(masjid_id, ''accounts''))';
    execute 'drop policy if exists transactions_update_perm on public.transactions';
    execute 'create policy transactions_update_perm on public.transactions for update to authenticated using (public.has_masjid_permission(masjid_id, ''accounts'')) with check (public.has_masjid_permission(masjid_id, ''accounts''))';
    execute 'drop policy if exists transactions_delete_perm on public.transactions';
    execute 'create policy transactions_delete_perm on public.transactions for delete to authenticated using (public.has_masjid_permission(masjid_id, ''accounts''))';
  end if;
end $$;

-- events
do $$
begin
  if to_regclass('public.events') is not null then
    execute 'alter table public.events enable row level security';
    execute 'drop policy if exists events_select_tenant on public.events';
    execute 'create policy events_select_tenant on public.events for select to authenticated using (exists (select 1 from public.user_roles ur where ur.masjid_id = events.masjid_id and ur.user_id = auth.uid()))';
    execute 'drop policy if exists events_insert_perm on public.events';
    execute 'create policy events_insert_perm on public.events for insert to authenticated with check (public.has_masjid_permission(masjid_id, ''events''))';
    execute 'drop policy if exists events_update_perm on public.events';
    execute 'create policy events_update_perm on public.events for update to authenticated using (public.has_masjid_permission(masjid_id, ''events'')) with check (public.has_masjid_permission(masjid_id, ''events''))';
    execute 'drop policy if exists events_delete_perm on public.events';
    execute 'create policy events_delete_perm on public.events for delete to authenticated using (public.has_masjid_permission(masjid_id, ''events''))';
  end if;
end $$;

-- event_attendance (event marking)
do $$
begin
  if to_regclass('public.event_attendance') is not null then
    execute 'alter table public.event_attendance enable row level security';
    execute 'drop policy if exists event_attendance_select_tenant on public.event_attendance';
    execute 'create policy event_attendance_select_tenant on public.event_attendance for select to authenticated using (exists (select 1 from public.user_roles ur where ur.masjid_id = event_attendance.masjid_id and ur.user_id = auth.uid()))';
    execute 'drop policy if exists event_attendance_insert_perm on public.event_attendance';
    execute 'create policy event_attendance_insert_perm on public.event_attendance for insert to authenticated with check (public.has_masjid_permission(masjid_id, ''events''))';
    execute 'drop policy if exists event_attendance_update_perm on public.event_attendance';
    execute 'create policy event_attendance_update_perm on public.event_attendance for update to authenticated using (public.has_masjid_permission(masjid_id, ''events'')) with check (public.has_masjid_permission(masjid_id, ''events''))';
    execute 'drop policy if exists event_attendance_delete_perm on public.event_attendance';
    execute 'create policy event_attendance_delete_perm on public.event_attendance for delete to authenticated using (public.has_masjid_permission(masjid_id, ''events''))';
  end if;
end $$;

-- service_distributions (member services)
do $$
begin
  if to_regclass('public.service_distributions') is not null then
    execute 'alter table public.service_distributions enable row level security';
    execute 'drop policy if exists service_distributions_select_tenant on public.service_distributions';
    execute 'create policy service_distributions_select_tenant on public.service_distributions for select to authenticated using (exists (select 1 from public.user_roles ur where ur.masjid_id = service_distributions.masjid_id and ur.user_id = auth.uid()))';
    execute 'drop policy if exists service_distributions_insert_perm on public.service_distributions';
    execute 'create policy service_distributions_insert_perm on public.service_distributions for insert to authenticated with check (public.has_masjid_permission(masjid_id, ''members''))';
    execute 'drop policy if exists service_distributions_update_perm on public.service_distributions';
    execute 'create policy service_distributions_update_perm on public.service_distributions for update to authenticated using (public.has_masjid_permission(masjid_id, ''members'')) with check (public.has_masjid_permission(masjid_id, ''members''))';
    execute 'drop policy if exists service_distributions_delete_perm on public.service_distributions';
    execute 'create policy service_distributions_delete_perm on public.service_distributions for delete to authenticated using (public.has_masjid_permission(masjid_id, ''members''))';
  end if;
end $$;

-- employees
do $$
begin
  if to_regclass('public.employees') is not null then
    execute 'alter table public.employees enable row level security';
    execute 'drop policy if exists employees_select_tenant on public.employees';
    execute 'create policy employees_select_tenant on public.employees for select to authenticated using (exists (select 1 from public.user_roles ur where ur.masjid_id = employees.masjid_id and ur.user_id = auth.uid()))';
    execute 'drop policy if exists employees_write_admin on public.employees';
    execute 'create policy employees_write_admin on public.employees for all to authenticated using (public.is_masjid_admin(masjid_id)) with check (public.is_masjid_admin(masjid_id))';
  end if;
end $$;

-- board_members
do $$
begin
  if to_regclass('public.board_members') is not null then
    execute 'alter table public.board_members enable row level security';
    execute 'drop policy if exists board_members_select_tenant on public.board_members';
    execute 'create policy board_members_select_tenant on public.board_members for select to authenticated using (exists (select 1 from public.user_roles ur where ur.masjid_id = board_members.masjid_id and ur.user_id = auth.uid()))';
    execute 'drop policy if exists board_members_write_admin on public.board_members';
    execute 'create policy board_members_write_admin on public.board_members for all to authenticated using (public.is_masjid_admin(masjid_id)) with check (public.is_masjid_admin(masjid_id))';
  end if;
end $$;

