-- Comprehensive Salary & Advance Salary Migration
-- This script adds all necessary database changes for advance salary features
-- Run this in Supabase SQL Editor to apply all changes at once

begin;

-- =====================================================
-- 1. Add salary_disbursement_date to masjids table
-- =====================================================
alter table public.masjids
add column if not exists salary_disbursement_date integer default 25 check (salary_disbursement_date >= 1 and salary_disbursement_date <= 31);

comment on column public.masjids.salary_disbursement_date is 'Day of month when salary is disbursed (1-31). Used for calculating salary cycles and arrears.';

-- =====================================================
-- 2. Add advances_paid column to employees table
-- =====================================================
alter table public.employees
add column if not exists advances_paid numeric(12,2) default 0 check (advances_paid >= 0);

create index if not exists idx_employees_advances_paid
on public.employees (masjid_id, advances_paid desc);

comment on column public.employees.advances_paid is 'Total advance payments given to staff that have not yet been deducted from salary. Decreases when advances are deducted from salary payments.';

-- =====================================================
-- 3. Fix salary_payments table column name (employee_id -> staff_id)
-- =====================================================
-- Handle schema mismatch: some databases have employee_id, others have staff_id
-- This ensures consistency with the staff_salary_management.sql schema
do $$
begin
  -- If employee_id exists and staff_id doesn't, rename it
  if exists (
    select 1 from information_schema.columns 
    where table_name = 'salary_payments' 
    and column_name = 'employee_id'
  ) and not exists (
    select 1 from information_schema.columns 
    where table_name = 'salary_payments' 
    and column_name = 'staff_id'
  ) then
    alter table public.salary_payments rename column employee_id to staff_id;
  end if;
  
  -- Ensure staff_id column exists
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'salary_payments' 
    and column_name = 'staff_id'
  ) then
    alter table public.salary_payments add column staff_id uuid references public.employees(id) on delete cascade;
  end if;
end $$;

-- =====================================================
-- 4. Create staff_ledger table for financial tracking
-- =====================================================
create table if not exists public.staff_ledger (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null references public.masjids(id) on delete cascade,
  staff_id uuid not null references public.employees(id) on delete cascade,
  transaction_date date not null default current_date,
  transaction_type text not null check (transaction_type in ('credit', 'debit')),
  amount numeric(12,2) not null check (amount > 0),
  description text not null,
  reference_type text check (reference_type in ('salary_payment', 'advance_payment', 'monthly_salary_credit', 'adjustment')),
  reference_id uuid,
  balance_after numeric(12,2) not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create index if not exists idx_staff_ledger_masjid_staff
  on public.staff_ledger (masjid_id, staff_id, transaction_date desc);

create index if not exists idx_staff_ledger_reference
  on public.staff_ledger (reference_type, reference_id);

comment on table public.staff_ledger is 'Ledger-style financial tracking for staff members. Credits represent salary dues, debits represent payments made to staff. Running balance shows net position (positive = dues owed, negative = overpaid).';

-- =====================================================
-- 5. Create advance_repayment_schedules table for installment tracking
-- =====================================================
create table if not exists public.advance_repayment_schedules (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null references public.masjids(id) on delete cascade,
  staff_id uuid not null references public.employees(id) on delete cascade,
  advance_id uuid references public.salary_advances(id) on delete cascade,
  total_amount numeric(12,2) not null check (total_amount > 0),
  monthly_deduction_amount numeric(12,2) not null check (monthly_deduction_amount > 0),
  remaining_amount numeric(12,2) not null check (remaining_amount >= 0),
  start_month date not null,
  end_month date not null,
  is_active boolean default true,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create index if not exists idx_advance_repayment_schedules_staff
  on public.advance_repayment_schedules (staff_id, masjid_id, is_active);

create index if not exists idx_advance_repayment_schedules_advance
  on public.advance_repayment_schedules (advance_id);

comment on table public.advance_repayment_schedules is 'Tracks installment-based repayment schedules for advance salary payments. Allows specifying monthly deduction amounts and automatically posts deductions on salary dates.';

-- =====================================================
-- 6. Add RLS policies for staff_ledger table
-- =====================================================
alter table public.staff_ledger enable row level security;

drop policy if exists staff_ledger_select_tenant on public.staff_ledger;
create policy staff_ledger_select_tenant
on public.staff_ledger for select
to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.masjid_id = staff_ledger.masjid_id
  and ur.user_id = auth.uid()
));

