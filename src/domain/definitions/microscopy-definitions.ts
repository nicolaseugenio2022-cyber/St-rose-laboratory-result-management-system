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
 * Color & Consistency: result reported uppercase from render-contract version 2; the stored
 *   option value keeps its mixed case
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
  // Fecalysis reports no reference or normal values, so it declares a two-column result grid. No
  // parameter below carries a referenceRule, so the third column could only ever have printed an
  // empty cell under a "NORMAL VALUES" heading; declaring two columns removes the heading as well
  // and returns the width to the result. The layout family is unchanged - this is a declared
  // override of the shared Tabular composition, not a new renderer.
  renderContract: {
    // Version 2 carries the approved client corrections. Version 1 - the three-column layout with
    // the NORMAL VALUES header - remains supported so every Fecalysis report completed before this
    // change renders byte-for-byte as it was issued.
    renderContractVersion: 2,
    supersededRenderContractVersions: [1],
    staticContentVersion: "standard-report-v1",
    standardComposition: {
      resultHeaders: ["EXAMINATION", "RESULT"],
      columnRatios: [40, 60],
      sinceRenderContractVersion: 2,
    },
  },
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
      // The stored value keeps the mixed-case option exactly as selected or typed; only the
      // reported value is uppercased, so "Brown" is persisted and BROWN is printed.
      resultPresentation: { casing: "Uppercase", sinceRenderContractVersion: 2 },
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
      // The stored value keeps the mixed-case option exactly as selected or typed; only the
      // reported value is uppercased, so "Loose" is persisted and LOOSE is printed.
      resultPresentation: { casing: "Uppercase", sinceRenderContractVersion: 2 },
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
      // Organism names and the negative phrase are both reported in italics; the examination label
      // is not, because the emphasis belongs to the result value primitive alone.
      resultPresentation: { emphasis: "Italic", sinceRenderContractVersion: 2 },
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
  renderContract: {
    renderContractVersion: 1,
    staticContentVersion: "standard-report-v1",
    specializedComposition: {
      kind: "MicroscopyTwoColumn",
      sections: [
        {
          id: "physical-chemical",
          label: "PHYSICAL / CHEMICAL EXAMINATION",
          parameterCodes: ["COLOR", "TRANSPARENCY", "PH", "SP_GRAVITY", "PROTEIN", "GLUCOSE"],
        },
        {
          id: "microscopic",
          label: "MICROSCOPIC EXAMINATION",
          parameterCodes: ["WBC", "RBC", "EPITHELIAL_CELLS", "BACTERIA", "MUCUS_THREADS", "AMORPHOUS_CRYSTAL"],
        },
      ],
      conditionalParameterCodes: ["AMORPHOUS_CRYSTAL"],
      repeatableFindingCategories: ["Additional Microscopic Findings"],
    },
  },
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
