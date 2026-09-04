import React, { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { Label } from "@/components/shadcn/label";
import { fieldErrorClassName, fieldLabelClassName, fieldSurfaceClassName } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

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
 *
 * Deliberately not migrated onto the registry's Select: that primitive is a Radix
 * listbox built from divs, which would drop the native mobile picker, the native
 * type-ahead and the native form contract this component's consumers rely on. It shares
 * the Rhea field surface with Input instead, and carries a data-slot so it picks up the
 * same keyboard focus indicator as every migrated primitive.
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
          <Label htmlFor={selectId} className={fieldLabelClassName}>
            {label}
          </Label>
        )}
        <div className="relative">
          <select
            data-slot="native-select"
            id={selectId}
            ref={ref}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "flex w-full appearance-none border border-transparent outline-none focus-visible:border-ring",
              fieldSurfaceClassName,
              "pl-3 pr-9",
              error && fieldErrorClassName,
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
