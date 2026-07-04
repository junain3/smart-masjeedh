# WhatsApp Edge Function

This Edge Function accepts a payload with:
- member_id
- trigger_type
- additional_data

It looks up the member's family phone number, normalizes it to international format, selects a message template based on trigger_type, sends it via the WhatsApp Cloud API, and logs each attempt in the message_logs table.

Example payload:

```json
{
  "member_id": "<member-uuid>",
  "trigger_type": "subscription_payment",
  "additional_data": {
    "amount": "Rs. 500",
    "description": "monthly subscription"
  }
}
```

Required environment variables:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- WHATSAPP_TOKEN
- WHATSAPP_PHONE_NUMBER_ID

Required table:
- message_logs (member_id, trigger_type, status, error_message, created_at)
