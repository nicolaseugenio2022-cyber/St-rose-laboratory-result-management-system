/**
 * Blood Bank and Timed Test Declarative Definitions (Phase B3)
 *
 * Reports:
 * 1. BLOOD_TYPING
 * 2. OGTT
 */

import { ClinicalReportDefinition } from "@/domain/types/report-definition";
import { RESULT_ONLY_STANDARD_RENDER_CONTRACT } from "./shared-render-contracts";
import { lessThan, validEntryOnly } from "./evaluation-policies";

/**
 * BLOOD_TYPING: 2 parameters (ABO Typing, Rh Typing).
 * Requested By: OPTIONAL and editable. Which physicians it suggests, and which one a new report starts at, are decided by the managed physician directory - not declared here.
 * No automatic default result selection.
 */
export const BLOOD_TYPING_DEFINITION: ClinicalReportDefinition = {
  templateCode: "BLOOD_TYPING",
  templateTitle: "Blood Typing",
  reportTitle: "BLOOD TYPING",
  examinationFamily: "Serology & Blood Bank",
  rendererFamily: "SimpleResult",
  renderContract: RESULT_ONLY_STANDARD_RENDER_CONTRACT,
  parameters: [
    {
      parameterCode: "ABO_TYPING",
      legacyParameterCodes: ["BLOOD_GROUP"],
      parameterName: "ABO Typing",
      inputType: "SingleSelect",
      options: ["A", "B", "AB", "O"], // Exact options
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "RH_TYPING",
      legacyParameterCodes: ["RH_FACTOR"],
      parameterName: "Rh Typing",
      inputType: "SingleSelect",
      options: ["Positive", "Negative"], // Exact options
      isRequired: true,
      isSelectable: true,
      displayOrder: 2,
      evaluationPolicy: validEntryOnly(),
    },
  ],
  requestedByPolicy: {
    defaultPhysician: null,
    isEditable: true,
    isRequired: false,
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
 * OGTT: 3 timed glucose tolerance parameters (FBS, 1 Hour, 2 Hours).
 * Requested By: OPTIONAL and editable. Which physicians it suggests, and which one a new report starts at, are decided by the managed physician directory - not declared here.
 */
export const OGTT_DEFINITION: ClinicalReportDefinition = {
  templateCode: "OGTT",
  templateTitle: "Oral Glucose Tolerance Test (OGTT)",
  reportTitle: "ORAL GLUCOSE TOLERANCE TEST",
  examinationFamily: "Clinical Chemistry",
  rendererFamily: "Tabular",
  parameters: [
    {
      parameterCode: "FBS",
      legacyParameterCodes: ["FASTING"],
      parameterName: "Fasting Blood Sugar",
      inputType: "NumericText",
      unit: "mg/dL",
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
      referenceRule: { normalRange: "< 100" },
      evaluationPolicy: lessThan(100),
    },
    {
      parameterCode: "OGTT_1HR",
      legacyParameterCodes: ["FIRST_HOUR"],
      parameterName: "1 Hour",
      inputType: "NumericText",
      unit: "mg/dL",
      isRequired: true,
      isSelectable: true,
      displayOrder: 2,
      referenceRule: { normalRange: "< 200" },
      evaluationPolicy: lessThan(200),
    },
    {
      parameterCode: "OGTT_2HR",
      legacyParameterCodes: ["SECOND_HOUR"],
      parameterName: "2 Hours",
      inputType: "NumericText",
      unit: "mg/dL",
      isRequired: true,
      isSelectable: true,
      displayOrder: 3,
      referenceRule: { normalRange: "< 140" },
      evaluationPolicy: lessThan(140),
    },
  ],
  requestedByPolicy: {
    defaultPhysician: "Dr. Heinz Roland Asperas",
    isEditable: true,
    isRequired: false,
  },
  statusPolicy: {
    demographicCollection: false,
    type: "Omitted",
  },
  requiresKitInfo: false,
  supportsRemarks: true,
  defaultRemarks: "",
};
