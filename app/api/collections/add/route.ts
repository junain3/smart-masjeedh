import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { withCollectionSecurity } from "../middleware";
import { sendSms } from "@/lib/sms-utils";
import { buildCollectionRecordedSms } from "@/lib/collection-utils";

export const POST = withCollectionSecurity(async (request: NextRequest) => {
  try {
    const {
      family_id,
      member_id,
      subscription_id,
      collection_amount,
      notes = "",
      date,
    } = await request.json();

    const userContext = (request as any).userContext;
    const employee = (request as any).employee;

    if (!userContext) {
      return NextResponse.json(
        { error: "User validation failed" },
        { status: 403 }
      );
    }

    const resolvedFamilyId = family_id || member_id;
    const amount = Number(collection_amount);

    if (!resolvedFamilyId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Family/member and a valid collection amount are required" },
        { status: 400 }
      );
    }

    console.info("[collections/add] request received", {
      masjidId: userContext.masjidId,
      userId: userContext.userId,
      resolvedFamilyId,
      amount,
      hasNotes: Boolean(notes),
    });

    const commissionPercent = Number(employee?.commission_percent ?? 0);
    const commissionAmount = (amount * commissionPercent) / 100;

    const insertPayload: Record<string, any> = {
      masjid_id: userContext.masjidId,
      family_id: resolvedFamilyId,
      amount,
      commission_percent: commissionPercent,
      commission_amount: commissionAmount,
      notes: notes || null,
      date:
        typeof date === "string" && date.trim()
          ? date.trim()
          : new Date().toISOString().split("T")[0],
      status: "pending",
      collected_by_user_id: userContext.userId,
      collector_employee_id: userContext.employeeId || null,
    };

    // First, get the family information to send SMS
    const { data: familyData, error: familyError } = await supabaseAdmin
      .from("families")
      .select("id, head_name, phone")
      .eq("id", resolvedFamilyId)
      .eq("masjid_id", userContext.masjidId)
      .single();

    if (familyError) {
      console.error("[collections/add] family lookup failed", {
        masjidId: userContext.masjidId,
        resolvedFamilyId,
        familyError,
      });
    } else {
      console.info("[collections/add] family lookup result", {
        masjidId: userContext.masjidId,
        resolvedFamilyId,
        familyFound: Boolean(familyData),
        headName: familyData?.head_name || null,
        phonePresent: Boolean(familyData?.phone),
        phoneLength: familyData?.phone?.length || 0,
      });
    }

    const { data: collection, error: insertError } = await supabaseAdmin
      .from("subscription_collections")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error("Error creating collection:", insertError);
      return NextResponse.json(
        { error: "Failed to create collection record" },
        { status: 500 }
      );
    }

    console.info("[collections/add] collection insert success", {
      collectionId: collection.id,
      masjidId: userContext.masjidId,
      familyId: resolvedFamilyId,
      status: collection.status,
    });

    // Send SMS notification if family has phone number
    let smsResult: { success: boolean; error?: string } | null = null;
    if (familyData?.phone) {
      const message = buildCollectionRecordedSms(familyData.head_name, amount);
      console.info("[collections/add] triggering auto SMS", {
        collectionId: collection.id,
        familyId: familyData.id,
        phoneLength: familyData.phone.length,
        messageLength: message.length,
      });

      try {
        smsResult = await sendSms(
          userContext.masjidId,
          familyData.phone,
          message,
          userContext.userId
        );
        if (!smsResult.success) {
          console.error("[collections/add] auto SMS failed", {
            collectionId: collection.id,
            familyId: familyData.id,
            phoneLength: familyData.phone.length,
            error: smsResult.error,
          });
        } else {
          console.info("[collections/add] auto SMS completed", {
            collectionId: collection.id,
            familyId: familyData.id,
            smsResult,
          });
        }
      } catch (smsError) {
        console.error("[collections/add] auto SMS threw unexpectedly", {
          collectionId: collection.id,
          familyId: familyData.id,
          smsError,
        });
      }
    } else {
      console.error("[collections/add] auto SMS skipped: missing family phone", {
        collectionId: collection.id,
        resolvedFamilyId,
        familyFound: Boolean(familyData),
        familyError,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Collection recorded successfully",
      collection: {
        id: collection.id,
        amount: collection.amount,
        commission_percent: collection.commission_percent,
        commission_amount: collection.commission_amount,
        date: collection.date,
        status: collection.status,
      },
      staff_info: {
        employee_id: userContext.employeeId,
        commission_percent: commissionPercent,
        note: "Commission calculated from collected amount only",
      },
      sms_sent: smsResult ? { success: smsResult.success, error: smsResult.error } : null,
    });
  } catch (error) {
    console.error("Collection creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
