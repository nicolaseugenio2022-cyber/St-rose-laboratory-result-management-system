/**
 * Client-Confirmed Computed Medical Formulas
 * Synchronized 100% with architecture/specifications/CHEM_10.md and HDL_LDL.md.
 */

export interface ComputedLDLResult {
  value: string;
  outcome: "Normal" | "Abnormal" | "NoEvaluation";
  error?: string;
}

export function evaluateLDL(triglycerides: number, hdl: number, cholesterol: number): ComputedLDLResult | null {
  // Strict prerequisite validation: return null if ANY parameter is NaN, blank, or <= 0
  if (
    typeof triglycerides !== "number" ||
    typeof hdl !== "number" ||
    typeof cholesterol !== "number" ||
    isNaN(triglycerides) ||
    isNaN(hdl) ||
    isNaN(cholesterol) ||
    triglycerides <= 0 ||
    hdl <= 0 ||
    cholesterol <= 0
  ) {
    return null; // LDL becomes completely blank ("") with no evaluation badge when any input is missing
  }

  // Friedewald equation limitation: invalid if Triglycerides > 400 mg/dL per specification
  if (triglycerides > 400) {
    return {
      value: "",
      outcome: "NoEvaluation",
      error: "Triglycerides > 400 mg/dL: Friedewald equation invalid",
    };
  }

  // Friedewald Equation: Total Cholesterol - HDL - (Triglycerides / 5)
  const ldlVal = cholesterol - hdl - triglycerides / 5;
  const rounded = Math.round(ldlVal * 100) / 100;

  return {
    value: rounded.toString(),
    outcome: rounded > 150 ? "Abnormal" : "Normal",
  };
}
