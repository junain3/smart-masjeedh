# Supabase Edge Function Deployment Guide

## Prerequisites

1. **Docker Desktop must be running**
2. **Supabase CLI must be installed** and authenticated
3. **Project linked to your Supabase project**

## Deployment Steps

1. **Navigate to the project root:**
   ```bash
   cd "c:\Smart Masjeedh"
   ```

2. **Deploy the send-sms function:**
   ```bash
   npx supabase functions deploy send-sms
   ```

## Verification

After deployment, you can verify by checking your Supabase Dashboard → Edge Functions.

## Troubleshooting

### Docker not running?
Make sure Docker Desktop is running and available in your system.

### "No such file or directory"?
Verify your folder structure is exactly:
```
supabase/
├── config.toml
└── functions/
    └── send-sms/
        └── index.ts
```
