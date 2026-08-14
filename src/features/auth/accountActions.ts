"use server";

import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PasswordChangeRateLimitError } from "@/lib/password-change-rate-limit";
import { createSession, getSession } from "@/lib/session";
import { userService } from "@/services/user-service-instance";

export type PasswordChangeActionResult =
  | { success: true }
  | { success: false; error: string };

const PASSWORD_CHANGE_FAILED = "Unable to change the password.";
const PASSWORD_CHANGE_TRY_LATER =
  "Password change is temporarily unavailable. Please try again later.";

async function getClientIp(): Promise<string | null> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || requestHeaders.get("x-real-ip")?.trim() || null;
}

export async function changeOwnPasswordAction(
  formData: FormData
): Promise<PasswordChangeActionResult> {
  const session = await getSession();
  if (!session) redirect("/login");

  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return { success: false, error: PASSWORD_CHANGE_FAILED };
  }
  if (newPassword.length < 6 || newPassword.length > 100) {
    return {
      success: false,
      error: "Password must be between 6 and 100 characters.",
    };
  }
  if (newPassword !== confirmPassword) {
    return { success: false, error: "Passwords do not match." };
  }

  try {
    const user = await userService.changeOwnPassword(
      session.userId,
      currentPassword,
      newPassword,
      await getClientIp()
    );
    await createSession(user, session.rememberMe);
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof PasswordChangeRateLimitError) {
      return { success: false, error: PASSWORD_CHANGE_TRY_LATER };
    }
    return { success: false, error: PASSWORD_CHANGE_FAILED };
  }
}
