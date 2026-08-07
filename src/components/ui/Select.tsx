import React, { forwardRef } from "react";
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

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-brand-text">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-1.5 text-xs text-brand-text transition-colors focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-focus-ring disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
            error && "border-brand-danger focus:border-brand-danger focus:ring-brand-danger",
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
        {error && <p className="text-xs font-medium text-brand-danger">{error}</p>}
        {!error && helperText && <p className="text-[11px] text-brand-text-muted">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
