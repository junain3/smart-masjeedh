-- FORCE DELETE WITH CASCADE - Nuclear Option
-- This will forcefully delete everything

-- Step 1: Disable constraints temporarily
ALTER TABLE transactions DISABLE TRIGGER ALL;
ALTER TABLE masjids DISABLE TRIGGER ALL;

-- Step 2: Force delete everything
DELETE FROM transactions WHERE masjid_id IN (
    SELECT id FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb'
);

DELETE FROM user_roles WHERE auth_user_id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

DELETE FROM invitations WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

DELETE FROM masjids WHERE created_by = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

DELETE FROM auth.users WHERE id = '6021e985-e8b9-44cb-b29d-e586d6f7d1fb';

-- Step 3: Re-enable constraints
ALTER TABLE transactions ENABLE TRIGGER ALL;
ALTER TABLE masjids ENABLE TRIGGER ALL;

-- Step 4: Verify deletion
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users WHERE email = 'mohammedjunain@gmail.com';
