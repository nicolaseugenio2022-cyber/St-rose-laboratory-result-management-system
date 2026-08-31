import React from "react";
import { cn } from "@/utils/cn";

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Tint every second body row. For long, uniform record tables; leave off for tables with detail rows. */
  striped?: boolean;
  /** Classes for the scrolling wrapper rather than the table element. */
  wrapperClassName?: string;
}

/**
 * Record table.
 *
 * The wrapper owns the border, the radius and the horizontal scroll, so a wide table
 * scrolls inside its own panel and never forces the page sideways. The header is a
 * structural band with navy labels; rows are ~34px with hairlines between them.
 */
export function Table({ className, striped = false, wrapperClassName, ...props }: TableProps) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-lg border border-brand-border bg-brand-card",
        wrapperClassName
      )}
    >
      <table
        className={cn(
          "w-full border-collapse text-left text-xs",
          // :not(:hover) keeps the stripe from outranking the row hover tint.
          striped && "[&_tbody>tr:nth-child(even):not(:hover)]:bg-[#F8FAFC]",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-brand-border bg-brand-structural text-brand-navy", className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-brand-border-subtle bg-brand-card", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-brand-surface-hover", className)} {...props} />;
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-brand-navy",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2 align-middle text-xs text-brand-text", className)} {...props} />;
}
