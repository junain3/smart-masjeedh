-- Create salary_advances table to track advance payments
-- This allows staff to receive advance payments that are deducted from future salary

begin;

-- Create salary_advances table
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

-- Add indexes for performance
create index if not exists idx_salary_advances_staff_id on public.salary_advances(staff_id, masjid_id);
create index if not exists idx_salary_advances_deducted on public.salary_advances(deducted_from_salary, masjid_id);

-- Enable RLS
alter table public.salary_advances enable row level security;

-- RLS Policies
create policy salary_advances_select_tenant
on public.salary_advances for select
to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.masjid_id = salary_advances.masjid_id
  and ur.user_id = auth.uid()
));

create policy salary_advances_write_admin
on public.salary_advances for all
to authenticated
using (public.is_masjid_admin(masjid_id))
with check (public.is_masjid_admin(masjid_id));

-- Comment the table
comment on table public.salary_advances is 'Tracks advance salary payments given to staff members. These advances are deducted from future salary payments.';

commit;
