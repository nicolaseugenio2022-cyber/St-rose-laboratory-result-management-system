/**
 * Formatter Registry
 *
 * Provides deterministic display formatters for numerical values and suffixes:
 * - Half-up decimal precision formatting (e.g. 2 decimal places for HDL/LDL).
 * - Fixed suffix formatting with deduplication (e.g. "0-2" + " /HPF" -> "0-2 /HPF").
 */

/**
 * Decimal half-up rounding:
 * e.g., 40.00 -> "40.00"
 * 12.345 -> "12.35"
 * 12.344 -> "12.34"
 */
export function formatHalfUp(value: number, precision: number = 2): string {
  if (!Number.isFinite(value)) return "";
  const factor = Math.pow(10, precision);
  const rounded = Math.floor(Math.abs(value) * factor + 0.5) / factor * (value < 0 ? -1 : 1);
  return rounded.toFixed(precision);
}

/**
 * Appends a fixed suffix if not already present.
 * Prevents double-appending if input already ends with the suffix.
 */
export function formatWithSuffix(value: string | null | undefined, suffix: string): string {
  if (!value || value.trim() === "") return "";
  const trimmedValue = value.trim();
  const trimmedSuffix = suffix.trim();

  if (trimmedValue.toLowerCase().endsWith(trimmedSuffix.toLowerCase())) {
    const valueWithoutLegacySuffix = trimmedValue.slice(0, -trimmedSuffix.length).trimEnd();
    return `${valueWithoutLegacySuffix}${suffix}`;
  }
  return `${trimmedValue}${suffix}`;
}

/**
 * Removes a fixed display suffix from legacy stored input so Encoding edits only
 * the staff-entered value portion. Matching is case-insensitive and whitespace-tolerant.
 */
export function stripFixedSuffix(value: string | null | undefined, suffix: string): string {
  if (!value || value.trim() === "") return "";
  const trimmedValue = value.trim();
  const trimmedSuffix = suffix.trim();

  if (!trimmedValue.toLowerCase().endsWith(trimmedSuffix.toLowerCase())) {
    return trimmedValue;
  }

  return trimmedValue.slice(0, -trimmedSuffix.length).trimEnd();
}
