"use client";

import Link from "next/link";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/utils/cn";
import { AuthShell } from "./AuthShell";
import {
  completeRecoveryResetAction,
  startRecoveryAction,
  verifyRecoveryAnswerAction,
} from "@/features/auth/forgotPasswordActions";

type RecoveryStage = "username" | "answer" | "reset";

/**
 * Recovery is three server-enforced stages, and until now the screen only ever showed one
 * unlabelled form. An operator locked out mid-shift could not tell how far in they were, whether
 * anything had been accepted, or how much was left. The state machine is unchanged - the same
 * three actions, the same transitions, the same sanitised messages - it is now simply visible.
 */
const RECOVERY_STEPS: ReadonlyArray<{ stage: RecoveryStage; label: string }> = [
  { stage: "username", label: "Identify account" },
  { stage: "answer", label: "Verify answer" },
  { stage: "reset", label: "New password" },
];

/**
 * Three-segment rail, one segment per stage.
 *
 * The rail is teal up to and including the current stage and muted beyond it, so progress reads
 * as a fill. State is never carried by colour alone. A completed step swaps its numeral for a
 * check glyph, the current step is the only one with a navy label, and every step carries a
 * screen-reader word - Completed / Current step / Not started - alongside `aria-current="step"`
 * on the active one. The polite live region restates position when the stage advances, because
 * a heading that changes silently is not an announcement.
 */
function RecoveryProgress({ currentIndex }: { currentIndex: number }) {
  const currentStep = RECOVERY_STEPS[currentIndex];

  return (
    <div>
      <p
        aria-hidden="true"
        className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-text-muted"
      >
        Step {currentIndex + 1} of {RECOVERY_STEPS.length}
      </p>
      <p role="status" className="sr-only">
        Step {currentIndex + 1} of {RECOVERY_STEPS.length}: {currentStep.label}.
      </p>

      {/* Three equal columns whose labels wrap within their column, so 375px never produces a
          horizontal overflow. */}
      <ol aria-label="Password recovery progress" className="mt-2 grid grid-cols-3 gap-2">
        {RECOVERY_STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li
              key={step.stage}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "min-w-0 border-t-2 pt-1.5",
                isDone || isCurrent ? "border-brand-primary" : "border-brand-border"
              )}
            >
              <span className="flex items-start gap-1">
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[10px] font-bold leading-none tabular-nums",
                    isDone || isCurrent ? "text-brand-primary" : "text-brand-text-muted"
                  )}
                >
                  {isDone ? <Check aria-hidden="true" className="h-3 w-3" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-[11px] leading-tight",
                    isCurrent ? "font-semibold text-brand-navy" : "font-medium text-brand-text-muted"
                  )}
                >
                  {step.label}
                </span>
              </span>
              <span className="sr-only">
                {isDone ? "Completed" : isCurrent ? "Current step" : "Not started"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

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
      banner={<RecoveryProgress currentIndex={currentIndex} />}
      footer={
        // Available at every stage: recovery is the flow an operator is most likely to enter by
        // mistake, and the way out must not depend on how far in they got.
        <p className="text-center text-xs text-brand-text-muted">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center font-semibold text-brand-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 sm:min-h-0"
          >
            Back to login
          </Link>
        </p>
      }
    >
      <form action={submit} className="space-y-4">
        {/* The shared Alert carries role="alert", so a rejected attempt is announced rather than
            only drawn. The previous markup tinted its own box with alpha modifiers on the danger
            token - and `brand.*` colours resolve to raw CSS `var()`, for which Tailwind emits no
            rule at all under an alpha modifier, so that box rendered with no background and no
            border. Solid `*-bg` / `*-border` tokens inside Alert render. The message text is
            unchanged: these strings are deliberately sanitised server-side. */}
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
            type="text"
            autoComplete="username"
            disabled={isPending}
            required
          />
        )}

        {stage === "answer" && (
          <>
            {/* A flat panel on the structural tint, not a second card: the question is reference
                text the operator reads while answering, not an object in its own right. */}
            <div className="rounded-md border border-brand-border bg-brand-structural px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">
                Security question
              </p>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-brand-text">
                {securityQuestion}
              </p>
            </div>

            {/* 44x44 on a phone, shrinking on larger pointers. The box is centred on the
                wrapper, and the wrapper includes the field's own label row (11px label plus the
                6px gap), so a fixed 11px nudge re-centres it on the control itself. Same
                geometry as the first-login reveal control. */}
            <div className="relative">
              <Input
                ref={firstFieldRef}
                id="answer"
                name="answer"
                label="Recovery answer"
                type={showAnswer ? "text" : "password"}
                autoComplete="off"
                disabled={isPending}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowAnswer(!showAnswer)}
                aria-label={showAnswer ? "Hide recovery answer" : "Show recovery answer"}
                aria-pressed={showAnswer}
                className="absolute right-3 top-1/2 -translate-y-1/2 mt-[11px] inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring sm:h-9 sm:w-9 sm:min-h-0 sm:min-w-0"
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
                type={showNewPassword ? "text" : "password"}
                minLength={6}
                maxLength={100}
                autoComplete="new-password"
                disabled={isPending}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                aria-pressed={showNewPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 mt-[11px] inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring sm:h-9 sm:w-9 sm:min-h-0 sm:min-w-0"
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
                type={showConfirmPassword ? "text" : "password"}
                minLength={6}
                maxLength={100}
                autoComplete="new-password"
                disabled={isPending}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={
                  showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                }
                aria-pressed={showConfirmPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 mt-[11px] inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring sm:h-9 sm:w-9 sm:min-h-0 sm:min-w-0"
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
          className="w-full"
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
