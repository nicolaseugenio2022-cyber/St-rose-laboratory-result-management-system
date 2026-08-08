import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { SYSTEM_CONSTANTS } from "./constants";

/**
 * Combines CSS class names safely using clsx and tailwind-merge.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a Date object or ISO string to standard YYYY-MM-DD date format.
 */
export function formatDateISO(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

/**
 * Calculates retention expiration date (completed_at + 30 days).
 */
export function calculateExpirationDate(completedAt: Date | string = new Date()): Date {
  const date = typeof completedAt === "string" ? new Date(completedAt) : new Date(completedAt.getTime());
  date.setDate(date.getDate() + SYSTEM_CONSTANTS.RETENTION.COMPLETED_REPORT_DAYS);
  return date;
}

/**
 * Calculates remaining days until retention expiration.
 */
export function getRemainingRetentionDays(expiresAt: Date | string): number {
  const expiration = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const now = new Date();
  const diffTime = expiration.getTime() - now.getTime();
  const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, remainingDays);
}

/**
 * Capitalizes string nicely for UI display.
 */
export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
