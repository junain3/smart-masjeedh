
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withCollectionSecurity } from "../../collections/middleware";
import { sendSms } from "@/lib/sms-utils";
import { buildEventReceivedSms } from "@/lib/event-utils";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const POST = withCollectionSecurity(async (request: NextRequest) => {
  try {
    const userContext = (request as any).userContext;
    const userId = userContext?.userId;

    const body = await request.json();
    const { eventId, filter = "all" } = body;

    if (!userContext || !userId || !eventId) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    console.info("[events/send-sms] request received", {
      masjidId: userContext.masjidId,
      userId,
      eventId,
      filter,
      hasSupabaseUrl: Boolean(SUPABASE_URL),
      hasServiceRoleKey: Boolean(SUPABASE_SERVICE_ROLE_KEY),
    });

    const isAdmin = userContext.role === "super_admin" || userContext.role === "co_admin";
    const canEvents = isAdmin || userContext.permissions?.events !== false;

    if (!canEvents) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get event details
    const { data: event, error: eventErr } = await supabaseAdmin
      .from("events")
      .select("title")
      .eq("id", eventId)
      .eq("masjid_id", userContext.masjidId)
      .single();

    if (eventErr || !event) {
      console.error("[events/send-sms] event lookup failed", {
        eventId,
        masjidId: userContext.masjidId,
        eventErr,
      });
      throw new Error("Event not found");
    }

    console.info("[events/send-sms] event loaded", {
      eventId,
      eventTitle: event.title,
    });

    // 2. Get families based on filter
    let familyQuery = supabaseAdmin
      .from("event_attendance")
      .select("families(id, head_name, phone)")
      .eq("event_id", eventId)
      .eq("masjid_id", userContext.masjidId);

    if (filter === "received") {
      familyQuery = familyQuery.eq("status", "Received");
    } else if (filter === "pending") {
      familyQuery = familyQuery.eq("status", "Pending");
    }

    const { data: familyAttendance, error: familyErr } = await familyQuery;

    if (familyErr) throw familyErr;

    console.info("[events/send-sms] attendance rows fetched", {
      eventId,
      filter,
      attendanceCount: familyAttendance?.length || 0,
    });

    // 3. Filter families with valid phone numbers
    const validFamilies = (familyAttendance || []).filter((fa: any) => fa.families?.phone && fa.families.phone.trim() !== "");
    const skippedFamilies = (familyAttendance || []).filter((fa: any) => !fa.families?.phone || fa.families.phone.trim() === "");

    if (skippedFamilies.length > 0) {
      console.error("[events/send-sms] families skipped due to missing phone", {
        eventId,
        skippedCount: skippedFamilies.length,
        skippedFamilyIds: skippedFamilies.map((fa: any) => fa.families?.id || null),
      });
    }

    if (validFamilies.length === 0) {
      console.error("[events/send-sms] no valid family phones found", {
        eventId,
        filter,
      });
      return NextResponse.json({
        success: true,
        sent: 0,
        skipped: 0,
        message: "No families with valid phone numbers found"
      });
    }

    // 4. Send SMS to each valid family
    let sentCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const fa of validFamilies) {
      const family = fa.families;
      const message = buildEventReceivedSms(family.head_name, event.title);

      try {
        console.info("[events/send-sms] sending SMS for family", {
          eventId,
          familyId: family.id,
          headName: family.head_name,
          phoneLength: family.phone?.length || 0,
          messageLength: message.length,
        });

        const smsResult = await sendSms(
          userContext.masjidId,
          family.phone,
          message,
          userId
        );

        if (!smsResult.success) {
          console.error("[events/send-sms] auto SMS failed", {
            eventId,
            familyId: family.id,
            headName: family.head_name,
            phoneLength: family.phone?.length || 0,
            error: smsResult.error,
          });
          throw new Error(smsResult.error || "Failed to send SMS");
        }

        console.info("[events/send-sms] SMS sent successfully", {
          eventId,
          familyId: family.id,
        });
        sentCount++;
      } catch (smsErr: any) {
        console.error("[events/send-sms] SMS send error", {
          eventId,
          familyId: family.id,
          headName: family.head_name,
          error: smsErr,
        });
        skippedCount++;
        errors.push(`${family.head_name}: ${smsErr.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error("Event send SMS error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Internal server error"
    }, { status: 500 });
  }
});
