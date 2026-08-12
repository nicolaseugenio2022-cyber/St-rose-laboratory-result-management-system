import { NextResponse } from "next/server";
import {
  AccountOwnsReportsError,
  LastActiveAdminError,
  SelfDeactivationError,
  SelfDeletionError,
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const currentUserProfile = await getCurrentUserProfile();
  const access = checkRouteAccess("/users", currentUserProfile);

  if (!access.allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = updateUserPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (currentUserProfile?.role === "Admin" && parsed.data.role === "Developer") {
    return NextResponse.json({ error: "Admins cannot assign Developer role." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const user = await userService.updateUser(id, parsed.data, currentUserProfile?.id);
    return NextResponse.json(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user";
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

  try {
    const { id } = await context.params;
    await userService.deleteUser(id, currentUserProfile?.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete user";
    return NextResponse.json(
      { error: message },
      { status: isUserConflict(error) ? 409 : 400 }
    );
  }
}
