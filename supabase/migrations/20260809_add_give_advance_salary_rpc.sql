-- Add RPC function to give advance salary to staff
-- This records advance payments and increases the advances_paid balance

begin;

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

commit;
