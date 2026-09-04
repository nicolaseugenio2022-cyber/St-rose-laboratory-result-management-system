import React from "react";
import {
  Table as RheaTable,
  TableBody as RheaTableBody,
  TableCell as RheaTableCell,
  TableHead as RheaTableHead,
  TableHeader as RheaTableHeader,
  TableRow as RheaTableRow,
} from "@/components/shadcn/table";
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
 *
 * The Rhea primitive brings its own scroll container, so the frame below sits outside it:
 * the frame carries the border, the radius and `wrapperClassName` (which consumers use to
 * hide the table at a breakpoint), while the primitive's container keeps doing the
 * scrolling.
 */
export function Table({ className, striped = false, wrapperClassName, ...props }: TableProps) {
  return (
    <div
      data-slot="table-frame"
      className={cn(
        "w-full overflow-hidden rounded-lg border border-brand-border bg-brand-card",
        wrapperClassName
      )}
    >
      <RheaTable
        className={cn(
          "border-collapse text-left text-xs",
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
    <RheaTableHeader
      className={cn("bg-brand-structural text-brand-navy [&_tr]:border-brand-border", className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <RheaTableBody className={cn("bg-brand-card", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <RheaTableRow
      className={cn("border-brand-border-subtle hover:bg-brand-surface-hover", className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <RheaTableHead
      scope="col"
      className={cn(
        "h-auto px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-brand-navy",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <RheaTableCell
      className={cn("p-0 px-3 py-2 align-middle text-xs whitespace-normal text-brand-text", className)}
      {...props}
    />
  );
}
