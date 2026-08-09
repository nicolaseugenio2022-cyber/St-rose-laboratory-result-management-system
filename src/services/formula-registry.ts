/**
 * Formula Registry
 *
 * Report-neutral registry mapping formula IDs to formula evaluation functions.
 * Does NOT contain template/report-code branching.
 */

import { calculateHdl, calculateLdl } from "@/domain/chemistry/formulas";

export interface FormulaEvaluationContext {
  inputs: Record<string, number | null | undefined>;
}

export interface FormulaEvaluationResult {
  unroundedValue: number;
  computationMetadata: Record<string, unknown>;
}

export type FormulaFunction = (context: FormulaEvaluationContext) => FormulaEvaluationResult;

const formulaMap = new Map<string, FormulaFunction>();

// Register hdl-client-formula
formulaMap.set("hdl-client-formula", ({ inputs }) => {
  const cholesterol = Number(inputs.CHOLESTEROL ?? 0);
  const unroundedValue = calculateHdl(cholesterol);
  return {
    unroundedValue,
    computationMetadata: {
      formulaId: "hdl-client-formula",
      formulaExpression: "Cholesterol * 40 / 150",
      inputs: { CHOLESTEROL: cholesterol },
      unroundedValue,
    },
  };
});

// Register ldl-client-formula
formulaMap.set("ldl-client-formula", ({ inputs }) => {
  const triglycerides = Number(inputs.TRIGLYCERIDES ?? 0);
  const cholesterol = Number(inputs.CHOLESTEROL ?? 0);

  // Calculate unrounded HDL intermediate
  const unroundedHdl = calculateHdl(cholesterol);
  const unroundedValue = calculateLdl(triglycerides, unroundedHdl, cholesterol);

  return {
    unroundedValue,
    computationMetadata: {
      formulaId: "ldl-client-formula",
      formulaExpression: "Triglycerides / 5 + unrounded_HDL - Cholesterol",
      inputs: { TRIGLYCERIDES: triglycerides, CHOLESTEROL: cholesterol },
      unroundedHdlIntermediate: unroundedHdl,
      unroundedValue,
    },
  };
});

export class FormulaRegistry {
  public static registerFormula(id: string, fn: FormulaFunction): void {
    formulaMap.set(id, fn);
  }

  public static getFormula(id: string): FormulaFunction | null {
    return formulaMap.get(id) || null;
  }

  public static hasFormula(id: string): boolean {
    return formulaMap.has(id);
  }

  public static evaluateFormula(id: string, inputs: Record<string, number | null | undefined>): FormulaEvaluationResult {
    const fn = formulaMap.get(id);
    if (!fn) {
      throw new Error(`Formula with ID "${id}" is not registered in FormulaRegistry.`);
    }
    return fn({ inputs });
  }
}
