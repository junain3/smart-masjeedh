-- =====================================================
-- UI Permission Architecture + RLS Final Authority
-- =====================================================
-- Goal:
-- 1. Keep permissions as a UI-only visibility layer in Next.js.
-- 2. Keep real authorization in PostgreSQL RLS.
-- 3. Enforce strict multi-tenant isolation by masjid_id.
--
-- This file is designed to be additive and modular.
-- It does not require business logic changes in feature pages.

begin;

-- =====================================================
-- 1. Helper Functions
-- =====================================================

create or replace function public.current_user_masjid_ids()
returns setof uuid
language sql
stable
as $$
  select ur.masjid_id
  from public.user_roles ur
  where ur.user_id = auth.uid()
$$;

create or replace function public.is_masjid_member(p_masjid_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.masjid_id = p_masjid_id
  )
$$;

create or replace function public.is_masjid_admin(p_masjid_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.masjid_id = p_masjid_id
      and ur.role in ('admin', 'super_admin', 'co_admin')
  )
$$;

create or replace function public.has_masjid_permission(
  p_masjid_id uuid,
  p_permission text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.masjid_id = p_masjid_id
      and (
        ur.role in ('admin', 'super_admin', 'co_admin')
        or coalesce((ur.permissions ->> p_permission)::boolean, false)
      )
  )
$$;

-- =====================================================
-- 2. Employees / Staff
-- =====================================================

alter table public.employees enable row level security;

drop policy if exists employees_select_by_masjid on public.employees;
create policy employees_select_by_masjid
on public.employees
for select
to authenticated
using (public.is_masjid_member(masjid_id));

drop policy if exists employees_insert_admin_only on public.employees;
create policy employees_insert_admin_only
on public.employees
for insert
to authenticated
with check (
  public.has_masjid_permission(masjid_id, 'staff_management')
);

drop policy if exists employees_update_admin_only on public.employees;
create policy employees_update_admin_only
on public.employees
for update
to authenticated
using (public.has_masjid_permission(masjid_id, 'staff_management'))
with check (public.has_masjid_permission(masjid_id, 'staff_management'));

drop policy if exists employees_delete_admin_only on public.employees;
create policy employees_delete_admin_only
on public.employees
for delete
to authenticated
using (public.has_masjid_permission(masjid_id, 'staff_management'));

-- =====================================================
-- 3. Salary Payments
-- =====================================================

alter table public.salary_payments enable row level security;

drop policy if exists salary_payments_select_scoped on public.salary_payments;
create policy salary_payments_select_scoped
on public.salary_payments
for select
to authenticated
using (
  public.has_masjid_permission(masjid_id, 'staff_management')
  or public.has_masjid_permission(masjid_id, 'accounts')
);

drop policy if exists salary_payments_insert_scoped on public.salary_payments;
create policy salary_payments_insert_scoped
on public.salary_payments
for insert
to authenticated
with check (
  public.has_masjid_permission(masjid_id, 'staff_management')
  or public.has_masjid_permission(masjid_id, 'accounts')
);

drop policy if exists salary_payments_update_scoped on public.salary_payments;
create policy salary_payments_update_scoped
on public.salary_payments
for update
to authenticated
using (
  public.has_masjid_permission(masjid_id, 'staff_management')
  or public.has_masjid_permission(masjid_id, 'accounts')
)
with check (
  public.has_masjid_permission(masjid_id, 'staff_management')
  or public.has_masjid_permission(masjid_id, 'accounts')
);

-- =====================================================
-- 4. Transactions / Accounts
-- =====================================================

alter table public.transactions enable row level security;

drop policy if exists transactions_select_by_masjid on public.transactions;
create policy transactions_select_by_masjid
on public.transactions
for select
to authenticated
using (public.has_masjid_permission(masjid_id, 'accounts'));

drop policy if exists transactions_insert_by_masjid on public.transactions;
create policy transactions_insert_by_masjid
on public.transactions
for insert
to authenticated
with check (
  public.has_masjid_permission(masjid_id, 'accounts')
  and user_id = auth.uid()
);

drop policy if exists transactions_update_by_masjid on public.transactions;
create policy transactions_update_by_masjid
on public.transactions
for update
to authenticated
using (public.has_masjid_permission(masjid_id, 'accounts'))
with check (public.has_masjid_permission(masjid_id, 'accounts'));

drop policy if exists transactions_delete_by_masjid on public.transactions;
create policy transactions_delete_by_masjid
on public.transactions
for delete
to authenticated
using (public.has_masjid_permission(masjid_id, 'accounts'));

-- =====================================================
-- 5. Collections
-- =====================================================

alter table public.subscription_collections enable row level security;

drop policy if exists subscription_collections_select_scoped on public.subscription_collections;
create policy subscription_collections_select_scoped
on public.subscription_collections
for select
to authenticated
using (
  public.has_masjid_permission(masjid_id, 'subscriptions_collect')
  or public.has_masjid_permission(masjid_id, 'subscriptions_approve')
);

drop policy if exists subscription_collections_insert_scoped on public.subscription_collections;
create policy subscription_collections_insert_scoped
on public.subscription_collections
for insert
to authenticated
with check (
  public.has_masjid_permission(masjid_id, 'subscriptions_collect')
);

drop policy if exists subscription_collections_update_scoped on public.subscription_collections;
create policy subscription_collections_update_scoped
on public.subscription_collections
for update
to authenticated
using (
  public.has_masjid_permission(masjid_id, 'subscriptions_collect')
  or public.has_masjid_permission(masjid_id, 'subscriptions_approve')
)
with check (
  public.has_masjid_permission(masjid_id, 'subscriptions_collect')
  or public.has_masjid_permission(masjid_id, 'subscriptions_approve')
);

-- =====================================================
-- 6. Families
-- =====================================================

alter table public.families enable row level security;

drop policy if exists families_select_by_masjid on public.families;
create policy families_select_by_masjid
on public.families
for select
to authenticated
using (public.is_masjid_member(masjid_id));

drop policy if exists families_write_by_permission on public.families;
create policy families_write_by_permission
on public.families
for all
to authenticated
using (public.has_masjid_permission(masjid_id, 'families'))
with check (public.has_masjid_permission(masjid_id, 'families'));

-- =====================================================
-- 7. Dashboard Safety Pattern
-- =====================================================
-- Dashboard itself is UI-only, but the data queries it uses must
-- read only from RLS-protected tables filtered by masjid_id.
-- This architecture means even if a UI element is manually forced
-- visible in the browser, the database still blocks unauthorized rows.

commit;
