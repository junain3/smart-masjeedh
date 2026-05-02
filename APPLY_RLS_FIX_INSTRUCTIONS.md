# Apply RLS Fix for family_subscription_payments

## To Apply This Migration:

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `fix_family_subscription_payments_rls.sql`
4. Click **Run** to execute the migration

### Option 2: Command Line
```bash
# If you have supabase CLI installed
supabase db push
# Or apply the SQL file directly
psql YOUR_CONNECTION_STRING -f fix_family_subscription_payments_rls.sql
```

## What This Migration Does:
1. ✅ Verifies current RLS status
2. ✅ Creates INSERT policy for family_subscription_payments
3. ✅ Creates UPDATE policy for family_subscription_payments  
4. ✅ Verifies policies were created successfully

## Expected Result:
- No more "new row violates row-level security policy" errors
- Users with proper permissions can add payments
- Payment status updates restricted to admins/approvers

## After Applying:
Test adding a payment of Rs. 100 from the phone to verify the fix works.
