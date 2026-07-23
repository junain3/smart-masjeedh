
// ========================================================
// SUPABASE EDGE FUNCTION: Send Arrears Reminders
// Scheduled function to send monthly arrears reminders
// ========================================================

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers for browser compatibility
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[send-arrears-reminders] Function started");

    // Get Supabase client with service role (for backend access)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get current month to determine which template to use
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();

    console.log(
      `[send-arrears-reminders] Current date: ${currentDate.toISOString()}, Month: ${currentMonth}`
    );

    // Only send reminders in January, June, and December
    if (![1, 6, 12].includes(currentMonth)) {
      console.log(
        "[send-arrears-reminders] Not a reminder month (only Jan, Jun, Dec). Exiting."
      );
      return new Response(
        JSON.stringify({
          success: true,
          message: "Not a reminder month (only Jan, Jun, Dec)",
          sent: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Step 1: Get all masjids (we'll process each masjid separately)
    const { data: masjids, error: masjidsError } = await supabaseAdmin
      .from("masjids")
      .select("id, sms_api_key, sms_sender_id, sms_provider_url, masjid_name")
      .not("sms_provider_url", "is", null)
      .not("sms_api_key", "is", null);

    if (masjidsError || !masjids || masjids.length === 0) {
      console.error(
        "[send-arrears-reminders] No masjids with SMS config found"
      );
      return new Response(
        JSON.stringify({
          success: false,
          message: "No masjids with SMS configuration found",
          sent: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(
      `[send-arrears-reminders] Found ${masjids.length} masjids with SMS config`
    );

    let totalSent = 0;
    let totalFailed = 0;

    // Step 2: Process each masjid
    for (const masjid of masjids) {
      console.log(
        `[send-arrears-reminders] Processing masjid: ${masjid.masjid_name} (${masjid.id})`
      );

      try {
        // Step 3: Get all families with phone numbers for this masjid
        const { data: families, error: familiesError } = await supabaseAdmin
          .from("families")
          .select("id, head_name, phone, subscription_amount, opening_balance")
          .eq("masjid_id", masjid.id)
          .not("phone", "is", null)
          .neq("phone", "");

        if (familiesError || !families || families.length === 0) {
          console.warn(
            `[send-arrears-reminders] No families found for masjid ${masjid.id}`
          );
          continue;
        }

        console.log(
          `[send-arrears-reminders] Found ${families.length} families with phone numbers for masjid ${masjid.id}`
        );

        // Step 4: For each family, calculate their pending arrears
        for (const family of families) {
          try {
            // Calculate total paid amount (accepted collections)
            const { data: acceptedCollections, error: collError } =
              await supabaseAdmin
                .from("subscription_collections")
                .select("amount")
                .eq("masjid_id", masjid.id)
                .eq("family_id", family.id)
                .eq("status", "accepted");

            const totalPaid = acceptedCollections?.reduce(
              (sum: number, coll: any) => sum + Number(coll.amount),
              0
            ) ?? 0;

            // Calculate total expected amount (based on subscription amount, if available)
            // Let's assume subscription is monthly, so total expected is subscription * 12 months
            const subscriptionAmount = Number(
              family.subscription_amount ?? 0
            );
            const openingBalance = Number(family.opening_balance ?? 0);
            const totalExpected = openingBalance + subscriptionAmount * 12; // 12 months of subscription + opening balance
            const pendingArrears = Math.max(0, totalExpected - totalPaid);

            // If arrears are zero, skip sending
            if (pendingArrears <= 0) {
              continue;
            }

            // Step 5: Determine which SMS template to use based on current month
            let message: string;
            if (currentMonth === 1) {
              // January: New Year reminder
              message =
                `அஸ்ஸலாமு அலைகும்! புத்தாண்டு வாழ்த்துக்கள்! ${family.head_name} அவர்களின் மீது ` +
                `ரூ.${pendingArrears.toLocaleString()} முன்பணி தொகை இருக்கிறது. ` +
                `தயவு செய்து விரைவில் செலுத்துங்கள்.`;
            } else if (currentMonth === 6) {
              // June: Mid-year reminder for mosque development
              message =
                `அஸ்ஸலாமு அலைகும்! அரைப்பண்டு ஆண்டு நிறைவு! ${family.head_name} அவர்களின் மீது ` +
                `ரூ.${pendingArrears.toLocaleString()} முன்பணி தொகை இருக்கிறது. ` +
                `மஸ்ஜித் வளர்ச்சிக்கு உதவி செய்ய தயவு செய்து விரைவில் செலுத்துங்கள்.`;
            } else {
              // December: Year-end final reminder
              message =
                `அஸ்ஸலாமு அலைகும்! ஆண்டு இறுதி நினைவூட்டல்! ${family.head_name} அவர்களின் மீது ` +
                `ரூ.${pendingArrears.toLocaleString()} முன்பணி தொகை இருக்கிறது. ` +
                `தயவு செய்து ஆண்டு இறுதிக்குள் செலுத்தி முடிக்கவும்.`;
            }

            // Step 6: Create sms_logs entry
            const { data: smsLog, error: logError } = await supabaseAdmin
              .from("sms_logs")
              .insert({
                masjid_id: masjid.id,
                phone_number: family.phone,
                message: message,
                status: "pending",
              })
              .select("id")
              .single();

            if (logError || !smsLog) {
              console.error(
                `[send-arrears-reminders] Failed to create SMS log for family ${family.id}:`,
                logError
              );
              totalFailed++;
              continue;
            }

            // Step 7: Send SMS using the existing send-sms function
            const sendSmsResponse = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get(
                    "SUPABASE_SERVICE_ROLE_KEY"
                  )}`,
                  apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
                },
                body: JSON.stringify({ log_id: smsLog.id }),
              }
            );

            if (sendSmsResponse.ok) {
              totalSent++;
              console.log(
                `[send-arrears-reminders] Successfully sent reminder to family ${family.id}`
              );
            } else {
              totalFailed++;
              const failureBody = await sendSmsResponse.text();
              console.error(
                `[send-arrears-reminders] Failed to send reminder to family ${family.id}:`,
                {
                  masjidId: masjid.id,
                  familyId: family.id,
                  smsLogId: smsLog.id,
                  status: sendSmsResponse.status,
                  responseBody: failureBody,
                }
              );
            }
          } catch (familyErr) {
            console.error(
              `[send-arrears-reminders] Error processing family ${family.id}:`,
              familyErr
            );
            totalFailed++;
          }
        }
      } catch (masjidErr) {
        console.error(
          `[send-arrears-reminders] Error processing masjid ${masjid.id}:`,
          masjidErr
        );
      }
    }

    console.log(
      `[send-arrears-reminders] Complete! Sent: ${totalSent}, Failed: ${totalFailed}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Reminder process complete",
        sent: totalSent,
        failed: totalFailed,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (globalError) {
    console.error(
      "[send-arrears-reminders] Unexpected global error:",
      globalError
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        sent: 0,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

