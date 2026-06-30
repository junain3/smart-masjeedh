import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { withCollectionSecurity } from "../middleware";

export const POST = withCollectionSecurity(async (request: NextRequest) => {
  try {
    const {
      family_id,
      member_id,
      subscription_id,
      collection_amount,
      payment_method = "cash",
      notes = ""
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

    const commissionPercent = Number(employee?.commission_percent ?? 0);
    const commissionAmount = (amount * commissionPercent) / 100;

    const insertPayload: Record<string, any> = {
      masjid_id: userContext.masjidId,
      family_id: resolvedFamilyId,
      amount,
      commission_percent: commissionPercent,
      commission_amount: commissionAmount,
      notes: notes || null,
      date: new Date().toISOString().split("T")[0],
      status: "pending",
      collected_by_user_id: userContext.userId,
      collector_employee_id: userContext.employeeId || null,
    };

    try {
      const { data: collection, error: insertError } = await supabase
        .from("subscription_collections")
        .insert({
          ...insertPayload,
          payment_method,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating collection:", insertError);
        return NextResponse.json(
          { error: "Failed to create collection record" },
          { status: 500 }
        );
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
      });
    } catch (error: any) {
      if (error?.message?.includes("payment_method") || error?.code === "42703") {
        const { data: fallbackCollection, error: fallbackError } = await supabase
          .from("subscription_collections")
          .insert(insertPayload)
          .select()
          .single();

        if (fallbackError || !fallbackCollection) {
          throw fallbackError || new Error("Collection insert failed");
        }

        return NextResponse.json({
          success: true,
          message: "Collection recorded successfully",
          collection: {
            id: fallbackCollection.id,
            amount: fallbackCollection.amount,
            commission_percent: fallbackCollection.commission_percent,
            commission_amount: fallbackCollection.commission_amount,
            date: fallbackCollection.date,
            status: fallbackCollection.status,
          },
          staff_info: {
            employee_id: userContext.employeeId,
            commission_percent: commissionPercent,
            note: "Commission calculated from collected amount only",
          },
        });
      }

      throw error;
    }
  } catch (error) {
    console.error("Collection creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
