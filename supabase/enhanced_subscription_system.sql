-- Enhanced Subscription System with Waiting State and Complete Workflow
-- This implements the exact requirements specified

-- 1. Family subscription payments tracking (immediate update on collection)
create table if not exists public.family_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null,
  family_id uuid not null,
  collection_id uuid not null references public.subscription_collections(id) on delete cascade,
  amount numeric not null,
  payment_date date not null default (now()::date),
  status text not null default 'waiting' check (status in ('waiting','approved','rejected')),
  collected_by_user_id uuid not null,
  notes text null,
  created_at timestamptz not null default now(),
  approved_at timestamptz null,
  approved_by_user_id uuid null
);

create index if not exists family_subscription_payments_family_idx on public.family_subscription_payments(masjid_id, family_id);
create index if not exists family_subscription_payments_status_idx on public.family_subscription_payments(masjid_id, status);

-- 2. Collector waiting balance aggregation
create table if not exists public.collector_waiting_balances (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null,
  collector_user_id uuid not null,
  total_waiting_amount numeric not null default 0,
  total_collections_count integer not null default 0,
  last_updated_at timestamptz not null default now(),
  unique(masjid_id, collector_user_id)
);

create index if not exists collector_waiting_balances_collector_idx on public.collector_waiting_balances(masjid_id, collector_user_id);

-- 3. Staff salary/commission ledger
create table if not exists public.staff_salary_ledger (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null,
  staff_user_id uuid not null,
  transaction_type text not null check (transaction_type in ('base_salary','collection_commission','salary_payment')),
  amount numeric not null,
  balance_change numeric not null, -- positive for credit, negative for debit
  description text null,
  reference_id uuid null, -- links to collection_id, payment_id, etc.
  transaction_date date not null default (now()::date),
  created_at timestamptz not null default now(),
  created_by_user_id uuid null
);

create index if not exists staff_salary_ledger_staff_idx on public.staff_salary_ledger(masjid_id, staff_user_id);
create index if not exists staff_salary_ledger_type_idx on public.staff_salary_ledger(masjid_id, transaction_type);

-- 4. Enhanced transaction categories for better tracking
do $$
begin
  -- Insert specific transaction categories if they don't exist
  insert into public.transaction_categories (id, masjid_id, name, type, icon, color, created_at)
  values 
    (gen_random_uuid(), (select id from public.masjids limit 1), 'Subscription Income', 'income', 'dollar-sign', '#10b981', now()),
    (gen_random_uuid(), (select id from public.masjids limit 1), 'Base Salary', 'expense', 'briefcase', '#ef4444', now()),
    (gen_random_uuid(), (select id from public.masjids limit 1), 'Collection Commission', 'expense', 'percent', '#8b5cf6', now())
  on conflict (masjid_id, name) do nothing;
end $$;

-- 5. Trigger to update family subscription payments immediately on collection
create or replace function public.update_family_subscription_payment()
returns trigger
language plpgsql
as $$
begin
  -- Insert immediate family payment record with waiting status
  insert into public.family_subscription_payments (
    masjid_id, family_id, collection_id, amount, payment_date, status, 
    collected_by_user_id, notes
  ) values (
    new.masjid_id, new.family_id, new.id, new.amount, new.date, 'waiting',
    new.collected_by_user_id, new.notes
  );
  
  -- Update collector waiting balance
  insert into public.collector_waiting_balances (masjid_id, collector_user_id, total_waiting_amount, total_collections_count)
  values (new.masjid_id, new.collected_by_user_id, new.amount, 1)
  on conflict (masjid_id, collector_user_id)
  do update set
    total_waiting_amount = collector_waiting_balances.total_waiting_amount + new.amount,
    total_collections_count = collector_waiting_balances.total_collections_count + 1,
    last_updated_at = now();
  
  return new;
end;
$$;

-- Create trigger for immediate family update
drop trigger if exists subscription_collections_family_update on public.subscription_collections;
create trigger subscription_collections_family_update
after insert on public.subscription_collections
for each row
execute function public.update_family_subscription_payment();

-- 6. Trigger for approval workflow - creates main account transaction and commission
create or replace function public.approve_subscription_collection()
returns trigger
language plpgsql
as $$
declare
  v_subscription_category_id uuid;
  v_commission_category_id uuid;
  v_base_salary_category_id uuid;
  v_main_transaction_id uuid;
  v_commission_amount numeric;
