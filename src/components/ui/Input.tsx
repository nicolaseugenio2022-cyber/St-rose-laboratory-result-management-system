import React, { forwardRef } from "react";
import { cn } from "@/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", label, error, helperText, id, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-brand-text">
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          ref={ref}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-1.5 text-xs text-brand-text placeholder:text-brand-text-subtle transition-colors focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-focus-ring disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
            error && "border-brand-danger focus:border-brand-danger focus:ring-brand-danger",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs font-medium text-brand-danger">{error}</p>}
        {!error && helperText && <p className="text-[11px] text-brand-text-muted">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
