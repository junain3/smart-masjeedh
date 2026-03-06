-- subscription_collections + employee_commissions

create table if not exists public.subscription_collections (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null,
  family_id uuid not null,
  collected_by_user_id uuid not null,
  collector_employee_id uuid null,
  amount numeric not null,
  commission_percent numeric null,
  commission_amount numeric null,
  notes text null,
  date date not null default (now()::date),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  accepted_by_user_id uuid null,
  accepted_at timestamptz null,
  main_transaction_id uuid null,
  created_at timestamptz not null default now()
);

create index if not exists subscription_collections_masjid_idx on public.subscription_collections (masjid_id);
create index if not exists subscription_collections_status_idx on public.subscription_collections (masjid_id, status);
create index if not exists subscription_collections_family_idx on public.subscription_collections (masjid_id, family_id);

create table if not exists public.employee_commissions (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null,
  employee_id uuid not null,
  collection_id uuid not null references public.subscription_collections(id) on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists employee_commissions_masjid_idx on public.employee_commissions (masjid_id);
create index if not exists employee_commissions_employee_idx on public.employee_commissions (masjid_id, employee_id);

alter table public.subscription_collections enable row level security;
alter table public.employee_commissions enable row level security;

-- Helper: treat masjid owner/co-admin as admins.
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

-- Collectors + admins can read collections of their masjid.
drop policy if exists subscription_collections_select on public.subscription_collections;
create policy subscription_collections_select
on public.subscription_collections
for select
to authenticated
using (
  public.is_masjid_admin(masjid_id)
  or public.has_masjid_permission(masjid_id, 'subscriptions_collect'::text)
  or public.has_masjid_permission(masjid_id, 'subscriptions_approve'::text)
);

-- Insert: collectors (and admins) can create pending collections.
drop policy if exists subscription_collections_insert on public.subscription_collections;
create policy subscription_collections_insert
on public.subscription_collections
for insert
to authenticated
with check (
  (public.is_masjid_admin(masjid_id) and collected_by_user_id = auth.uid())
  or (public.has_masjid_permission(masjid_id, 'subscriptions_collect'::text) and collected_by_user_id = auth.uid())
);

-- Update: only admins/approvers can accept/reject.
drop policy if exists subscription_collections_update_approve on public.subscription_collections;
create policy subscription_collections_update_approve
on public.subscription_collections
for update
to authenticated
using (
  public.is_masjid_admin(masjid_id)
  or public.has_masjid_permission(masjid_id, 'subscriptions_approve'::text)
)
with check (
  public.is_masjid_admin(masjid_id)
  or public.has_masjid_permission(masjid_id, 'subscriptions_approve'::text)
);

-- employee_commissions: collectors can insert; approvers/admin can read.
drop policy if exists employee_commissions_select on public.employee_commissions;
create policy employee_commissions_select
on public.employee_commissions
for select
to authenticated
using (
  public.is_masjid_admin(masjid_id)
  or public.has_masjid_permission(masjid_id, 'subscriptions_collect'::text)
  or public.has_masjid_permission(masjid_id, 'subscriptions_approve'::text)
);

drop policy if exists employee_commissions_insert on public.employee_commissions;
create policy employee_commissions_insert
on public.employee_commissions
for insert
to authenticated
with check (
  public.is_masjid_admin(masjid_id)
  or public.has_masjid_permission(masjid_id, 'subscriptions_collect'::text)
);
