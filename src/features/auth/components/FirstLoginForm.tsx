"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2, LogOut } from "lucide-react";
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
  changeFirstLoginPasswordAction,
  logoutAction,
  setFirstLoginRecoveryAnswerAction,
} from "@/features/auth/authActions";

export interface FirstLoginFormProps {
  step: "password" | "recovery";
  securityQuestion?: string | null;
}

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
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-3 pb-6 text-center">
        <div className="mx-auto flex items-center justify-center">
          <Image
            src="/st-rose-logo-official.png"
            alt="St. Rose Diagnostic Laboratory"
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
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
          <h2 className="text-xl font-semibold text-brand-text">
            {isPasswordStep ? "Change your password" : "Set your recovery answer"}
          </h2>
          <p className="mt-1 text-sm text-brand-text-muted">
            {isPasswordStep
              ? "A new password is required before you can access the system."
              : "Enter the private answer for the security question configured on your account."}
          </p>
        </div>
      </CardHeader>

      <form action={submit}>
        <CardContent className="space-y-4">
          {serverError && (
            <div className="rounded-md border border-brand-danger/20 bg-brand-danger/10 p-3 text-sm text-brand-danger">
              {serverError}
            </div>
          )}

          {isPasswordStep ? (
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
        </CardContent>

        <CardFooter className="flex-col gap-3 pb-6 pt-4">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isPasswordStep ? (
              "Change Password"
            ) : (
              "Save Recovery Answer"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={isPending}
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
