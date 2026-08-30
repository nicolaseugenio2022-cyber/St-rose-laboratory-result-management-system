import React, { forwardRef, useId } from "react";
import { cn } from "@/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", label, error, helperText, id, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    // Unique per instance so two fields sharing a label cannot collide on a message id.
    const reactId = useId();
    const errorId = `${inputId ?? reactId}-error`;
    const helperId = `${inputId ?? reactId}-helper`;
    // The message is bound to the field rather than left floating beside it. Set before
    // the prop spread, so a consumer passing its own aria-describedby still wins.
    const describedBy = error ? errorId : helperText ? helperId : undefined;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          ref={ref}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "flex h-10 w-full rounded-md border border-brand-border bg-brand-surface px-3 text-sm text-brand-text placeholder:text-brand-text-subtle transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-focus-ring/40 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
            error && "border-brand-danger focus:border-brand-danger focus:ring-brand-danger/30",
            className
          )}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-[11px] font-medium text-brand-danger">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-[11px] text-brand-text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