begin
  -- Only process if status is being set to 'accepted'
  if new.status = 'accepted' and old.status != 'accepted' then
    -- Get transaction categories
    select id into v_subscription_category_id 
    from public.transaction_categories 
    where masjid_id = new.masjid_id and name = 'Subscription Income' limit 1;
    
    select id into v_commission_category_id 
    from public.transaction_categories 
    where masjid_id = new.masjid_id and name = 'Collection Commission' limit 1;
    
    -- Create main account transaction for subscription income
    insert into public.transactions (
      masjid_id, family_id, category_id, amount, type, description, 
      date, reference_id, created_by_user_id
    ) values (
      new.masjid_id, new.family_id, v_subscription_category_id, new.amount, 
      'income', 'Subscription - ' || (select family_code from public.families where id = new.family_id limit 1),
      new.accept_date, new.id, new.accepted_by_user_id
    ) returning id into v_main_transaction_id;
    
    -- Update collection with main transaction ID
    update public.subscription_collections 
    set main_transaction_id = v_main_transaction_id 
    where id = new.id;
    
    -- Calculate and process commission if applicable
    v_commission_amount := coalesce(new.commission_amount, 0);
    if v_commission_amount > 0 then
      -- Create commission transaction
      insert into public.transactions (
        masjid_id, category_id, amount, type, description, 
        date, reference_id, created_by_user_id
      ) values (
        new.masjid_id, v_commission_category_id, v_commission_amount, 
        'expense', 'Commission - ' || (select family_code from public.families where id = new.family_id limit 1),
        new.accept_date, new.id, new.accepted_by_user_id
      );
      
      -- Credit staff salary ledger
      insert into public.staff_salary_ledger (
        masjid_id, staff_user_id, transaction_type, amount, balance_change,
        description, reference_id, transaction_date, created_by_user_id
      ) values (
        new.masjid_id, new.collected_by_user_id, 'collection_commission', 
        v_commission_amount, v_commission_amount,
        'Commission from subscription collection', new.id, new.accept_date, new.accepted_by_user_id
      );
    end if;
    
    -- Update family payment status
    update public.family_subscription_payments 
    set status = 'approved', approved_at = now(), approved_by_user_id = new.accepted_by_user_id
    where collection_id = new.id;
    
    -- Update collector waiting balance (subtract approved amount)
    update public.collector_waiting_balances 
    set total_waiting_amount = total_waiting_amount - new.amount,
        last_updated_at = now()
    where masjid_id = new.masjid_id and collector_user_id = new.collected_by_user_id;
  end if;
  
  return new;
end;
$$;

-- Create trigger for approval workflow
drop trigger if exists subscription_collections_approval_trigger on public.subscription_collections;
create trigger subscription_collections_approval_trigger
after update on public.subscription_collections
for each row
execute function public.approve_subscription_collection();

-- 7. Function to process salary payments with commission separation
create or replace function public.process_staff_salary_payment(
  p_masjid_id uuid,
  p_staff_user_id uuid,
  p_base_salary numeric,
  p_payment_date date default (now()::date),
  p_notes text default null
)
returns uuid
language plpgsql
as $$
declare
  v_base_salary_category_id uuid;
  v_commission_category_id uuid;
  v_base_transaction_id uuid;
  v_commission_transaction_id uuid;
  v_total_commission numeric;
begin
  -- Get transaction categories
  select id into v_base_salary_category_id 
  from public.transaction_categories 
  where masjid_id = p_masjid_id and name = 'Base Salary' limit 1;
  
  select id into v_commission_category_id 
  from public.transaction_categories 
  where masjid_id = p_masjid_id and name = 'Collection Commission' limit 1;
  
  -- Calculate total commission balance
  select coalesce(sum(amount), 0) into v_total_commission
  from public.staff_salary_ledger
  where masjid_id = p_masjid_id 
    and staff_user_id = p_staff_user_id 
    and transaction_type = 'collection_commission'
    and balance_change > 0; -- only credit commissions
  
  -- Create base salary transaction
  insert into public.transactions (
    masjid_id, category_id, amount, type, description, 
    date, created_by_user_id
  ) values (
    p_masjid_id, v_base_salary_category_id, p_base_salary, 
    'expense', 'Base Salary Payment', p_payment_date, auth.uid()
  ) returning id into v_base_transaction_id;
  
  -- Debit base salary from ledger
  insert into public.staff_salary_ledger (
    masjid_id, staff_user_id, transaction_type, amount, balance_change,
    description, reference_id, transaction_date, created_by_user_id
  ) values (
    p_masjid_id, p_staff_user_id, 'salary_payment', p_base_salary, -p_base_salary,
    'Base salary payment', v_base_transaction_id, p_payment_date, auth.uid()
  );
  
  -- Create commission payment transaction if commission exists
  if v_total_commission > 0 then
    insert into public.transactions (
      masjid_id, category_id, amount, type, description, 
      date, created_by_user_id
    ) values (
      p_masjid_id, v_commission_category_id, v_total_commission, 
      'expense', 'Collection Commission Payment', p_payment_date, auth.uid()
    ) returning id into v_commission_transaction_id;
    
    -- Debit commission from ledger
    insert into public.staff_salary_ledger (
      masjid_id, staff_user_id, transaction_type, amount, balance_change,
      description, reference_id, transaction_date, created_by_user_id
    ) values (
      p_masjid_id, p_staff_user_id, 'salary_payment', v_total_commission, -v_total_commission,
      'Commission payment', v_commission_transaction_id, p_payment_date, auth.uid()
    );
  end if;
  
  return v_base_transaction_id;
