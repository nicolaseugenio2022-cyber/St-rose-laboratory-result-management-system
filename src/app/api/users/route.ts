import { NextResponse } from "next/server";
import { userService } from "@/services/userService";
import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";
import { createUserSchema } from "@/lib/validations/userValidation";

export async function GET() {
  const currentUserProfile = await getCurrentUserProfile();
  const access = checkRouteAccess("/users", currentUserProfile);

  if (!access.allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const users = await userService.getUsers();
  const sanitizedUsers = users.map(({ password, ...user }) => user);

  if (currentUserProfile?.role === "Admin") {
    return NextResponse.json(sanitizedUsers.filter((user) => user.role !== "Developer"));
  }

  return NextResponse.json(sanitizedUsers);
}

export async function POST(request: Request) {
  const currentUserProfile = await getCurrentUserProfile();
  const access = checkRouteAccess("/users", currentUserProfile);

  if (!access.allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = createUserSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (currentUserProfile?.role === "Admin" && parsed.data.role === "Developer") {
    return NextResponse.json({ error: "Admins cannot create Developer accounts." }, { status: 403 });
  }

  try {
    const user = await userService.createUser(parsed.data);
    const { password, ...sanitizedUser } = user;
    return NextResponse.json(sanitizedUser);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create user" }, { status: 400 });
  }
}
