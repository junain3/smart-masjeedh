
-- ============================================================
-- Security Fixes Migration (2026-07-16)
-- ============================================================

-- ============================================================
-- Step 1: Standardize user_roles column to auth_user_id
-- ============================================================
-- First, add auth_user_id column if not exists, copy data from user_id
-- Create a function to get user_id if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_roles'
    AND column_name = 'user_id'
  ) THEN
    -- Add auth_user_id column
    ALTER TABLE public.user_roles 
    ADD COLUMN IF NOT EXISTS auth_user_id UUID;

    -- Copy existing user_id to auth_user_id
    UPDATE public.user_roles 
    SET auth_user_id = user_id
    WHERE auth_user_id IS NULL;

    -- Add unique constraint on auth_user_id and masjid_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu 
      ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'public' 
      AND tc.table_name = 'user_roles' 
      AND tc.constraint_type = 'UNIQUE'
      AND ccu.column_name = 'auth_user_id'
    ) THEN
      ALTER TABLE public.user_roles 
      DROP CONSTRAINT IF EXISTS user_roles_masjid_id_user_id_key;
      ALTER TABLE public.user_roles 
      ADD CONSTRAINT user_roles_masjid_id_auth_user_id_key 
      UNIQUE (masjid_id, auth_user_id);
    END IF;

    -- Create index
    CREATE INDEX IF NOT EXISTS idx_user_roles_auth_user_id 
    ON public.user_roles(auth_user_id);
  END IF;
END $$;

-- ============================================================
-- Step 2: Add masjid_id to message_logs
-- ============================================================
ALTER TABLE public.message_logs 
ADD COLUMN IF NOT EXISTS masjid_id UUID 
REFERENCES public.masjids(id) ON DELETE CASCADE;

-- Populate existing message_logs with masjid_id from members table
UPDATE public.message_logs ml
SET masjid_id = m.masjid_id
FROM public.members m
WHERE ml.member_id = m.id
AND ml.masjid_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_message_logs_masjid_id 
ON public.message_logs(masjid_id);

-- ============================================================
-- Step 3: Enable RLS on whatsapp_configs and add policies
-- ============================================================
ALTER TABLE public.whatsapp_configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their masjid's WhatsApp config" 
ON public.whatsapp_configs;
DROP POLICY IF EXISTS "Admins can manage their masjid's WhatsApp config" 
ON public.whatsapp_configs;

-- Select policy
CREATE POLICY "Users can view their masjid's WhatsApp config"
ON public.whatsapp_configs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.masjid_id = whatsapp_configs.masjid_id
    AND ur.auth_user_id = auth.uid()
  )
);

-- Insert/Update/Delete policies
CREATE POLICY "Admins can manage their masjid's WhatsApp config"
ON public.whatsapp_configs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.masjid_id = whatsapp_configs.masjid_id
    AND ur.auth_user_id = auth.uid()
    AND ur.role IN ('super_admin', 'co_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.masjid_id = whatsapp_configs.masjid_id
    AND ur.auth_user_id = auth.uid()
    AND ur.role IN ('super_admin', 'co_admin')
  )
);

-- ============================================================
-- Step 4: Enable RLS on message_logs and add policies
-- ============================================================
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their masjid's message logs" 
ON public.message_logs;
DROP POLICY IF EXISTS "Admins can insert message logs for their masjid" 
ON public.message_logs;

-- Select policy
CREATE POLICY "Users can view their masjid's message logs"
ON public.message_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.masjid_id = message_logs.masjid_id
    AND ur.auth_user_id = auth.uid()
  )
);

-- Insert policy
CREATE POLICY "Admins can insert message logs for their masjid"
ON public.message_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.masjid_id = message_logs.masjid_id
    AND ur.auth_user_id = auth.uid()
    AND ur.role IN ('super_admin', 'co_admin')
  )
);

-- ============================================================
-- Step 5: Update existing helper functions to use auth_user_id
-- ============================================================
-- Update is_masjid_admin function
CREATE OR REPLACE FUNCTION public.is_masjid_admin(_masjid_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.masjid_id = _masjid_id
      AND ur.auth_user_id = auth.uid()
      AND ur.role IN ('super_admin', 'co_admin')
  );
$$;

-- Update has_masjid_permission function
CREATE OR REPLACE FUNCTION public.has_masjid_permission(_masjid_id uuid, _key text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    public.is_masjid_admin(_masjid_id)
    OR coalesce(
      (SELECT (ur.permissions ->> _key)::boolean
       FROM public.user_roles ur
       WHERE ur.masjid_id = _masjid_id
         AND ur.auth_user_id = auth.uid()
       LIMIT 1),
      true
    )
  );
