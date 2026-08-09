import { NextResponse } from "next/server";
import { userService } from "@/services/userService";
import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";
import { updateUserPayloadSchema } from "@/lib/validations/userValidation";

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
    const user = await userService.updateUser(id, parsed.data);
    const { password, ...sanitizedUser } = user;
    return NextResponse.json(sanitizedUser);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update user" }, { status: 400 });
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
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete user" }, { status: 400 });
  }
}
