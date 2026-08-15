import { NextResponse } from "next/server";
import { purgeSchedulerService } from "@/services/purge-scheduler-service";
import { assertAdminAccess, getCurrentUserProfile } from "@/lib/auth-guards";

export async function POST() {
  const user = await getCurrentUserProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    assertAdminAccess(user, "Purge expired sessions");
    const res = await purgeSchedulerService.executeScheduledPurge(user.id);
    return NextResponse.json({ message: `Purged ${res.purgedCount} expired sessions.` });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Purge failed" }, { status: 500 });
  }
}