$$;

-- Update user_roles policies to use auth_user_id
DROP POLICY IF EXISTS user_roles_select_self ON public.user_roles;
CREATE POLICY user_roles_select_self
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS user_roles_bootstrap_owner ON public.user_roles;
CREATE POLICY user_roles_bootstrap_owner
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (masjid_id = auth.uid() AND auth_user_id = auth.uid() AND role = 'super_admin');

DROP POLICY IF EXISTS user_roles_select_admin ON public.user_roles;
CREATE POLICY user_roles_select_admin
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_masjid_admin(masjid_id));

DROP POLICY IF EXISTS user_roles_insert_admin ON public.user_roles;
CREATE POLICY user_roles_insert_admin
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_masjid_admin(masjid_id));

DROP POLICY IF EXISTS user_roles_update_admin ON public.user_roles;
CREATE POLICY user_roles_update_admin
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_masjid_admin(masjid_id))
WITH CHECK (public.is_masjid_admin(masjid_id));

DROP POLICY IF EXISTS user_roles_delete_admin ON public.user_roles;
CREATE POLICY user_roles_delete_admin
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_masjid_admin(masjid_id));

-- ============================================================
-- Step 6: Re-apply RLS for all tables to use auth_user_id
-- ============================================================

-- Re-apply masjids RLS
ALTER TABLE public.masjids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS masjids_select_tenant ON public.masjids;
CREATE POLICY masjids_select_tenant 
ON public.masjids 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur 
  WHERE ur.masjid_id = masjids.id 
  AND ur.auth_user_id = auth.uid()) 
  OR masjids.id = auth.uid()
);

DROP POLICY IF EXISTS masjids_upsert_admin ON public.masjids;
CREATE POLICY masjids_upsert_admin 
ON public.masjids 
FOR INSERT 
TO authenticated 
WITH CHECK (public.is_masjid_admin(id) OR id = auth.uid());

DROP POLICY IF EXISTS masjids_update_admin ON public.masjids;
CREATE POLICY masjids_update_admin 
ON public.masjids 
FOR UPDATE 
TO authenticated 
USING (public.is_masjid_admin(id) OR id = auth.uid()) 
WITH CHECK (public.is_masjid_admin(id) OR id = auth.uid());

-- Re-apply families RLS
DO $$
BEGIN
  IF to_regclass('public.families') IS NOT NULL THEN
    ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS families_select_tenant ON public.families;
    CREATE POLICY families_select_tenant ON public.families FOR SELECT TO authenticated USING (exists (SELECT 1 FROM public.user_roles ur WHERE ur.masjid_id = families.masjid_id AND ur.auth_user_id = auth.uid()));
    DROP POLICY IF EXISTS families_insert_perm ON public.families;
    CREATE POLICY families_insert_perm ON public.families FOR INSERT TO authenticated WITH CHECK (public.has_masjid_permission(masjid_id, 'members'));
    DROP POLICY IF EXISTS families_update_perm ON public.families;
    CREATE POLICY families_update_perm ON public.families FOR UPDATE TO authenticated USING (public.has_masjid_permission(masjid_id, 'members')) WITH CHECK (public.has_masjid_permission(masjid_id, 'members'));
    DROP POLICY IF EXISTS families_delete_perm ON public.families;
    CREATE POLICY families_delete_perm ON public.families FOR DELETE TO authenticated USING (public.has_masjid_permission(masjid_id, 'members'));
  END IF;
END $$;

-- Re-apply members RLS
DO $$
BEGIN
  IF to_regclass('public.members') IS NOT NULL THEN
    ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS members_select_tenant ON public.members;
    CREATE POLICY members_select_tenant ON public.members FOR SELECT TO authenticated USING (exists (SELECT 1 FROM public.user_roles ur WHERE ur.masjid_id = members.masjid_id AND ur.auth_user_id = auth.uid()));
    DROP POLICY IF EXISTS members_insert_perm ON public.members;
    CREATE POLICY members_insert_perm ON public.members FOR INSERT TO authenticated WITH CHECK (public.has_masjid_permission(masjid_id, 'members'));
    DROP POLICY IF EXISTS members_update_perm ON public.members;
    CREATE POLICY members_update_perm ON public.members FOR UPDATE TO authenticated USING (public.has_masjid_permission(masjid_id, 'members')) WITH CHECK (public.has_masjid_permission(masjid_id, 'members'));
    DROP POLICY IF EXISTS members_delete_perm ON public.members;
    CREATE POLICY members_delete_perm ON public.members FOR DELETE TO authenticated USING (public.has_masjid_permission(masjid_id, 'members'));
  END IF;
