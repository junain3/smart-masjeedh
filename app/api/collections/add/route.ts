import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { withCollectionSecurity } from "../middleware";

export const POST = withCollectionSecurity(async (request: NextRequest) => {
  try {
    const { 
      member_id, 
      subscription_id, 
      collection_amount, 
      payment_method = "cash",
      notes = ""
    } = await request.json();

    const userContext = (request as any).userContext;
    const employee = (request as any).employee;

    if (!userContext || !employee) {
      return NextResponse.json(
        { error: "Employee validation failed" },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!member_id || !collection_amount || collection_amount <= 0) {
      return NextResponse.json(
        { error: "Member ID and collection amount are required" },
        { status: 400 }
      );
    }

    // Check if staff already has collections this month
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const { data: existingCollections, error: checkError } = await supabase
      .from("collections")
      .select("id, collection_amount")
      .eq("employee_id", userContext.employeeId)
      .eq("masjid_id", userContext.masjidId)
      .gte("collection_date", currentMonthStart.toISOString())
      .eq("status", "approved");

    if (checkError) {
      console.error("Error checking existing collections:", checkError);
      return NextResponse.json(
        { error: "Failed to validate staff collection status" },
        { status: 500 }
      );
    }

    // Calculate commission based on collected amount (not salary)
    const commissionAmount = (collection_amount * employee.commission_percent) / 100;

    // Create collection record
    const { data: collection, error: insertError } = await supabase
      .from("collections")
      .insert({
        masjid_id: userContext.masjidId,
        employee_id: userContext.employeeId,
        member_id: member_id,
        subscription_id: subscription_id || null,
        collection_amount: collection_amount,
        commission_percent: employee.commission_percent,
        commission_amount: commissionAmount,
        collection_date: new Date().toISOString().split('T')[0],
        payment_method: payment_method,
        notes: notes,
        status: "pending",
        created_by: userContext.userId
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
        collection_amount: collection.collection_amount,
        commission_percent: collection.commission_percent,
        commission_amount: collection.commission_amount,
        collection_date: collection.collection_date,
        status: collection.status
      },
      staff_info: {
        employee_id: userContext.employeeId,
        commission_percent: employee.commission_percent,
        note: "Commission calculated from collected amount only"
      }
    });

  } catch (error) {
    console.error("Collection creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
