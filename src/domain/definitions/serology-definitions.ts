/**
 * Serology & Immunology Declarative Definitions (Phase B2)
 *
 * Reports:
 * 1. HBSAG
 * 2. RPR
 * 3. DENGUE_DUO
 * 4. PREG_TEST
 * 5. HIV_RESULT
 */

import { ClinicalReportDefinition } from "@/domain/types/report-definition";
import { validEntryOnly } from "./evaluation-policies";

/**
 * HBSAG: 1 qualitative parameter (Nonreactive / Reactive).
 * Requested By Default: Dr. Ralph Roland Asperas (Editable, Required)
 * Printed Report Title: HEPATITIS B (SCREENING)
 * Kit info required (editable by staff, no invented defaults).
 */
export const HBSAG_DEFINITION: ClinicalReportDefinition = {
  templateCode: "HBSAG",
  templateTitle: "Hepatitis B Surface Antigen (HBsAg)",
  reportTitle: "HEPATITIS B (SCREENING)", // Exact printed report title
  examinationFamily: "Serology & Immunology",
  rendererFamily: "SimpleResult",
  parameters: [
    {
      parameterCode: "HBSAG_RESULT",
      legacyParameterCodes: ["HBSAG"],
      parameterName: "HBsAg",
      inputType: "SingleSelect",
      options: ["Nonreactive", "Reactive"],
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
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
  requiresKitInfo: true,
  defaultKitInfo: {
    lotNumber: "",
    expirationDate: "",
    isLotEditable: true,
    isExpEditable: true,
  },
  supportsRemarks: true,
  defaultRemarks: "",
};

/**
 * RPR: 1 qualitative parameter (Nonreactive / Reactive).
 * Requested By Default: Dr. Ralph Roland Asperas (Editable, Required)
 * Printed Report Title: SYPHILIS / RPR (SCREENING)
 * Kit info required (editable by staff, no invented defaults).
 */
export const RPR_DEFINITION: ClinicalReportDefinition = {
  templateCode: "RPR",
  templateTitle: "Rapid Plasma Reagin (RPR)",
  reportTitle: "SYPHILIS / RPR (SCREENING)", // Exact printed report title
  examinationFamily: "Serology & Immunology",
  rendererFamily: "SimpleResult",
  parameters: [
    {
      parameterCode: "RPR_RESULT",
      legacyParameterCodes: ["RPR"],
      parameterName: "RPR",
      inputType: "SingleSelect",
      options: ["Nonreactive", "Reactive"],
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
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
  requiresKitInfo: true,
  defaultKitInfo: {
    lotNumber: "",
    expirationDate: "",
    isLotEditable: true,
    isExpEditable: true,
  },
  supportsRemarks: true,
  defaultRemarks: "",
};

/**
 * DENGUE_DUO: 3 qualitative parameters (NS1, IgG, IgM).
 * Requested By Default: Dr. Ralph Roland Asperas (Editable, Required)
 * Printed Report Title: DENGUE DUO TEST
 * Kit info required: initial Lot 202512015, Exp 2028-11 (Editable)
 */
export const DENGUE_DUO_DEFINITION: ClinicalReportDefinition = {
  templateCode: "DENGUE_DUO",
  templateTitle: "Dengue Duo Test",
  reportTitle: "DENGUE DUO TEST",
  examinationFamily: "Serology & Immunology",
  rendererFamily: "SimpleResult",
  parameters: [
    {
      parameterCode: "DENGUE_NS1",
      parameterName: "Dengue NS1 Ag",
      inputType: "SingleSelect",
      options: ["Negative", "Positive"],
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "DENGUE_IGG",
      legacyParameterCodes: ["IGG"],
      parameterName: "Dengue IgG",
      inputType: "SingleSelect",
      options: ["Negative", "Positive"],
      isRequired: true,
      isSelectable: true,
      displayOrder: 2,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "DENGUE_IGM",
      legacyParameterCodes: ["IGM"],
      parameterName: "Dengue IgM",
      inputType: "SingleSelect",
      options: ["Negative", "Positive"],
      isRequired: true,
      isSelectable: true,
      displayOrder: 3,
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
  requiresKitInfo: true,
  defaultKitInfo: {
    lotNumber: "202512015",
    expirationDate: "2028-11",
    isLotEditable: true,
    isExpEditable: true,
  },
  supportsRemarks: true,
  defaultRemarks: "",
};

/**
 * PREG_TEST: 1 qualitative parameter (Negative / Positive).
 * Requested By Default: Dr. Ralph Roland Asperas (Editable, Required)
 * Printed Report Title: PREGNANCY TEST (URINE)
 * Kit info required (editable by staff, no invented defaults).
 */
export const PREG_TEST_DEFINITION: ClinicalReportDefinition = {
  templateCode: "PREG_TEST",
  templateTitle: "Pregnancy Test",
  reportTitle: "PREGNANCY TEST (URINE)", // Exact printed report title
  examinationFamily: "Serology & Immunology",
  rendererFamily: "SimpleResult",
  parameters: [
    {
      parameterCode: "PREG_RESULT",
      legacyParameterCodes: ["PREG_TEST"],
      parameterName: "Pregnancy Test",
      inputType: "SingleSelect",
      options: ["Negative", "Positive"],
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
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
  requiresKitInfo: true,
  defaultKitInfo: {
    lotNumber: "",
    expirationDate: "",
    isLotEditable: true,
    isExpEditable: true,
  },
  supportsRemarks: true,
  defaultRemarks: "",
};

/**
 * HIV_RESULT: 1 qualitative parameter (Nonreactive / Reactive).
 * Dedicated Certificate layout.
 * Requested By Policy: Referring Doctor: REQUIRED, no default physician.
 * Printed Report Title: HIV 1 & 2 RAPID TEST CERTIFICATE
 * Kit info required (editable by staff, no invented defaults).
 */
export const HIV_RESULT_DEFINITION: ClinicalReportDefinition = {
  templateCode: "HIV_RESULT",
  templateTitle: "HIV 1 & 2 Rapid Test Certificate",
  reportTitle: "HIV 1 & 2 RAPID TEST CERTIFICATE",
  examinationFamily: "Serology & Immunology",
  rendererFamily: "Dedicated Certificate",
  parameters: [
    {
      parameterCode: "HIV_RESULT",
      legacyParameterCodes: ["HIV_SCREENING"],
      parameterName: "HIV 1 & 2 Rapid Test",
      inputType: "SingleSelect",
      options: ["Nonreactive", "Reactive"],
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
      evaluationPolicy: validEntryOnly(),
    },
  ],
  requestedByPolicy: {
    defaultPhysician: null, // Staff entry required, no default physician
    fieldLabel: "Referring Doctor",
    isEditable: true,
    isRequired: true,      // REQUIRED (Referring Doctor is mandatory)
  },
  additionalEncodingFields: [
    {
      fieldCode: "examinationDateTime",
      label: "Date & Time of Examination",
      inputType: "FreeText",
      isRequired: true,
      placeholder: "Enter examination date and time",
    },
    {
      fieldCode: "companyName",
      label: "Company Name",
      inputType: "FreeText",
      isRequired: false,
      placeholder: "Enter company name if applicable",
    },
  ],
  signatoryRequirements: {
    requiredPathologistsCount: 1,
    requiredMedtechsCount: 2,
  },
  statusPolicy: {
    demographicCollection: false,
    type: "Omitted",
  },
  requiresKitInfo: true,
  defaultKitInfo: {
    lotNumber: "",
    expirationDate: "",
    isLotEditable: true,
    isExpEditable: true,
  },
  supportsRemarks: true,
  defaultRemarks: "",
};
