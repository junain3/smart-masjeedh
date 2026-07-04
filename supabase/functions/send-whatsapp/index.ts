import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TriggerType =
  | "subscription_payment"
  | "subscription_due"
  | "donation"
  | "service_avail";

type AdditionalData = Record<string, unknown> | string | null | undefined;

interface WhatsAppPayload {
  member_id?: string;
  masjid_id?: string;
  trigger_type?: string;
  additional_data?: AdditionalData;
}

function parseAdditionalData(input: AdditionalData): Record<string, unknown> {
  if (!input) return {};

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return typeof parsed === "object" && parsed !== null ? parsed : { value: parsed };
    } catch {
      return { raw: input };
    }
  }

  if (typeof input === "object") {
    return input as Record<string, unknown>;
  }

  return { value: input };
}

function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const cleaned = phone.trim();
  if (!cleaned) return null;

  const digitsOnly = cleaned.replace(/\D/g, "");
  if (!digitsOnly) return null;

  if (cleaned.startsWith("+")) {
    const withoutPlus = cleaned.slice(1);
    if (withoutPlus.startsWith("94")) return `+${withoutPlus}`;
    if (withoutPlus.length === 9 && withoutPlus.startsWith("7")) return `+94${withoutPlus.slice(1)}`;
    return null;
  }

  if (cleaned.startsWith("0")) {
    return `+94${digitsOnly.slice(1)}`;
  }

  if (cleaned.startsWith("94")) {
    return `+${cleaned}`;
  }

  if (digitsOnly.length === 9 && digitsOnly.startsWith("7")) {
    return `+94${digitsOnly.slice(1)}`;
  }

  return null;
}

function buildMessage(
  triggerType: TriggerType,
  memberName: string,
  additionalData: Record<string, unknown>
): string {
  const amount = String(additionalData.amount ?? additionalData.Amount ?? "") || "";
  const description =
    String(additionalData.description ?? additionalData.reason ?? additionalData.service ?? "") || "";
  const dueDate =
    String(additionalData.due_date ?? additionalData.dueDate ?? additionalData.date ?? "") || "";

  const greeting = `Assalamu Alaikum ${memberName || "valued member"},`;

  switch (triggerType) {
    case "subscription_payment":
      return `${greeting} we have received your subscription payment${amount ? ` of ${amount}` : ""}${description ? ` for ${description}` : ""}. JazakAllah Khair.`;

    case "subscription_due":
      return `${greeting} your subscription payment${amount ? ` of ${amount}` : ""} is due${dueDate ? ` by ${dueDate}` : ""}. Please settle it at your earliest convenience.`;

    case "donation":
      return `${greeting} we have received your donation${amount ? ` of ${amount}` : ""}${description ? ` for ${description}` : ""}. Thank you for your generosity.`;

    case "service_avail":
      return `${greeting} your request for ${description || "the requested service"} has been received. We will get back to you soon.`;

    default:
      return `${greeting} you have a new update from Smart Masjeedh.`;
  }
}

async function updateLog(
  supabaseAdmin: ReturnType<typeof createClient>,
  logId: string | null,
  status: string,
  errorMessage: string | null = null
) {
  if (!logId) return;

  await supabaseAdmin
    .from("message_logs")
    .update({
      status,
      error_message: errorMessage,
    })
    .eq("id", logId);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  try {
    const requestBody = (await req.json().catch(() => null)) as WhatsAppPayload | null;

    if (!requestBody) {
      return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { member_id, masjid_id, trigger_type, additional_data } = requestBody;

    if (!member_id || !trigger_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: member_id and trigger_type." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: logRow, error: logError } = await supabaseAdmin
      .from("message_logs")
      .insert({
        member_id,
        trigger_type,
        status: "pending",
        error_message: null,
      })
      .select("id")
      .single();

    if (logError || !logRow?.id) {
      console.error("Failed to create message log", logError);
      return new Response(JSON.stringify({ error: "Could not create message log entry." }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: familyData, error: familyError } = await supabaseAdmin
      .from("families")
      .select("id, phone, head_name, masjid_id")
      .eq("id", member_id)
      .maybeSingle();

    if (familyError || !familyData) {
      await updateLog(supabaseAdmin, logRow.id, "failed", "Family record not found.");
      return new Response(JSON.stringify({ error: "Family record not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const normalizedPhone = normalizePhoneNumber(familyData.phone);
    if (!normalizedPhone) {
      await updateLog(supabaseAdmin, logRow.id, "failed", "No valid phone number available for the family.");
      return new Response(JSON.stringify({ error: "No valid phone number found for the family." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const effectiveMasjidId = masjid_id || familyData.masjid_id;

    if (!effectiveMasjidId) {
      await updateLog(supabaseAdmin, logRow.id, "failed", "Masjid ID is required for WhatsApp configuration.");
      return new Response(JSON.stringify({ error: "Masjid ID is required for WhatsApp configuration." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: whatsappConfig, error: whatsappConfigError } = await supabaseAdmin
      .from("whatsapp_configs")
      .select("api_key, phone_number_id")
      .eq("masjid_id", effectiveMasjidId)
      .maybeSingle();

    if (whatsappConfigError || !whatsappConfig?.api_key || !whatsappConfig?.phone_number_id) {
      await updateLog(supabaseAdmin, logRow.id, "failed", "WhatsApp configuration not found for this masjid.");
      return new Response(JSON.stringify({ error: "WhatsApp configuration not found for this masjid." }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const whatsappToken = whatsappConfig.api_key;
    const whatsappPhoneId = whatsappConfig.phone_number_id;

    const supportedTriggers: TriggerType[] = [
      "subscription_payment",
      "subscription_due",
      "donation",
      "service_avail",
    ];

    if (!supportedTriggers.includes(trigger_type as TriggerType)) {
      await updateLog(supabaseAdmin, logRow.id, "failed", "Unsupported trigger type.");
      return new Response(JSON.stringify({ error: "Unsupported trigger type." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const parsedAdditionalData = parseAdditionalData(additional_data);
    const message = buildMessage(
      trigger_type as TriggerType,
      familyData.head_name || "valued member",
      parsedAdditionalData
    );

    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizedPhone,
          type: "text",
          text: {
            body: message,
          },
        }),
      }
    );

    const whatsappData = await whatsappResponse.json().catch(() => null);

    if (!whatsappResponse.ok) {
      const errorMessage =
        typeof whatsappData?.error?.message === "string"
          ? whatsappData.error.message
          : "WhatsApp API request failed.";

      await updateLog(supabaseAdmin, logRow.id, "failed", errorMessage);
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          details: whatsappData,
        }),
        {
          status: whatsappResponse.status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    try {
      await supabaseAdmin.from("sms_logs").insert({
        masjid_id: familyData.masjid_id,
        phone_number: familyData.phone,
        message,
        status: "sent",
        created_by: familyData.id,
      });
    } catch (logError) {
      console.error("Failed to write sms_logs entry", logError);
    }

    await updateLog(supabaseAdmin, logRow.id, "sent", null);

    return new Response(
      JSON.stringify({
        success: true,
        message: "WhatsApp notification sent successfully.",
        phone: normalizedPhone,
        trigger_type: trigger_type,
        response: whatsappData,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("send-whatsapp failed", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
