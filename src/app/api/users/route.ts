import { NextResponse } from "next/server";
import { userService } from "@/services/user-service-instance";
import { auditService } from "@/services/audit-service-instance";
import {
  authorizeOrdinaryAccountRead,
  authorizeOrdinaryAccountWrite,
} from "@/features/server-boundary/ordinary-account-guard";
import {
  toAccountDirectory,
  toAdminAccountEntry,
} from "@/features/users/account-directory-entry";
import { safeApiErrorMessage } from "@/lib/api/safe-error-response";
import { createUserSchema } from "@/lib/validations/userValidation";
import type { User } from "@/types/user";

export async function GET() {
  const auth = await authorizeOrdinaryAccountRead("GET");
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Role-aware projection. Admin receives the five directory fields its table renders; Developer
  // receives the three ADR-005 names and nothing else. Previously this returned the service result
  // unprojected, so every caller - Developer included - received tokenVersion, passwordUpdatedAt
  // and both first-login flags in the response body. Which records are visible is unchanged; only
  // how much of each record is.
  const users = await userService.getUsersVisibleTo(auth.caller.role);
  return NextResponse.json(toAccountDirectory(users, auth.caller.role));
}

export async function POST(request: Request) {
  const auth = await authorizeOrdinaryAccountWrite("POST");
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const currentUserProfile = auth.caller;

  const payload = await request.json();
  const parsed = createUserSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  let user: User;
  try {
    user = await userService.createUser(parsed.data);
  } catch (error: unknown) {
    // Allowlisted domain failures keep their operator-facing sentence; everything else - a
    // PostgREST plain object, a Postgres error, an infrastructure fault - collapses to this
    // route's own existing generic string. `catch (error: any)` with `error?.message` previously
    // returned whichever message the thrown value happened to carry, including one composed by
    // the database.
    return NextResponse.json(
      { error: safeApiErrorMessage(error, "Failed to create user") },
      { status: 400 }
    );
  }

  // The audit event still reads the full record - it runs on the server and target_reference and
  // details are unchanged. Only the response body is projected.
  await auditService.emit({
    category: "AuthAccount",
    eventType: "AccountCreated",
    actorRole: currentUserProfile.role,
    targetRole: user.role,
    performedByUserId: currentUserProfile.id,
    performedByUsername: currentUserProfile.username,
    targetReference: user.username,
    details: { targetUserId: user.id, status: user.status },
  });
  return NextResponse.json(toAdminAccountEntry(user));
}
