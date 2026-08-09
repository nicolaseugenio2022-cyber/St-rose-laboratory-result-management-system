/**
 * Hematology Declarative Definitions (Phase B3)
 *
 * Reports:
 * 1. CBC
 * 2. CT_BT
 * 3. ESR
 */

import { ClinicalReportDefinition } from "@/domain/types/report-definition";
import { numericRange, sexSpecificRange, unresolvedEvaluation, validEntryOnly } from "./evaluation-policies";

/**
 * CBC: 10 parameters (Hemoglobin, Hematocrit, RBC Count, WBC Count, Platelet Count, Neutrophil, Lymphocyte, Eosinophil, Monocyte, Basophil).
 * Requested By Default: Dr. Ralph Roland Asperas (Editable, Required)
 * Default Remarks: "TEST/S RECHECKED; RESULT/S VERIFIED" (Editable)
 * Abnormal indicators: Suppressed entirely (suppressAbnormalIndicators: true)
 * Patient Status: No Encoding demographic collection (demographicCollection: false). Static label reserved for layout.
 */
export const CBC_DEFINITION: ClinicalReportDefinition = {
  templateCode: "CBC",
  templateTitle: "Complete Blood Count (CBC)",
  reportTitle: null, // Omit report title on document per contract
  examinationFamily: "Hematology",
  rendererFamily: "Tabular",
  suppressAbnormalIndicators: true,
  parameters: [
    {
      parameterCode: "HEMOGLOBIN",
      parameterName: "Hemoglobin",
      inputType: "NumericText",
      unit: "g/L",
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
      displayPrecision: 0,
      referenceRule: { male: "130–160", female: "120–140" },
      evaluationPolicy: sexSpecificRange(
        { minValue: 130, maxValue: 160 },
        { minValue: 120, maxValue: 140 }
      ),
    },
    {
      parameterCode: "HEMATOCRIT",
      parameterName: "Hematocrit",
      inputType: "NumericText",
      unit: null,
      isRequired: true,
      isSelectable: true,
      displayOrder: 2,
      displayPrecision: 2,
      referenceRule: { male: "0.40–0.52", female: "0.37–0.42" },
      evaluationPolicy: sexSpecificRange(
        { minValue: 0.4, maxValue: 0.52 },
        { minValue: 0.37, maxValue: 0.42 }
      ),
    },
    {
      parameterCode: "RBC_COUNT",
      legacyParameterCodes: ["RBC"],
      parameterName: "RBC Count",
      inputType: "NumericText",
      unit: "x 10^12/L",
      isRequired: true,
      isSelectable: true,
      displayOrder: 3,
      displayPrecision: 1,
      referenceRule: { male: "4.5–6.0", female: "4.0–5.5" },
      evaluationPolicy: sexSpecificRange(
        { minValue: 4.5, maxValue: 6.0 },
        { minValue: 4.0, maxValue: 5.5 }
      ),
    },
    {
      parameterCode: "WBC_COUNT",
      legacyParameterCodes: ["WBC"],
      parameterName: "WBC Count",
      inputType: "NumericText",
      unit: "x 10^9/L",
      isRequired: true,
      isSelectable: true,
      displayOrder: 4,
      displayPrecision: 1,
      referenceRule: { normalRange: "5.0–10.0" },
      evaluationPolicy: numericRange(5.0, 10.0),
    },
    {
      parameterCode: "PLATELET_COUNT",
      legacyParameterCodes: ["PLATELET"],
      parameterName: "Platelet Count",
      inputType: "NumericText",
      unit: "x 10^9/L",
      isRequired: true,
      isSelectable: true,
      displayOrder: 5,
      displayPrecision: 0,
      referenceRule: { normalRange: "150–450" },
      evaluationPolicy: numericRange(150, 450),
    },
    {
      parameterCode: "NEUTROPHIL",
      parameterName: "Neutrophil",
      inputType: "NumericText",
      unit: null,
      isRequired: true,
      isSelectable: true,
      displayOrder: 6,
      displayPrecision: 2,
      referenceRule: { normalRange: "0.50–0.70" },
      evaluationPolicy: numericRange(0.5, 0.7),
    },
    {
      parameterCode: "LYMPHOCYTE",
      parameterName: "Lymphocyte",
      inputType: "NumericText",
      unit: null,
      isRequired: true,
      isSelectable: true,
      displayOrder: 7,
      displayPrecision: 2,
      referenceRule: { normalRange: "0.25–0.40" },
      evaluationPolicy: numericRange(0.25, 0.4),
    },
    {
      parameterCode: "EOSINOPHIL",
      parameterName: "Eosinophil",
      inputType: "NumericText",
      unit: null,
      isRequired: true,
      isSelectable: true,
      displayOrder: 8,
      displayPrecision: 2,
      referenceRule: { normalRange: "0.01–0.04" },
      evaluationPolicy: numericRange(0.01, 0.04),
    },
    {
      parameterCode: "MONOCYTE",
      parameterName: "Monocyte",
      inputType: "NumericText",
      unit: null,
      isRequired: true,
      isSelectable: true,
      displayOrder: 9,
      displayPrecision: 2,
      referenceRule: { normalRange: "0.03–0.08" },
      evaluationPolicy: numericRange(0.03, 0.08),
    },
    {
      parameterCode: "BASOPHIL",
      parameterName: "Basophil",
      inputType: "NumericText",
      unit: null,
      isRequired: true,
      isSelectable: true,
      displayOrder: 10,
      displayPrecision: 2,
      referenceRule: { normalRange: "0.00–0.01" },
      evaluationPolicy: numericRange(0, 0.01),
    },
  ],
  requestedByPolicy: {
    defaultPhysician: "Dr. Ralph Roland Asperas",
    isEditable: true,
    isRequired: true,
  },
  statusPolicy: {
    demographicCollection: false, // No Patient Status Encoding collection
    type: "Static",
    staticLabel: "Status",
  },
  requiresKitInfo: false,
  supportsRemarks: true,
  defaultRemarks: "TEST/S RECHECKED; RESULT/S VERIFIED",
};

