"use client";

import React, { useTransition, useState, useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthShell } from "../_components/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { loginAction } from "@/features/auth/authActions";
import { getLockoutRetryAfterAction } from "@/features/auth/lockout-status-actions";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/** "4 minutes 5 seconds" rather than "4 minute(s) 5 second(s)", and no "0 minutes" prefix. */
function formatRetryAfter(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (seconds > 0 || minutes === 0) parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);
  return parts.join(" ");
}

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [retryAfterMs, setRetryAfterMs] = useState<number | null>(null);
  const isLocked = retryAfterMs !== null && retryAfterMs > 0;

  useEffect(() => {
    if (!isLocked) return;
    const timer = setInterval(() => {
      setRetryAfterMs((prev) => {
        if (prev === null || prev <= 1000) return null;
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLocked]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  // Unchanged: the same FormData, the same loginAction, the same lockout follow-up on the same
  // exact message, the same generic server error surfaced verbatim. Only its presentation moved.
  const onSubmit = (data: LoginFormValues) => {
    setServerError(null);
    setRetryAfterMs(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("username", data.username);
      formData.append("password", data.password);
      formData.append("rememberMe", String(!!data.rememberMe));

      const result = await loginAction(formData);

      // If we reach here, it means the server action returned an error
      // (a successful login redirects and doesn't return here)
      if (result && !result.success) {
        setServerError(result.error);

        if (result.error === "Too many login attempts. Please try again later.") {
          const status = await getLockoutRetryAfterAction({ username: data.username });
          if (status.retryAfterMs > 0) {
            setRetryAfterMs(status.retryAfterMs);
          }
        }
      }
    });
  };

  return (
    <AuthShell title="Sign in" description="Enter your credentials to access the laboratory system.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* The failure sits inside the form, directly above the fields it concerns - the same
            position recovery and first-login use, which is what makes the three read as one
            screen. The shared Alert carries role="alert", so it is announced rather than only
            drawn, and every message is the server's own text, surfaced verbatim: an invalid
            credential, a temporary "unable to sign in right now", and the generic lockout
            notice all arrive here unaltered. */}
        {serverError && (
          <div className="space-y-1.5">
            <Alert variant="destructive">
              <p>{serverError}</p>
            </Alert>
            {isLocked && retryAfterMs !== null && (
              // Deliberately a SIBLING of the Alert rather than a child. Alert carries
              // role="alert", which is an assertive live region, and a nested polite region does
              // not override an assertive ancestor - the countdown was therefore re-announced
              // assertively every second, interrupting a screen reader continuously. Out here it
              // owns its own polite region and announces without interrupting, while the Alert is
              // left holding only the static server message it is meant to announce once.
              <p
                aria-live="polite"
                className="px-3 text-xs font-semibold tabular-nums text-brand-danger"
              >
                Try again in {formatRetryAfter(retryAfterMs)}.
              </p>
            )}
          </div>
        )}

        {/* Input owns its own label and error wiring - htmlFor, aria-describedby and the error
            id - so the message is associated with the field instead of merely sitting near it.
            The comfortable scale is the shared field at its 44px form size: on this screen the
            field IS the task, so it is not the 36px worksheet control. */}
        <Input
          id="username"
          label="Username"
          fieldScale="comfortable"
          type="text"
          autoComplete="username"
          disabled={isPending}
          error={errors.username?.message}
          {...register("username")}
        />

        <div className="relative">
          <Input
            id="password"
            label="Password"
            fieldScale="comfortable"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            disabled={isPending}
            error={errors.password?.message}
            className="pr-14"
            {...register("password")}
          />
          {/* 44x44 at every width now that the field itself is 44 tall, so the target is
              comfortable with a mouse as well as a finger.

              Offset from the TOP of the wrapper (13px label + the 6px label gap), not centred
              on it. Centring measures the whole wrapper, which also holds the validation
              message - so the moment "Password is required" appeared, the control slid down
              over it. Anchoring to the top pins it to the field in every state. */}
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-3 top-[19px] inline-flex h-11 w-11 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Eye aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-0.5">
          <label
            htmlFor="rememberMe"
            className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px] text-brand-text sm:min-h-0"
          >
            {/* accent-brand-primary is what actually colours a native checkbox; the previous
                text-brand-primary set a text colour the control never reads. */}
            <input
              type="checkbox"
              id="rememberMe"
              className="h-4 w-4 rounded border-brand-border-strong accent-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-1"
              disabled={isPending}
              {...register("rememberMe")}
            />
            <span className="font-medium">Remember me</span>
          </label>

          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center rounded-sm text-[13px] font-semibold text-brand-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 sm:min-h-0"
          >
            Forgot password?
          </Link>
        </div>

        {/* Disabled while pending, so a second press cannot start a second sign-in; also disabled
            while locked out, exactly as before. */}
        <Button type="submit" size="lg" className="w-full rounded-md" disabled={isPending || isLocked}>
          {isPending ? (
            <>
              <Loader2
                aria-hidden="true"
                className="mr-2 h-4 w-4 motion-safe:animate-spin"
              />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
