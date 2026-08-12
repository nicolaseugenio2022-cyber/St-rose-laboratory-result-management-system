import "server-only";

import { randomUUID } from "node:crypto";
import type { AuthAttemptRecord, ILoginAttemptRepository } from "@/repositories/interfaces";

export const RECOVERY_RATE_LIMIT_POLICY = {
  lookup: {
    windowMs: 15 * 60 * 1000,
    maxAttemptsPerIp: 20,
  },
  answer: {
    windowMs: 15 * 60 * 1000,
    lockoutFailureCount: 6,
    lockoutMs: 15 * 60 * 1000,
    progressiveCooldownsMs: [0, 0, 30 * 1000, 60 * 1000, 5 * 60 * 1000],
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000,
    maxSubmissionsPerUsername: 5,
  },
} as const;

export class RecoveryRateLimitError extends Error {
  constructor(
    public readonly retryAfterMs: number,
    public readonly attemptCount: number
  ) {
    super("Password recovery is temporarily unavailable.");
    this.name = "RecoveryRateLimitError";
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

function answerRetryAfter(attempts: AuthAttemptRecord[], now: number): number {
  const failures = consecutiveFailures(attempts);
  if (failures.length === 0) return 0;

  const latestAttemptAt = new Date(failures[0].attemptedAt).getTime();
  const duration =
    failures.length >= RECOVERY_RATE_LIMIT_POLICY.answer.lockoutFailureCount
      ? RECOVERY_RATE_LIMIT_POLICY.answer.lockoutMs
      : RECOVERY_RATE_LIMIT_POLICY.answer.progressiveCooldownsMs[
          Math.min(
            failures.length,
            RECOVERY_RATE_LIMIT_POLICY.answer.progressiveCooldownsMs.length
          ) - 1
        ];
  return Math.max(0, duration - (now - latestAttemptAt));
}

export class RecoveryRateLimiter {
  constructor(private readonly attempts: ILoginAttemptRepository) {}

  async assertLookupAllowed(
    username: string,
    clientIp: string
  ): Promise<{ ipAttemptCount: number; usernameAttemptCount: number }> {
    const now = Date.now();
    const since = new Date(now - RECOVERY_RATE_LIMIT_POLICY.lookup.windowMs).toISOString();
    const [ipAttempts, usernameAttempts] = await Promise.all([
      this.attempts.findAttempts({ attemptKind: "RecoveryLookup", clientIp, since }),
      this.attempts.findAttempts({ attemptKind: "RecoveryLookup", username, since }),
    ]);

    if (ipAttempts.length >= RECOVERY_RATE_LIMIT_POLICY.lookup.maxAttemptsPerIp) {
      const oldestCountedAttempt = ipAttempts.at(-1);
      const retryAfterMs = oldestCountedAttempt
        ? Math.max(
            0,
            RECOVERY_RATE_LIMIT_POLICY.lookup.windowMs -
              (now - new Date(oldestCountedAttempt.attemptedAt).getTime())
          )
        : RECOVERY_RATE_LIMIT_POLICY.lookup.windowMs;
      throw new RecoveryRateLimitError(retryAfterMs, ipAttempts.length);
    }

    return {
      ipAttemptCount: ipAttempts.length,
      usernameAttemptCount: usernameAttempts.length,
    };
  }

  async recordLookup(username: string, clientIp: string, succeeded: boolean): Promise<void> {
    await this.record("RecoveryLookup", username, clientIp, succeeded);
  }

  async assertAnswerAllowed(username: string, clientIp: string): Promise<void> {
    const now = Date.now();
    const since = new Date(now - RECOVERY_RATE_LIMIT_POLICY.answer.windowMs).toISOString();
    const histories = await Promise.all([
      this.attempts.findAttempts({ attemptKind: "RecoveryAnswer", username, since }),
      this.attempts.findAttempts({ attemptKind: "RecoveryAnswer", clientIp, since }),
    ]);
    const retryAfterMs = Math.max(...histories.map((history) => answerRetryAfter(history, now)));
    if (retryAfterMs > 0) {
      const failureCount = Math.max(
        ...histories.map((history) => consecutiveFailures(history).length)
      );
      throw new RecoveryRateLimitError(retryAfterMs, failureCount);
    }
  }

  async recordAnswer(username: string, clientIp: string, succeeded: boolean): Promise<void> {
    await this.record("RecoveryAnswer", username, clientIp, succeeded);
  }

  async assertPasswordResetAllowed(username: string): Promise<void> {
    const now = Date.now();
    const since = new Date(
      now - RECOVERY_RATE_LIMIT_POLICY.passwordReset.windowMs
    ).toISOString();
    const attempts = await this.attempts.findAttempts({
      attemptKind: "PasswordReset",
      username,
      since,
    });
    if (attempts.length >= RECOVERY_RATE_LIMIT_POLICY.passwordReset.maxSubmissionsPerUsername) {
      const oldestCountedAttempt = attempts.at(-1);
      const retryAfterMs = oldestCountedAttempt
        ? Math.max(
            0,
            RECOVERY_RATE_LIMIT_POLICY.passwordReset.windowMs -
              (now - new Date(oldestCountedAttempt.attemptedAt).getTime())
          )
        : RECOVERY_RATE_LIMIT_POLICY.passwordReset.windowMs;
      throw new RecoveryRateLimitError(retryAfterMs, attempts.length);
    }
  }

  async recordPasswordReset(username: string, succeeded: boolean): Promise<void> {
    await this.record("PasswordReset", username, null, succeeded);
  }

  private async record(
    attemptKind: "RecoveryLookup" | "RecoveryAnswer" | "PasswordReset",
    username: string,
    clientIp: string | null,
    succeeded: boolean
  ): Promise<void> {
    await this.attempts.record({
      id: randomUUID(),
      username,
      attemptKind,
      succeeded,
      clientIp,
      attemptedAt: new Date().toISOString(),
    });
  }
}
