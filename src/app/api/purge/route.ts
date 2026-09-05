import { NextResponse } from "next/server";
import { purgeSchedulerService } from "@/services/purge-scheduler-service";
import { assertAdminAccess, getCurrentUserProfile } from "@/lib/auth-guards";
import { safeApiErrorMessage } from "@/lib/api/safe-error-response";
import { ForbiddenError } from "@/lib/errors";

export async function POST() {
  const user = await getCurrentUserProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  // Authorization is refused as authorization, not as a server fault. The guard threw inside the
  // same try that wrapped execution, so a non-Admin caller received HTTP 500 - a refusal reported
  // as a malfunction. The guard is unchanged, still server-side, and still runs before any purge
  // work; only the failure it raises is now classified separately from an execution failure.
  try {
    assertAdminAccess(user, "Purge expired sessions");
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: safeApiErrorMessage(error, "Forbidden") },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    const res = await purgeSchedulerService.executeScheduledPurge(user.id);
    return NextResponse.json({ message: `Purged ${res.purgedCount} expired sessions.` });
  } catch (error: unknown) {
    // An execution failure keeps its 500 and this route's own existing generic string. It no
    // longer returns the caught message, which could be a repository or Postgres sentence.
    return NextResponse.json(
      { error: safeApiErrorMessage(error, "Purge failed") },
      { status: 500 }
    );
  }
}