drop policy if exists staff_ledger_write_admin on public.staff_ledger;
create policy staff_ledger_write_admin
on public.staff_ledger for all
to authenticated
using (public.is_masjid_admin(masjid_id))
with check (public.is_masjid_admin(masjid_id));

-- =====================================================
-- 7. Add RLS policies for advance_repayment_schedules table
-- =====================================================
alter table public.advance_repayment_schedules enable row level security;

drop policy if exists advance_repayment_schedules_select_tenant on public.advance_repayment_schedules;
create policy advance_repayment_schedules_select_tenant
on public.advance_repayment_schedules for select
to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.masjid_id = advance_repayment_schedules.masjid_id
  and ur.user_id = auth.uid()
));

drop policy if exists advance_repayment_schedules_write_admin on public.advance_repayment_schedules;
create policy advance_repayment_schedules_write_admin
on public.advance_repayment_schedules for all
to authenticated
using (public.is_masjid_admin(masjid_id))
with check (public.is_masjid_admin(masjid_id));

-- =====================================================
-- 8. Update staff_ledger reference_type check to include new types
-- =====================================================
do $$
begin
  -- Drop and recreate the table with updated check constraint
  -- This is necessary because PostgreSQL doesn't support altering check constraints easily
  alter table public.staff_ledger drop constraint if exists staff_ledger_transaction_type_check;
  alter table public.staff_ledger add constraint staff_ledger_transaction_type_check 
    check (transaction_type in ('credit', 'debit'));
  
  alter table public.staff_ledger drop constraint if exists staff_ledger_reference_type_check;
  alter table public.staff_ledger add constraint staff_ledger_reference_type_check 
    check (reference_type in ('salary_payment', 'advance_payment', 'monthly_salary_credit', 'custom_credit', 'repayment_deduction', 'adjustment'));
end $$;

-- =====================================================
-- 9. Create salary_advances table
-- =====================================================
create table if not exists public.salary_advances (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null references public.masjids(id) on delete cascade,
  staff_id uuid not null references public.employees(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  advance_date date not null default current_date,
  notes text,
  finance_transaction_id uuid references public.transactions(id) on delete set null,
  deducted_from_salary boolean default false,
  deducted_salary_payment_id uuid references public.salary_payments(id) on delete set null,
  paid_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_salary_advances_staff_id on public.salary_advances(staff_id, masjid_id);
create index if not exists idx_salary_advances_deducted on public.salary_advances(deducted_from_salary, masjid_id);

-- Enable RLS
alter table public.salary_advances enable row level security;

-- RLS Policies
drop policy if exists salary_advances_select_tenant on public.salary_advances;
create policy salary_advances_select_tenant
on public.salary_advances for select
to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.masjid_id = salary_advances.masjid_id
  and ur.user_id = auth.uid()
));

drop policy if exists salary_advances_write_admin on public.salary_advances;
create policy salary_advances_write_admin
on public.salary_advances for all
to authenticated
using (public.is_masjid_admin(masjid_id))
with check (public.is_masjid_admin(masjid_id));

comment on table public.salary_advances is 'Tracks advance salary payments given to staff members. These advances are deducted from future salary payments.';

