-- Staff salary management for multi-tenant mosque operations
-- Run this in Supabase SQL editor before using the /staff/[id] salary payment flow.

begin;

alter table public.transactions
add column if not exists staff_id uuid references public.employees(id) on delete set null;

create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null references public.masjids(id) on delete cascade,
  staff_id uuid not null references public.employees(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  salary_month date not null,
  payment_date date not null default current_date,
  notes text,
  finance_transaction_id uuid references public.transactions(id) on delete set null,
  paid_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_salary_payments_masjid_staff
  on public.salary_payments (masjid_id, staff_id, payment_date desc);

create index if not exists idx_salary_payments_salary_month
  on public.salary_payments (masjid_id, salary_month desc);

create or replace function public.set_salary_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_salary_payments_updated_at on public.salary_payments;
create trigger trg_salary_payments_updated_at
before update on public.salary_payments
for each row
execute function public.set_salary_payments_updated_at();

create or replace function public.can_manage_staff_salary(p_masjid_id uuid)
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
        ur.role in ('super_admin', 'co_admin')
        or coalesce((ur.permissions ->> 'staff_management')::boolean, false)
        or coalesce((ur.permissions ->> 'accounts')::boolean, false)
      )
  );
$$;

create or replace function public.pay_staff_salary(
  p_masjid_id uuid,
  p_staff_id uuid,
  p_amount numeric,
  p_salary_month date,
  p_payment_date date default current_date,
  p_notes text default null
)
returns table (
  salary_payment_id uuid,
  transaction_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_name text;
  v_actor_id uuid := auth.uid();
  v_transaction_id uuid;
  v_salary_payment_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_salary_month is null then
    raise exception 'Salary month is required';
  end if;

  if not public.can_manage_staff_salary(p_masjid_id) then
    raise exception 'You are not authorized to manage staff salary payments for this mosque';
  end if;

  select e.name
  into v_staff_name
  from public.employees e
  where e.id = p_staff_id
    and e.masjid_id = p_masjid_id
  limit 1;

  if v_staff_name is null then
    raise exception 'Staff member not found for the current mosque';
  end if;

  insert into public.transactions (
    amount,
    description,
    type,
    category,
    date,
    masjid_id,
    user_id,
    family_id,
    staff_id
  )
  values (
    p_amount,
    'Salary payment to ' || v_staff_name,
    'expense',
    'salary',
    p_payment_date,
    p_masjid_id,
    v_actor_id,
    null,
    p_staff_id
  )
  returning id into v_transaction_id;

  insert into public.salary_payments (
    masjid_id,
    staff_id,
    amount,
    salary_month,
    payment_date,
    notes,
    finance_transaction_id,
    paid_by_user_id
  )
  values (
    p_masjid_id,
    p_staff_id,
    p_amount,
    date_trunc('month', p_salary_month)::date,
    p_payment_date,
    nullif(trim(p_notes), ''),
    v_transaction_id,
    v_actor_id
  )
  returning id into v_salary_payment_id;

  return query
  select v_salary_payment_id, v_transaction_id;
end;
$$;

revoke all on function public.pay_staff_salary(uuid, uuid, numeric, date, date, text) from public;
grant execute on function public.pay_staff_salary(uuid, uuid, numeric, date, date, text) to authenticated;

alter table public.salary_payments enable row level security;

drop policy if exists salary_payments_select on public.salary_payments;
create policy salary_payments_select
on public.salary_payments
for select
to authenticated
using (public.can_manage_staff_salary(masjid_id));

drop policy if exists salary_payments_insert on public.salary_payments;
create policy salary_payments_insert
on public.salary_payments
for insert
to authenticated
with check (
  public.can_manage_staff_salary(masjid_id)
  and paid_by_user_id = auth.uid()
);

drop policy if exists salary_payments_update on public.salary_payments;
create policy salary_payments_update
on public.salary_payments
for update
to authenticated
using (public.can_manage_staff_salary(masjid_id))
with check (public.can_manage_staff_salary(masjid_id));

drop policy if exists salary_payments_delete on public.salary_payments;
create policy salary_payments_delete
on public.salary_payments
for delete
to authenticated
using (public.can_manage_staff_salary(masjid_id));

commit;
