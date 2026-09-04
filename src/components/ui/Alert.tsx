import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import {
  Alert as RheaAlert,
  AlertAction as RheaAlertAction,
  AlertDescription as RheaAlertDescription,
  AlertTitle as RheaAlertTitle,
} from "@/components/shadcn/alert";
import { cn } from "@/lib/utils";

export type AlertVariant = "info" | "success" | "warning" | "destructive";

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant;
  /** Optional short heading. The body alone is fine for one-line messages. */
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Renders a dismiss control. Omit for messages the user must not lose. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

/**
 * Restrained inline message block.
 *
 * Meaning is never carried by color alone: every variant pairs its tint with a
 * distinct icon, and `title`/body text states the message in words.
 *
 * Live-region semantics follow urgency — problems interrupt, confirmations do
 * not: `destructive` and `warning` use role="alert" (assertive), while `info`
 * and `success` use role="status" (polite). The Rhea primitive hardcodes
 * role="alert" before its prop spread, so the urgency-derived role below still
 * wins and a confirmation does not interrupt a screen reader.
 *
 * Rhea's grid supplies the icon column and the title/body rows; the tints, the
 * compact padding and the square radius are the application's own.
 */
export function Alert({
  variant = "info",
  title,
  children,
  onDismiss,
  dismissLabel = "Dismiss message",
  className,
  ...props
}: AlertProps) {
  const surfaces: Record<AlertVariant, string> = {
    info: "bg-brand-info-bg text-brand-info border-brand-info-border",
    success: "bg-brand-success-bg text-brand-success border-brand-success-border",
    warning: "bg-brand-warning-bg text-brand-warning border-brand-warning-border",
    destructive: "bg-brand-danger-bg text-brand-danger border-brand-danger-border",
  };

  const icons: Record<AlertVariant, React.ComponentType<{ className?: string }>> = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    destructive: AlertCircle,
  };

  const Icon = icons[variant];
  const isUrgent = variant === "destructive" || variant === "warning";

  return (
    <RheaAlert
      role={isUrgent ? "alert" : "status"}
      className={cn(
        "items-start rounded-md px-3 py-2.5 text-xs has-data-[slot=alert-action]:pr-10",
        surfaces[variant],
        className
      )}
      {...props}
    >
      <Icon className="shrink-0" aria-hidden="true" />
      {title && <RheaAlertTitle className="font-semibold leading-tight">{title}</RheaAlertTitle>}
      {children && (
        <RheaAlertDescription
          className={cn(
            "text-xs leading-relaxed text-current",
            title && "font-normal opacity-90"
          )}
        >
          {children}
        </RheaAlertDescription>
      )}
      {onDismiss && (
        <RheaAlertAction className="top-2 right-2">
          <button
            data-slot="alert-dismiss"
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-current outline-none transition-colors hover:bg-black/5 active:bg-black/10"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </RheaAlertAction>
      )}
    </RheaAlert>
  );
}
