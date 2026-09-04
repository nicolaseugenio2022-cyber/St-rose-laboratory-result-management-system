import React from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/utils/cn";
import { daysUntilExpiry, type RecentWorkItem } from "../../_lib/recent-work";

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
 * between rows, and declares itself a size container (`container-type: inline-size`).
 * The row then answers to the width of the PANEL it sits in, not the viewport: in a
 * panel 40rem or wider it is a fixed-column grid - patient, accession, date, reports,
 * action - so five rows read as one small table with every column aligned; in a
 * narrower panel (a side column, a phone) the metadata wraps under the name and the
 * action spans both lines. Status is a word via `StatusBadge`, never colour alone,
 * and the expiry warning states the remaining days in text.
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
    <div
      className={cn(
        // Narrow: two rows (name / meta) with the action spanning both on the right.
        // Wide container: one row of aligned columns. `contents` dissolves the meta
        // wrapper so its three cells place themselves into the shared column tracks.
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3.5 py-2",
        "[@container(min-width:40rem)]:grid-cols-[minmax(0,1fr)_6.5rem_4rem_9rem_auto] [@container(min-width:40rem)]:gap-x-4 [@container(min-width:40rem)]:gap-y-0",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {/* title restores what truncation removes: a long patient name is still
            readable on hover instead of ending in an ellipsis with no recourse. */}
        <span title={item.patientName} className="truncate text-[13px] font-semibold text-brand-navy">
          {item.patientName}
        </span>
        <StatusBadge status={item.status} size="sm" />
      </div>

      <div className="col-start-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-brand-text-muted [@container(min-width:40rem)]:contents">
        {/* The dash keeps the accession column honest in the wide layout; inline on a narrow
            row it would only read as noise, so there it is withheld. */}
        <span
          className={cn(
            "whitespace-nowrap font-mono tabular-nums",
            !item.accessionNumber && "hidden [@container(min-width:40rem)]:inline"
          )}
        >
          {item.accessionNumber ?? "—"}
        </span>
        {activity ? (
          <time dateTime={item.activityAt} title={activity.full} className="whitespace-nowrap tabular-nums">
            {activity.short}
          </time>
        ) : (
          <span>—</span>
        )}
        <span className="min-w-0 whitespace-nowrap">
          {item.reportCount} {item.reportCount === 1 ? "report" : "reports"}
          {expiringSoon && (
            <span className="ml-2 font-semibold text-brand-warning">
              {days === 0 ? "Expires today" : `Expires in ${days}d`}
            </span>
          )}
        </span>
      </div>

      {canResume && (
        <Link
          href={`/workspace?sessionId=${encodeURIComponent(item.id)}`}
          // min-h-8 lifts a 23px control clear of WCAG 2.2 SC 2.5.8 without inflating
          // the row: 44px would push every list row to ~60px and halve how much work
          // fits above the fold, and this is the only target in the row, so the
          // spacing exception already applied - 32px is the honest middle.
          className="col-start-2 row-span-2 row-start-1 inline-flex min-h-8 shrink-0 items-center justify-self-end rounded-md border border-brand-border-strong bg-brand-surface px-2.5 text-[11px] font-semibold text-brand-navy transition-[color,background-color,border-color,transform] duration-150 hover:border-brand-navy-muted hover:bg-brand-surface-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent [@container(min-width:40rem)]:col-start-5 [@container(min-width:40rem)]:row-span-1"
        >
          {item.status === "Draft" ? "Resume" : "Open"}
          <span className="sr-only"> {item.patientName}</span>
        </Link>
      )}
    </div>
  );
}
