"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { firstLoginRedirectPath } from "@/lib/first-login-gate";
import { LoginRateLimitError } from "@/lib/login-rate-limit";
import { normalizeSecurityAnswer } from "@/lib/password";
import { describeErrorShape } from "@/lib/safe-error";
import { createSession, deleteSession, getSession } from "@/lib/session";
import { canonicalizeUsername } from "@/lib/username";
import { emitLogoutAuditForSession } from "@/features/auth/logout-audit";
import { auditService } from "@/services/audit-service-instance";
import { userService } from "@/services/user-service-instance";
import { InvalidCredentialsError } from "@/services/userService";

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
    // SHADCN-07B3: the session is established BEFORE the success audit claims one exists. If
    // createSession throws, control leaves for the catch below and no AuthenticationSucceeded row
    // is ever written - the audit can no longer assert a login the operator did not get. The emit
    // itself swallows its own persistence failure, so a lost audit write still cannot turn a
    // successfully issued session into a false failure.
    await createSession(user, rememberMe);
    await userService.emitAuthenticatedSessionEstablished(user);
    destination = destinationFor(user);
  } catch (error: unknown) {
    if (error instanceof LoginRateLimitError) {
      return {
        success: false,
        error: "Too many login attempts. Please try again later.",
      };
    }
    // Only a genuine credential rejection may be reported as one. InvalidCredentialsError is the
    // single class authenticate throws for a wrong password, an unknown username, and an inactive
    // account - deliberately one message for all three, so nothing here can be used to enumerate
    // accounts.
    if (error instanceof InvalidCredentialsError) {
      return { success: false, error: "Invalid username or password." };
    }
    // Anything else is an infrastructure failure - a stalled connection, a rate-limiter backend
    // error, a session-write failure - and telling the user their password was wrong would be
    // false. SHADCN-07B3: the diagnostic is the SHADCN-07B1 sanitized shape rather than the raw
    // constructor name it logged before - an unallowlisted, caller-influenceable string of exactly
    // the kind 07B1 closed elsewhere. Fixed route and stage identifiers only: never the username,
    // the form data, the credential material, a token, a cookie, or the raw message.
    console.error("Login failed for a non-credential reason.", {
      route: "/login",
      stage: "loginAction",
      ...describeErrorShape(error),
    });
    return { success: false, error: "Unable to sign in right now. Please try again." };
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
