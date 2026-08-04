import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { withCollectionSecurity } from "../middleware";
import { sendSms } from "@/lib/sms-utils";
import {
  buildCollectionRecordedSms,
  buildCollectionApprovedSms,
} from "@/lib/collection-utils";

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
    const userId = userContext?.userId;

    if (!userContext || !userId) {
      return NextResponse.json(
        { error: "User validation failed" },
        { status: 403 }
      );
    }

    const canCollect = Boolean(
      userContext.role === "super_admin" || userContext.permissions?.subscriptions_collect
    );
    if (!canCollect) {
      return NextResponse.json(
        { error: "Collection recording permission required" },
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

    const nowIso = new Date().toISOString();
    const resolvedDate =
      typeof date === "string" && date.trim()
        ? date.trim()
        : nowIso.split("T")[0];

    console.info("[collections/add] request received", {
      masjidId: userContext.masjidId,
      userId,
      resolvedFamilyId,
      amount,
      hasNotes: Boolean(notes),
    });

    const commissionPercent = Number(employee?.commission_percent ?? 0);
    const commissionAmount = (amount * commissionPercent) / 100;

    // First, resolve the family (used for SMS and masjid-scoped consistency checks)
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

    let collection: any;

    // Determine collection source based on user role
    // Admin direct collections go to pending queue as "admin_direct" for bulk approval
    // Regular collector collections go to pending queue as "collector"
    const isAdmin = Boolean(
      userContext.role === "super_admin" || userContext.role === "co_admin"
    );
    const collectionSource = isAdmin ? "admin_direct" : "collector";

    // All collections now go to pending queue for bulk approval
    // Admin collections are marked as "admin_direct" for separate tracking
    const pendingPayload: Record<string, any> = {
      masjid_id: userContext.masjidId,
      family_id: resolvedFamilyId,
      amount,
      commission_percent: commissionPercent,
      commission_amount: commissionAmount,
      notes: notes || null,
      date: resolvedDate,
      status: "pending",
      collected_by_user_id: userId,
      collector_employee_id: userContext.employeeId || null,
      collection_source: collectionSource,
    };

    const { data: insertedPending, error: pendingInsertError } = await supabaseAdmin
      .from("subscription_collections")
      .insert(pendingPayload)
      .select()
      .single();

    if (pendingInsertError || !insertedPending) {
      console.error("[collections/add] pending collection insert error:", pendingInsertError);
      return NextResponse.json(
        { error: "Failed to create collection record" },
        { status: 500 }
      );
    }
    collection = insertedPending;

    console.info("[collections/add] pending collection recorded", {
      collectionId: collection.id,
      masjidId: userContext.masjidId,
      familyId: resolvedFamilyId,
      status: collection.status,
      collectionSource,
    });

    // Send SMS notification if family has phone number — choose the template
    // that matches the actual final status of the collection so families receive
    // a correct, non-confusing confirmation.
    let smsResult: { success: boolean; error?: string } | null = null;
    if (familyData?.phone) {
      const isApproved = collection.status === "accepted";
      const message = isApproved
        ? buildCollectionApprovedSms(familyData.head_name, amount)
        : buildCollectionRecordedSms(familyData.head_name, amount);

      console.info("[collections/add] triggering auto SMS", {
        collectionId: collection.id,
        familyId: familyData.id,
        isApproved,
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
          console.error("[collections/add] auto SMS failed", {
            collectionId: collection.id,
            familyId: familyData.id,
            isApproved,
            phoneLength: familyData.phone.length,
            error: smsResult.error,
          });
        } else {
          console.info("[collections/add] auto SMS completed", {
            collectionId: collection.id,
            familyId: familyData.id,
            isApproved,
            smsResult,
          });
        }
      } catch (smsError) {
        console.error("[collections/add] auto SMS threw unexpectedly", {
          collectionId: collection.id,
          familyId: familyData.id,
          isApproved,
          smsError,
        });
        smsResult = {
          success: false,
          error: smsError instanceof Error ? smsError.message : "Unknown SMS error",
        };
      }
    } else {
      console.error("[collections/add] auto SMS skipped: missing family phone", {
        collectionId: collection.id,
        resolvedFamilyId,
        status: collection.status,
        familyFound: Boolean(familyData),
        familyError,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Collection recorded successfully and pending approval",
      collection: {
        id: collection.id,
        amount: collection.amount,
        commission_percent: collection.commission_percent,
        commission_amount: collection.commission_amount,
        date: collection.date,
        status: collection.status,
        collection_source: collection.collection_source,
      },
      staff_info: {
        employee_id: userContext.employeeId,
        commission_percent: commissionPercent,
        note: "Commission calculated from collected amount only",
      },
      sms_sent: smsResult ? { success: smsResult.success, error: smsResult.error } : null,
    });
  } catch (error: any) {
    console.error("Collection creation error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
});
