-- subscription_collections + employee_commissions

-- Per-collector default commission profile (collectors can update their own default %)
create table if not exists public.subscription_collector_profiles (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null,
  user_id uuid not null,
  collector_employee_id uuid null,
  default_commission_percent numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (masjid_id, user_id)
);

create index if not exists subscription_collector_profiles_masjid_idx on public.subscription_collector_profiles (masjid_id);

create table if not exists public.subscription_collection_batches (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null,
  collected_by_user_id uuid not null,
  collector_employee_id uuid null,
  status text not null default 'open' check (status in ('open','accepted','rejected')),
  accepted_by_user_id uuid null,
  accepted_at timestamptz null,
  accept_date date null,
  main_transaction_id uuid null,
  created_at timestamptz not null default now()
);

create index if not exists subscription_batches_masjid_idx on public.subscription_collection_batches (masjid_id);
create index if not exists subscription_batches_status_idx on public.subscription_collection_batches (masjid_id, status);

-- subscription_collections: create if missing, and ensure required columns exist (safe for re-run)
do $$
begin
  if to_regclass('public.subscription_collections') is null then
    execute 'create table public.subscription_collections (
      id uuid primary key default gen_random_uuid(),
      masjid_id uuid not null,
      batch_id uuid null references public.subscription_collection_batches(id) on delete set null,
      family_id uuid not null,
      collected_by_user_id uuid not null,
      collector_employee_id uuid null,
      amount numeric not null,
      commission_percent numeric null,
      commission_amount numeric null,
      notes text null,
      date date not null default (now()::date),
      status text not null default ''pending'' check (status in (''pending'',''accepted'',''rejected'')),
      accepted_by_user_id uuid null,
      accepted_at timestamptz null,
      main_transaction_id uuid null,
      created_at timestamptz not null default now()
    )';
  else
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'subscription_collections' and column_name = 'batch_id'
    ) then
      execute 'alter table public.subscription_collections add column batch_id uuid null references public.subscription_collection_batches(id) on delete set null';
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'subscription_collections' and column_name = 'commission_percent'
    ) then
      execute 'alter table public.subscription_collections add column commission_percent numeric null';
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'subscription_collections' and column_name = 'commission_amount'
    ) then
      execute 'alter table public.subscription_collections add column commission_amount numeric null';
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'subscription_collections' and column_name = 'collector_employee_id'
    ) then
      execute 'alter table public.subscription_collections add column collector_employee_id uuid null';
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'subscription_collections' and column_name = 'accepted_by_user_id'
    ) then
      execute 'alter table public.subscription_collections add column accepted_by_user_id uuid null';
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'subscription_collections' and column_name = 'accepted_at'
    ) then
      execute 'alter table public.subscription_collections add column accepted_at timestamptz null';
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'subscription_collections' and column_name = 'main_transaction_id'
    ) then
      execute 'alter table public.subscription_collections add column main_transaction_id uuid null';
    end if;
  end if;
end $$;

create index if not exists subscription_collections_masjid_idx on public.subscription_collections (masjid_id);
create index if not exists subscription_collections_status_idx on public.subscription_collections (masjid_id, status);
create index if not exists subscription_collections_family_idx on public.subscription_collections (masjid_id, family_id);
create index if not exists subscription_collections_batch_idx on public.subscription_collections (masjid_id, batch_id);

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
create unique index if not exists employee_commissions_collection_uniq on public.employee_commissions (collection_id);

alter table public.subscription_collections enable row level security;
alter table public.subscription_collection_batches enable row level security;
alter table public.subscription_collector_profiles enable row level security;
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

-- Collectors + admins can read batches of their masjid.
drop policy if exists subscription_batches_select on public.subscription_collection_batches;
create policy subscription_batches_select
on public.subscription_collection_batches
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

-- Insert: collectors can create/open batches.
drop policy if exists subscription_batches_insert on public.subscription_collection_batches;
create policy subscription_batches_insert
on public.subscription_collection_batches
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

drop policy if exists subscription_batches_update_approve on public.subscription_collection_batches;
create policy subscription_batches_update_approve
on public.subscription_collection_batches
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
  or public.has_masjid_permission(masjid_id, 'subscriptions_approve'::text)
);
