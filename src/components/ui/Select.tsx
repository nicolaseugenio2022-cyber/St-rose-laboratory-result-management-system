import React, { forwardRef, useId } from "react";
import { cn } from "@/utils/cn";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, helperText, id, disabled, children, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    // Mirrors Input: the message is bound to the control, and a consumer-supplied
    // aria-describedby still overrides it because the prop spread comes afterwards.
    const reactId = useId();
    const errorId = `${selectId ?? reactId}-error`;
    const helperId = `${selectId ?? reactId}-helper`;
    const describedBy = error ? errorId : helperText ? helperId : undefined;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "flex h-10 w-full rounded-md border border-brand-border bg-brand-surface px-3 text-sm text-brand-text transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-focus-ring/40 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
            error && "border-brand-danger focus:border-brand-danger focus:ring-brand-danger/30",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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

Select.displayName = "Select";
