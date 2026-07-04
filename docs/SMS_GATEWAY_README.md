# Multi-Tenant SMS Gateway System - Complete Setup Guide

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Smart Masjeedh Platform                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  Frontend (Next.js)                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐│  │
│  │  │  /settings/sms - Admin UI                                            ││  │
│  │  │  - SMS Configuration (API Key, Sender, URL)                          ││  │
│  │  │  - Send SMS Form                                                      ││  │
│  │  │  - SMS Logs Viewer                                                    ││  │
│  │  └─────────────────────────────────────────────────────────────────────┘│  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                          │                                                       │
│                          ▼                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  Supabase Edge Function: send-sms                                         │  │
│  │  - Accepts log_id only! No sensitive data from frontend                  │  │
│  │  - Fetches config, validates permissions, calls provider                 │  │
│  │  - Updates sms_logs status (pending → sent/failed)                       │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                          │                                                       │
│                          ▼                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database (Supabase)                                           │  │
│  │  ┌───────────────────────────────────────────────────────────────────┐ │  │
│  │  │ masjids table: SMS configuration columns                          │ │  │
│  │  │ - sms_api_key (secure, never exposed!)                            │ │  │
│  │  │ - sms_sender_id                                                    │ │  │
│  │  │ - sms_provider_url                                                 │ │  │
│  │  │ - sms_updated_at                                                   │ │  │
│  │  └───────────────────────────────────────────────────────────────────┘ │  │
│  │  ┌───────────────────────────────────────────────────────────────────┐ │  │
│  │  │ sms_logs table: Audit & processing                               │ │  │
│  │  │ - id (uuid pk)                                                    │ │  │
│  │  │ - masjid_id (fk → masjids)                                       │ │  │
│  │  │ - phone_number                                                    │ │  │
│  │  │ - message                                                         │ │  │
│  │  │ - status: pending|sent|failed                                      │ │  │
│  │  │ - provider_response                                                │ │  │
│  │  │ - created_by                                                      │ │  │
│  │  │ - created_at, updated_at                                          │ │  │
│  │  └───────────────────────────────────────────────────────────────────┘ │  │
│  │  RLS: Strict tenant isolation!                                           │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                          │                                                       │
│                          ▼                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  External SMS Provider (Twilio, Plivo, Local API, etc.)                  │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Step 1: Database Setup

1. Open Supabase → SQL Editor
2. Run the migration script from:
   ```
   supabase/complete_sms_system.sql
   ```

This script will:
- Add SMS configuration columns to the `masjids` table
- Create the `sms_logs` table with audit capabilities
- Enable RLS on both tables
- Create strict tenant isolation policies
- Add automatic `updated_at` triggers

---

## 📋 Step 2: Deploy Edge Function

From your project directory:

```bash
cd supabase

# Deploy the send-sms function
supabase functions deploy send-sms

# (Optional) Test locally:
# supabase functions serve send-sms
```

---

## 📋 Step 3: Configure Your SMS Provider

1. Log in to Smart Masjeedh as an Admin
2. Go to Settings → SMS Gateway
3. Enter your provider details:

| Field | Description |
|-------|-------------|
| **SMS Provider API Key** | Your secret API key from provider |
| **Sender ID / Name** | What appears as sender (your masjid name) |
| **SMS Provider API URL** | The provider's API endpoint for sending SMS |

---

## 📋 Step 4: Send Test SMS

From the same SMS Gateway page:
1. Enter phone number (international format, e.g., +1234567890)
2. Type your message
3. Click **Send SMS**
4. Check the SMS Logs section to see status update!

---

## 🔌 Supported SMS Providers

This system works with **any JSON-based SMS API provider**! The payload format is:

```json
{
  "to": "+1234567890",
  "message": "Your message here",
  "sender_id": "Your Masjid Name"
}
```

**Popular providers that work out of the box:**
- Twilio (with minor payload adjustments if needed)
- Plivo
- Nexmo/Vonage
- Most local/regional SMS API providers

**Need to adapt to a different payload format?**
Modify the `smsPayload` in `supabase/functions/send-sms/index.ts` to match your provider's API specification.

---

## 🔐 Security Features

### 1. **Zero Exposure of Credentials**
- API keys are **never** sent to frontend
- Only Edge Function uses Service Role key to access config
- Frontend only inserts log entries and calls function with log_id

### 2. **Strict Tenant Isolation**
- Every table has RLS policies scoped to masjid_id
- Users can only access their own masjid's data
- API calls are validated against user's role and masjid membership

### 3. **Role-Based Access**
- Only `super_admin`, `admin`, `co_admin` can send SMS
- Other roles can't even insert into sms_logs

### 4. **Comprehensive Audit**
- Every SMS is logged with:
  - Who sent it (created_by)
  - When it was sent
  - Status (pending/sent/failed)
  - Provider's full response
  - Timestamps

---

## 📊 SMS Logs Statuses

| Status | Meaning |
|--------|---------|
| 📋 **pending** | Log created, waiting for processing |
| ✅ **sent** | Successfully delivered via provider |
| ❌ **failed** | Failed - check provider_response for error details |

---

## 🚀 Production Checklist

1. [ ] Run the SQL migration
2. [ ] Deploy the Edge Function
3. [ ] Configure your provider in /settings/sms
4. [ ] Send a test SMS and verify in logs
5. [ ] Set up backup for sms_logs (optional but recommended)

---

## 📂 Key Files

| File | Location | Purpose |
|------|----------|---------|
| **SQL Migration** | `supabase/complete_sms_system.sql` | Database setup |
| **Edge Function** | `supabase/functions/send-sms/index.ts` | SMS processing |
| **Admin UI** | `app/settings/sms/page.tsx` | Configuration & sending UI |

---

## ❓ Troubleshooting

### **"SMS configuration missing" error**
Make sure you have entered API Key, Sender ID, and Provider URL in Settings → SMS Gateway.

### **"Unauthorized" error**
Ensure your user role is `super_admin`, `admin`, or `co_admin` and you belong to the masjid.

### **"Failed to send SMS" (provider)**
Check the Provider Response column in SMS Logs - this will show your provider's specific error message.

### **Logs not updating?**
Click the **Refresh** button in the SMS Logs section.

---

## 🎉 All Set!

Your multi-tenant SMS gateway is now production-ready! 🎊
