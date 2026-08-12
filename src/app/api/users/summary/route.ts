import { NextResponse } from "next/server";
import { userService } from "@/services/user-service-instance";
import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";

export async function GET() {
  const currentUserProfile = await getCurrentUserProfile();
  // Summary is intended for the Dashboard; allow any authenticated, active user
  const access = checkRouteAccess("/dashboard", currentUserProfile);

  if (!access.allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const users = await userService.getUsers();
  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === "Active").length;
  const inactiveUsers = users.filter((user) => user.status !== "Active").length;
  const adminUsers = users.filter((user) => user.role === "Admin").length;

  return NextResponse.json({
    totalUsers,
    activeUsers,
    inactiveUsers,
    adminUsers,
  });
}