-- =====================================================
-- 10. Update pay_staff_salary function with advance deduction
-- =====================================================
drop function if exists public.pay_staff_salary(uuid, uuid, numeric, date, date, text);

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
  transaction_id uuid,
  advances_deducted numeric,
  remaining_advances numeric
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
  v_advances_paid numeric;
  v_advances_to_deduct numeric;
  v_remaining_advances numeric;
  v_pending_arrears numeric;
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

  -- Get staff details
  select e.name, e.advances_paid, e.pending_arrears
  into v_staff_name, v_advances_paid, v_pending_arrears
  from public.employees e
  where e.id = p_staff_id
    and e.masjid_id = p_masjid_id
  for update
  limit 1;

  if v_staff_name is null then
    raise exception 'Staff member not found for the current mosque';
  end if;

  -- Calculate how much to deduct from advances
  -- Deduct as much as possible from advances, but not more than the payment amount
  v_advances_to_deduct := least(v_advances_paid, p_amount);
  v_remaining_advances := v_advances_paid - v_advances_to_deduct;

  -- Update pending arrears: Net Pending Arrears = (Previous Arrears + Current Month Salary) - (Advances Deducted + Regular Salary Paid)
  -- Simplified: pending_arrears = pending_arrears - (p_amount - v_advances_to_deduct)
  v_pending_arrears := greatest(0, v_pending_arrears - (p_amount - v_advances_to_deduct));

  -- Update employee record
  update public.employees
  set 
    advances_paid = v_remaining_advances,
    pending_arrears = v_pending_arrears
  where id = p_staff_id
    and masjid_id = p_masjid_id;

  -- Mark advances as deducted
  if v_advances_to_deduct > 0 then
    update public.salary_advances
    set 
      deducted_from_salary = true,
      deducted_salary_payment_id = (select id from public.salary_payments where staff_id = p_staff_id order by created_at desc limit 1)
    where id in (
      select id from public.salary_advances
      where staff_id = p_staff_id
        and masjid_id = p_masjid_id
        and deducted_from_salary = false
      order by created_at asc
      limit (select count(*) from public.salary_advances where staff_id = p_staff_id and masjid_id = p_masjid_id and deducted_from_salary = false)
    );
  end if;

  -- Insert transaction (uses user_id, not created_by)
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
    'Salary payment to ' || v_staff_name || case when v_advances_to_deduct > 0 then ' (includes Rs. ' || v_advances_to_deduct || ' advance deduction)' else '' end,
    'expense',
    'salary',
    p_payment_date,
    p_masjid_id,
    v_actor_id,
    null,
    p_staff_id
  )
  returning id into v_transaction_id;

  -- Insert salary payment
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
  select v_salary_payment_id, v_transaction_id, v_advances_to_deduct, v_remaining_advances;
end;
$$;

revoke all on function public.pay_staff_salary(uuid, uuid, numeric, date, date, text) from public;
grant execute on function public.pay_staff_salary(uuid, uuid, numeric, date, date, text) to authenticated;

-- =====================================================
-- 11. Create give_advance_salary function
-- =====================================================
drop function if exists public.give_advance_salary(uuid, uuid, numeric, date, text);

create or replace function public.give_advance_salary(
  p_masjid_id uuid,
  p_staff_id uuid,
  p_amount numeric,
  p_advance_date date default current_date,
  p_notes text default null
)
returns table (
  advance_id uuid,
  transaction_id uuid,
  total_advances numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_name text;
  v_actor_id uuid := auth.uid();
  v_transaction_id uuid;
  v_advance_id uuid;
  v_current_advances numeric;
  v_new_advances numeric;
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if not public.can_manage_staff_salary(p_masjid_id) then
    raise exception 'You are not authorized to manage staff salary payments for this mosque';
  end if;

  -- Get staff details
  select e.name, e.advances_paid
  into v_staff_name, v_current_advances
  from public.employees e
  where e.id = p_staff_id
    and e.masjid_id = p_masjid_id
  for update
  limit 1;

  if v_staff_name is null then
    raise exception 'Staff member not found for the current mosque';
  end if;

  -- Calculate new advances total
  v_new_advances := v_current_advances + p_amount;

  -- Update employee advances_paid
  update public.employees
  set advances_paid = v_new_advances
  where id = p_staff_id
    and masjid_id = p_masjid_id;

  -- Insert transaction (uses user_id, not created_by)
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
    'Advance salary to ' || v_staff_name,
    'expense',
    'Advance Salary',
    p_advance_date,
    p_masjid_id,
    v_actor_id,
    null,
    p_staff_id
  )
  returning id into v_transaction_id;

  -- Insert advance record
  insert into public.salary_advances (
    masjid_id,
    staff_id,
    amount,
    advance_date,
    notes,
    finance_transaction_id,
    paid_by_user_id
  )
  values (
    p_masjid_id,
    p_staff_id,
    p_amount,
    p_advance_date,
    nullif(trim(p_notes), ''),
    v_transaction_id,
    v_actor_id
  )
  returning id into v_advance_id;

  return query
  select v_advance_id, v_transaction_id, v_new_advances;
