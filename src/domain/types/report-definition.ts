/**
 * Generic Declarative Report Definition Types & Interfaces
 * Phase B Architecture: Report-Neutral Declarative Model
 */

export type InputControlType =
  | "NumericText"
  | "FreeText"
  | "SingleSelect"
  | "MultiSelect"
  | "Combobox"
  | "Computed";

export type ValidationPolicy = "StrictPositive" | "AllowZero" | "NonNegative" | "AnyFinite";

export interface SuffixSpec {
  suffix: string;
  renderSeparate?: boolean;
}

export interface FormulaBindingSpec {
  formulaId: string;
  dependencies: string[];
  precision?: number;
  dependencyValidationPolicy?: ValidationPolicy;
  resultValidationPolicy?: ValidationPolicy;
  validationPolicy?: ValidationPolicy;
}

export interface ConditionalChoiceSpec {
  labelChoices: string[]; // e.g. ["Amorphous Urates", "Amorphous Phosphates"]
  resultOptions: string[]; // e.g. ["Rare", "Few", "Moderate", "Many", "Plenty"]
}

export interface NumericBoundarySpec {
  minValue?: number;
  maxValue?: number;
}

export type EvaluationPolicySpec =
  | {
      mode: "NumericAutomatic";
      strategy: "NumericRange" | "LessThan" | "GreaterThan";
      boundary?: NumericBoundarySpec;
      sexBoundaries?: Partial<Record<"Male" | "Female", NumericBoundarySpec>>;
    }
  | {
      mode: "QualitativeAutomatic";
      expectedValues: string[];
      unexpectedOutcome: "Abnormal" | "Invalid";
    }
  | { mode: "ValidEntryOnly" }
  | { mode: "Unresolved"; reason: string };

export interface ParameterSpec {
  parameterCode: string;
  legacyParameterCodes?: string[];
  parameterName: string;
  inputType: InputControlType;
  unit?: string | null;
  defaultValue?: string | null;
  options?: string[] | null;
  referenceRule?: Record<string, unknown> | null;
  formulaBinding?: FormulaBindingSpec | null;
  suffixSpec?: SuffixSpec | null;
  isRequired: boolean;
  isSelectable: boolean;
  displayOrder: number;
  displayPrecision?: number | null;
  blankOmission?: boolean; // If true, optional blank finding is omitted from output
  conditionalChoiceSpec?: ConditionalChoiceSpec | null;
  evaluationPolicy: EvaluationPolicySpec;
}

export interface RequestedByPolicySpec {
  defaultPhysician?: string | null;
  fieldLabel?: string;
  isEditable: boolean;
  isRequired: boolean;
}

export interface AdditionalEncodingFieldSpec {
  fieldCode: string;
  label: string;
  inputType: "FreeText" | "SingleSelect";
  options?: string[] | null;
  isRequired: boolean;
  placeholder?: string;
}

export interface StatusPolicySpec {
  demographicCollection: boolean; // false for all reports (no Patient Status collected in Encoding UI)
  type: "Omitted" | "Static" | "Dynamic";
  staticLabel?: string | null;
}

export interface RepeatableFindingSpec {
  findingCategory: string;
  allowedOptions?: string[] | null;
  maxEntries?: number | null;
}

export interface UnresolvedNoteSpec {
  topic: string;
  note: string;
}

export interface ClinicalReportDefinition {
  templateCode: string;
  templateTitle: string;       // Catalog / Navigation Display Title
  reportTitle?: string | null; // Printed Report Output Title
  examinationFamily: string;
  rendererFamily: string;
  parameters: ParameterSpec[];
  requestedByPolicy: RequestedByPolicySpec;
  statusPolicy: StatusPolicySpec;
  requiresKitInfo: boolean;
  defaultKitInfo?: {
    lotNumber?: string | null;
    expirationDate?: string | null;
    isLotEditable?: boolean;
    isExpEditable?: boolean;
  } | null;
  supportsRemarks: boolean;
  defaultRemarks?: string | null;
  repeatableFindings?: RepeatableFindingSpec[] | null;
  additionalEncodingFields?: AdditionalEncodingFieldSpec[] | null;
  signatoryRequirements?: {
    requiredPathologistsCount: number;
    requiredMedtechsCount: number;
  };
  suppressAbnormalIndicators?: boolean;
  unresolvedNotes?: UnresolvedNoteSpec[];
}
