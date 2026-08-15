import type { SessionPayload } from "@/lib/session-codec";
import type { AuditEvent } from "@/services/audit-service";
import type { User } from "@/types/user";

export type LogoutAuditDependencies = {
  getUserById: (userId: string) => Promise<User | null>;
  emit: (event: AuditEvent) => Promise<void>;
};

export async function emitLogoutAuditForSession(
  session: SessionPayload | null,
  dependencies: LogoutAuditDependencies
): Promise<void> {
  try {
    if (!session) return;

    const user = await dependencies.getUserById(session.userId);
    if (!user) return;

    await dependencies.emit({
      category: "AuthAccount",
      eventType: "AuthenticationLoggedOut",
      actorRole: user.role,
      targetRole: user.role,
      performedByUserId: user.id,
      performedByUsername: user.username,
      targetReference: user.username,
      details: null,
    });
  } catch {
    console.error("Logout audit persistence failed.", {
      eventType: "AuthenticationLoggedOut",
    });
  }
}