end;
$$;

revoke all on function public.give_advance_salary(uuid, uuid, numeric, date, text) from public;
grant execute on function public.give_advance_salary(uuid, uuid, numeric, date, text) to authenticated;

-- =====================================================
-- 12. Create post_custom_credit function for bonuses, allowances, gifts
-- =====================================================
drop function if exists public.post_custom_credit(uuid, uuid, numeric, text, text, date, text);

create or replace function public.post_custom_credit(
  p_masjid_id uuid,
  p_staff_id uuid,
  p_amount numeric,
  p_credit_type text, -- 'bonus', 'allowance', 'gift', 'other'
  p_description text,
  p_credit_date date default current_date,
  p_notes text default null
)
returns table (
  ledger_id uuid,
  balance_after numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_balance numeric;
  v_new_balance numeric;
  v_ledger_id uuid;
begin
  -- Get current balance
  select coalesce(balance_after, 0) into v_previous_balance
  from public.staff_ledger
  where staff_id = p_staff_id
    and masjid_id = p_masjid_id
  order by transaction_date desc, created_at desc
  limit 1;

  -- Calculate new balance (credit increases balance)
  v_new_balance := v_previous_balance + p_amount;

  -- Create ledger entry
  insert into public.staff_ledger (
    masjid_id,
    staff_id,
    transaction_date,
    transaction_type,
    amount,
    description,
    reference_type,
    reference_id,
    balance_after,
    created_by
  ) values (
    p_masjid_id,
    p_staff_id,
    p_credit_date,
    'credit',
    p_amount,
    p_description || ' (' || p_credit_type || ')',
    'custom_credit',
    null,
    v_new_balance,
    auth.uid()
  ) returning id into v_ledger_id;

  return query
  select v_ledger_id, v_new_balance;
end;
$$;

revoke all on function public.post_custom_credit(uuid, uuid, numeric, text, text, date, text) from public;
grant execute on function public.post_custom_credit(uuid, uuid, numeric, text, text, date, text) to authenticated;

-- =====================================================
-- 13. Create create_advance_repayment_schedule function
-- =====================================================
drop function if exists public.create_advance_repayment_schedule(uuid, uuid, uuid, numeric, numeric, date, date);

create or replace function public.create_advance_repayment_schedule(
  p_masjid_id uuid,
  p_staff_id uuid,
  p_advance_id uuid,
  p_total_amount numeric,
  p_monthly_deduction numeric,
  p_start_month date,
  p_end_month date
)
returns table (
  schedule_id uuid,
  total_months integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule_id uuid;
  v_total_months integer;
begin
  -- Calculate total months
  v_total_months := extract(year from age(p_end_month, p_start_month)) * 12 
                  + extract(month from age(p_end_month, p_start_month)) + 1;

  -- Create repayment schedule
  insert into public.advance_repayment_schedules (
    masjid_id,
    staff_id,
    advance_id,
    total_amount,
    monthly_deduction_amount,
    remaining_amount,
    start_month,
    end_month,
    is_active,
    created_by
  ) values (
    p_masjid_id,
    p_staff_id,
    p_advance_id,
    p_total_amount,
    p_monthly_deduction,
    p_total_amount,
    p_start_month,
    p_end_month,
    true,
    auth.uid()
  ) returning id into v_schedule_id;

  return query
  select v_schedule_id, v_total_months;
end;
$$;

revoke all on function public.create_advance_repayment_schedule(uuid, uuid, uuid, numeric, numeric, date, date) from public;
grant execute on function public.create_advance_repayment_schedule(uuid, uuid, uuid, numeric, numeric, date, date) to authenticated;

-- =====================================================
-- 14. Create process_repayment_deductions function
-- =====================================================
drop function if exists public.process_repayment_deductions(uuid, uuid, date);

create or replace function public.process_repayment_deductions(
  p_masjid_id uuid,
  p_staff_id uuid,
  p_salary_month date
)
returns table (
  deduction_amount numeric,
  schedule_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule record;
  v_deduction_amount numeric;
  v_previous_balance numeric;
  v_new_balance numeric;
  v_ledger_id uuid;
begin
  -- Find active repayment schedules for this month
  for v_schedule in 
    select id, monthly_deduction_amount, remaining_amount
    from public.advance_repayment_schedules
    where staff_id = p_staff_id
      and masjid_id = p_masjid_id
      and is_active = true
      and p_salary_month >= start_month
      and p_salary_month <= end_month
      and remaining_amount > 0
  loop
    -- Calculate deduction (don't exceed remaining amount)
    v_deduction_amount := least(v_schedule.monthly_deduction_amount, v_schedule.remaining_amount);

    -- Get current balance
    select coalesce(balance_after, 0) into v_previous_balance
    from public.staff_ledger
    where staff_id = p_staff_id
      and masjid_id = p_masjid_id
    order by transaction_date desc, created_at desc
    limit 1;

    -- Calculate new balance (deduction reduces balance)
    v_new_balance := v_previous_balance - v_deduction_amount;

    -- Create ledger entry for deduction
    insert into public.staff_ledger (
      masjid_id,
      staff_id,
      transaction_date,
      transaction_type,
      amount,
      description,
      reference_type,
      reference_id,
      balance_after,
      created_by
    ) values (
      p_masjid_id,
      p_staff_id,
      p_salary_month,
      'debit',
      v_deduction_amount,
      'Advance repayment deduction',
      'repayment_deduction',
      v_schedule.id,
      v_new_balance,
      auth.uid()
    ) returning id into v_ledger_id;

    -- Update remaining amount in schedule
    update public.advance_repayment_schedules
    set remaining_amount = remaining_amount - v_deduction_amount,
        completed_at = case when remaining_amount - v_deduction_amount <= 0 then now() else null end,
        is_active = case when remaining_amount - v_deduction_amount <= 0 then false else true end
    where id = v_schedule.id;

    return query
    select v_deduction_amount, v_schedule.id;
  end loop;

  return;
end;
$$;

revoke all on function public.process_repayment_deductions(uuid, uuid, date) from public;
grant execute on function public.process_repayment_deductions(uuid, uuid, date) to authenticated;

-- =====================================================
-- 15. Verify transactions table uses user_id (not created_by)
-- =====================================================
-- Note: The transactions table already uses user_id column
-- This migration ensures no created_by column exists in transactions
do $$
begin
  -- Check if created_by column exists in transactions and drop it if it does
  if exists (
    select 1 from information_schema.columns 
    where table_name = 'transactions' 
    and column_name = 'created_by'
  ) then
    alter table public.transactions drop column if exists created_by;
  end if;
  
  -- Ensure user_id column exists
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'transactions' 
    and column_name = 'user_id'
  ) then
    raise exception 'transactions table must have user_id column';
  end if;
end $$;

commit;

-- =====================================================
-- Verification Queries (run these to verify success)
-- =====================================================
-- Check masjids table has salary_disbursement_date:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'masjids' AND column_name = 'salary_disbursement_date';

-- Check employees table has advances_paid:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'advances_paid';

-- Check salary_advances table exists:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'salary_advances';

-- Check RPC functions exist:
-- SELECT routine_name FROM information_schema.routines WHERE routine_name IN ('pay_staff_salary', 'give_advance_salary');

-- Check transactions table uses user_id (not created_by):
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' AND column_name IN ('user_id', 'created_by');
