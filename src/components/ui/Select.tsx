import React, { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
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

/**
 * Native select with the system field styling.
 *
 * The browser arrow is replaced by the lucide chevron so the control matches the fields
 * beside it; the element stays a real <select>, so keyboard, mobile pickers and form
 * semantics are untouched.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, helperText, id, disabled, children, ...props }, ref) => {
    const reactId = useId();
    const selectId = id ?? `select-${reactId}`;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;
    const describedBy = error ? errorId : helperText ? helperId : undefined;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "flex h-11 w-full appearance-none rounded-md border border-brand-border bg-brand-surface pl-3 pr-9 text-[13px] text-brand-text transition-[border-color,box-shadow] hover:border-brand-border-strong focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring disabled:cursor-not-allowed disabled:bg-brand-structural disabled:text-brand-text-muted disabled:opacity-80 sm:h-9",
              error && "border-brand-danger hover:border-brand-danger focus-visible:border-brand-danger focus-visible:ring-brand-danger",
              className
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            {children}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted"
          />
        </div>
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
