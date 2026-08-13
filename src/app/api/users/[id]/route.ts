import { NextResponse } from "next/server";
import {
  AccountOwnsReportsError,
  LastActiveAdminError,
  SelfDeactivationError,
  SelfDeletionError,
  UserNotFoundError,
} from "@/services/userService";
import { userService } from "@/services/user-service-instance";
import { auditService } from "@/services/audit-service-instance";
import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";
import { updateUserPayloadSchema } from "@/lib/validations/userValidation";
import type { User } from "@/types/user";

function isUserConflict(error: unknown): boolean {
  return (
    error instanceof LastActiveAdminError ||
    error instanceof SelfDeactivationError ||
    error instanceof AccountOwnsReportsError ||
    error instanceof SelfDeletionError
  );
}

function userNotFoundResponse(id: string) {
  return NextResponse.json(
    { error: new UserNotFoundError(id).message },
    { status: 404 }
  );
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
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
        method: "PATCH",
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
        method: "PATCH",
      },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;
  const target = await userService.getUserByIdVisibleTo(id, currentUserProfile.role);
  if (!target) return userNotFoundResponse(id);

  const payload = await request.json();
  const parsed = updateUserPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  let user: User;
  try {
    user = await userService.updateUser(id, parsed.data, currentUserProfile?.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    if (error instanceof UserNotFoundError) return userNotFoundResponse(id);
    return NextResponse.json(
      { error: message },
      { status: isUserConflict(error) ? 409 : 400 }
    );
  }

  await auditService.emit({
    category: "AuthAccount",
    eventType: "AccountUpdated",
    actorRole: currentUserProfile.role,
    targetRole: user.role,
    performedByUserId: currentUserProfile.id,
    performedByUsername: currentUserProfile.username,
    targetReference: user.username,
    details: {
      targetUserId: user.id,
      previousRole: target.role,
      previousStatus: target.status,
      status: user.status,
      changedFields: Object.keys(parsed.data),
    },
  });
  return NextResponse.json(user);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
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
        method: "DELETE",
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
        method: "DELETE",
      },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;
  const target = await userService.getUserByIdVisibleTo(id, currentUserProfile.role);
  if (!target) return userNotFoundResponse(id);

  try {
    await userService.deleteUser(id, currentUserProfile.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete user";
    if (error instanceof UserNotFoundError) return userNotFoundResponse(id);
    return NextResponse.json(
      { error: message },
      { status: isUserConflict(error) ? 409 : 400 }
    );
  }

  await auditService.emit({
    category: "AuthAccount",
    eventType: "AccountDeleted",
    actorRole: currentUserProfile.role,
    targetRole: target.role,
    performedByUserId: currentUserProfile.id,
    performedByUsername: currentUserProfile.username,
    targetReference: target.username,
    details: { targetUserId: target.id, previousStatus: target.status },
  });
  return NextResponse.json({ success: true });
}
