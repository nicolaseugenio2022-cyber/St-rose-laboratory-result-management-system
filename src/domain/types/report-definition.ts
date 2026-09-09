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
  /**
   * Opt-in. Only a binding that sets this may be switched to Manual operator entry, so adding a
   * formula binding never makes a parameter editable on its own.
   */
  supportsManualEntry?: boolean;
  /**
   * Formula-bound parameters whose ACTIVE value this formula consumes when they are in Manual
   * mode. While such a parameter is Auto it is omitted entirely and the formula derives the value
   * itself, which is what keeps the exact unrounded intermediate rather than a display value.
   */
  activeDependencies?: string[];
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

/**
 * Declarative presentation of a RESULT value. Presentation only: it never changes what is entered,
 * validated, evaluated or persisted, and a completed snapshot keeps the exact bytes it froze.
 *
 * `casing` is baked into the string at the render-model boundary rather than applied as a render
 * style, for two reasons. Uppercase text is wider than mixed case, so the value has to reach text
 * measurement in its final form or wrapping is computed against a narrower string than the one that
 * is painted. And the native `uppercase` style flag is honoured only by the preview DOM, so using
 * it would silently diverge the exported PDF from Live Preview.
 *
 * `emphasis` cannot be baked into a string, so it travels to the renderers as a style flag and is
 * resolved by each of them - CSS `font-style` in the preview, a jsPDF font-style name in the PDF.
 */
export interface ResultPresentationSpec {
  casing?: "Uppercase";
  emphasis?: "Italic";
  /**
   * The render-contract version this presentation was introduced at. It is REQUIRED, so a
   * presentation can never be added without stating when it takes effect.
   *
   * A completed report renders at the contract version frozen into its snapshot, so a report issued
   * before this version keeps the exact output it was issued with. Drafts and newly completed
   * reports render at the definition's current version and receive the new presentation.
   */
  sinceRenderContractVersion: number;
}

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
  /** Presentation of the result value only - never its entry, validation, evaluation or storage. */
  resultPresentation?: ResultPresentationSpec | null;
  evaluationPolicy: EvaluationPolicySpec;
}

export interface RequestedByPolicySpec {
  defaultPhysician?: string | null;
  fieldLabel?: string;
  isEditable: boolean;
  isRequired: boolean;
  /**
   * Physicians this examination may be requested by, when it is restricted to a subset of the
   * laboratory's directory.
   *
   * Absent means unrestricted, which is every examination but one: the control offers the whole
   * managed directory. Present means the offered list is narrowed to exactly these names for THIS
   * report, without removing anyone from the directory that other examinations still draw on.
   *
   * A suggestion restriction only. The field stays free text and stays optional, so this never
   * validates, rewrites or blocks what an operator types - it decides what is offered.
   */
  allowedPhysicians?: string[];
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

export type CertificateStaticSegmentSpec =
  | { kind: "Text"; text: string }
  | { kind: "PatientName" }
  | { kind: "PatientAddress" }
  | { kind: "ResultMark"; resultValue: string };

export interface CertificateStaticParagraphSpec {
  id: string;
  segments: CertificateStaticSegmentSpec[];
}

export interface CertificateStaticContentSpec {
  kind: "Certificate";
  heading: string;
  salutation: string;
  narrativeParagraphs: CertificateStaticParagraphSpec[];
  sectionTitle: string;
  fieldLabels: {
    orderDate: string;
    orderTime: string;
    patientName: string;
    age: string;
    sex: string;
    referringDoctor: string;
    company: string;
  };
  resultTable: {
    testHeader: string;
    resultHeader: string;
    testLabel: string;
  };
  kitLabels: {
    lotNumber: string;
    expirationDate: string;
  };
  signatoryLabels: {
    performedBy: string;
    verifiedBy: string;
    licenseNumber: string;
    medicalTechnologist: string;
    pathologist: string;
  };
}

export interface DeclarativeRenderContractSpec {
  renderContractVersion: number;
  /**
   * Earlier render-contract versions this definition can still render faithfully. A completed
   * snapshot frozen at one of these versions is rendered with the presentation of that version
   * rather than rejected. Any frozen version that is neither current nor listed here is still a
   * hard error - superseding a contract is a declaration, never an inference.
   */
  supersededRenderContractVersions?: number[];
  staticContentVersion: string;
  sourceReference?: string;
  staticContent?: CertificateStaticContentSpec;
  demographics?: {
    ageDisplay?: "NumberOnly" | "NumberWithUnit";
    layoutVariant?: "Standard" | "CBC";
    /**
     * When set, `ageDisplay` applies only from this render-contract version onward, and a report
     * frozen at an earlier version keeps `supersededAgeDisplay` instead. This is how the printed
     * age presentation is corrected without restating what an already-issued report said.
     */
    sinceRenderContractVersion?: number;
    /** The presentation a report frozen BEFORE `sinceRenderContractVersion` keeps. */
    supersededAgeDisplay?: "NumberOnly" | "NumberWithUnit";
  };
  standardComposition?: {
    // Two or three columns. A two-entry declaration is a report that carries no reference track at
    // all: the column is absent from the header row and no reference cell is composed for any row,
    // rather than a third column being rendered empty.
    resultHeaders?: [string, string, string] | [string, string];
    columnRatios?: [number, number, number] | [number, number];
    uppercaseParameterLabels?: boolean;
    /**
     * When set, this composition applies only from that render-contract version onward. A report
     * rendering at an earlier version falls back to its layout family's defaults, which is what
     * preserves the output of reports completed before the layout changed.
     */
    sinceRenderContractVersion?: number;
  };
  specializedComposition?:
    | {
        kind: "Certificate";
      }
    | {
        kind: "MicroscopyTwoColumn";
        sections: Array<{
          id: string;
          label: string;
          parameterCodes: string[];
        }>;
        conditionalParameterCodes: string[];
        repeatableFindingCategories: string[];
      };
  resultSections?: Array<{
    id: string;
    label: string;
    beforeParameterCode: string;
  }>;
  signatorySlots?: Array<{
    slotId: string;
    personnelRole: "Pathologist" | "MedicalTechnologist";
    semanticRole: "Pathologist" | "MedicalTechnologist" | "Examiner" | "Verifier";
    displayOrder: number;
  }>;
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
  renderContract?: DeclarativeRenderContractSpec;
}
