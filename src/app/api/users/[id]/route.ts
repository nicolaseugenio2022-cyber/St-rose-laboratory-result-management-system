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
import { authorizeOrdinaryAccountWrite } from "@/features/server-boundary/ordinary-account-guard";
import { safeApiErrorMessage } from "@/lib/api/safe-error-response";
import { toAdminAccountEntry } from "@/features/users/account-directory-entry";
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
  // Admin only. This route previously authorized through checkRouteAccess alone, which admits
  // Developer - so a Developer could edit, deactivate or promote an ordinary account.
  const auth = await authorizeOrdinaryAccountWrite("PATCH");
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const currentUserProfile = auth.caller;

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
    // Only the message narrows. The status expression below is unchanged and stays pinned:
    // recognised invariant conflicts remain 409, everything else remains 400. `instanceof Error`
    // already blocked a PostgREST plain object, but it still passed the message of ANY internal
    // Error - including one raised inside a repository - straight to the browser.
    const message = safeApiErrorMessage(error, "Failed to update user");
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
  return NextResponse.json(toAdminAccountEntry(user));
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  // Admin only. This route previously authorized through checkRouteAccess alone, which admits
  // Developer - so a Developer could delete an ordinary account.
  const auth = await authorizeOrdinaryAccountWrite("DELETE");
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const currentUserProfile = auth.caller;

  const { id } = await context.params;
  const target = await userService.getUserByIdVisibleTo(id, currentUserProfile.role);
  if (!target) return userNotFoundResponse(id);

  try {
    await userService.deleteUser(id, currentUserProfile.id);
  } catch (error) {
    const message = safeApiErrorMessage(error, "Failed to delete user");
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
