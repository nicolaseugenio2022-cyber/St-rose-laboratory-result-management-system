import { NextResponse } from "next/server";
import { userService } from "@/services/user-service-instance";
import { auditService } from "@/services/audit-service-instance";
import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";
import { createUserSchema } from "@/lib/validations/userValidation";
import type { User } from "@/types/user";

export async function GET() {
  const currentUserProfile = await getCurrentUserProfile();
  const access = checkRouteAccess("/users", currentUserProfile);

  if (!access.allowed) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "UserManagementAccessDenied",
      actorRole: currentUserProfile?.role ?? null,
      targetRole: null,
      performedByUserId: currentUserProfile?.id ?? null,
      performedByUsername: currentUserProfile?.username ?? null,
      details: {
        reasonCode: currentUserProfile ? "role_not_authorized" : "unauthenticated",
        method: "GET",
      },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!currentUserProfile) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "UserManagementAccessDenied",
      actorRole: null,
      targetRole: null,
      performedByUserId: null,
      performedByUsername: null,
      details: {
        reasonCode: "unauthenticated",
        method: "GET",
      },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json(
    await userService.getUsersVisibleTo(currentUserProfile.role)
  );
}

export async function POST(request: Request) {
  const currentUserProfile = await getCurrentUserProfile();
  const access = checkRouteAccess("/users", currentUserProfile);

  if (!access.allowed) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "UserManagementAccessDenied",
      actorRole: currentUserProfile?.role ?? null,
      targetRole: null,
      performedByUserId: currentUserProfile?.id ?? null,
      performedByUsername: currentUserProfile?.username ?? null,
      details: {
        reasonCode: currentUserProfile ? "role_not_authorized" : "unauthenticated",
        method: "POST",
      },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!currentUserProfile) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "UserManagementAccessDenied",
      actorRole: null,
      targetRole: null,
      performedByUserId: null,
      performedByUsername: null,
      details: {
        reasonCode: "unauthenticated",
        method: "POST",
      },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = createUserSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  let user: User;
  try {
    user = await userService.createUser(parsed.data);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create user" }, { status: 400 });
  }

  await auditService.emit({
    category: "AuthAccount",
    eventType: "AccountCreated",
    actorRole: currentUserProfile.role,
    targetRole: user.role,
    performedByUserId: currentUserProfile.id,
    performedByUsername: currentUserProfile.username,
    targetReference: user.username,
    details: { targetUserId: user.id, status: user.status },
  });
  return NextResponse.json(user);
}
