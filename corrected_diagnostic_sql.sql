-- CORRECTED DIAGNOSTIC SQL FOR EVENT CREATION DEBUG
-- Use correct column names for this project

-- Step 1: Get existing masjids (correct column name)
SELECT id, masjid_name, created_at
FROM public.masjids
ORDER BY created_at DESC
LIMIT 5;

-- Step 2: Get current user's roles
SELECT user_id, masjid_id, role, status, email
FROM public.user_roles
WHERE email = 'mohammedjunain@gmail.com';

-- Step 3: Verify the referenced masjid exists
SELECT id, masjid_name
FROM public.masjids
WHERE id IN (
  SELECT masjid_id
  FROM public.user_roles
  WHERE email = 'mohammedjunain@gmail.com'
);

-- Step 4: Check if user_roles masjid_id actually exists in masjids
SELECT 
    ur.user_id,
    ur.masjid_id as user_role_masjid_id,
    ur.email,
    ur.role,
    m.id as masjid_exists,
    m.masjid_name,
    CASE 
        WHEN m.id IS NULL THEN 'MASJID NOT FOUND - FOREIGN KEY VIOLATION'
        ELSE 'MASJID EXISTS - OK'
    END as status
FROM public.user_roles ur
LEFT JOIN public.masjids m ON ur.masjid_id = m.id
WHERE ur.email = 'mohammedjunain@gmail.com';
