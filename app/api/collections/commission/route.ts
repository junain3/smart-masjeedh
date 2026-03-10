import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { employee_id, start_date, end_date } = await request.json();

    if (!employee_id || !start_date || !end_date) {
      return NextResponse.json(
        { error: "Employee ID and date range are required" },
        { status: 400 }
      );
    }

    // Get employee details
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, masjid_id, full_name, email, commission_percent, salary_amount, salary_type")
      .eq("id", employee_id)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Get all approved collections for the period
    const { data: collections, error: collectionsError } = await supabase
      .from("collections")
      .select(`
        id,
        collection_amount,
        commission_percent,
        commission_amount,
        collection_date,
        status,
        member_id,
        members(full_name),
        subscription_id,
        subscriptions(subscription_type)
      `)
      .eq("employee_id", employee_id)
      .eq("masjid_id", employee.masjid_id)
      .gte("collection_date", start_date)
      .lte("collection_date", end_date)
      .eq("status", "approved")
      .order("collection_date", { ascending: false });

    if (collectionsError) {
      console.error("Error fetching collections:", collectionsError);
      return NextResponse.json(
        { error: "Failed to fetch collections" },
        { status: 500 }
      );
    }

    // Calculate totals
    const totalCollected = collections?.reduce((sum, c) => sum + (c.collection_amount || 0), 0) || 0;
    const totalCommission = collections?.reduce((sum, c) => sum + (c.commission_amount || 0), 0) || 0;

    // Get monthly salary for comparison
    let monthlySalary = 0;
    if (employee.salary_type === "monthly") {
      monthlySalary = employee.salary_amount || 0;
    } else if (employee.salary_type === "weekly") {
      monthlySalary = (employee.salary_amount || 0) * 4.33; // Average weeks per month
    } else if (employee.salary_type === "daily") {
      monthlySalary = (employee.salary_amount || 0) * 30; // Average days per month
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        full_name: employee.full_name,
        email: employee.email,
        commission_percent: employee.commission_percent,
        salary_amount: employee.salary_amount,
        salary_type: employee.salary_type,
        monthly_salary: monthlySalary
      },
      period: {
        start_date: start_date,
        end_date: end_date,
        total_days: Math.ceil((new Date(end_date).getTime() - new Date(start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
      },
      collections: {
        count: collections?.length || 0,
        total_collected: totalCollected,
        total_commission: totalCommission,
        average_per_collection: collections?.length > 0 ? totalCollected / collections.length : 0,
        details: collections || []
      },
      summary: {
        total_earnings: monthlySalary + totalCommission,
        commission_percentage_of_salary: monthlySalary > 0 ? (totalCommission / monthlySalary) * 100 : 0,
        note: "Commission calculated only from collected amounts, not from salary"
      }
    });

  } catch (error) {
    console.error("Commission calculation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
