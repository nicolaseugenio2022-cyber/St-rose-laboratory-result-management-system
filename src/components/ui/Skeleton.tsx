import React from "react";
import { cn } from "@/utils/cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render as a circle (avatars, icon placeholders). Defaults to a rounded block. */
  circle?: boolean;
}

/**
 * Decorative loading placeholder.
 *
 * Usage rules (UX0-C):
 * - Size it to approximate the FINAL content box so swapping in real content
 *   causes no layout shift. Pass explicit height/width via `className`.
 * - Use for content that is arriving: dashboard regions, list/table rows,
 *   panels whose geometry is predictable.
 * - Do NOT use for small mutations (Save, Upload, Remove, Login, Complete,
 *   Replace). Those use the Button pending/disabled state instead.
 * - Skeletons are decorative: they are hidden from assistive technology and
 *   never announce placeholder content. Mark the surrounding region with
 *   `aria-busy="true"` so the loading state is conveyed once, semantically.
 *
 * Motion: animates only when the user has not requested reduced motion.
 */
export function Skeleton({ className, circle = false, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-slate-200/70 motion-safe:animate-pulse",
        circle ? "rounded-full" : "rounded-md",
        className
      )}
      {...props}
    />
  );
}

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of placeholder lines. */
  lines?: number;
  /** Shorten the final line so the block reads as prose rather than a bar. */
  lastLineWidth?: string;
}

/**
 * Multi-line text placeholder. Line height matches the default body scale so
 * the block occupies the same vertical space as the text it stands in for.
 */
export function SkeletonText({
  lines = 3,
  lastLineWidth = "60%",
  className,
  ...props
}: SkeletonTextProps) {
  return (
    <div aria-hidden="true" className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5 w-full"
          style={i === lines - 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  );
}

export interface SkeletonRegionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the region is still loading. */
  isLoading: boolean;
  /** Accessible description of what is loading, announced once. */
  label?: string;
  children: React.ReactNode;
}

/**
 * Wraps a loading region so the state is announced once, semantically, while
 * the skeletons inside stay decorative. Prefer this over adding `aria-busy`
 * by hand at each call site.
 */
export function SkeletonRegion({
  isLoading,
  label = "Loading",
  className,
  children,
  ...props
}: SkeletonRegionProps) {
  return (
    <div aria-busy={isLoading} aria-live="polite" className={className} {...props}>
      {isLoading && <span className="sr-only">{label}</span>}
      {children}
    </div>
  );
}
