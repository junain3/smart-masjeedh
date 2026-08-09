-- Add RPC function to deduct pending arrears when salary is paid
-- This ensures atomic deduction of arrears with proper validation

begin;

-- Create function to deduct pending arrears
create or replace function public.deduct_pending_arrears(
  p_staff_id uuid,
  p_masjid_id uuid,
  p_amount numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_arrears numeric;
begin
  -- Validate inputs
  if p_staff_id is null then
    raise exception 'Staff ID is required';
  end if;
  
  if p_masjid_id is null then
    raise exception 'Masjid ID is required';
  end if;
  
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  
  -- Get current arrears
  select pending_arrears into v_current_arrears
  from public.employees
  where id = p_staff_id
    and masjid_id = p_masjid_id
  for update;
  
  if not found then
    raise exception 'Staff member not found';
  end if;
  
  -- Deduct amount, ensuring it doesn't go below zero
  update public.employees
  set pending_arrears = greatest(0, v_current_arrears - p_amount)
  where id = p_staff_id
    and masjid_id = p_masjid_id;
  
  return true;
end;
$$;

-- Grant execute permission to authenticated users
revoke all on function public.deduct_pending_arrears(uuid, uuid, numeric) from public;
grant execute on function public.deduct_pending_arrears(uuid, uuid, numeric) to authenticated;

commit;
