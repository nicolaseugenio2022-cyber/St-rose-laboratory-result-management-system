/**
 * Clinical Microscopy Declarative Definitions (Phase B3)
 *
 * Reports:
 * 1. FECALYSIS
 * 2. URINALYSIS
 */

import { ClinicalReportDefinition } from "@/domain/types/report-definition";
import { validEntryOnly } from "./evaluation-policies";

/**
 * FECALYSIS:
 * Color: Combobox (options + editable text)
 * Consistency: Combobox (options + editable text)
 * Pus Cells & Red Cells: FreeText raw input with fixed " /HPF" suffix
 * Bacteria: FreeText with initial default "4+" (editable)
 * Parasites: FreeText with initial automatic default "NO INTESTINAL PARASITES OR OVA SEEN" (editable)
 * Blank Omission: Optional blank findings omitted from report output (blankOmission: true)
 * Requested By Default: Dr. Ma. Floricel Dedace-Lagrazon (Editable, Required)
 */
export const FECALYSIS_DEFINITION: ClinicalReportDefinition = {
  templateCode: "FECALYSIS",
  templateTitle: "Routine Fecalysis",
  reportTitle: "ROUTINE FECALYSIS",
  examinationFamily: "Clinical Microscopy",
  rendererFamily: "Tabular",
  parameters: [
    {
      parameterCode: "COLOR",
      parameterName: "Color",
      inputType: "Combobox",
      options: [
        "Brown",
        "Yellowish Brown",
        "Dark Brown",
        "Black",
        "Green",
        "Greenish Brown",
        "Red",
        "Reddish Brown",
      ],
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "CONSISTENCY",
      parameterName: "Consistency",
      inputType: "Combobox",
      options: ["Soft", "Loose", "Semi-Formed", "Formed", "Mushy", "Watery"],
      isRequired: true,
      isSelectable: true,
      displayOrder: 2,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "BLOOD",
      parameterName: "Blood",
      inputType: "FreeText",
      isRequired: false,
      isSelectable: true,
      displayOrder: 3,
      evaluationPolicy: validEntryOnly(),
      blankOmission: true,
    },
    {
      parameterCode: "MUCUS",
      parameterName: "Mucus",
      inputType: "FreeText",
      isRequired: false,
      isSelectable: true,
      displayOrder: 4,
      evaluationPolicy: validEntryOnly(),
      blankOmission: true,
    },
    {
      parameterCode: "PH",
      parameterName: "pH",
      inputType: "FreeText",
      isRequired: false,
      isSelectable: true,
      displayOrder: 5,
      evaluationPolicy: validEntryOnly(),
      blankOmission: true,
    },
    {
      parameterCode: "FAT_GLOBULES",
      parameterName: "Fat Globules",
      inputType: "FreeText",
      isRequired: false,
      isSelectable: true,
      displayOrder: 6,
      evaluationPolicy: validEntryOnly(),
      blankOmission: true,
    },
    {
      parameterCode: "PUS_CELLS",
      parameterName: "Pus Cells",
      inputType: "FreeText",
      suffixSpec: { suffix: " /HPF" },
      isRequired: false,
      isSelectable: true,
      displayOrder: 7,
      evaluationPolicy: validEntryOnly(),
      blankOmission: true,
    },
    {
      parameterCode: "RED_CELLS",
      parameterName: "Red Cells",
      inputType: "FreeText",
      suffixSpec: { suffix: " /HPF" },
      isRequired: false,
      isSelectable: true,
      displayOrder: 8,
      evaluationPolicy: validEntryOnly(),
      blankOmission: true,
    },
    {
      parameterCode: "BACTERIA",
      parameterName: "Bacteria",
      inputType: "FreeText", // FreeText, NOT combobox
      defaultValue: "4+",
      isRequired: false,
      isSelectable: true,
      displayOrder: 9,
      evaluationPolicy: validEntryOnly(),
      blankOmission: true,
    },
    {
      parameterCode: "PARASITES",
      legacyParameterCodes: ["PARASITE"],
      parameterName: "Parasites / Ova",
      inputType: "FreeText",
      defaultValue: "NO INTESTINAL PARASITES OR OVA SEEN", // Exact approved automatic default
      isRequired: false,
      isSelectable: true,
      displayOrder: 10,
      evaluationPolicy: validEntryOnly(),
      blankOmission: true,
    },
    {
      parameterCode: "OTHERS",
      parameterName: "Others",
      inputType: "FreeText",
      isRequired: false,
      isSelectable: true,
      displayOrder: 11,
      evaluationPolicy: validEntryOnly(),
      blankOmission: true,
    },
  ],
  requestedByPolicy: {
    defaultPhysician: "Dr. Ma. Floricel Dedace-Lagrazon",
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
 * URINALYSIS: DiagnosticGrid Renderer Family
 * Physical & Chemical: Color, Transparency/Clarity, pH, Specific Gravity, Protein, Glucose
 * Microscopic: WBC (FreeText + " /HPF"), RBC (FreeText + " /HPF"), Epithelial Cells, Bacteria, Mucus Threads
 * Conditional Primary Crystal: Amorphous Urates / Phosphates (label choice + quantity options, omitted if blank)
 * Repeatable Findings: Additional Microscopic Findings (multiple entries)
 * Requested By: Required staff entry, no default physician.
 */
export const URINALYSIS_DEFINITION: ClinicalReportDefinition = {
  templateCode: "URINALYSIS",
  templateTitle: "Routine Urinalysis",
  reportTitle: "ROUTINE URINALYSIS",
  examinationFamily: "Clinical Microscopy",
  rendererFamily: "DiagnosticGrid",
  parameters: [
    {
      parameterCode: "COLOR",
      parameterName: "Color",
      inputType: "Combobox",
      options: [
        "Straw",
        "Pale Yellow",
        "Light Yellow",
        "Yellow",
        "Dark Yellow",
        "Amber",
        "Brown",
        "Red",
      ],
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "TRANSPARENCY",
      legacyParameterCodes: ["CLARITY"],
      parameterName: "Transparency / Clarity",
      inputType: "Combobox",
      options: [
        "Clear",
        "Slightly Hazy",
        "Hazy",
        "Slightly Cloudy",
        "Cloudy",
        "Slightly Turbid",
        "Turbid",
      ],
      isRequired: true,
      isSelectable: true,
      displayOrder: 2,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "PH",
      parameterName: "pH",
      inputType: "SingleSelect",
      options: ["5.0", "6.0", "6.5", "7.0", "7.5", "8.0", "9.0"],
      isRequired: true,
      isSelectable: true,
      displayOrder: 3,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "SP_GRAVITY",
      legacyParameterCodes: ["SPECIFIC_GRAVITY"],
      parameterName: "Specific Gravity",
      inputType: "SingleSelect",
      options: ["1.000", "1.005", "1.010", "1.015", "1.020", "1.025", "1.030"],
      isRequired: true,
      isSelectable: true,
      displayOrder: 4,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "PROTEIN",
      parameterName: "Protein",
      inputType: "SingleSelect",
      options: ["Negative", "Trace", "1+", "2+", "3+", "4+"],
      isRequired: true,
      isSelectable: true,
      displayOrder: 5,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "GLUCOSE",
      parameterName: "Glucose",
      inputType: "SingleSelect",
      options: ["Negative", "Trace", "1+", "2+", "3+", "4+"],
      isRequired: true,
      isSelectable: true,
      displayOrder: 6,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "WBC",
      parameterName: "Pus Cells / WBC",
      inputType: "FreeText", // FreeText, not numeric-only
      suffixSpec: { suffix: " /HPF" },
      isRequired: false,
      isSelectable: true,
      displayOrder: 7,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "RBC",
      parameterName: "Red Cells / RBC",
      inputType: "FreeText", // FreeText, not numeric-only
      suffixSpec: { suffix: " /HPF" },
      isRequired: false,
      isSelectable: true,
      displayOrder: 8,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "EPITHELIAL_CELLS",
      parameterName: "Epithelial Cells",
      inputType: "SingleSelect",
      options: ["Rare", "Few", "Moderate", "Many", "Plenty"],
      isRequired: false,
      isSelectable: true,
      displayOrder: 9,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "BACTERIA",
      parameterName: "Bacteria",
      inputType: "SingleSelect",
      options: ["Rare", "Few", "Moderate", "Many", "Plenty"],
      isRequired: false,
      isSelectable: true,
      displayOrder: 10,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "MUCUS_THREADS",
      parameterName: "Mucus Threads",
      inputType: "SingleSelect",
      options: ["Rare", "Few", "Moderate", "Many", "Plenty"],
      isRequired: false,
      isSelectable: true,
      displayOrder: 11,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "AMORPHOUS_CRYSTAL",
      legacyParameterCodes: ["CRYSTAL_TYPE"],
      parameterName: "Amorphous Urates / Phosphates",
      inputType: "SingleSelect",
      blankOmission: true, // Omitted from report output if unselected/blank
      conditionalChoiceSpec: {
        labelChoices: ["Amorphous Urates", "Amorphous Phosphates"],
        resultOptions: ["Rare", "Few", "Moderate", "Many", "Plenty"],
      },
      isRequired: false,
      isSelectable: true,
      displayOrder: 12,
      evaluationPolicy: validEntryOnly(),
    },
  ],
  repeatableFindings: [
    {
      findingCategory: "Additional Microscopic Findings",
      allowedOptions: null,
      maxEntries: null,
    },
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
