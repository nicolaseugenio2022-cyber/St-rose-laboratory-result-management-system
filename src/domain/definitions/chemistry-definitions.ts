/**
 * Clinical Chemistry Declarative Definitions (Phase B2)
 *
 * Reports:
 * 1. CHEM_8
 * 2. HDL_LDL
 * 3. CHEM_10
 * 4. RBS
 * 5. HBA1C
 */

import { ClinicalReportDefinition } from "@/domain/types/report-definition";
import {
  FBS_PARAM,
  CHOLESTEROL_PARAM,
  TRIGLYCERIDES_PARAM,
  HDL_PARAM,
  LDL_PARAM,
  URIC_ACID_PARAM,
  BUN_PARAM,
  SGPT_PARAM,
  SGPT_ALT_PARAM,
  SGOT_AST_PARAM,
  CREATININE_PARAM,
} from "./shared-chemistry-parameters";
import { lessThan, numericRange } from "./evaluation-policies";

/**
 * CHEM_8: 6 parameters (Fasting Blood Sugar, Cholesterol, Triglycerides, Uric Acid, SGPT, Creatinine).
 * Requested By: REQUIRED, no automatic physician default.
 */
export const CHEM_8_DEFINITION: ClinicalReportDefinition = {
  templateCode: "CHEM_8",
  templateTitle: "Clinical Chemistry (Chem 8)",
  reportTitle: "CLINICAL CHEMISTRY",
  examinationFamily: "Clinical Chemistry",
  rendererFamily: "Tabular",
  parameters: [
    { ...FBS_PARAM, displayOrder: 1 },
    { ...CHOLESTEROL_PARAM, displayOrder: 2 },
    { ...TRIGLYCERIDES_PARAM, displayOrder: 3 },
    { ...URIC_ACID_PARAM, displayOrder: 4 },
    { ...SGPT_PARAM, displayOrder: 5 },
    { ...CREATININE_PARAM, displayOrder: 6 },
  ],
  requestedByPolicy: {
    defaultPhysician: null, // Required staff entry, no default physician
    isEditable: true,
    isRequired: true,
  },
  statusPolicy: {
    demographicCollection: false,
    type: "Omitted",
  },
  requiresKitInfo: false,
  supportsRemarks: true,
  defaultRemarks: "",
};

/**
 * HDL_LDL: 8 parameters (Fasting Blood Sugar, Cholesterol, Triglycerides, HDL, LDL, Uric Acid, SGPT, Creatinine).
 * Requested By Default: Dr. Heinz Roland Asperas (Editable, Required)
 */
export const HDL_LDL_DEFINITION: ClinicalReportDefinition = {
  templateCode: "HDL_LDL",
  templateTitle: "Lipid Profile (HDL / LDL)",
  reportTitle: "LIPID PROFILE",
  examinationFamily: "Clinical Chemistry",
  rendererFamily: "Tabular",
  parameters: [
    { ...FBS_PARAM, displayOrder: 1 },
    { ...CHOLESTEROL_PARAM, displayOrder: 2 },
    { ...TRIGLYCERIDES_PARAM, displayOrder: 3 },
    { ...HDL_PARAM, displayOrder: 4 },
    { ...LDL_PARAM, displayOrder: 5 },
    { ...URIC_ACID_PARAM, displayOrder: 6 },
    { ...SGPT_PARAM, displayOrder: 7 },
    { ...CREATININE_PARAM, displayOrder: 8 },
  ],
  requestedByPolicy: {
    defaultPhysician: "Dr. Heinz Roland Asperas",
    isEditable: true,
    isRequired: true,
  },
  statusPolicy: {
    demographicCollection: false,
    type: "Omitted",
  },
  requiresKitInfo: false,
  supportsRemarks: true,
  defaultRemarks: "",
};

/**
 * CHEM_10: 10 parameters (Fasting Blood Sugar, Cholesterol, Triglycerides, HDL, LDL, Uric Acid, Blood Urea Nitrogen, SGPT/ALT, SGOT/AST, Creatinine).
 * Requested By Default: Dr. Heinz Roland Asperas (Editable, Required)
 */
