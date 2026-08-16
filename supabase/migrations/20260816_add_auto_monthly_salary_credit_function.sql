-- Create function to auto-credit monthly salary for all active staff
-- This function checks for duplicates and only credits if not already done for the month

create or replace function public.auto_credit_monthly_salary(
  p_salary_month text, -- Format: 'YYYY-MM' (e.g., '2026-08')
  p_masjid_id uuid default null
)
returns table (
  staff_id uuid,
  staff_name text,
  salary_amount numeric,
  ledger_id uuid,
  balance_after numeric,
  status text,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_record record;
  v_previous_balance numeric;
  v_new_balance numeric;
  v_ledger_id uuid;
  v_existing_credit_id uuid;
begin
  -- If masjid_id is null, process all masjids
  if p_masjid_id is null then
    -- Return empty result for now (would need cursor for multiple masjids)
    return query select null::uuid, null::text, 0::numeric, null::uuid, 0::numeric, 'error'::text, 'masjid_id is required'::text;
    return;
  end if;
  
  -- Loop through all active staff for the masjid
  for v_staff_record in 
    select id, name, monthly_salary, salary_date
    from public.employees
    where masjid_id = p_masjid_id
      and is_active = true
      and monthly_salary is not null
      and monthly_salary > 0
  loop
    -- Check if salary credit already exists for this month
    select id into v_existing_credit_id
    from public.staff_ledger
    where staff_id = v_staff_record.id
      and masjid_id = p_masjid_id
      and reference_type = 'monthly_salary_credit'
      and to_char(transaction_date, 'YYYY-MM') = p_salary_month
    limit 1;
    
    -- If already credited, skip with message
    if v_existing_credit_id is not null then
      return query next
      select 
        v_staff_record.id,
        v_staff_record.name,
        v_staff_record.monthly_salary,
        null::uuid,
        0::numeric,
        'skipped'::text,
        'Salary already credited for this month'::text;
      continue;
    end if;
    
    -- Get current balance
    select coalesce(balance_after, 0) into v_previous_balance
    from public.staff_ledger
    where staff_id = v_staff_record.id
      and masjid_id = p_masjid_id
    order by transaction_date desc, created_at desc
    limit 1;
    
    -- Calculate new balance (credit increases balance)
    v_new_balance := v_previous_balance + v_staff_record.monthly_salary;
    
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
      balance_after
    ) values (
      p_masjid_id,
      v_staff_record.id,
      p_salary_month || '-01', -- First day of the month
      'credit',
      v_staff_record.monthly_salary,
      'Monthly salary credit for ' || p_salary_month,
      'monthly_salary_credit',
      null,
      v_new_balance
    ) returning id into v_ledger_id;
    
    -- Return success result
    return query next
    select 
      v_staff_record.id,
      v_staff_record.name,
      v_staff_record.monthly_salary,
      v_ledger_id,
      v_new_balance,
      'success'::text,
      'Salary credited successfully'::text;
      
  end loop;
  
  return;
end;
$$;

-- Grant execute permission
revoke all on function public.auto_credit_monthly_salary(text, uuid) from public;
grant execute on function public.auto_credit_monthly_salary(text, uuid) to authenticated;

-- Create a simplified version that processes a single staff member
create or replace function public.credit_staff_monthly_salary(
  p_staff_id uuid,
  p_salary_month text, -- Format: 'YYYY-MM'
  p_masjid_id uuid
)
returns table (
  ledger_id uuid,
  balance_after numeric,
  status text,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_name text;
  v_monthly_salary numeric;
  v_previous_balance numeric;
  v_new_balance numeric;
  v_ledger_id uuid;
  v_existing_credit_id uuid;
begin
  -- Get staff details
  select name, monthly_salary into v_staff_name, v_monthly_salary
  from public.employees
  where id = p_staff_id
    and masjid_id = p_masjid_id
    and is_active = true;
    
  if v_staff_name is null then
    return query select null::uuid, 0::numeric, 'error'::text, 'Staff not found or inactive'::text;
    return;
  end if;
  
  if v_monthly_salary is null or v_monthly_salary <= 0 then
    return query select null::uuid, 0::numeric, 'error'::text, 'Invalid salary amount'::text;
    return;
  end if;
  
  -- Check if salary credit already exists for this month
  select id into v_existing_credit_id
  from public.staff_ledger
  where staff_id = p_staff_id
    and masjid_id = p_masjid_id
    and reference_type = 'monthly_salary_credit'
    and to_char(transaction_date, 'YYYY-MM') = p_salary_month
  limit 1;
  
  if v_existing_credit_id is not null then
    return query select null::uuid, 0::numeric, 'skipped'::text, 'Salary already credited for this month'::text;
    return;
  end if;
  
  -- Get current balance
  select coalesce(balance_after, 0) into v_previous_balance
  from public.staff_ledger
  where staff_id = p_staff_id
    and masjid_id = p_masjid_id
  order by transaction_date desc, created_at desc
  limit 1;
  
  -- Calculate new balance (credit increases balance)
  v_new_balance := v_previous_balance + v_monthly_salary;
  
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
    balance_after
  ) values (
    p_masjid_id,
    p_staff_id,
    p_salary_month || '-01',
    'credit',
    v_monthly_salary,
    'Monthly salary credit for ' || p_salary_month,
    'monthly_salary_credit',
    null,
    v_new_balance
  ) returning id into v_ledger_id;
  
  return query select v_ledger_id, v_new_balance, 'success'::text, 'Salary credited successfully'::text;
  return;
end;
$$;

-- Grant execute permission
revoke all on function public.credit_staff_monthly_salary(uuid, text, uuid) from public;
grant execute on function public.credit_staff_monthly_salary(uuid, text, uuid) to authenticated;
