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
    <AuthShell
      title="Sign in"
      description="Enter your credentials to access the laboratory system."
      banner={
        serverError && (
          // The shared Alert carries role="alert", so the failure is announced rather than only
          // drawn. The previous markup styled this box with alpha modifiers on the danger colour.
          // Those colours are backed by CSS custom properties, and Tailwind emits no rule at all
          // for an alpha modifier on one - so the box rendered with no background and no border.
          <Alert variant="destructive">
            <p>{serverError}</p>
            {isLocked && retryAfterMs !== null && (
              // Polite, not assertive: the countdown reannounces every second, and an assertive
              // region would interrupt a screen reader continuously.
              <p aria-live="polite" className="mt-1 font-semibold">
                Try again in {formatRetryAfter(retryAfterMs)}.
              </p>
            )}
          </Alert>
        )
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Input owns its own label and error wiring - htmlFor, aria-describedby and the error
            id - so the message is associated with the field instead of merely sitting near it. */}
        <Input
          id="username"
          label="Username"
          type="text"
          placeholder="Enter your username"
          autoComplete="username"
          disabled={isPending}
          error={errors.username?.message}
          {...register("username")}
        />

        <div className="relative">
          <Input
            id="password"
            label="Password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            autoComplete="current-password"
            disabled={isPending}
            error={errors.password?.message}
            className="pr-10"
            {...register("password")}
          />
          {/* 44x44 on a phone, shrinking on larger pointers. The box is centred on the
              wrapper, and the wrapper includes the field's own label row (11px label plus the
              6px gap), so a fixed 11px nudge re-centres it on the control itself. */}
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 mt-[11px] inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring sm:h-9 sm:w-9 sm:min-h-0 sm:min-w-0"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Eye aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
          <label
            htmlFor="rememberMe"
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-brand-text sm:min-h-0"
          >
            <input
              type="checkbox"
              id="rememberMe"
              className="h-4 w-4 rounded border-brand-border-strong text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
              disabled={isPending}
              {...register("rememberMe")}
            />
            <span className="font-medium">Remember me</span>
          </label>

          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 sm:min-h-0"
          >
            Forgot password?
          </Link>
        </div>

        {/* Disabled while pending, so a second press cannot start a second sign-in; also disabled
            while locked out, exactly as before. */}
        <Button type="submit" size="lg" className="w-full" disabled={isPending || isLocked}>
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
