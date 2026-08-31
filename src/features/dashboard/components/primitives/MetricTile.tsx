import React from "react";
import { cn } from "@/utils/cn";

export interface MetricTileProps {
  label: string;
  value: React.ReactNode;
  /** Short qualifier, e.g. "of 12 accounts". Optional and deliberately terse. */
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * The figure could not be read. Renders the value as prose rather than as a
   * number, so an outage never looks like a measurement.
   */
  unavailable?: boolean;
  className?: string;
}

/**
 * Compact operational figure. One term/description pair of the enclosing <dl>.
 *
 * Deliberately small: a dashboard is a place to read several numbers at a
 * glance, not four oversized KPI cards. The label always states the meaning in
 * words, so the figure is never carried by size or colour alone.
 *
 * Grid rather than nested flex so <dt> and <dd> stay direct children of this
 * tile's wrapper div, which is what makes the strip a valid description list.
 * The icon spans both rows beside them.
 */
export function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  unavailable = false,
  className,
}: MetricTileProps) {
  return (
    <div
      className={cn(
        "grid items-center gap-x-2.5 px-3 py-2.5",
        Icon ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1",
        className
      )}
    >
      {Icon && (
        <span className="row-span-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-tint text-brand-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      {/* Wraps rather than truncates: at two tiles per row on a 320px screen a
          truncated label read "Total acc...", and these labels are short, fixed
          and known - there is nothing to gain by clipping them. */}
      <dt className="min-w-0 text-[11px] font-medium leading-tight text-brand-text-muted">
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 leading-tight",
          unavailable
            ? "text-sm font-medium text-brand-text-muted"
            : "text-base font-semibold tabular-nums text-brand-text"
        )}
      >
        {value}
        {hint && (
          <span className="mt-0.5 block truncate text-[11px] font-normal text-brand-text-subtle">
            {hint}
          </span>
        )}
      </dd>
    </div>
  );
}
