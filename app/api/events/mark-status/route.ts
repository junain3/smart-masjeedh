import { NextRequest, NextResponse } from "next/server";
import { withCollectionSecurity } from "../../collections/middleware";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendSms } from "@/lib/sms-utils";
import { buildEventReceivedSms } from "@/lib/event-utils";

export const POST = withCollectionSecurity(async (request: NextRequest) => {
  try {
    const userContext = (request as any).userContext;
    const userId = userContext?.userId;

    const { eventId, familyId, status, familyCode = "" } = await request.json();

    if (!userContext || !userId || !eventId || !familyId) {
      return NextResponse.json(
        { error: "Event ID and family ID are required" },
        { status: 400 }
      );
    }

    if (status !== "Received" && status !== "Pending") {
      return NextResponse.json(
        { error: "Status must be Received or Pending" },
        { status: 400 }
      );
    }

    const isAdmin =
      userContext.role === "super_admin" || userContext.role === "co_admin";
    const canEvents = isAdmin || userContext.permissions?.events !== false;

    if (!canEvents) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    console.info("[events/mark-status] request received", {
      masjidId: userContext.masjidId,
      userId,
      eventId,
      familyId,
      status,
    });

    const { data: event, error: eventErr } = await supabaseAdmin
      .from("events")
      .select("id, title, event_date")
      .eq("id", eventId)
      .eq("masjid_id", userContext.masjidId)
      .single();

    if (eventErr || !event) {
      console.error("[events/mark-status] event lookup failed", {
        eventId,
        masjidId: userContext.masjidId,
        eventErr,
      });
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const { data: familyData, error: familyErr } = await supabaseAdmin
      .from("families")
      .select("id, head_name, phone")
      .eq("id", familyId)
      .eq("masjid_id", userContext.masjidId)
      .single();

    if (familyErr) {
      console.error("[events/mark-status] family lookup failed", {
        familyId,
        masjidId: userContext.masjidId,
        familyErr,
      });
    }

    const { error: attendanceError } = await supabaseAdmin
      .from("event_attendance")
      .update({ status })
      .eq("event_id", eventId)
      .eq("family_id", familyId)
      .eq("masjid_id", userContext.masjidId);

    if (attendanceError) {
      console.error("[events/mark-status] attendance update failed", attendanceError);
      return NextResponse.json(
        { error: "Failed to update event attendance" },
        { status: 500 }
      );
    }

    const serviceName = `Event: ${event.title}`;
    const serviceDate =
      event.event_date || new Date().toISOString().split("T")[0];

    const { data: existingService } = await supabaseAdmin
      .from("service_distributions")
      .select("id")
      .eq("family_id", familyId)
      .eq("masjid_id", userContext.masjidId)
      .eq("name", serviceName)
      .eq("date", serviceDate)
      .limit(1)
      .maybeSingle();

    if (existingService?.id) {
      const { error: serviceUpdateErr } = await supabaseAdmin
        .from("service_distributions")
        .update({ status })
        .eq("id", existingService.id)
        .eq("masjid_id", userContext.masjidId);

      if (serviceUpdateErr) {
        console.error(
          "[events/mark-status] service distribution update failed",
          serviceUpdateErr
        );
      }
    } else if (status === "Received") {
      const { error: serviceInsertErr } = await supabaseAdmin
        .from("service_distributions")
        .insert({
          family_id: familyId,
          masjid_id: userContext.masjidId,
          name: serviceName,
          date: serviceDate,
          status,
        });

      if (serviceInsertErr) {
        console.error(
          "[events/mark-status] service distribution insert failed",
          serviceInsertErr
        );
      }
    }

    if (status === "Received") {
      const { error: txErr } = await supabaseAdmin.from("transactions").insert({
        masjid_id: userContext.masjidId,
        family_id: familyId,
        amount: 0,
        description: `Event: ${event.title} (${familyCode || ""})`,
        type: "income",
        category: `Event: ${event.title}`,
        date: serviceDate,
      });

      if (txErr) {
        console.error("[events/mark-status] transaction insert failed", txErr);
      }
    }

    let smsResult: { success: boolean; error?: string } | null = null;
    if (status === "Received" && familyData?.phone) {
      const message = buildEventReceivedSms(familyData.head_name, event.title);
      console.info("[events/mark-status] triggering auto SMS", {
        eventId,
        familyId: familyData.id,
        phoneLength: familyData.phone.length,
        messageLength: message.length,
      });

      try {
        smsResult = await sendSms(
          userContext.masjidId,
          familyData.phone,
          message,
          userId
        );

        if (!smsResult.success) {
          console.error("[events/mark-status] auto SMS failed", {
            eventId,
            familyId: familyData.id,
            error: smsResult.error,
          });
        } else {
          console.info("[events/mark-status] auto SMS completed", {
            eventId,
            familyId: familyData.id,
          });
        }
      } catch (smsError) {
        console.error("[events/mark-status] auto SMS threw unexpectedly", {
          eventId,
          familyId: familyData.id,
          smsError,
        });
      }
    } else if (status === "Received") {
      console.error("[events/mark-status] auto SMS skipped: missing family phone", {
        eventId,
        familyId,
        familyFound: Boolean(familyData),
        familyErr,
      });
    }

    return NextResponse.json({
      success: true,
      status,
      sms_sent: smsResult
        ? { success: smsResult.success, error: smsResult.error }
        : null,
    });
  } catch (error) {
    console.error("[events/mark-status] unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
