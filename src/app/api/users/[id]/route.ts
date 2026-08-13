import { NextResponse } from "next/server";
import {
  AccountOwnsReportsError,
  LastActiveAdminError,
  SelfDeactivationError,
  SelfDeletionError,
  UserNotFoundError,
} from "@/services/userService";
import { userService } from "@/services/user-service-instance";
import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";
import { updateUserPayloadSchema } from "@/lib/validations/userValidation";

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!currentUserProfile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!(await userService.getUserByIdVisibleTo(id, currentUserProfile.role))) {
    return userNotFoundResponse(id);
  }

  const payload = await request.json();
  const parsed = updateUserPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const user = await userService.updateUser(id, parsed.data, currentUserProfile?.id);
    return NextResponse.json(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    if (error instanceof UserNotFoundError) return userNotFoundResponse(id);
    return NextResponse.json(
      { error: message },
      { status: isUserConflict(error) ? 409 : 400 }
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const currentUserProfile = await getCurrentUserProfile();
  const access = checkRouteAccess("/users", currentUserProfile);

  if (!access.allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!currentUserProfile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!(await userService.getUserByIdVisibleTo(id, currentUserProfile.role))) {
    return userNotFoundResponse(id);
  }

  try {
    await userService.deleteUser(id, currentUserProfile.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete user";
    if (error instanceof UserNotFoundError) return userNotFoundResponse(id);
    return NextResponse.json(
      { error: message },
      { status: isUserConflict(error) ? 409 : 400 }
    );
  }
}
