/**
 * Formula Registry
 *
 * Report-neutral registry mapping formula IDs to formula evaluation functions.
 * Does NOT contain template/report-code branching.
 */

import { calculateHdl, calculateLdl } from "@/domain/chemistry/formulas";

export interface FormulaEvaluationContext {
  inputs: Record<string, number | null | undefined>;
  /**
   * Validated operator-entered values for the binding's activeDependencies that are currently in
   * Manual mode. A formula-bound dependency left in Auto is absent here, which is the signal that
   * the formula should derive it itself and so keep the exact unrounded intermediate.
   */
  manualInputs?: Readonly<Record<string, number>>;
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
formulaMap.set("ldl-client-formula", ({ inputs, manualInputs }) => {
  const triglycerides = Number(inputs.TRIGLYCERIDES ?? 0);
  const cholesterol = Number(inputs.CHOLESTEROL ?? 0);

  // The ACTIVE HDL. While HDL is Auto the client formula is applied here, so LDL consumes the
  // exact unrounded intermediate; a Manual HDL supplies the operator's exact parsed value. Reading
  // HDL's stored result instead would hand LDL a two-decimal display value, and the resolver
  // resolves parameters from one frozen snapshot so it would also be a cycle behind.
  const manualHdl = manualInputs?.HDL;
  const hdlIsManual = typeof manualHdl === "number" && Number.isFinite(manualHdl);
  const activeHdl = hdlIsManual ? manualHdl : calculateHdl(cholesterol);
  const unroundedValue = calculateLdl(triglycerides, activeHdl, cholesterol);

  const computationMetadata: Record<string, unknown> = {
    formulaId: "ldl-client-formula",
    formulaExpression: "Cholesterol - active_HDL - Triglycerides / 5",
    inputs: hdlIsManual
      ? { TRIGLYCERIDES: triglycerides, CHOLESTEROL: cholesterol, HDL: activeHdl }
      : { TRIGLYCERIDES: triglycerides, CHOLESTEROL: cholesterol },
    hdlSource: hdlIsManual ? "Manual" : "ClientFormula",
    activeHdl,
    unroundedValue,
  };
  // Only the Auto-HDL path has a genuinely computed intermediate. Emitting this key for an
  // operator-entered HDL would describe a calculation that never happened.
  if (!hdlIsManual) computationMetadata.unroundedHdlIntermediate = activeHdl;

  return { unroundedValue, computationMetadata };
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

  public static evaluateFormula(
    id: string,
    inputs: Record<string, number | null | undefined>,
    manualInputs?: Readonly<Record<string, number>>
  ): FormulaEvaluationResult {
    const fn = formulaMap.get(id);
    if (!fn) {
      throw new Error(`Formula with ID "${id}" is not registered in FormulaRegistry.`);
    }
    return fn({ inputs, manualInputs });
  }
}
