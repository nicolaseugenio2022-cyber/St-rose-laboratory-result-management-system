import React from "react";
import { cn } from "@/utils/cn";

export interface MetricTileProps {
  label: string;
  value: React.ReactNode;
  /** Short qualifier, e.g. "of 12 accounts". Optional and deliberately terse. */
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

/**
 * Compact operational figure.
 *
 * Deliberately small: a dashboard is a place to read several numbers at a
 * glance, not four oversized KPI cards. The label always states the meaning in
 * words, so the figure is never carried by size or colour alone.
 */
export function MetricTile({ label, value, hint, icon: Icon, className }: MetricTileProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-brand-card-border bg-brand-card px-3.5 py-3",
        className
      )}
    >
      {Icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-tint text-brand-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted">
          {label}
        </div>
        <div className="text-lg font-bold leading-tight tabular-nums text-brand-text">{value}</div>
        {hint && <div className="text-[11px] text-brand-text-subtle">{hint}</div>}
      </div>
    </div>
  );
}
