-- Update pay_staff_salary function to handle advance deductions
-- This ensures advances are automatically deducted when salary is paid

begin;

-- Drop existing function
drop function if exists public.pay_staff_salary(uuid, uuid, numeric, date, date, text);

-- Recreate with advance deduction logic
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
  v_monthly_salary numeric;
  v_allowances numeric;
  v_salary_disbursement_date integer;
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
  select e.name, e.monthly_salary, e.allowances, e.advances_paid, e.pending_arrears
  into v_staff_name, v_monthly_salary, v_allowances, v_advances_paid, v_pending_arrears
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
    where staff_id = p_staff_id
      and masjid_id = p_masjid_id
      and deducted_from_salary = false
    order by created_at asc
    limit (select count(*) from public.salary_advances where staff_id = p_staff_id and masjid_id = p_masjid_id and deducted_from_salary = false);
  end if;

  -- Insert transaction
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

commit;
