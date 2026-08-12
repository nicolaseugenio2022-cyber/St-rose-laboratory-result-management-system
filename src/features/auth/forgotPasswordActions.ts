"use server";

import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RecoveryRateLimitError } from "@/lib/recovery-rate-limit";
import {
  clearRecoveryState,
  issueRecoveryState,
  readRecoveryState,
} from "@/lib/recovery-state";
import { canonicalizeUsername } from "@/lib/username";
import {
  RecoveryResetConflictError,
} from "@/services/userService";
import { userService } from "@/services/user-service-instance";

export type StartRecoveryActionResult =
  | { success: true; securityQuestion: string }
  | { success: false; error: string };

export type RecoveryActionResult =
  | { success: true }
  | { success: false; error: string };

const RECOVERY_UNAVAILABLE =
  "Unable to start password recovery. Check the username and try again.";
const RECOVERY_STATE_INVALID =
  "This password recovery request is invalid or has expired. Please start again.";
const RECOVERY_ANSWER_INVALID =
  "Unable to verify the recovery answer. Check your answer and try again.";
const RECOVERY_TRY_LATER =
  "Password recovery is temporarily unavailable. Please try again later.";
const RECOVERY_RESET_FAILED =
  "Unable to reset the password. Please start password recovery again.";

async function getClientIp(): Promise<string | null> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || requestHeaders.get("x-real-ip")?.trim() || null;
}

async function rejectInvalidRecoveryState(): Promise<RecoveryActionResult> {
  await clearRecoveryState();
  return { success: false, error: RECOVERY_STATE_INVALID };
}

export async function startRecoveryAction(
  formData: FormData
): Promise<StartRecoveryActionResult> {
  const usernameValue = formData.get("username");
  const username = canonicalizeUsername(
    typeof usernameValue === "string" ? usernameValue : ""
  );
  const clientIp = (await getClientIp()) ?? "unknown";

  try {
    const challenge = await userService.getRecoveryChallenge(username, clientIp);
    if (!challenge.eligible) {
      await clearRecoveryState();
      return { success: false, error: RECOVERY_UNAVAILABLE };
    }

    await issueRecoveryState({
      userId: challenge.userId,
      stage: "answer",
      tokenVersionAtIssue: challenge.tokenVersion,
    });
    return { success: true, securityQuestion: challenge.securityQuestion };
  } catch {
    await clearRecoveryState();
    return { success: false, error: RECOVERY_UNAVAILABLE };
  }
}

export async function verifyRecoveryAnswerAction(
  formData: FormData
): Promise<RecoveryActionResult> {
  const state = await readRecoveryState();
  if (!state || state.stage !== "answer") {
    return rejectInvalidRecoveryState();
  }

  const answerValue = formData.get("answer");
  if (typeof answerValue !== "string" || !answerValue.trim()) {
    return { success: false, error: "Recovery answer is required." };
  }

  const recoveryUser = await userService.getUserById(state.userId);
  if (
    !recoveryUser ||
    recoveryUser.status !== "Active" ||
    recoveryUser.tokenVersion !== state.tokenVersionAtIssue
  ) {
    return rejectInvalidRecoveryState();
  }

  try {
    const result = await userService.verifyRecoveryAnswer(
      recoveryUser.username,
      answerValue,
      (await getClientIp()) ?? "unknown"
    );
    if (
      !result.verified ||
      result.userId !== state.userId ||
      result.tokenVersion !== state.tokenVersionAtIssue
    ) {
      return { success: false, error: RECOVERY_ANSWER_INVALID };
    }

    await issueRecoveryState({
      userId: state.userId,
      stage: "reset",
      tokenVersionAtIssue: state.tokenVersionAtIssue,
    });
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof RecoveryRateLimitError) {
      return { success: false, error: RECOVERY_TRY_LATER };
    }
    return { success: false, error: RECOVERY_ANSWER_INVALID };
  }
}

export async function completeRecoveryResetAction(
  formData: FormData
): Promise<RecoveryActionResult> {
  const state = await readRecoveryState();
  if (!state || state.stage !== "reset") {
    return rejectInvalidRecoveryState();
  }

  const passwordValue = formData.get("password");
  const confirmationValue = formData.get("confirmPassword");
  if (
    typeof passwordValue !== "string" ||
    passwordValue.length < 6 ||
    passwordValue.length > 100
  ) {
    return {
      success: false,
      error: "Password must be between 6 and 100 characters.",
    };
  }
  if (typeof confirmationValue !== "string" || passwordValue !== confirmationValue) {
    return { success: false, error: "Passwords do not match." };
  }

  try {
    const result = await userService.resetPasswordAfterRecovery(
      state.userId,
      state.tokenVersionAtIssue,
      passwordValue
    );
    if (result.tokenVersion !== state.tokenVersionAtIssue + 1) {
      await clearRecoveryState();
      return { success: false, error: RECOVERY_RESET_FAILED };
    }
  } catch (error: unknown) {
    if (error instanceof RecoveryRateLimitError) {
      return { success: false, error: RECOVERY_TRY_LATER };
    }
    if (error instanceof RecoveryResetConflictError) {
      await clearRecoveryState();
      return { success: false, error: RECOVERY_RESET_FAILED };
    }
    return { success: false, error: RECOVERY_RESET_FAILED };
  }

  await clearRecoveryState();
  redirect("/login");
}
