import "server-only";

import { getSession, getSessionUser } from "@/lib/session";
import { ForbiddenError } from "@/lib/errors";
import { auditService } from "@/services/audit-service-instance";

type PersonnelReaderProfile = {
  userId: string;
  role: "Admin" | "Developer";
  username: string;
};

export async function requirePersonnelReader(): Promise<PersonnelReaderProfile> {
  const session = await getSession();
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

  const profile = await getSessionUser();
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
  const session = await getSession();
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

  const profile = await getSessionUser();
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
