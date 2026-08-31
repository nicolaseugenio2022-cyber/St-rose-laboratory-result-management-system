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

/**
 * "Mar 4" is what the row can afford to show, but it drops the year, so a session
 * from a previous retention window is indistinguishable from a recent one. The
 * <time> element carries the machine-readable instant and the title carries the
 * full local timestamp, so the missing year is recoverable without spending row
 * width on it.
 */
function activityParts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    short: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    full: d.toLocaleString(),
  };
}

/**
 * One compact line of recent laboratory work.
 *
 * A flat row, not a card: the enclosing list owns the border and the hairlines
 * between rows, so a list of five sessions reads as one panel instead of five
 * stacked cards. Status is a word via `StatusBadge`, never colour alone, and
 * the expiry warning states the remaining days in text.
 *
 * The Resume action appears only when the caller both is permitted to see it
 * and owns the session per the server's `canReopen`. Ownership is never
 * recomputed here.
 */
export function SessionRow({ item, showResume = false, className }: SessionRowProps) {
  const days = daysUntilExpiry(item.expiresAt);
  const expiringSoon = days !== null && days >= 0 && days <= 7;
  const canResume = showResume && item.canReopen;
  const activity = activityParts(item.activityAt);

  return (
    <div className={cn("flex items-center gap-3 px-3 py-2", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {/* title restores what truncation removes: a long patient name is still
              readable on hover instead of ending in an ellipsis with no recourse. */}
          <span
            title={item.patientName}
            className="truncate text-xs font-semibold text-brand-text"
          >
            {item.patientName}
          </span>
          <StatusBadge status={item.status} size="sm" />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-brand-text-muted">
          {item.accessionNumber && (
            <span className="font-mono tabular-nums">{item.accessionNumber}</span>
          )}
          {activity ? (
            <time dateTime={item.activityAt} title={activity.full}>
              {activity.short}
            </time>
          ) : (
            <span>—</span>
          )}
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
          // min-h-8 lifts a 23px control clear of WCAG 2.2 SC 2.5.8 without inflating
          // the row: 44px would push every list row to ~60px and halve how much work
          // fits above the fold, and this is the only target in the row, so the
          // spacing exception already applied - 32px is the honest middle.
          className="inline-flex min-h-8 shrink-0 items-center rounded-md border border-brand-border px-2.5 text-[11px] font-semibold text-brand-text transition-[color,background-color,border-color,transform] duration-150 hover:bg-brand-surface-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          {item.status === "Draft" ? "Resume" : "Open"}
          <span className="sr-only"> {item.patientName}</span>
        </Link>
      )}
    </div>
  );
}
