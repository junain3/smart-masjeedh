import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { TenantPermissions } from "@/lib/types";

const SUPER_ADMIN_PERMISSIONS: TenantPermissions = {
  accounts: true,
  events: true,
  members: true,
  subscriptions_collect: true,
  subscriptions_approve: true,
  staff_management: true,
  reports: true,
  settings: true,
};

const USER_ROLE_SELECT =
  "masjid_id, role, permissions, employee_id, verified";

type ResolvedUserRole = {
  masjid_id: string;
  role: string;
  permissions: TenantPermissions | null;
  employee_id: string | null;
  verified: boolean | null;
};

async function resolveAuthenticatedUser(
  request: NextRequest,
  supabase: ReturnType<typeof createClient>
): Promise<User | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error) {
        console.error("[collections/middleware] getUser(token) failed", {
          message: error.message,
        });
      }
      if (user) {
        return user;
      }
    }
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    return null;
  }
  return session.user;
}

async function resolveUserRole(authUser: User): Promise<ResolvedUserRole | null> {
  const { data: byAuthId, error: authIdError } = await supabaseAdmin
    .from("user_roles")
    .select(USER_ROLE_SELECT)
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (!authIdError && byAuthId?.masjid_id) {
    return byAuthId as ResolvedUserRole;
  }

  const { data: byUserId, error: userIdError } = await supabaseAdmin
    .from("user_roles")
    .select(USER_ROLE_SELECT)
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (!userIdError && byUserId?.masjid_id) {
    return byUserId as ResolvedUserRole;
  }

  if (authUser.email) {
    const { data: byEmail, error: emailError } = await supabaseAdmin
      .from("user_roles")
      .select(USER_ROLE_SELECT)
      .eq("email", authUser.email)
      .maybeSingle();

    if (!emailError && byEmail?.masjid_id) {
      return byEmail as ResolvedUserRole;
    }
  }

  const { data: masjid, error: masjidError } = await supabaseAdmin
    .from("masjids")
    .select("id")
    .eq("created_by", authUser.id)
    .maybeSingle();

  if (!masjidError && masjid?.id) {
    return {
      masjid_id: masjid.id,
      role: "super_admin",
      permissions: SUPER_ADMIN_PERMISSIONS,
      employee_id: null,
      verified: true,
    };
  }

  return null;
}

export async function collectionSecurityMiddleware(request: NextRequest) {
  try {
    const supabase = createClient();
    const authUser = await resolveAuthenticatedUser(request, supabase);

    if (!authUser) {
      console.error("[collections/middleware] authentication failed", {
        path: request.nextUrl.pathname,
        hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
      });
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userRole = await resolveUserRole(authUser);

    if (!userRole?.masjid_id) {
      console.error("[collections/middleware] user role lookup failed", {
        path: request.nextUrl.pathname,
        userId: authUser.id,
        email: authUser.email,
      });
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
      const { data: employee, error: employeeError } = await supabaseAdmin
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

      // Salary is not required for collection recording/approval in this flow.
      // Only an active employee profile is required to keep the permission model consistent.
      (request as any).employee = employee;
    }

    // Attach user context to request
    (request as any).userContext = {
      userId: authUser.id,
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
