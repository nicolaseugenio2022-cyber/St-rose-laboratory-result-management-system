/**
 * Pure Chemistry Formula Calculations
 *
 * Client Literals:
 * HDL = Cholesterol * 40 / 150
 * LDL = Triglycerides / 5 + HDL - Cholesterol
 *
 * Rules:
 * - LDL uses the exact unrounded intermediate HDL.
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

export function calculateLdl(triglycerides: number, unroundedHdl: number, cholesterol: number): number {
  return (triglycerides / 5) + unroundedHdl - cholesterol;
}
