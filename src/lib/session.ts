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

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const payload = await decryptSessionToken(cookieStore.get("session_token")?.value);
  if (!payload) return null;

  const { userService } = await import("@/services/user-service-instance");
  const user = await userService.getUserById(payload.userId);
  if (!user || user.status !== "Active" || user.tokenVersion !== payload.tokenVersion) return null;

  return {
    ...payload,
    mustChangePassword: user.mustChangePassword,
    mustSetRecovery: user.mustSetRecovery,
  };
}
