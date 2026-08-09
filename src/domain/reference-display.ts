import type { PatientSex } from "@/domain/types";

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function appendUnit(value: string, unit?: string | null): string {
  const normalizedUnit = unit?.trim();
  if (!normalizedUnit) return value;
  return value.toLocaleLowerCase().endsWith(normalizedUnit.toLocaleLowerCase())
    ? value
    : `${value} ${normalizedUnit}`;
}

export function resolveReferenceDisplay(
  referenceRule?: Record<string, unknown> | null,
  sex?: PatientSex | null,
  unit?: string | null
): string | null {
  if (!referenceRule) return null;

  for (const key of ["normalRange", "displayValue", "referenceDisplay"] as const) {
    if (nonBlank(referenceRule[key])) return appendUnit(referenceRule[key].trim(), unit);
  }

  const male = referenceRule.male;
  const female = referenceRule.female;
  const children = referenceRule.children;
  if (sex === "Male" && nonBlank(male)) return appendUnit(male.trim(), unit);
  if (sex === "Female" && nonBlank(female)) return appendUnit(female.trim(), unit);
  if (nonBlank(male) || nonBlank(female) || nonBlank(children)) {
    return [
      nonBlank(male) ? `Male: ${appendUnit(male.trim(), unit)}` : "",
      nonBlank(female) ? `Female: ${appendUnit(female.trim(), unit)}` : "",
      nonBlank(children) ? `Children: ${appendUnit(children.trim(), unit)}` : "",
    ].filter(Boolean).join("; ");
  }

  if (nonBlank(referenceRule.expectedValue)) {
    return appendUnit(referenceRule.expectedValue.trim(), unit);
  }

  const min = typeof referenceRule.minValue === "number" ? referenceRule.minValue : null;
  const max = typeof referenceRule.maxValue === "number" ? referenceRule.maxValue : null;
  if (min !== null || max !== null) {
    const display = min !== null && max !== null
      ? `${min}–${max}`
      : min !== null ? `> ${min}` : `< ${max}`;
    return appendUnit(display, unit);
  }

  return null;
}