export const CHEM_10_DEFINITION: ClinicalReportDefinition = {
  templateCode: "CHEM_10",
  templateTitle: "Clinical Chemistry (Chem 10)",
  reportTitle: "CLINICAL CHEMISTRY",
  examinationFamily: "Clinical Chemistry",
  rendererFamily: "Tabular",
  parameters: [
    { ...FBS_PARAM, displayOrder: 1 },
    { ...CHOLESTEROL_PARAM, displayOrder: 2 },
    { ...TRIGLYCERIDES_PARAM, displayOrder: 3 },
    { ...HDL_PARAM, displayOrder: 4 },
    { ...LDL_PARAM, displayOrder: 5 },
    { ...URIC_ACID_PARAM, displayOrder: 6 },
    { ...BUN_PARAM, displayOrder: 7 },
    { ...SGPT_ALT_PARAM, displayOrder: 8 },
    { ...SGOT_AST_PARAM, displayOrder: 9 },
    { ...CREATININE_PARAM, displayOrder: 10 },
  ],
  requestedByPolicy: {
    defaultPhysician: "Dr. Heinz Roland Asperas",
    isEditable: true,
    isRequired: true,
  },
  statusPolicy: {
    demographicCollection: false,
    type: "Omitted",
  },
  requiresKitInfo: false,
  supportsRemarks: true,
  defaultRemarks: "",
};

/**
 * RBS: 1 parameter (Random Blood Sugar).
 * Requested By Default: Dr. Ralph Roland Asperas (Editable, Required)
 */
export const RBS_DEFINITION: ClinicalReportDefinition = {
  templateCode: "RBS",
  templateTitle: "Random Blood Sugar (RBS)",
  reportTitle: "RANDOM BLOOD SUGAR",
  examinationFamily: "Clinical Chemistry",
  rendererFamily: "SimpleResult",
  parameters: [
    {
      parameterCode: "RBS_RESULT",
      legacyParameterCodes: ["RBS"],
      parameterName: "Random Blood Sugar",
      inputType: "NumericText",
      unit: "mg/dL",
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
      referenceRule: { normalRange: "90–145" },
      evaluationPolicy: numericRange(90, 145),
    },
  ],
  requestedByPolicy: {
    defaultPhysician: "Dr. Ralph Roland Asperas",
    isEditable: true,
    isRequired: true,
  },
  statusPolicy: {
    demographicCollection: false,
    type: "Omitted",
  },
  requiresKitInfo: false,
  supportsRemarks: true,
  defaultRemarks: "",
};

/**
 * HBA1C: 1 parameter (HbA1c). Exact mixed-case casing "HbA1c".
 * Requested By Default: Dr. Heinz Roland Asperas (Editable, Required)
 * Kit metadata: Lot F20712509AD, Exp 2028-04-26 (Editable)
 */
export const HBA1C_DEFINITION: ClinicalReportDefinition = {
  templateCode: "HBA1C",
  templateTitle: "Glycated Hemoglobin (HbA1c)",
  reportTitle: "HbA1c", // Exact mixed-case printed report title required
  examinationFamily: "Clinical Chemistry",
  rendererFamily: "SimpleResult",
  parameters: [
    {
      parameterCode: "HBA1C_RESULT",
      legacyParameterCodes: ["HBA1C"],
      parameterName: "HbA1c", // Exact mixed-case parameter label
      inputType: "NumericText",
      unit: "%",
      suffixSpec: { suffix: "%" },
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
      referenceRule: { normalRange: "< 6.5 %" },
      evaluationPolicy: lessThan(6.5),
    },
  ],
  requestedByPolicy: {
    defaultPhysician: "Dr. Heinz Roland Asperas",
    isEditable: true,
    isRequired: true,
  },
  statusPolicy: {
    demographicCollection: false,
    type: "Omitted",
  },
  requiresKitInfo: true,
  defaultKitInfo: {
    lotNumber: "F20712509AD",
    expirationDate: "2028-04-26",
    isLotEditable: true,
    isExpEditable: true,
  },
  supportsRemarks: true,
  defaultRemarks: "",
};
