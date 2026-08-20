import React from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/utils/cn";
import { daysUntilExpiry, type RecentWorkItem } from "@/features/dashboard/recent-work";

export interface SessionRowProps {
  item: RecentWorkItem;
  /**
   * Render the Resume control. Only meaningful when the server said
   * `canReopen`; this component never infers ownership itself.
   */
  showResume?: boolean;
  className?: string;
}

function formatActivity(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * One compact line of recent laboratory work.
 *
 * A row, not a card: a dashboard should show several sessions at a glance.
 * Status is a word via `StatusBadge`, never colour alone, and the expiry
 * warning states the remaining days in text.
 *
 * The Resume action appears only when the caller both is permitted to see it
 * and owns the session per the server's `canReopen`. Ownership is never
 * recomputed here.
 */
export function SessionRow({ item, showResume = false, className }: SessionRowProps) {
  const days = daysUntilExpiry(item.expiresAt);
  const expiringSoon = days !== null && days >= 0 && days <= 7;
  const canResume = showResume && item.canReopen;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-brand-card-border bg-brand-card px-3.5 py-2.5",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-semibold text-brand-text">{item.patientName}</span>
          <StatusBadge status={item.status} size="sm" />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-brand-text-muted">
          {item.accessionNumber && (
            <span className="tabular-nums font-medium">{item.accessionNumber}</span>
          )}
          <span>{formatActivity(item.activityAt)}</span>
          <span>
            {item.reportCount} {item.reportCount === 1 ? "report" : "reports"}
          </span>
          {expiringSoon && (
            <span className="font-semibold text-brand-warning">
              {days === 0 ? "Expires today" : `Expires in ${days}d`}
            </span>
          )}
        </div>
      </div>

      {canResume && (
        <Link
          href={`/workspace?sessionId=${encodeURIComponent(item.id)}`}
          className="shrink-0 rounded-md border border-brand-border px-2.5 py-1 text-[11px] font-semibold text-brand-text transition-colors hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2"
        >
          {item.status === "Draft" ? "Resume" : "Open"}
          <span className="sr-only"> {item.patientName}</span>
        </Link>
      )}
    </div>
  );
}