END $$;

-- Re-apply transactions RLS
DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL THEN
    ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS transactions_select_tenant ON public.transactions;
    CREATE POLICY transactions_select_tenant ON public.transactions FOR SELECT TO authenticated USING (exists (SELECT 1 FROM public.user_roles ur WHERE ur.masjid_id = transactions.masjid_id AND ur.auth_user_id = auth.uid()));
    DROP POLICY IF EXISTS transactions_insert_perm ON public.transactions;
    CREATE POLICY transactions_insert_perm ON public.transactions FOR INSERT TO authenticated WITH CHECK (public.has_masjid_permission(masjid_id, 'accounts'));
    DROP POLICY IF EXISTS transactions_update_perm ON public.transactions;
    CREATE POLICY transactions_update_perm ON public.transactions FOR UPDATE TO authenticated USING (public.has_masjid_permission(masjid_id, 'accounts')) WITH CHECK (public.has_masjid_permission(masjid_id, 'accounts'));
    DROP POLICY IF EXISTS transactions_delete_perm ON public.transactions;
    CREATE POLICY transactions_delete_perm ON public.transactions FOR DELETE TO authenticated USING (public.has_masjid_permission(masjid_id, 'accounts'));
  END IF;
END $$;

-- Re-apply events RLS
DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS events_select_tenant ON public.events;
    CREATE POLICY events_select_tenant ON public.events FOR SELECT TO authenticated USING (exists (SELECT 1 FROM public.user_roles ur WHERE ur.masjid_id = events.masjid_id AND ur.auth_user_id = auth.uid()));
    DROP POLICY IF EXISTS events_insert_perm ON public.events;
    CREATE POLICY events_insert_perm ON public.events FOR INSERT TO authenticated WITH CHECK (public.has_masjid_permission(masjid_id, 'events'));
    DROP POLICY IF EXISTS events_update_perm ON public.events;
    CREATE POLICY events_update_perm ON public.events FOR UPDATE TO authenticated USING (public.has_masjid_permission(masjid_id, 'events')) WITH CHECK (public.has_masjid_permission(masjid_id, 'events'));
    DROP POLICY IF EXISTS events_delete_perm ON public.events;
    CREATE POLICY events_delete_perm ON public.events FOR DELETE TO authenticated USING (public.has_masjid_permission(masjid_id, 'events'));
  END IF;
END $$;

-- Re-apply event_attendance RLS
DO $$
BEGIN
  IF to_regclass('public.event_attendance') IS NOT NULL THEN
    ALTER TABLE public.event_attendance ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS event_attendance_select_tenant ON public.event_attendance;
    CREATE POLICY event_attendance_select_tenant ON public.event_attendance FOR SELECT TO authenticated USING (exists (SELECT 1 FROM public.user_roles ur WHERE ur.masjid_id = event_attendance.masjid_id AND ur.auth_user_id = auth.uid()));
    DROP POLICY IF EXISTS event_attendance_insert_perm ON public.event_attendance;
    CREATE POLICY event_attendance_insert_perm ON public.event_attendance FOR INSERT TO authenticated WITH CHECK (public.has_masjid_permission(masjid_id, 'events'));
    DROP POLICY IF EXISTS event_attendance_update_perm ON public.event_attendance;
    CREATE POLICY event_attendance_update_perm ON public.event_attendance FOR UPDATE TO authenticated USING (public.has_masjid_permission(masjid_id, 'events')) WITH CHECK (public.has_masjid_permission(masjid_id, 'events'));
    DROP POLICY IF EXISTS event_attendance_delete_perm ON public.event_attendance;
    CREATE POLICY event_attendance_delete_perm ON public.event_attendance FOR DELETE TO authenticated USING (public.has_masjid_permission(masjid_id, 'events'));
  END IF;
END $$;

