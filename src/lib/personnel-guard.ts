import "server-only";

import { resolveAuthenticatedRequest } from "@/lib/session";
import { ForbiddenError } from "@/lib/errors";
import { auditService } from "@/services/audit-service-instance";

type PersonnelReaderProfile = {
  userId: string;
  role: "Admin" | "Developer";
  username: string;
};

export async function requirePersonnelReader(): Promise<PersonnelReaderProfile> {
  // SHADCN-07C1-R2: ONE resolution per invocation. React cache() gives reuse within a Server
  // Component render; it is not a dependable dedupe inside a Server Action, so the earlier
  // two-step session-then-profile pair could genuinely read the user row twice. Resolving once
  // removes the second read outright rather than relying on a memo, and guarantees the session and
  // the profile describe the same row. Every check, denial reason, audit field, thrown error and
  // returned value below is unchanged.
  const resolved = await resolveAuthenticatedRequest();
  const session = resolved?.session ?? null;
  if (!session) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "PersonnelDirectoryAccessDenied",
      actorRole: null,
      targetRole: null,
      details: { reasonCode: "unauthenticated" },
    });
    throw new ForbiddenError("Authentication is required.");
  }
  if (session.mustChangePassword || session.mustSetRecovery) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "PersonnelDirectoryAccessDenied",
      actorRole: null,
      targetRole: null,
      performedByUserId: session.userId,
      details: { reasonCode: "first_login_incomplete" },
    });
    throw new ForbiddenError("First-login account setup must be completed before accessing personnel data.");
  }

  const profile = resolved?.user ?? null;
  if (!profile || profile.status !== "Active") {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "PersonnelDirectoryAccessDenied",
      actorRole: profile?.role ?? null,
      targetRole: null,
      performedByUserId: session.userId,
      performedByUsername: profile?.username ?? null,
      details: { reasonCode: profile ? "account_inactive" : "unauthenticated" },
    });
    throw new ForbiddenError("Authentication is required.");
  }
  if (profile.role !== "Admin" && profile.role !== "Developer") {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "PersonnelDirectoryAccessDenied",
      actorRole: profile.role,
      targetRole: null,
      performedByUserId: profile.id,
      performedByUsername: profile.username,
      details: { reasonCode: "role_not_authorized" },
    });
    throw new ForbiddenError("This role is not authorized to access personnel data.");
  }

  return { userId: profile.id, role: profile.role, username: profile.username };
}

export async function requirePersonnelAdmin(): Promise<PersonnelReaderProfile> {
  // SHADCN-07C1-R2: ONE resolution per invocation. React cache() gives reuse within a Server
  // Component render; it is not a dependable dedupe inside a Server Action, so the earlier
  // two-step session-then-profile pair could genuinely read the user row twice. Resolving once
  // removes the second read outright rather than relying on a memo, and guarantees the session and
  // the profile describe the same row. Every check, denial reason, audit field, thrown error and
  // returned value below is unchanged.
  const resolved = await resolveAuthenticatedRequest();
  const session = resolved?.session ?? null;
  if (!session) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "PersonnelDirectoryAccessDenied",
      actorRole: null,
      targetRole: null,
      details: { reasonCode: "unauthenticated" },
    });
    throw new ForbiddenError("Authentication is required.");
  }
  if (session.mustChangePassword || session.mustSetRecovery) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "PersonnelDirectoryAccessDenied",
      actorRole: null,
      targetRole: null,
      performedByUserId: session.userId,
      details: { reasonCode: "first_login_incomplete" },
    });
    throw new ForbiddenError("First-login account setup must be completed before managing personnel.");
  }

  const profile = resolved?.user ?? null;
  if (!profile || profile.status !== "Active") {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "PersonnelDirectoryAccessDenied",
      actorRole: profile?.role ?? null,
      targetRole: null,
      performedByUserId: session.userId,
      performedByUsername: profile?.username ?? null,
      details: { reasonCode: profile ? "account_inactive" : "unauthenticated" },
    });
    throw new ForbiddenError("Authentication is required.");
  }
  if (profile.role !== "Admin") {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "PersonnelDirectoryAccessDenied",
      actorRole: profile.role,
      targetRole: null,
      performedByUserId: profile.id,
      performedByUsername: profile.username,
      details: { reasonCode: "role_not_authorized" },
    });
    throw new ForbiddenError("Only administrators may manage personnel records.");
  }

  return { userId: profile.id, role: profile.role, username: profile.username };
}
