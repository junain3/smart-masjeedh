
# Arrears Reminders Setup Guide

## What's Been Created?
- A new edge function: `send-arrears-reminders` (supabase/functions/send-arrears-reminders/index.ts)
- This function automatically sends SMS reminders for pending arrears in January, June, and December

## How It Works
1. **Checks Current Month**: Only runs in Jan, Jun, Dec
2. **Gets All Masjids**: Filters to only masjids with SMS configured
3. **Calculates Arrears**: For each family:
   - Total paid = sum of accepted subscription collections
   - Total expected = opening balance + (subscription_amount × 12)
   - Pending arrears = max(0, total expected - total paid)
4. **Sends Reminders**: Uses existing send-sms edge function

## Setup Instructions

### Step 1: Deploy the Edge Function
In your terminal, run:
```bash
cd /path/to/Smart Masjeedh
supabase functions deploy send-arrears-reminders
```

### Step 2: Set Up the Scheduled Job in Supabase
1. Go to your Supabase dashboard → Edge Functions
2. Find `send-arrears-reminders`
3. Click "Add Trigger" → "Cron"
4. Set the schedule (example: "0 9 1 * *" for 9 AM on 1st day of every month)
5. Save

### Schedule Examples
- Every 1st of the month at 9 AM: `0 9 1 * *`
- Every Friday at 8 AM: `0 8 * * 5`

## Month-Specific SMS Templates
- **January**: New Year reminder with total arrears
- **June**: Mid-year reminder urging mosque development contributions
- **December**: Year-end final reminder to clear all dues

## Verification
After deploying, you can test the function:
1. Go to Supabase → Edge Functions → `send-arrears-reminders`
2. Click "Test"
3. Check the "Logs" tab to see if it runs successfully

## Notes
- This function only sends reminders to families that have a phone number in the database
- It uses the existing SMS configuration for each masjid
- It will not send messages if the pending arrears are zero
- It reuses the existing send-sms edge function, so no changes to SMS sending logic

