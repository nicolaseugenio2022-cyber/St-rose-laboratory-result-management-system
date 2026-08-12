"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  completeRecoveryResetAction,
  startRecoveryAction,
  verifyRecoveryAnswerAction,
} from "@/features/auth/forgotPasswordActions";

type RecoveryStage = "username" | "answer" | "reset";

export function ForgotPasswordForm() {
  const [stage, setStage] = useState<RecoveryStage>("username");
  const [securityQuestion, setSecurityQuestion] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

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

  const heading =
    stage === "username"
      ? "Forgot your password?"
      : stage === "answer"
        ? "Verify your recovery answer"
        : "Set a new password";
  const description =
    stage === "username"
      ? "Enter your username to begin password recovery."
      : stage === "answer"
        ? "Answer the security question configured for your account."
        : "Choose a new password between 6 and 100 characters.";

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-3 pb-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-brand-primary-foreground shadow-sm">
          <Image
            src="/st-rose-logo.png"
            alt="St. Rose Diagnostic Laboratory Logo"
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
            priority
          />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold tracking-tight text-brand-text">
            St. Rose
          </CardTitle>
          <CardDescription className="mt-1 text-sm font-medium text-brand-text-muted">
            Diagnostic Laboratory
          </CardDescription>
        </div>
        <div className="pt-2">
          <h2 className="text-xl font-semibold text-brand-text">{heading}</h2>
          <p className="mt-1 text-sm text-brand-text-muted">{description}</p>
        </div>
      </CardHeader>

      <form action={submit}>
        <CardContent className="space-y-4">
          {serverError && (
            <div className="rounded-md border border-brand-danger/20 bg-brand-danger/10 p-3 text-sm text-brand-danger">
              {serverError}
            </div>
          )}

          {stage === "username" && (
            <Input
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
              <div className="rounded-md border border-brand-primary/20 bg-brand-primary/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-text-muted">
                  Security Question
                </p>
                <p className="mt-1 text-base font-semibold text-brand-text">
                  {securityQuestion}
                </p>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="answer"
                  className="block text-xs font-semibold text-brand-text"
                >
                  Recovery Answer
                </label>
                <div className="relative">
                  <Input
                    id="answer"
                    name="answer"
                    type={showAnswer ? "text" : "password"}
                    autoComplete="off"
                    disabled={isPending}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text"
                    onClick={() => setShowAnswer(!showAnswer)}
                    aria-label={showAnswer ? "Hide recovery answer" : "Show recovery answer"}
                  >
                    {showAnswer ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {stage === "reset" && (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-brand-text"
                >
                  New Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-semibold text-brand-text"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={
                      showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex-col gap-3 pb-6 pt-4">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait...
              </>
            ) : stage === "username" ? (
              "Continue"
            ) : stage === "answer" ? (
              "Verify Answer"
            ) : (
              "Reset Password"
            )}
          </Button>
          <Link
            href="/login"
            className="text-sm font-medium text-brand-primary hover:underline"
          >
            Back to login
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
