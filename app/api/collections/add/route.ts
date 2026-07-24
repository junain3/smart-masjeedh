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

    // Auto-approve when the caller has approval permission (admins, super admins,
    // or users explicitly granted subscriptions_approve). Collections recorded
    // directly from the Collections or Accounts pages by these users bypass the
    // pending queue and are credited immediately.
    const canApprove = Boolean(
      userContext.role === "super_admin" || userContext.permissions?.subscriptions_approve
    );

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
      canApprove,
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
    let mainTransactionId: string | null = null;

    if (canApprove) {
      // --------- DIRECTLY-APPROVED PATH (admin / approver user) ---------
      // Mirror approve-single flow exactly: main transaction → collection insert
      // → commission rows (legacy + new) linked by collection.id.
      const { data: transaction, error: transactionError } = await supabaseAdmin
        .from("transactions")
        .insert({
          masjid_id: userContext.masjidId,
          user_id: userId,
          family_id: resolvedFamilyId,
          amount,
          type: "income",
          category: "subscription",
          description: `சந்தா வசூல் — நேரடி (${familyData?.head_name ?? resolvedFamilyId})`,
          date: resolvedDate,
        })
        .select()
        .single();

      if (transactionError || !transaction) {
        console.error("[collections/add] direct-approve transaction creation error:", transactionError);
        return NextResponse.json(
          { error: "Failed to create account transaction" },
          { status: 500 }
        );
      }
      mainTransactionId = transaction.id;

      // 1) Insert the accepted collection FIRST so we have a real collection.id
      //    to satisfy employee_commissions.collection_id FK (non-nullable).
      const acceptedPayload: Record<string, any> = {
        masjid_id: userContext.masjidId,
        family_id: resolvedFamilyId,
        amount,
        commission_percent: commissionPercent,
        commission_amount: commissionAmount,
        notes: notes || null,
        date: resolvedDate,
        status: "accepted",
        collected_by_user_id: userId,
        collector_employee_id: userContext.employeeId || null,
        accepted_by_user_id: userId,
        accepted_at: nowIso,
        main_transaction_id: mainTransactionId,
      };

      const { data: insertedAccepted, error: acceptedInsertError } = await supabaseAdmin
        .from("subscription_collections")
        .insert(acceptedPayload)
        .select()
        .single();

      if (acceptedInsertError || !insertedAccepted) {
        console.error("[collections/add] direct-approve collection insert error:", acceptedInsertError);
        return NextResponse.json(
          { error: "Failed to record approved collection" },
          { status: 500 }
        );
      }
      collection = insertedAccepted;

      // 2) Commission rows written AFTER collection insert (mirrors approve-single
      //    processing loop where collection.id is already known).
      try {
        await supabaseAdmin.from("employee_commissions").insert({
          masjid_id: userContext.masjidId,
          employee_id: userId,
          collection_id: collection.id,
          amount: commissionAmount,
        });
      } catch (commissionError) {
        console.warn("[collections/add] employee commission insert skipped:", commissionError);
      }

      try {
        await supabaseAdmin.from("staff_commissions").insert({
          masjid_id: userContext.masjidId,
          collector_user_id: userId,
          amount: commissionAmount,
          status: "pending",
        });
      } catch (staffCommissionError) {
        console.warn("[collections/add] staff commission insert skipped:", staffCommissionError);
      }

      console.info("[collections/add] direct-approve collection recorded", {
        collectionId: collection.id,
        masjidId: userContext.masjidId,
        familyId: resolvedFamilyId,
        status: collection.status,
        mainTransactionId,
      });
    } else {
      // --------- PENDING PATH (regular collector without approval rights) ---------
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
      });
    }

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
      message:
        collection.status === "accepted"
          ? "Collection recorded and approved successfully"
          : "Collection recorded successfully",
      auto_approved: collection.status === "accepted",
      collection: {
        id: collection.id,
        amount: collection.amount,
        commission_percent: collection.commission_percent,
        commission_amount: collection.commission_amount,
        date: collection.date,
        status: collection.status,
        accepted_by_user_id: collection.accepted_by_user_id ?? null,
        accepted_at: collection.accepted_at ?? null,
        main_transaction_id: collection.main_transaction_id ?? null,
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
