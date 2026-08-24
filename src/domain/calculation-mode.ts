/**
 * Calculation Mode - Auto / Manual for formula-bound parameters.
 *
 * One shared resolution rule for every layer. Encoding, the resolver, completion,
 * rendering and the UI all call resolveCalculationMode, so a stored mode can never be
 * interpreted one way in the form and another way in a completed snapshot.
 *
 * Manual is honoured only where the definition opts in through
 * FormulaBindingSpec.supportsManualEntry. Having a formula binding is therefore never on
 * its own enough to make a parameter operator-editable.
 */
import type { FormulaBindingSpec } from "@/domain/types/report-definition";

export type CalculationMode = "Auto" | "Manual";

/** Sparse by construction: an absent key means Auto. */
export type CalculationModeMap = Readonly<Partial<Record<string, CalculationMode>>>;

export type ResultProvenance =
  | "ClientFormula"
  | "ClientFormulaComposite"
  | "StandardInputCalculation"
  | "Manual";

export type HdlSource = "ClientFormula" | "Manual";

/**
 * Shape-only normalisation. Anything that is not exactly "Auto" or "Manual" is dropped, and a
 * dropped key resolves to Auto.
 *
 * This never throws. A corrupted, hand-edited or future-versioned draft must still load, and
 * Auto is the safe clinical default - refusing the draft would turn a cosmetic problem into
 * data loss. It deliberately knows nothing about report definitions and does not filter keys
 * against one: eligibility belongs to resolveCalculationMode, which holds the binding.
 */
export function normalizeCalculationModes(raw: unknown): CalculationModeMap {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const normalized: Record<string, CalculationMode> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === "Manual") normalized[key] = "Manual";
    else if (value === "Auto") normalized[key] = "Auto";
  }
  return normalized;
}

/**
 * The single mode-resolution rule. A key for an unknown or unrelated parameter is never looked
 * up, so it is ignored by resolution rather than filtered out of the map.
 */
export function resolveCalculationMode(
  binding: FormulaBindingSpec | null | undefined,
  parameterCode: string,
  modes: CalculationModeMap | undefined
): CalculationMode {
  if (!binding?.supportsManualEntry) return "Auto";
  return modes?.[parameterCode] === "Manual" ? "Manual" : "Auto";
}
