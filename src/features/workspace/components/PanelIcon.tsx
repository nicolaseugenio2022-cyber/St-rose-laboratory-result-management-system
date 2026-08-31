import React from "react";
import { cn } from "@/utils/cn";

export interface PanelIconProps {
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}

/**
 * The panel-header mark: a small bordered white tile carrying one teal lucide glyph.
 *
 * It is the same tile the dashboard's DashboardSection draws beside its title, so a Workspace
 * panel - catalog, demographics, worksheet, report footer - reads as the same family of surface
 * as a dashboard panel. Decorative: the title beside it carries the meaning, so the glyph is
 * hidden from assistive technology.
 */
export function PanelIcon({ icon: Icon, className }: PanelIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-brand-border bg-brand-surface text-brand-primary",
        className
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}
