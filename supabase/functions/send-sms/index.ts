// ========================================================
// SUPABASE EDGE FUNCTION: Send SMS (log-based processing)
// ========================================================
//
// Architecture:
// 1. Frontend inserts into sms_logs with status = "pending"
// 2. Frontend calls this Edge Function with log_id
// 3. This function processes it, updates log status
//
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
    console.log("[send-sms] Function started");
    
    // Validate request method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Parse request body - now accepts log_id only!
    let requestBody: { log_id: string };
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error("[send-sms] Invalid JSON in request body");
      return new Response(
        JSON.stringify({ error: "Invalid request body. Must be valid JSON with 'log_id'." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate log_id is provided
    const { log_id } = requestBody;
    if (!log_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: 'log_id'" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get Supabase client with service role (for backend access)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get authorization header for user or service-role validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const isServiceRoleCall =
      Boolean(serviceRoleKey) && token === serviceRoleKey;

    let user: { id: string } | null = null;

    if (isServiceRoleCall) {
      console.log(
        `[send-sms] Service-role automated send for log: ${log_id}`
      );
    } else {
      // Validate user session for manual/browser-triggered sends
      const {
        data: { user: authUser },
        error: authError,
      } = await supabaseAdmin.auth.getUser(token);

      if (authError || !authUser) {
        console.error("[send-sms] Invalid authentication:", authError);
        return new Response(
          JSON.stringify({ error: "Invalid authentication token" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      user = authUser;
      console.log(`[send-sms] Processing log: ${log_id} for user: ${user.id}`);
    }

    // ========================================================
    // Step 1: Fetch the sms_logs entry by log_id
    // ========================================================
    const { data: smsLog, error: logFetchError } = await supabaseAdmin
      .from("sms_logs")
      .select("*")
      .eq("id", log_id)
      .single();

    if (logFetchError || !smsLog) {
      console.error("[send-sms] Failed to fetch SMS log:", logFetchError);
      return new Response(
        JSON.stringify({ error: "Failed to locate SMS log entry" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // ========================================================
    // Step 2: Verify user has access to this masjid (skip for automated sends)
    // ========================================================
    if (!isServiceRoleCall && user) {
      const { data: userRole, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .select("id, role")
        .eq("auth_user_id", user.id)
        .eq("masjid_id", smsLog.masjid_id)
        .single();

      if (roleError || !userRole) {
        console.error("[send-sms] User access denied for masjid:", {
          user_id: user.id,
          masjid_id: smsLog.masjid_id,
        });
        return new Response(
          JSON.stringify({
            error: "Unauthorized: You do not have access to this masjid's SMS.",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Verify role has permission to send SMS
      const allowedRoles = ["super_admin", "admin", "co_admin"];
      if (!allowedRoles.includes(userRole.role)) {
        console.error("[send-sms] User has insufficient permissions:", userRole.role);
        return new Response(
          JSON.stringify({
            error: "Unauthorized: You do not have permission to send SMS.",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // ========================================================
    // Step 3: Fetch SMS configuration from masjids table
    // ========================================================
    const { data: masjidConfig, error: configError } = await supabaseAdmin
      .from("masjids")
      .select("sms_api_key, sms_sender_id, sms_provider_url")
      .eq("id", smsLog.masjid_id)
      .single();

    if (configError || !masjidConfig) {
      console.error("[send-sms] Failed to fetch masjid config:", configError);
      return new Response(
        JSON.stringify({ error: "Failed to retrieve SMS configuration for masjid" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // ========================================================
    // Step 4: Validate configuration exists
    // ========================================================
    const { sms_api_key, sms_sender_id, sms_provider_url } = masjidConfig;
    if (!sms_api_key || !sms_sender_id || !sms_provider_url) {
      const missing = [];
      if (!sms_api_key) missing.push("API key");
      if (!sms_sender_id) missing.push("Sender ID");
      if (!sms_provider_url) missing.push("Provider URL");
      
      console.error("[send-sms] SMS configuration missing:", {
        missing,
        masjid_id: smsLog.masjid_id
      });

      // Mark log as failed!
      await supabaseAdmin
        .from("sms_logs")
        .update({
          status: "failed",
          provider_response: `SMS configuration missing: ${missing.join(", ")}`,
          updated_at: new Date().toISOString()
        })
        .eq("id", log_id);

      return new Response(
        JSON.stringify({
          error: `SMS configuration missing for masjid. Please set up your provider first.`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // ========================================================
    // Step 5: Send SMS using provider API
    // ========================================================
    let providerResponse;
    try {
      console.log(`[send-sms] Sending SMS to: ${smsLog.phone_number}`);
      console.log(`[send-sms] Provider URL: ${sms_provider_url}`);
      
      // Check if this is textit.biz (uses GET with query params)
      if (sms_provider_url.includes('textit.biz')) {
        // For textit.biz: format is https://textit.biz/sendmsg/?id=USER&pw=PASS&text=MESSAGE&to=PHONE
        const url = new URL(sms_provider_url);
        // Split API key into id and pw (assume format "username:password")
        const [id, pw] = sms_api_key.split(':');
        
        url.searchParams.set('id', id || sms_api_key); // fallback if no colon
        url.searchParams.set('pw', pw || '');
        url.searchParams.set('text', smsLog.message);
        url.searchParams.set('to', smsLog.phone_number);
        if (sms_sender_id) {
          url.searchParams.set('sender', sms_sender_id);
        }
        
        console.log(`[send-sms] Textit.biz URL: ${url.toString()}`);
        
        providerResponse = await fetch(url.toString(), {
          method: "GET"
        });
      } else {
        // For other providers: use JSON POST
        const smsPayload = {
          to: smsLog.phone_number,
          message: smsLog.message,
          sender_id: sms_sender_id
        };

        providerResponse = await fetch(sms_provider_url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${sms_api_key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(smsPayload)
        });
      }

      // Parse the response (or get text if not JSON)
      let responseText;
      try {
        responseText = await providerResponse.text();
      } catch (err) {
        responseText = `Status: ${providerResponse.status}`;
      }

      // Check if it failed
      if (!providerResponse.ok) {
        console.error("[send-sms] SMS provider returned error:", {
          status: providerResponse.status,
          response: responseText
        });

        // Mark log as failed with error
        await supabaseAdmin
          .from("sms_logs")
          .update({
            status: "failed",
            provider_response: responseText,
            updated_at: new Date().toISOString()
          })
          .eq("id", log_id);

        return new Response(
          JSON.stringify({
            error: `SMS provider returned error: ${providerResponse.status}`,
          }),
          {
            status: providerResponse.status,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // ========================================================
      // Success! Update log to 'sent'!
      // ========================================================
      await supabaseAdmin
        .from("sms_logs")
        .update({
          status: "sent",
          provider_response: responseText,
          updated_at: new Date().toISOString()
        })
        .eq("id", log_id);

      console.log(`[send-sms] SMS successfully sent! Log: ${log_id}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "SMS sent successfully",
          log_id: log_id,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );

    } catch (networkError) {
      console.error("[send-sms] Network error calling SMS provider:", networkError);
      
      // Mark log as failed!
      const errorMsg = networkError instanceof Error 
        ? networkError.message 
        : String(networkError);
        
      await supabaseAdmin
        .from("sms_logs")
        .update({
          status: "failed",
          provider_response: `Network error: ${errorMsg}`,
          updated_at: new Date().toISOString()
        })
        .eq("id", log_id);

      return new Response(
        JSON.stringify({
          error: "Network error connecting to SMS provider. Please check your provider URL.",
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

  } catch (globalError) {
    console.error("[send-sms] Unexpected error:", globalError);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
