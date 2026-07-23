# Debug Session: auto-sms-failures

- Status: OPEN
- Date: 2026-07-22
- Scope:
  - [app/api/collections/add/route.ts](file:///C:/Smart%20Masjeedh/app/api/collections/add/route.ts)
  - [app/api/collections/approve-single/route.ts](file:///C:/Smart%20Masjeedh/app/api/collections/approve-single/route.ts)
  - [app/api/events/send-sms/route.ts](file:///C:/Smart%20Masjeedh/app/api/events/send-sms/route.ts)
  - [lib/sms-utils.ts](file:///C:/Smart%20Masjeedh/lib/sms-utils.ts)
  - [supabase/functions/send-sms/index.ts](file:///C:/Smart%20Masjeedh/supabase/functions/send-sms/index.ts)

## Symptoms
- Manual SMS trigger works.
- Automatic SMS triggers do not send for collection add, collection approval, or event/arrears flows.

## Initial Hypotheses
1. Route-level SMS failures are caught but not logged with enough context.
2. Family phone data is empty or mismatched in one or more automatic paths.
3. Server-side `sendSms()` auth/env setup differs from manual trigger behavior.
4. Automatic paths succeed on DB writes but fail on follow-up SMS calls.
5. One or more auto-trigger paths never execute because the relevant route is not the path actually used by the UI.

## Evidence Plan
- Inspect all current auto-SMS entry points.
- Add instrumentation-only `console.error` / `console.info` around:
  - trigger entry
  - phone lookup results
  - SMS utility invocation
  - SMS utility response
  - caught exceptions
- Reproduce and compare logs.

## Notes
- No business logic changes before instrumentation.
