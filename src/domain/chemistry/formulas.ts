/**
 * Pure Chemistry Formula Calculations
 *
 * Client Literals:
 * HDL = Cholesterol * 40 / 150            (client-defined; not a measured HDL)
 * LDL = Cholesterol - active HDL - Triglycerides / 5
 *
 * The LDL operand order is the approved equation verified against CDC and NHLBI/PHA references.
 * "Active HDL" is the client-calculated HDL while HDL is Auto, or the operator's entered result
 * while HDL is Manual - the caller decides which and passes it in.
 *
 * Rules:
 * - LDL uses the exact unrounded active HDL, never a formatted display value.
 * - Dependencies must be finite numbers > 0.
 * - Returns unrounded floating point number.
 */

export interface ChemistryDependencyInputs {
  CHOLESTEROL?: number | null;
  TRIGLYCERIDES?: number | null;
  [key: string]: number | null | undefined;
}

export function validateDependencyPositive(val: number | null | undefined): val is number {
  return typeof val === "number" && Number.isFinite(val) && val > 0;
}

export function calculateHdl(cholesterol: number): number {
  return (cholesterol * 40) / 150;
}

export function calculateLdl(triglycerides: number, activeHdl: number, cholesterol: number): number {
  return cholesterol - activeHdl - triglycerides / 5;
}
