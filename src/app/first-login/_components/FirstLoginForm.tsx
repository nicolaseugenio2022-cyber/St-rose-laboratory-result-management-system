"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2, LogOut } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthShell } from "../../_components/AuthShell";
import { AuthSteps } from "../../_components/AuthSteps";
import {
  changeFirstLoginPasswordAction,
  logoutAction,
  setFirstLoginRecoveryAnswerAction,
} from "@/features/auth/authActions";

export interface FirstLoginFormProps {
  step: "password" | "recovery";
  securityQuestion?: string | null;
}

/**
 * The two mandatory setups, in the order the route guard already enforces: /first-login/password
 * is only left once mustChangePassword clears, and /first-login/recovery only once mustSetRecovery
 * clears. This array is presentation for that existing order - it does not define, add, or reorder
 * anything, and each screen still renders exactly one of these steps.
 *
 * It is drawn by the shared `AuthSteps` rail, the same one recovery uses, so an operator meeting
 * both flows meets one way of stating progress rather than two.
 */
const SETUP_STEPS = ["Password", "Recovery answer"] as const;

/**
 * First-login setup surface.
 *
 * Presentation only. The step prop, both server actions and their FormData field names, the
 * 6-100 character password bounds enforced on the field, the masked recovery answer and the
 * verbatim server error text are all unchanged; the screen simply says which of the two required
 * setups the operator is on, and shows only that step's controls.
 */
export function FirstLoginForm({ step, securityQuestion }: FirstLoginFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showAnswer, setShowAnswer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const isPasswordStep = step === "password";

  function submit(formData: FormData) {
    setServerError(null);
    startTransition(async () => {
      const result = isPasswordStep
        ? await changeFirstLoginPasswordAction(formData)
        : await setFirstLoginRecoveryAnswerAction(formData);
      if (result && !result.success) setServerError(result.error);
    });
  }

  function logout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <AuthShell
      title={isPasswordStep ? "Change your password" : "Set your recovery answer"}
      description={
        isPasswordStep
          ? "A new password is required before you can access the system."
          : "Enter the private answer for the security question configured on your account."
      }
      steps={
        <AuthSteps
          label="First sign-in setup"
          steps={SETUP_STEPS}
          currentIndex={isPasswordStep ? 0 : 1}
        />
      }
      footer={
        // Outside the form, because it is not a submission. Disabled alongside the submit button
        // while a credential mutation is in flight, so a sign-out cannot race it. Drawn as the
        // quiet action every auth footer uses, but on the shared Button, so it keeps a control's
        // disabled and focus behaviour.
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 rounded-md text-[13px] text-brand-primary underline-offset-2 hover:bg-transparent hover:text-brand-primary-hover hover:underline active:bg-transparent sm:min-h-9"
            disabled={isPending}
            onClick={logout}
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Logout
          </Button>
        </div>
      }
    >
      <form action={submit} className="space-y-4">
        {/* The shared Alert carries role="alert", so a rejected submission is announced rather
            than only drawn. The message itself is the server's own text, unchanged. */}
        {serverError && <Alert variant="destructive">{serverError}</Alert>}

        {isPasswordStep ? (
          // Input owns the label, htmlFor and any error wiring. Bounds unchanged: 6-100.
          <Input
            id="password"
            name="password"
            label="New password"
            fieldScale="comfortable"
            type="password"
            minLength={6}
            maxLength={100}
            autoComplete="new-password"
            disabled={isPending}
            required
          />
        ) : (
          <>
            {/* The question is context for the field below it, so it sits on the structural
                surface - recessed, flat, no second elevation inside the working surface. */}
            <div className="rounded-md border border-brand-border bg-brand-structural px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">
                Security question
              </p>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-brand-text">
                {securityQuestion}
              </p>
            </div>
            <div className="relative">
              <Input
                id="answer"
                name="answer"
                label="Recovery answer"
                fieldScale="comfortable"
                type={showAnswer ? "text" : "password"}
                autoComplete="off"
                disabled={isPending}
                required
                className="pr-10"
              />
              {/* 44x44 at every width now that the field itself is 44 tall. Centred on the
                  wrapper plus a fixed nudge for the field's own label row (13px label plus the
                  6px gap), which lands it on the control. This field renders no inline
                  validation message - rejections arrive in the Alert above - so the wrapper
                  never grows underneath it and the centred anchor stays correct. Login and
                  recovery, whose fields DO carry inline messages, anchor from the top
                  instead. */}
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 mt-[9px] inline-flex h-11 w-11 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
                onClick={() => setShowAnswer(!showAnswer)}
                aria-label={showAnswer ? "Hide recovery answer" : "Show recovery answer"}
                aria-pressed={showAnswer}
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

        {/* Disabled while pending, so a second press cannot start a second credential mutation. */}
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
              Saving...
            </>
          ) : isPasswordStep ? (
            "Change Password"
          ) : (
            "Save Recovery Answer"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
