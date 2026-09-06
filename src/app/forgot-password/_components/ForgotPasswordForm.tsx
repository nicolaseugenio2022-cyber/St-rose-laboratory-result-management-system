"use client";

import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthShell } from "../../_components/AuthShell";
import { AuthSteps } from "../../_components/AuthSteps";
import {
  completeRecoveryResetAction,
  startRecoveryAction,
  verifyRecoveryAnswerAction,
} from "@/features/auth/forgotPasswordActions";

type RecoveryStage = "username" | "answer" | "reset";

/**
 * Recovery is three server-enforced stages. The state machine is unchanged - the same three
 * actions, the same transitions, the same sanitised messages, and the same redirect to /login
 * that `completeRecoveryResetAction` performs on success, which is why there is no in-page
 * success screen to design. What changed is that the sequence is now drawn by the shared
 * `AuthSteps` rail, so it and first-login state their progress in one vocabulary instead of two.
 */
const RECOVERY_STEPS = [
  { stage: "username", label: "Identify account" },
  { stage: "answer", label: "Verify answer" },
  { stage: "reset", label: "New password" },
] as const satisfies ReadonlyArray<{ stage: RecoveryStage; label: string }>;

const RECOVERY_STEP_LABELS = RECOVERY_STEPS.map((step) => step.label);

/**
 * The recessed reference panel: the question the operator reads while answering.
 *
 * It sits on the structural tint rather than being a second card, because it is context for the
 * field beneath it and not an object in its own right - one elevated surface per screen.
 */
function SecurityQuestionPanel({ question }: { question: string | null }) {
  return (
    <div className="rounded-md border border-brand-border bg-brand-structural px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">
        Security question
      </p>
      <p className="mt-1 text-[13px] font-semibold leading-snug text-brand-text">{question}</p>
    </div>
  );
}

/**
 * The reveal control geometry, stated once so the three fields cannot drift apart.
 *
 * 44x44 at every width, now that the field itself is 44 tall. It is offset from the TOP of the
 * wrapper - 13px label plus the 6px label gap - rather than centred on it: the wrapper also
 * holds the field's validation message, so a centred control slides down over that message the
 * moment one appears. Anchoring to the top pins it to the field in every state.
 */
const REVEAL_BUTTON_CLASS =
  "absolute right-3 top-[19px] inline-flex h-11 w-11 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring";

