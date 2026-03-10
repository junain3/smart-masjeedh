import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function collectionSecurityMiddleware(request: NextRequest) {
  try {
    // Get user from session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user role and permissions
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select(`
        masjid_id,
        role,
        permissions,
        employee_id,
        verified
      `)
      .eq("auth_user_id", session.user.id)
      .eq("verified", true)
      .single();

    if (roleError || !userRole) {
      return NextResponse.json(
        { error: "User not found or not verified" },
        { status: 403 }
      );
    }

    // Check if user has collection permissions
    if (!userRole.permissions?.subscriptions_collect && userRole.role !== "super_admin") {
      return NextResponse.json(
        { error: "Collection permissions required" },
        { status: 403 }
      );
    }

    // For collection operations, validate employee status
    if (userRole.employee_id) {
      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .select("status, salary_amount, commission_percent")
        .eq("id", userRole.employee_id)
        .single();

      if (employeeError || !employee) {
        return NextResponse.json(
          { error: "Employee record not found" },
          { status: 403 }
        );
      }

      if (employee.status !== "active") {
        return NextResponse.json(
          { error: "Employee account is not active" },
          { status: 403 }
        );
      }

      if (!employee.salary_amount || employee.salary_amount <= 0) {
        return NextResponse.json(
          { error: "Employee salary not configured. Cannot perform collections." },
          { status: 403 }
        );
      }

      // Attach employee details to request for later use
      (request as any).employee = employee;
    }

    // Attach user context to request
    (request as any).userContext = {
      userId: session.user.id,
      masjidId: userRole.masjid_id,
      role: userRole.role,
      permissions: userRole.permissions,
      employeeId: userRole.employee_id
    };

    return null; // Continue to the actual API route

  } catch (error) {
    console.error("Collection security middleware error:", error);
    return NextResponse.json(
      { error: "Security validation failed" },
      { status: 500 }
    );
  }
}

export function withCollectionSecurity(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    // Run security middleware
    const securityResult = await collectionSecurityMiddleware(request);
    
    if (securityResult) {
      return securityResult; // Security check failed
    }

    // Continue to the actual handler
    return handler(request);
  };
}
