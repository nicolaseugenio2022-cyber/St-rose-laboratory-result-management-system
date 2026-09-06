import React, { forwardRef, useId } from "react";
import { Input as RheaInput } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { cn } from "@/lib/utils";

/**
 * How much room a field is given.
 *
 * `compact` is the established dense control - a 36px desktop / 44px touch field under an 11px
 * uppercase label - and is what every existing consumer gets, unchanged, because it is the
 * default. It is right for a worksheet where forty parameters share one screen.
 *
 * `comfortable` is for a surface where the field IS the task rather than one row of many: 44px
 * at every width, 14px value text, and a readable sentence-case label. Uppercase 11px labels
 * are scanning aids for a dense grid; on a two-field sign-in form they only make the form look
 * timid, and sentence case is easier to read at a glance.
 */
export type FieldScale = "compact" | "comfortable";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Defaults to `compact`, which is the existing control. */
  fieldScale?: FieldScale;
}

/**
 * The field surface, shared by Input and the native Select.
 *
 * Rhea's field is a 32px pill on a tinted fill; the application's is a 36px desktop /
 * 44px touch control on the white working surface with a 6px radius, and those heights
 * are what line a field up with the medium Button beside it. These classes override only
 * that geometry and colour - the primitive keeps its transition, its disabled handling,
 * its aria-invalid wiring and its focus border, and the keyboard focus indicator itself
 * comes from the shared `[data-slot]:focus-visible` rule established in globals.css.
 *
 * `aria-invalid:ring-0` cancels Rhea's permanent 3px error ring: an invalid field is
 * marked by its red border and its error text, not by a second ring that would collide
 * with the focus outline. `disabled:pointer-events-auto` restores the not-allowed cursor
 * the application has always shown on a disabled field.
 */
export const fieldSurfaceClassName =
  "h-11 rounded-md border-brand-border bg-brand-surface px-3 text-[13px] text-brand-text transition-[color,border-color,box-shadow] hover:border-brand-border-strong disabled:pointer-events-auto disabled:bg-brand-structural disabled:text-brand-text-muted disabled:opacity-80 aria-invalid:ring-0 sm:h-9 md:text-[13px]";

/** Applied on top of the surface when the field carries an error. */
export const fieldErrorClassName =
  "border-brand-danger hover:border-brand-danger aria-invalid:border-brand-danger";

/** The 11px uppercase field label, shared by Input and Select. */
export const fieldLabelClassName =
  "block text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted";

/**
 * The comfortable field surface. Same tokens, same states, same disabled and aria-invalid
 * handling as the compact one - only the height, horizontal padding and value size differ.
 * `text-sm` defeats the primitive's `text-base` below `md` and agrees with its own `md:text-sm`
 * above it, so the value is 14px at every width instead of stepping down.
 */
export const fieldSurfaceComfortableClassName =
  "h-11 rounded-md border-brand-border bg-brand-surface px-3.5 text-sm text-brand-text transition-[color,border-color,box-shadow] hover:border-brand-border-strong disabled:pointer-events-auto disabled:bg-brand-structural disabled:text-brand-text-muted disabled:opacity-80 aria-invalid:ring-0";

/** The comfortable field label: sentence case, navy, sized to be read rather than scanned. */
export const fieldLabelComfortableClassName =
  "block text-[13px] font-semibold leading-none text-brand-navy";

/**
 * Text field.
 *
 * 36px tall from `sm` up so it lines up with a medium Button; 44px below it, where a
 * finger is the pointer. The label sits above in the shared 11px uppercase style, and the
 * error or helper text is bound to the control through aria-describedby.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      label,
      error,
      helperText,
      id,
      disabled,
      fieldScale = "compact",
      ...props
    },
    ref
  ) => {
    const isComfortable = fieldScale === "comfortable";
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
          <Label
            htmlFor={inputId}
            className={isComfortable ? fieldLabelComfortableClassName : fieldLabelClassName}
          >
            {label}
          </Label>
        )}
        <RheaInput
          type={type}
          id={inputId}
          ref={ref}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            isComfortable ? fieldSurfaceComfortableClassName : fieldSurfaceClassName,
            "placeholder:text-slate-500",
            error && fieldErrorClassName,
            className
          )}
          {...props}
        />
        {error && (
          <p
            id={errorId}
            className={cn(
              "font-medium text-brand-danger",
              isComfortable ? "text-xs" : "text-[11px]"
            )}
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p
            id={helperId}
            className={cn("text-brand-text-muted", isComfortable ? "text-xs" : "text-[11px]")}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
