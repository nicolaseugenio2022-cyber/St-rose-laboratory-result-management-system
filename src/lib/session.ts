import { cache } from "react";
import { cookies } from "next/headers";
import { User } from "@/types/user";
import {
  decryptSessionToken,
  encryptSessionToken,
  SessionPayload,
} from "@/lib/session-codec";

export type { SessionPayload } from "@/lib/session-codec";
export { decryptSessionToken as decrypt, encryptSessionToken as encrypt } from "@/lib/session-codec";

export async function createSession(user: User, rememberMe = false): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const sessionToken = await encryptSessionToken({
    userId: user.id,
    tokenVersion: user.tokenVersion,
    mustChangePassword: user.mustChangePassword,
    mustSetRecovery: user.mustSetRecovery,
    rememberMe,
    expiresAt: expiresAt.toISOString(),
  });

  const cookieStore = await cookies();
  cookieStore.set("session_token", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(rememberMe ? { expires: expiresAt } : {}),
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session_token");
}

export type AuthenticatedRequest = {
  session: SessionPayload;
  user: User;
};

/**
 * The single DB-backed authenticated-user validation for one request (M6 P4).
 *
 * Validation is unchanged and still happens per request: the cookie signature and expiry are
 * verified locally, then the user row is read once and checked for existence, `Active` status and
 * a matching `tokenVersion`. What changed is only repetition. Previously `getSession` read that
 * row, `getCurrentUserProfile` read the identical row a second time, and each guard that called
 * `getSession` directly read it twice more - three to five reads of one row per navigation, all
 * serialized ahead of the route's own data.
 *
 * React `cache()` memoizes WITHIN A SERVER COMPONENT RENDER, and only there. Route Handlers and
 * Server Actions must not depend on that memoization: those callers call
 * `resolveAuthenticatedRequest()` ONCE per operation and reuse the returned `session` and `user`,
 * rather than calling `getSession()` and then `getSessionUser()` and assuming the two collapse into
 * a single read. An earlier revision assumed exactly that and read the user row twice per guard.
 *
 * Nothing is cached across requests. Every new request re-validates the cookie and re-reads the
 * current user row, so a deactivation or a token bump takes effect on the very next request.
 *
 * Callers that mutate authentication state (login, first-login password and recovery, logout,
 * account administration) resolve the caller once BEFORE mutating and then redirect or return, so
 * no flow observes a memoized value across its own write.
 */
const resolveAuthenticatedRequestForToken = cache(
  async (sessionToken: string | undefined): Promise<AuthenticatedRequest | null> => {
    const payload = await decryptSessionToken(sessionToken);
    if (!payload) return null;

    const { userService } = await import("@/services/user-service-instance");
    const user = await userService.getUserById(payload.userId);
    if (!user || user.status !== "Active" || user.tokenVersion !== payload.tokenVersion) return null;

    return {
      session: {
        ...payload,
        mustChangePassword: user.mustChangePassword,
        mustSetRecovery: user.mustSetRecovery,
      },
      user,
    };
  }
);

/**
 * Resolves the current request's authenticated user, memoized ON THE COOKIE VALUE.
 *
 * Keying on the token rather than on the request alone is what keeps the memo honest wherever it
 * applies. `deleteSession` and `createSession` change what `cookies()` returns immediately, so
 * after a logout the key becomes `undefined` and this resolves to null, and after a re-issued
 * session it resolves against the new token - never the pre-mutation value.
 *
 * Within one Server Component render, callers all read the same cookie and the common path resolves
 * once. A Route Handler or Server Action must not rely on that: call this once per operation and
 * pass the resolved `session` and `user` down.
 */
export async function resolveAuthenticatedRequest(): Promise<AuthenticatedRequest | null> {
  const cookieStore = await cookies();
  return resolveAuthenticatedRequestForToken(cookieStore.get("session_token")?.value);
}

export async function getSession(): Promise<SessionPayload | null> {
  const resolved = await resolveAuthenticatedRequest();
  return resolved?.session ?? null;
}

/**
 * The user row already validated for this request. Returns null on exactly the conditions that
 * make `getSession` null - no session, unknown user, inactive account, stale token version - so a
 * guard that re-read the row can consume this instead without changing any of its own checks.
 */
export async function getSessionUser(): Promise<User | null> {
  const resolved = await resolveAuthenticatedRequest();
  return resolved?.user ?? null;
}
