import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/utils/cn";

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
 * and `success` use role="status" (polite).
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
    <div
      role={isUrgent ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs",
        surfaces[variant],
        className
      )}
      {...props}
    >
      <Icon className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold leading-tight">{title}</p>}
        {children && (
          <div className={cn("leading-relaxed", title && "mt-0.5 font-normal opacity-90")}>
            {children}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="-mr-1 -mt-0.5 shrink-0 rounded p-1 text-current opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
