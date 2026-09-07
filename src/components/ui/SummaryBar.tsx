import React from "react";
import { cn } from "@/lib/utils";

/**
 * One figure in an administrative summary.
 *
 * `tone` colours the VALUE only, never the label, and only where the number already carries a
 * standing meaning the reader would otherwise have to compute - how many accounts are switched
 * off, how many people can still sign a report. It is reinforcement for a word that is already
 * there, never the signal itself: every figure is named by its own `label`, so a reader who
 * cannot separate the tints loses nothing.
 */
export interface SummaryFigure {
  label: string;
  value: number | string;
  /** Optional one-line qualifier under the label, for a figure whose name is not self-evident. */
  hint?: string;
  tone?: "default" | "muted" | "success" | "warning";
}

export interface SummaryBarProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Names the region for assistive technology. Not rendered - the shell owns the visible title. */
  label: string;
  figures: ReadonlyArray<SummaryFigure>;
  /** Rendered at the end of the strip: a standing note about the directory, never a control. */
  note?: React.ReactNode;
}

const VALUE_TONE: Record<NonNullable<SummaryFigure["tone"]>, string> = {
  default: "text-brand-navy",
  muted: "text-brand-text-muted",
  success: "text-brand-success",
  warning: "text-brand-warning",
};

/**
 * The count strip that opens an administrative directory.
 *
 * A single structural band divided into figures, not a row of cards: these numbers describe the
 * table underneath them, so they read as one header for it rather than four separate objects
 * competing with the records. That is also why it carries no shadow and no white fill - elevation
 * here would put the summary in front of the data it summarises.
 *
 * Figures are counts the caller already holds. This component performs no fetch, no derivation
 * and no filtering; it is presentation for numbers that were computed from data already on
 * screen.
 */
export function SummaryBar({ label, figures, note, className, ...props }: SummaryBarProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        "rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5",
        className
      )}
      {...props}
    >
      {/* The note stacks UNDER the figures below sm rather than beside them. As a flex sibling it
          competed for the same row, and on a 390px phone it took so much of it that the figure
          list was squeezed to a couple of dozen pixels and every label truncated to nothing -
          leaving four unlabelled numbers. It only shares a row once there is a row to share. */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6">
        <dl className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-1 sm:flex-wrap sm:items-baseline sm:gap-x-7">
          {figures.map((figure) => (
            <div key={figure.label} className="flex min-w-0 flex-col">
              {/* dt precedes dd in DOM order so assistive technology reads label-then-value.
                  CSS order reverses them visually: value above label. */}
              <dt className="order-2 mt-1 break-words text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-brand-text-muted">
                {figure.label}
              </dt>
              <dd
                className={cn(
                  "order-1 text-[19px] font-bold leading-none tabular-nums",
                  VALUE_TONE[figure.tone ?? "default"]
                )}
              >
                {figure.value}
              </dd>
              {figure.hint && (
                <dd className="order-3 mt-0.5 break-words text-[11px] leading-tight text-brand-text-subtle">
                  {figure.hint}
                </dd>
              )}
            </div>
          ))}
        </dl>
        {note && (
          <p className="min-w-0 text-[11px] leading-snug text-brand-text-muted sm:max-w-sm sm:text-right">
            {note}
          </p>
        )}
      </div>
    </section>
  );
}
