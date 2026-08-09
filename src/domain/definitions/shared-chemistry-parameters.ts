/**
 * Shared Clinical Chemistry Parameters
 * Phase B Architecture: Shared reusable parameter definitions across CHEM_8, HDL_LDL, and CHEM_10.
 */

import { ParameterSpec } from "@/domain/types/report-definition";
import { lessThan, numericRange, sexSpecificRange } from "./evaluation-policies";

export const FBS_PARAM: ParameterSpec = {
  parameterCode: "FBS",
  parameterName: "Fasting Blood Sugar",
  inputType: "NumericText",
  unit: "mg/dL",
  isRequired: true,
  isSelectable: true,
  displayOrder: 1,
  referenceRule: { normalRange: "70–110" },
  evaluationPolicy: numericRange(70, 110),
};

export const CHOLESTEROL_PARAM: ParameterSpec = {
  parameterCode: "CHOLESTEROL",
  parameterName: "Cholesterol",
  inputType: "NumericText",
  unit: "mg/dL",
  isRequired: true,
  isSelectable: true,
  displayOrder: 2,
  referenceRule: { normalRange: "< 200" },
  evaluationPolicy: lessThan(200),
};

export const TRIGLYCERIDES_PARAM: ParameterSpec = {
  parameterCode: "TRIGLYCERIDES",
  parameterName: "Triglycerides",
  inputType: "NumericText",
  unit: "mg/dL",
  isRequired: true,
  isSelectable: true,
  displayOrder: 3,
  referenceRule: { normalRange: "35–165" },
  evaluationPolicy: numericRange(35, 165),
};

export const HDL_PARAM: ParameterSpec = {
  parameterCode: "HDL",
  parameterName: "HDL",
  inputType: "Computed",
  unit: "mg/dL",
  isRequired: true,
  isSelectable: true,
  displayOrder: 4,
  displayPrecision: 2,
  referenceRule: { normalRange: "0–110" },
  evaluationPolicy: numericRange(0, 110),
  formulaBinding: {
    formulaId: "hdl-client-formula",
    dependencies: ["CHOLESTEROL"],
    precision: 2,
    dependencyValidationPolicy: "StrictPositive",
    resultValidationPolicy: "StrictPositive",
  },
};

export const LDL_PARAM: ParameterSpec = {
  parameterCode: "LDL",
  parameterName: "LDL",
  inputType: "Computed",
  unit: "mg/dL",
  isRequired: true,
  isSelectable: true,
  displayOrder: 5,
  displayPrecision: 2,
  referenceRule: { normalRange: "< 150" },
  evaluationPolicy: lessThan(150),
  formulaBinding: {
    formulaId: "ldl-client-formula",
    dependencies: ["TRIGLYCERIDES", "CHOLESTEROL"],
    precision: 2,
    dependencyValidationPolicy: "StrictPositive",
    resultValidationPolicy: "StrictPositive",
  },
};

export const URIC_ACID_PARAM: ParameterSpec = {
  parameterCode: "URIC_ACID",
  parameterName: "Uric Acid",
  inputType: "NumericText",
  unit: "mg/dL",
  isRequired: true,
  isSelectable: true,
  displayOrder: 6,
  referenceRule: { male: "3.4–7.0", female: "2.4–5.7" },
  evaluationPolicy: sexSpecificRange(
    { minValue: 3.4, maxValue: 7.0 },
    { minValue: 2.4, maxValue: 5.7 }
  ),
};

export const BUN_PARAM: ParameterSpec = {
  parameterCode: "BUN",
  parameterName: "Blood Urea Nitrogen",
  inputType: "NumericText",
  unit: "mg/dL",
  isRequired: true,
  isSelectable: true,
  displayOrder: 7,
  referenceRule: { normalRange: "10–45" },
  evaluationPolicy: numericRange(10, 45),
};

/** Exact label "SGPT" for CHEM_8 and HDL_LDL */
export const SGPT_PARAM: ParameterSpec = {
  parameterCode: "SGPT",
  parameterName: "SGPT",
  inputType: "NumericText",
  unit: "U/L",
  isRequired: true,
  isSelectable: true,
  displayOrder: 8,
  referenceRule: { normalRange: "4–41" },
  evaluationPolicy: numericRange(4, 41),
};

/** Exact label "SGPT / ALT" for CHEM_10 */
export const SGPT_ALT_PARAM: ParameterSpec = {
  parameterCode: "SGPT_ALT",
  parameterName: "SGPT / ALT",
  inputType: "NumericText",
  unit: "U/L",
  isRequired: true,
  isSelectable: true,
  displayOrder: 8,
  referenceRule: { normalRange: "4–41" },
  evaluationPolicy: numericRange(4, 41),
};

export const SGOT_AST_PARAM: ParameterSpec = {
  parameterCode: "SGOT_AST",
  parameterName: "SGOT / AST",
  inputType: "NumericText",
  unit: "U/L",
  isRequired: true,
  isSelectable: true,
  displayOrder: 9,
  referenceRule: { normalRange: "4–41" },
  evaluationPolicy: numericRange(4, 41),
};

export const CREATININE_PARAM: ParameterSpec = {
  parameterCode: "CREATININE",
  parameterName: "Creatinine",
  inputType: "NumericText",
  unit: "mg/dL",
  isRequired: true,
  isSelectable: true,
  displayOrder: 10,
  referenceRule: { normalRange: "0.4–1.4" },
  evaluationPolicy: numericRange(0.4, 1.4),
};
