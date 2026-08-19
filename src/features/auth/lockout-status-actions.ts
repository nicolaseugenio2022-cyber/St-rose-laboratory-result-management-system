"use server";

import { headers } from "next/headers";
import { LoginRateLimitError } from "@/lib/login-rate-limit";
import { canonicalizeUsername } from "@/lib/username";
import { SupabaseLoginAttemptRepository } from "@/repositories/supabase-login-attempt-repository";
import { LoginRateLimiter } from "@/lib/login-rate-limit";

export type LockoutStatusResult = {
  retryAfterMs: number;
};

async function getClientIp(): Promise<string | null> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || requestHeaders.get("x-real-ip")?.trim() || null;
}

export async function getLockoutRetryAfterAction({
  username,
}: {
  username: string;
}): Promise<LockoutStatusResult> {
  try {
    const canonical = canonicalizeUsername(username);
    if (!canonical) return { retryAfterMs: 0 };

    const limiter = new LoginRateLimiter(new SupabaseLoginAttemptRepository());
    const clientIp = await getClientIp();
    await limiter.assertAllowed(canonical, clientIp);
    return { retryAfterMs: 0 };
  } catch (error) {
    if (error instanceof LoginRateLimitError) {
      return { retryAfterMs: error.retryAfterMs };
    }
    return { retryAfterMs: 0 };
  }
}
