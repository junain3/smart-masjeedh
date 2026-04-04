# 🚀 Production Reset Instructions

## ⚠️ IMPORTANT WARNING
- **This will DELETE ALL DATA** while keeping code intact
- **BACKUP your database** before proceeding
- **Run scripts in exact order** as specified below

---

## 📋 Step-by-Step Execution

### **Step 1: Database Backup**
```sql
-- Create a backup before proceeding
CREATE DATABASE mjm_backup_$(date +%Y%m%d_%H%M%S) 
WITH TEMPLATE mjm_production;
```

### **Step 2: Run Production Reset**
```bash
# Connect to your Supabase database
psql -h your-project.supabase.co -U postgres -d postgres

# Run the reset script
\i database/production-reset.sql
```

### **Step 3: Verify Reset**
```sql
-- Run verification checks
\i database/verification-checks.sql
```

### **Step 4: Sign Up as Super Admin**
1. Go to your application: `http://localhost:3000/register`
2. Sign up with: **Mohammedjunain@gmail.com**
3. Create your masjid profile
4. Complete registration

### **Step 5: Run Super Admin Setup**
```sql
-- Run this AFTER signing up
\i database/super-admin-setup.sql
```

### **Step 6: Final Verification**
```sql
-- Run final verification
\i database/verification-checks.sql
```

---

## 🔍 What Gets Cleared

### **Data Tables (TRUNCATED):**
- ✅ `masjids` - All masjid profiles
- ✅ `families` - All family records  
- ✅ `user_roles` - All user role assignments
- ✅ `invitations` - All invitation records
- ✅ `subscription_collections` - All payment collections
- ✅ `collector_commission_payments` - All commission payments
- ✅ `subscription_collector_profiles` - All collector profiles
- ✅ `subscription_history` - All subscription history
- ✅ `trial_extensions` - All trial extensions

### **What Gets Reset:**
- ✅ All ID sequences reset to 1
- ✅ Auto-increment counters reset
- ✅ UUID sequences reset

### **What Stays Intact:**
- ✅ **All code files** - No code changes
- ✅ **Database schema** - Table structure preserved
- ✅ **Trial system logic** - All functions intact
- ✅ **Super Admin bypass** - mohammedjunain@gmail.com protection
- ✅ **90-day trial logic** - Automatic expiry system
- ✅ **Staff Profile features** - All functionality preserved

---

## 🧪 Post-Reset Testing

### **Test 1: Super Admin Access**
1. Login as **Mohammedjunain@gmail.com**
2. Verify you have Super Admin access
3. Check that you're never locked by trial system

### **Test 2: Trial System**
1. Create a new user account
2. Verify 90-day trial starts automatically
3. Check trial status badge shows correct days
4. Verify lock screen appears after 90 days (simulate)

### **Test 3: Staff Management**
1. Add new staff members
2. Verify role-based permissions work
3. Test staff profile functionality
4. Check commission tracking works

### **Test 4: Subscription Renewal**
1. Go to trial admin panel
2. Test manual renewal functionality
3. Verify subscription end date updates
4. Check lock screen behavior

---

## 📊 Expected Results

### **After Reset:**
- All tables empty except `auth.users`
- All ID sequences start from 1
- Codebase 100% intact
- Trial system fully functional

### **After Super Admin Setup:**
- Mohammedjunain@gmail.com = Super Admin
- Linked to first masjid created
- 90-day trial period started
- Full system access granted

---

## 🚨 Troubleshooting

### **If Super Admin Setup Fails:**
```sql
-- Check if user exists
SELECT * FROM auth.users WHERE email = 'mohammedjunain@gmail.com';

-- Check if masjid exists
SELECT * FROM masjids ORDER BY created_at ASC LIMIT 1;
```

### **If Trial System Not Working:**
```sql
-- Check trial system columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'masjids';
```

### **If ID Sequences Not Reset:**
```sql
-- Check current sequence values
SELECT * FROM masjids_id_seq;
-- Reset manually if needed
ALTER SEQUENCE masjids_id_seq RESTART WITH 1;
```

---

## ✅ Production Readiness Checklist

- [ ] Database backed up
- [ ] Production reset script executed
- [ ] Verification checks passed
- [ ] Super Admin signed up
- [ ] Super Admin setup script executed
- [ ] Final verification passed
- [ ] Trial system tested
- [ ] Staff management tested
- [ ] Subscription renewal tested

---

## 🎯 Success Indicators

When everything is working correctly, you should see:

1. **Clean Database:** All tables empty except auth.users
2. **Super Admin Access:** Mohammedjunain@gmail.com has full access
3. **Trial System:** 90-day countdown works for new users
4. **Lock Screen:** Appears when subscriptions expire
5. **Staff Features:** All staff management functions work
6. **Renewal System:** Manual subscription renewals work

**🚀 Your system is now ready for production!**
