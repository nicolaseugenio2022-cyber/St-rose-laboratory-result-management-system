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

  if (!currentUserProfile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const summary = await userService.getUserSummaryVisibleTo(currentUserProfile.role);

  return NextResponse.json(summary);
}