export function ForgotPasswordForm() {
  const [stage, setStage] = useState<RecoveryStage>("username");
  const [securityQuestion, setSecurityQuestion] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Keyboard focus follows the stage. Without this the caret stays on a control that no longer
  // exists and the operator has to tab back into the form after every transition. Guarded on the
  // stage the component mounted with, so arriving at the page never steals focus.
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const mountedStageRef = useRef<RecoveryStage>(stage);
  useEffect(() => {
    if (stage === mountedStageRef.current) return;
    firstFieldRef.current?.focus();
  }, [stage]);

  function submit(formData: FormData) {
    setServerError(null);
    startTransition(async () => {
      if (stage === "username") {
        const result = await startRecoveryAction(formData);
        if (!result.success) {
          setServerError(result.error);
          return;
        }
        setSecurityQuestion(result.securityQuestion);
        setStage("answer");
        return;
      }

      if (stage === "answer") {
        const result = await verifyRecoveryAnswerAction(formData);
        if (!result.success) {
          setServerError(result.error);
          return;
        }
        setStage("reset");
        return;
      }

      const result = await completeRecoveryResetAction(formData);
      if (result && !result.success) setServerError(result.error);
    });
  }

  const currentIndex = RECOVERY_STEPS.findIndex((step) => step.stage === stage);

  const title =
    stage === "username"
      ? "Reset your password"
      : stage === "answer"
        ? "Verify your recovery answer"
        : "Set a new password";
  const description =
    stage === "username"
      ? "Enter your username to begin password recovery."
      : stage === "answer"
        ? "Answer the security question configured for your account."
        : "Choose a new password between 6 and 100 characters.";
  const submitLabel =
    stage === "username" ? "Continue" : stage === "answer" ? "Verify Answer" : "Reset Password";
  const pendingLabel =
    stage === "username" ? "Checking..." : stage === "answer" ? "Verifying..." : "Saving...";

  return (
    <AuthShell
      title={title}
      description={description}
      steps={
        <AuthSteps
          label="Password recovery progress"
          steps={RECOVERY_STEP_LABELS}
          currentIndex={currentIndex}
        />
      }
      footer={
        // Available at every stage: recovery is the flow an operator is most likely to enter by
        // mistake, and the way out must not depend on how far in they got.
        <div className="flex justify-center">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-sm text-[13px] font-semibold text-brand-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 sm:min-h-9"
          >
            Back to login
          </Link>
        </div>
      }
    >
      <form action={submit} className="space-y-4">
        {/* The shared Alert carries role="alert", so a rejected attempt is announced rather than
            only drawn. The message text is unchanged: these strings are deliberately sanitised
            server-side so that a wrong username and a wrong answer are indistinguishable, and
            nothing here inspects, splits or re-words them. */}
        {serverError && (
          <Alert variant="destructive">
            <p>{serverError}</p>
          </Alert>
        )}

        {/* Only the controls belonging to the current stage are mounted. */}
        {stage === "username" && (
          <Input
            ref={firstFieldRef}
            id="username"
            name="username"
            label="Username"
            fieldScale="comfortable"
            type="text"
            autoComplete="username"
            disabled={isPending}
            required
          />
        )}

        {stage === "answer" && (
          <>
            <SecurityQuestionPanel question={securityQuestion} />

            {/* 44x44 at every width, centred on the control rather than on the wrapper - the
                wrapper also holds the field's own label row, so the fixed nudge corrects for it.
                Same geometry as the first-login reveal control. */}
            <div className="relative">
              <Input
                ref={firstFieldRef}
                id="answer"
                name="answer"
                label="Recovery answer"
                fieldScale="comfortable"
                type={showAnswer ? "text" : "password"}
                autoComplete="off"
                disabled={isPending}
                required
                className="pr-14"
              />
              <button
                type="button"
                onClick={() => setShowAnswer(!showAnswer)}
                aria-label={showAnswer ? "Hide recovery answer" : "Show recovery answer"}
                aria-pressed={showAnswer}
                className={REVEAL_BUTTON_CLASS}
              >
                {showAnswer ? (
                  <EyeOff aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Eye aria-hidden="true" className="h-4 w-4" />
                )}
              </button>
            </div>
          </>
        )}

        {stage === "reset" && (
          <>
            <div className="relative">
              <Input
                ref={firstFieldRef}
                id="password"
                name="password"
                label="New password"
                fieldScale="comfortable"
                type={showNewPassword ? "text" : "password"}
                minLength={6}
                maxLength={100}
                autoComplete="new-password"
                disabled={isPending}
                required
                className="pr-14"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                aria-pressed={showNewPassword}
                className={REVEAL_BUTTON_CLASS}
              >
                {showNewPassword ? (
                  <EyeOff aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Eye aria-hidden="true" className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                label="Confirm new password"
                fieldScale="comfortable"
                type={showConfirmPassword ? "text" : "password"}
                minLength={6}
                maxLength={100}
                autoComplete="new-password"
                disabled={isPending}
                required
                className="pr-14"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={
                  showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                }
                aria-pressed={showConfirmPassword}
                className={REVEAL_BUTTON_CLASS}
              >
                {showConfirmPassword ? (
                  <EyeOff aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Eye aria-hidden="true" className="h-4 w-4" />
                )}
              </button>
            </div>
          </>
        )}

        {/* Disabled while pending, so a second press cannot start a second recovery attempt
            against the rate limiter. */}
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-md"
          disabled={isPending}
          aria-busy={isPending || undefined}
        >
          {isPending ? (
            <>
              <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 motion-safe:animate-spin" />
              {pendingLabel}
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
