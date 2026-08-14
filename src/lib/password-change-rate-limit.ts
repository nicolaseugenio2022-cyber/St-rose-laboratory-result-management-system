import { randomUUID } from "node:crypto";
import { LOGIN_RATE_LIMIT_POLICY } from "@/lib/login-rate-limit";
import type { AuthAttemptRecord, ILoginAttemptRepository } from "@/repositories/interfaces";

export class PasswordChangeRateLimitError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super("Password change is temporarily unavailable.");
    this.name = "PasswordChangeRateLimitError";
  }
}

function consecutiveFailures(attempts: AuthAttemptRecord[]): AuthAttemptRecord[] {
  const failures: AuthAttemptRecord[] = [];
  for (const attempt of attempts) {
    if (attempt.succeeded) break;
    failures.push(attempt);
  }
  return failures;
}

function retryAfterFor(attempts: AuthAttemptRecord[], now: number): number {
  const failures = consecutiveFailures(attempts);
  if (failures.length === 0) return 0;

  const latestAttemptAt = new Date(failures[0].attemptedAt).getTime();
  const duration =
    failures.length >= LOGIN_RATE_LIMIT_POLICY.lockoutFailureCount
      ? LOGIN_RATE_LIMIT_POLICY.lockoutMs
      : LOGIN_RATE_LIMIT_POLICY.progressiveCooldownsMs[
          Math.min(failures.length, LOGIN_RATE_LIMIT_POLICY.progressiveCooldownsMs.length) - 1
        ];
  return Math.max(0, duration - (now - latestAttemptAt));
}

export class PasswordChangeRateLimiter {
  constructor(private readonly attempts: ILoginAttemptRepository) {}

  async assertAllowed(username: string, clientIp: string | null): Promise<void> {
    const now = Date.now();
    const since = new Date(now - LOGIN_RATE_LIMIT_POLICY.windowMs).toISOString();
    const queries = [
      this.attempts.findAttempts({ attemptKind: "PasswordChange", username, since }),
      ...(clientIp
        ? [this.attempts.findAttempts({ attemptKind: "PasswordChange" as const, clientIp, since })]
        : []),
    ];
    const histories = await Promise.all(queries);
    const retryAfterMs = Math.max(...histories.map((history) => retryAfterFor(history, now)));
    if (retryAfterMs > 0) throw new PasswordChangeRateLimitError(retryAfterMs);
  }

  async record(username: string, clientIp: string | null, succeeded: boolean): Promise<void> {
    await this.attempts.record({
      id: randomUUID(),
      username,
      attemptKind: "PasswordChange",
      succeeded,
      clientIp,
      attemptedAt: new Date().toISOString(),
    });
  }
}
