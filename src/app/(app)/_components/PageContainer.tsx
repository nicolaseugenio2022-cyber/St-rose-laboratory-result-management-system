import React from "react";
import { cn } from "@/utils/cn";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * The shared page surface every non-Workspace module renders into.
 *
 * The cap is 1680px rather than 1280px: these screens are dense administrative
 * tables, and a 1280px cap left roughly a third of a 1920px workstation as dead
 * gutter while the table itself scrolled horizontally. `min-w-0` lets a wide
 * child shrink instead of forcing the page into horizontal overflow.
 */
export function PageContainer({ className, children, ...props }: PageContainerProps) {
  return (
    <main
      // A stable, focusable landing target for the shell skip link.
      // tabIndex={-1} makes it programmatically focusable without entering the Tab order.
      // Both sit before the prop spread, so a caller can still override either.
      id="main-content"
      tabIndex={-1}
      className={cn(
        // The skip link lands here programmatically, so the landing must be visible:
        // suppressing the ring entirely left a keyboard user with no confirmation that
        // the jump had happened at all.
        "mx-auto w-full min-w-0 max-w-[1680px] flex-1 p-4 sm:p-5 lg:px-6 lg:py-5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring",
        className
      )}
      {...props}
    >
      {children}
    </main>
  );
}