-- Re-apply service_distributions RLS
DO $$
BEGIN
  IF to_regclass('public.service_distributions') IS NOT NULL THEN
    ALTER TABLE public.service_distributions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS service_distributions_select_tenant ON public.service_distributions;
    CREATE POLICY service_distributions_select_tenant ON public.service_distributions FOR SELECT TO authenticated USING (exists (SELECT 1 FROM public.user_roles ur WHERE ur.masjid_id = service_distributions.masjid_id AND ur.auth_user_id = auth.uid()));
    DROP POLICY IF EXISTS service_distributions_insert_perm ON public.service_distributions;
    CREATE POLICY service_distributions_insert_perm ON public.service_distributions FOR INSERT TO authenticated WITH CHECK (public.has_masjid_permission(masjid_id, 'members'));
    DROP POLICY IF EXISTS service_distributions_update_perm ON public.service_distributions;
    CREATE POLICY service_distributions_update_perm ON public.service_distributions FOR UPDATE TO authenticated USING (public.has_masjid_permission(masjid_id, 'members')) WITH CHECK (public.has_masjid_permission(masjid_id, 'members'));
    DROP POLICY IF EXISTS service_distributions_delete_perm ON public.service_distributions;
    CREATE POLICY service_distributions_delete_perm ON public.service_distributions FOR DELETE TO authenticated USING (public.has_masjid_permission(masjid_id, 'members'));
  END IF;
END $$;

-- Re-apply employees RLS
DO $$
BEGIN
  IF to_regclass('public.employees') IS NOT NULL THEN
    ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS employees_select_tenant ON public.employees;
    CREATE POLICY employees_select_tenant ON public.employees FOR SELECT TO authenticated USING (exists (SELECT 1 FROM public.user_roles ur WHERE ur.masjid_id = employees.masjid_id AND ur.auth_user_id = auth.uid()));
    DROP POLICY IF EXISTS employees_write_admin ON public.employees;
    CREATE POLICY employees_write_admin ON public.employees FOR ALL TO authenticated USING (public.is_masjid_admin(masjid_id)) WITH CHECK (public.is_masjid_admin(masjid_id));
  END IF;
END $$;

-- Re-apply board_members RLS
DO $$
BEGIN
  IF to_regclass('public.board_members') IS NOT NULL THEN
    ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS board_members_select_tenant ON public.board_members;
    CREATE POLICY board_members_select_tenant ON public.board_members FOR SELECT TO authenticated USING (exists (SELECT 1 FROM public.user_roles ur WHERE ur.masjid_id = board_members.masjid_id AND ur.auth_user_id = auth.uid()));
    DROP POLICY IF EXISTS board_members_write_admin ON public.board_members;
    CREATE POLICY board_members_write_admin ON public.board_members FOR ALL TO authenticated USING (public.is_masjid_admin(masjid_id)) WITH CHECK (public.is_masjid_admin(masjid_id));
  END IF;
END $$;

-- ============================================================
-- Step 7: Also check for staff_commissions and salary_payments
-- ============================================================

-- Re-apply staff_commissions RLS (if exists)
DO $$
BEGIN
  IF to_regclass('public.staff_commissions') IS NOT NULL THEN
    ALTER TABLE public.staff_commissions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Staff can view their own commissions" 
    ON public.staff_commissions;
    CREATE POLICY "Staff can view their own commissions" 
    ON public.staff_commissions
    FOR SELECT
    TO authenticated
    USING (
      auth.uid() = staff_user_id 
      AND EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.auth_user_id = auth.uid() 
        AND user_roles.masjid_id = staff_commissions.masjid_id
      )
    );
    DROP POLICY IF EXISTS "Admins can manage staff_commissions" 
    ON public.staff_commissions;
    CREATE POLICY "Admins can manage staff_commissions" 
    ON public.staff_commissions
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.auth_user_id = auth.uid() 
        AND user_roles.masjid_id = staff_commissions.masjid_id
        AND user_roles.role IN ('super_admin', 'co_admin')
      )
    );
  END IF;
END $$;

-- Re-apply salary_payments RLS (if exists)
DO $$
BEGIN
  IF to_regclass('public.salary_payments') IS NOT NULL THEN
    ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Staff can view their own payments" 
    ON public.salary_payments;
    CREATE POLICY "Staff can view their own payments" 
    ON public.salary_payments
    FOR SELECT
    TO authenticated
    USING (
      auth.uid() = staff_user_id 
      AND EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.auth_user_id = auth.uid() 
        AND user_roles.masjid_id = salary_payments.masjid_id
      )
    );
    DROP POLICY IF EXISTS "Admins can manage salary_payments" 
    ON public.salary_payments;
    CREATE POLICY "Admins can manage salary_payments" 
    ON public.salary_payments
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.auth_user_id = auth.uid() 
        AND user_roles.masjid_id = salary_payments.masjid_id
        AND user_roles.role IN ('super_admin', 'co_admin')
      )
    );
  END IF;
END $$;
