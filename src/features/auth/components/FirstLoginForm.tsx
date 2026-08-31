"use client";

import { useState, useTransition } from "react";
import { Check, Eye, EyeOff, Loader2, LogOut } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/utils/cn";
import { AuthShell } from "./AuthShell";
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
 */
const SETUP_STEPS = [
  { key: "password", ordinal: "Step 1", label: "Password" },
  { key: "recovery", ordinal: "Step 2", label: "Recovery answer" },
] as const;

/**
 * Two-step trail, drawn as a rail rather than a row of boxes.
 *
 * Each step owns one segment of a top rail. The rail is teal up to and including the current
 * step and muted beyond it, so progress reads as a fill; the current step is the only one with
 * a navy label, and the completed step carries a teal check.
 *
 * State is never carried by colour alone: every item states "Done", "Current step" or "Not started"
 * in words, and the completed step also carries a check mark. `aria-current="step"` marks the active
 * item, so assistive technology reads position in the sequence rather than inferring it from a tint.
 */
function SetupSteps({ step }: { step: FirstLoginFormProps["step"] }) {
  const currentIndex = SETUP_STEPS.findIndex((entry) => entry.key === step);

  return (
    <nav aria-label="First sign-in setup">
      <ol className="grid grid-cols-2 gap-3">
        {SETUP_STEPS.map((entry, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          const status = isDone ? "Done" : isCurrent ? "Current step" : "Not started";

          return (
            <li
              key={entry.key}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "min-w-0 border-t-2 pt-2",
                isDone || isCurrent ? "border-brand-primary" : "border-brand-border"
              )}
            >
              <p
                className={cn(
                  "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
                  isDone || isCurrent ? "text-brand-primary" : "text-brand-text-muted"
                )}
              >
                {isDone && <Check aria-hidden="true" className="h-3 w-3 shrink-0" />}
                {entry.ordinal}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-[13px] font-semibold leading-tight",
                  isCurrent
                    ? "text-brand-navy"
                    : isDone
                      ? "text-brand-text"
                      : "text-brand-text-muted"
                )}
              >
                {entry.label}
              </p>
              <p className="mt-0.5 text-[11px] text-brand-text-muted">{status}</p>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

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
      banner={<SetupSteps step={step} />}
      footer={
        // Outside the form, because it is not a submission. Disabled alongside the submit button
        // while a credential mutation is in flight, so a sign-out cannot race it. Drawn as the
        // secondary text action every auth footer uses - teal, semibold, centred - but on the
        // shared Button, so it keeps a control's disabled and focus behaviour.
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 text-brand-primary underline-offset-2 hover:bg-transparent hover:text-brand-primary-hover hover:underline active:bg-transparent sm:min-h-0"
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
            than only drawn. The previous box tinted itself with alpha modifiers on var()-backed
            brand colours, for which Tailwind emits no rule at all, so it rendered with no
            background and no border. Solid danger tokens now. The message itself is unchanged. */}
        {serverError && <Alert variant="destructive">{serverError}</Alert>}

        {isPasswordStep ? (
          // Input owns the label, htmlFor and any error wiring. Bounds unchanged: 6-100.
          <Input
            id="password"
            name="password"
            label="New Password"
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
            <div className="rounded-md border border-brand-border bg-brand-structural px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">
                Security Question
              </p>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-brand-text">
                {securityQuestion}
              </p>
            </div>
            <div className="relative">
              <Input
                id="answer"
                name="answer"
                label="Recovery Answer"
                type={showAnswer ? "text" : "password"}
                autoComplete="off"
                disabled={isPending}
                required
                className="pr-10"
              />
              {/* 44x44 on a phone, shrinking on larger pointers. The box is centred on the
                  wrapper, and the wrapper now includes the field's own label row (11px label
                  plus the 6px gap), so a fixed 11px nudge re-centres it on the control itself. */}
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 mt-[11px] inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring sm:h-9 sm:w-9 sm:min-h-0 sm:min-w-0"
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
          className="w-full"
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
