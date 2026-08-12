"use client";

import React, { useTransition, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { loginAction } from "@/features/auth/authActions";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

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

  const onSubmit = (data: LoginFormValues) => {
    setServerError(null);
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
      }
    });
  };

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
          <CardTitle className="text-2xl font-bold tracking-tight text-brand-text">St. Rose</CardTitle>
          <CardDescription className="text-sm font-medium text-brand-text-muted mt-1">
            Diagnostic Laboratory
          </CardDescription>
        </div>
        <div className="pt-2">
          <h2 className="text-xl font-semibold text-brand-text">Welcome back</h2>
          <p className="text-sm text-brand-text-muted mt-1">Enter your credentials to access the system</p>
        </div>
      </CardHeader>
      
      <form id="login-form" onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {serverError && (
            <div className="rounded-md bg-brand-danger/10 p-3 text-sm text-brand-danger border border-brand-danger/20">
              {serverError}
            </div>
          )}
          
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium leading-none text-brand-text peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Username
            </label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your username"
              autoComplete="username"
              disabled={isPending}
              {...register("username")}
            />
            {errors.username && (
              <p className="text-sm font-medium text-brand-danger">{errors.username.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium leading-none text-brand-text peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Password
              </label>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isPending}
                {...register("password")}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm font-medium text-brand-danger">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="rememberMe"
                className="h-4 w-4 rounded border-brand-text-muted text-brand-primary focus:ring-brand-primary"
                disabled={isPending}
                {...register("rememberMe")}
              />
              <label htmlFor="rememberMe" className="text-sm font-medium leading-none text-brand-text peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Remember me
              </label>
            </div>
            <Link 
              href="/forgot-password" 
              className="text-sm font-medium text-brand-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </CardContent>
        
        <CardFooter className="pt-2 pb-6">
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
