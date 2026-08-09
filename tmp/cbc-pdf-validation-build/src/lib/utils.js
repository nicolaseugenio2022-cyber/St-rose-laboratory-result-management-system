"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cn = cn;
exports.formatDateISO = formatDateISO;
exports.calculateExpirationDate = calculateExpirationDate;
exports.getRemainingRetentionDays = getRemainingRetentionDays;
exports.capitalize = capitalize;
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
const constants_1 = require("./constants");
/**
 * Combines CSS class names safely using clsx and tailwind-merge.
 */
function cn(...inputs) {
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
/**
 * Formats a Date object or ISO string to standard YYYY-MM-DD date format.
 */
function formatDateISO(date = new Date()) {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime()))
        return "";
    return d.toISOString().split("T")[0];
}
/**
 * Calculates retention expiration date (completed_at + 30 days).
 */
function calculateExpirationDate(completedAt = new Date()) {
    const date = typeof completedAt === "string" ? new Date(completedAt) : new Date(completedAt.getTime());
    date.setDate(date.getDate() + constants_1.SYSTEM_CONSTANTS.RETENTION.COMPLETED_REPORT_DAYS);
    return date;
}
/**
 * Calculates remaining days until retention expiration.
 */
function getRemainingRetentionDays(expiresAt) {
    const expiration = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
    const now = new Date();
    const diffTime = expiration.getTime() - now.getTime();
    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, remainingDays);
}
/**
 * Capitalizes string nicely for UI display.
 */
function capitalize(str) {
    if (!str)
        return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