/**
 * CT_BT: 2 parameters (Bleeding Time, Clotting Time).
 * Requested By Default: Dr. Ralph Roland Asperas (Editable, Required)
 */
export const CT_BT_DEFINITION: ClinicalReportDefinition = {
  templateCode: "CT_BT",
  templateTitle: "Clotting Time & Bleeding Time",
  reportTitle: "CLOTTING TIME & BLEEDING TIME",
  examinationFamily: "Hematology",
  rendererFamily: "SimpleResult",
  parameters: [
    {
      parameterCode: "BLEEDING_TIME",
      parameterName: "Bleeding Time",
      inputType: "FreeText",
      unit: "mins",
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
      referenceRule: { normalRange: "1–4 mins" },
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "CLOTTING_TIME",
      parameterName: "Clotting Time",
      inputType: "FreeText",
      unit: "mins",
      isRequired: true,
      isSelectable: true,
      displayOrder: 2,
      referenceRule: { normalRange: "2–6 mins" },
      evaluationPolicy: validEntryOnly(),
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
 * ESR: 1 parameter (Erythrocyte Sedimentation Rate).
 * Requested By Default: Dr. Ralph Roland Asperas (Editable, Required)
 * Unresolved note preserved for child age cutoff threshold.
 */
export const ESR_DEFINITION: ClinicalReportDefinition = {
  templateCode: "ESR",
  templateTitle: "Erythrocyte Sedimentation Rate (ESR)",
  reportTitle: "ERYTHROCYTE SEDIMENTATION RATE",
  examinationFamily: "Hematology",
  rendererFamily: "SimpleResult",
  parameters: [
    {
      parameterCode: "ESR_RESULT",
      legacyParameterCodes: ["ESR"],
      parameterName: "Erythrocyte Sedimentation Rate",
      inputType: "NumericText",
      unit: "mm/hr",
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
      referenceRule: {
        male: "0–15 mm/hr",
        female: "0–20 mm/hr",
        children: "0–13 mm/hr",
      },
      evaluationPolicy: unresolvedEvaluation("Child age cutoff threshold is unconfirmed by client."),
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
  unresolvedNotes: [
    {
      topic: "Child Age Cutoff",
      note: "Child age cutoff threshold is unconfirmed by client; preserved as unresolved state.",
    },
  ],
};
