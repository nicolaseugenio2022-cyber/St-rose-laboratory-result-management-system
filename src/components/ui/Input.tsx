import React, { forwardRef, useId } from "react";
import { cn } from "@/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

/**
 * Text field.
 *
 * 36px tall from `sm` up so it lines up with a medium Button; 44px below it, where a
 * finger is the pointer. The label sits above in the shared 11px uppercase style, and the
 * error or helper text is bound to the control through aria-describedby.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", label, error, helperText, id, disabled, ...props }, ref) => {
    const reactId = useId();
    // Identity comes from useId, never from label text. Two fields sharing a label used to
    // collapse onto one id. An explicit caller id still wins outright.
    const inputId = id ?? `input-${reactId}`;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    // Set before the prop spread, so a consumer passing its own aria-describedby still wins.
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
            "flex h-11 w-full rounded-md border border-brand-border bg-brand-surface px-3 text-[13px] text-brand-text placeholder:text-slate-500 transition-[border-color,box-shadow] hover:border-brand-border-strong focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring disabled:cursor-not-allowed disabled:bg-brand-structural disabled:text-brand-text-muted disabled:opacity-80 sm:h-9",
            error && "border-brand-danger hover:border-brand-danger focus-visible:border-brand-danger focus-visible:ring-brand-danger",
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