end;
$$;

-- 8. Enable RLS for new tables
alter table public.family_subscription_payments enable row level security;
alter table public.collector_waiting_balances enable row level security;
alter table public.staff_salary_ledger enable row level security;

-- 9. RLS Policies for new tables

-- family_subscription_payments policies
drop policy if exists family_subscription_payments_select on public.family_subscription_payments;
create policy family_subscription_payments_select
on public.family_subscription_payments
for select
to authenticated
using (
  public.is_masjid_admin(masjid_id)
  or public.has_masjid_permission(masjid_id, 'subscriptions_collect'::text)
  or public.has_masjid_permission(masjid_id, 'subscriptions_approve'::text)
);

-- collector_waiting_balances policies
drop policy if exists collector_waiting_balances_select on public.collector_waiting_balances;
create policy collector_waiting_balances_select
on public.collector_waiting_balances
for select
to authenticated
using (
  public.is_masjid_admin(masjid_id)
  or public.has_masjid_permission(masjid_id, 'subscriptions_approve'::text)
  or (public.has_masjid_permission(masjid_id, 'subscriptions_collect'::text) and collector_user_id = auth.uid())
);

-- staff_salary_ledger policies
drop policy if exists staff_salary_ledger_select on public.staff_salary_ledger;
create policy staff_salary_ledger_select
on public.staff_salary_ledger
for select
to authenticated
using (
  public.is_masjid_admin(masjid_id)
  or (staff_user_id = auth.uid())
);

-- 10. Helper functions for workflow

-- Get collector's current waiting balance
create or replace function public.get_collector_waiting_balance(p_collector_user_id uuid)
returns table (masjid_id uuid, total_waiting_amount numeric, total_collections_count integer)
language sql
stable
as $$
  select 
    cwb.masjid_id,
    cwb.total_waiting_amount,
    cwb.total_collections_count
  from public.collector_waiting_balances cwb
  where cwb.collector_user_id = p_collector_user_id;
$$;

-- Get family's subscription payment status
create or replace function public.get_family_subscription_status(p_family_id uuid)
returns table (
  family_id uuid,
  total_paid numeric,
  waiting_amount numeric,
  approved_amount numeric,
  last_payment_date date
)
language sql
stable
as $$
  select 
    fsp.family_id,
    sum(fsp.amount) as total_paid,
    sum(case when fsp.status = 'waiting' then fsp.amount else 0 end) as waiting_amount,
    sum(case when fsp.status = 'approved' then fsp.amount else 0 end) as approved_amount,
    max(fsp.payment_date) as last_payment_date
  from public.family_subscription_payments fsp
  where fsp.family_id = p_family_id
  group by fsp.family_id;
$$;

-- Get staff commission balance
create or replace function public.get_staff_commission_balance(p_staff_user_id uuid)
returns table (
  staff_user_id uuid,
  total_commission_earned numeric,
  total_commission_paid numeric,
  available_balance numeric
)
language sql
stable
as $$
  select 
    ssl.staff_user_id,
    sum(case when ssl.transaction_type = 'collection_commission' and ssl.balance_change > 0 then ssl.balance_change else 0 end) as total_commission_earned,
    sum(case when ssl.transaction_type = 'salary_payment' and ssl.balance_change < 0 then abs(ssl.balance_change) else 0 end) as total_commission_paid,
    sum(ssl.balance_change) as available_balance
  from public.staff_salary_ledger ssl
  where ssl.staff_user_id = p_staff_user_id
  group by ssl.staff_user_id;
$$;
