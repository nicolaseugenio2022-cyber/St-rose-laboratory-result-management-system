"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { firstLoginRedirectPath } from "@/lib/first-login-gate";
import { LoginRateLimitError } from "@/lib/login-rate-limit";
import { normalizeSecurityAnswer } from "@/lib/password";
import { createSession, deleteSession, getSession } from "@/lib/session";
import { canonicalizeUsername } from "@/lib/username";
import { emitLogoutAuditForSession } from "@/features/auth/logout-audit";
import { auditService } from "@/services/audit-service-instance";
import { userService } from "@/services/user-service-instance";

export type AuthActionResult = {
  success: false;
  error: string;
};

function destinationFor(flags: {
  mustChangePassword: boolean;
  mustSetRecovery: boolean;
}): string {
  return flags.mustChangePassword || flags.mustSetRecovery
    ? firstLoginRedirectPath(flags)
    : "/dashboard";
}

async function getClientIp(): Promise<string | null> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || requestHeaders.get("x-real-ip")?.trim() || null;
}

export async function loginAction(formData: FormData): Promise<AuthActionResult> {
  const usernameValue = formData.get("username");
  const passwordValue = formData.get("password");
  const rememberMe = formData.get("rememberMe") === "true";

  if (typeof usernameValue !== "string" || typeof passwordValue !== "string") {
    return { success: false, error: "Username and password are required" };
  }

  const username = canonicalizeUsername(usernameValue);
  if (!username || !passwordValue) {
    return { success: false, error: "Username and password are required" };
  }

  let destination: string;
  try {
    const user = await userService.authenticate(username, passwordValue, await getClientIp());
    await createSession(user, rememberMe);
    destination = destinationFor(user);
  } catch (error: unknown) {
    if (error instanceof LoginRateLimitError) {
      return {
        success: false,
        error: "Too many login attempts. Please try again later.",
      };
    }
    return { success: false, error: "Invalid username or password." };
  }

  redirect(destination);
}

export async function changeFirstLoginPasswordAction(
  formData: FormData
): Promise<AuthActionResult> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.mustChangePassword) redirect(destinationFor(session));

  const password = formData.get("password");
  if (typeof password !== "string" || password.length < 6 || password.length > 100) {
    return {
      success: false,
      error: "Password must be between 6 and 100 characters.",
    };
  }

  let destination: string;
  try {
    const user = await userService.changeFirstLoginPassword(session.userId, password);
    await createSession(user, session.rememberMe);
    destination = destinationFor(user);
  } catch {
    return { success: false, error: "Unable to change the password." };
  }

  redirect(destination);
}

export async function setFirstLoginRecoveryAnswerAction(
  formData: FormData
): Promise<AuthActionResult> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.mustSetRecovery) redirect(destinationFor(session));

  const answer = formData.get("answer");
  if (typeof answer !== "string" || !normalizeSecurityAnswer(answer)) {
    return { success: false, error: "Recovery answer is required." };
  }

  let destination: string;
  try {
    const user = await userService.setFirstLoginRecoveryAnswer(session.userId, answer);
    await createSession(user, session.rememberMe);
    destination = destinationFor(user);
  } catch {
    return { success: false, error: "Unable to save the recovery answer." };
  }

  redirect(destination);
}

export async function logoutAction() {
  try {
    const session = await getSession();
    await emitLogoutAuditForSession(session, {
      getUserById: (userId) => userService.getUserById(userId),
      emit: (event) => auditService.emit(event),
    });
  } catch {
    console.error("Logout audit persistence failed.", {
      eventType: "AuthenticationLoggedOut",
    });
  }
  await deleteSession();
  redirect("/login");
}
