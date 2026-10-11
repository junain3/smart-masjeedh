-- Check user_roles table data to see if id column contains emails instead of UUIDs
SELECT id, email, masjid_id, user_id, role, status
FROM user_roles
LIMIT 10;

-- Check if any id values are not valid UUIDs
SELECT id, email
FROM user_roles
WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
LIMIT 10;
