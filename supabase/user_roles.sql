-- User roles and invitations for Smart Masjeedh

-- Stores per-user role within a masjid (Super Admin / Staff / Editor)
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null,
  user_id uuid not null,
  email text,
  role text not null check (role in ('super_admin', 'staff', 'editor')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (masjid_id, user_id)
);

-- Optional: index by masjid for faster lookups
create index if not exists idx_user_roles_masjid on public.user_roles (masjid_id);

-- Invitation requests by email, before the user signs up
create table if not exists public.role_invitations (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null,
  email text not null,
  role text not null check (role in ('staff', 'editor')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now()
);

create index if not exists idx_role_invitations_masjid on public.role_invitations (masjid_id);

