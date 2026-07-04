# Quick Deployment Guide

## Step 1: Link Your Project
First, link your local project to your Supabase project:

```bash
# Get your project ref from Supabase Dashboard
# It's the URL segment: https://<project-ref>.supabase.co
npx supabase link --project-ref YOUR_PROJECT_REF
```

## Step 2: Deploy the Function
Once linked, deploy:

```bash
npx supabase functions deploy send-sms
```

## Troubleshooting:
- **Docker must be running** for deployment
- If you don't know your project ref, check your Supabase URL or Settings
