import React, { forwardRef } from "react";
import { cn } from "@/utils/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading = false, disabled, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-md font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-60 disabled:pointer-events-none";

    // danger darkens along its own hue: --color-danger is #b91c1c (red-700), so
    // rose-700/800 swung the button toward pink on hover rather than deepening it.
    const variants = {
      primary: "bg-brand-primary text-brand-primary-foreground shadow-sm hover:bg-brand-primary-hover active:shadow-none",
      secondary: "bg-brand-secondary text-brand-secondary-foreground shadow-sm hover:bg-brand-secondary-hover active:bg-slate-950 active:shadow-none",
      outline: "border border-brand-border bg-brand-surface text-brand-text hover:border-slate-400 hover:bg-brand-surface-hover active:bg-slate-200",
      ghost: "text-brand-text-muted hover:bg-brand-surface-hover hover:text-brand-text active:bg-slate-200",
      danger: "bg-brand-danger text-white shadow-sm hover:bg-red-800 active:bg-red-900 active:shadow-none",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-11 px-5 text-base gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {/* The label survives the pending state. Replacing children with "Loading..."
            discarded the only thing that said WHICH action was running, changed the
            button's accessible name mid-submit, and jumped its width -- reflowing the
            dialog footer it sits in. aria-busy carries the state instead. */}
        {isLoading && (
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
