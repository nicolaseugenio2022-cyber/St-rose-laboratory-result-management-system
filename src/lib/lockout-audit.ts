import { MAX_USERNAME_LENGTH } from "@/lib/username";
import type { AuthCredentialRecord, LockoutRecord } from "@/repositories/interfaces";
import type { AuditEvent } from "@/services/audit-service";

export type LockoutAuditDependencies = {
  findByUsername: (username: string) => Promise<AuthCredentialRecord | null>;
  emit: (event: AuditEvent) => Promise<void>;
};

export async function emitLockoutActivated(
  lockout: LockoutRecord,
  dependencies: LockoutAuditDependencies
): Promise<void> {
  try {
    const { username, failureCount, expiresAt: lockoutExpiresAt } = lockout;
    const record = await dependencies.findByUsername(username);

    await dependencies.emit({
      category: "AuthAccount",
      eventType: "AuthenticationLockoutActivated",
      actorRole: null,
      targetRole: record?.role ?? null,
      performedByUserId: null,
      performedByUsername: null,
      targetReference: username.slice(0, MAX_USERNAME_LENGTH),
      details: { failureCount, lockoutExpiresAt },
    });
  } catch {
    console.error("Lockout-activation audit persistence failed.", {
      eventType: "AuthenticationLockoutActivated",
    });
  }
}

export async function emitLockoutReleased(
  lockout: LockoutRecord,
  dependencies: LockoutAuditDependencies
): Promise<void> {
  try {
    const { username, expiresAt: lockoutExpiresAt } = lockout;
    const record = await dependencies.findByUsername(username);

    await dependencies.emit({
      category: "AuthAccount",
      eventType: "AuthenticationLockoutReleased",
      actorRole: null,
      targetRole: record?.role ?? null,
      performedByUserId: null,
      performedByUsername: null,
      targetReference: username.slice(0, MAX_USERNAME_LENGTH),
      details: { lockoutExpiresAt },
    });
  } catch {
    console.error("Lockout-release audit persistence failed.", {
      eventType: "AuthenticationLockoutReleased",
    });
  }
}
