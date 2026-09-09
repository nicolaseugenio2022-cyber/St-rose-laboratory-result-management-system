import { 
  UserRole, 
  UserStatus, 
  SessionStatus, 
  PersonnelRole, 
  RendererFamily, 
  ExaminationFamily,
  InputType, 
  ReferenceRuleSpec, 
  PatientDemographics, 
  ReagentKitInfo, 
  SignatorySnapshot,
  EvaluationOutcome 
} from "../types";
import type { CompletedSessionSnapshot } from "@/domain/completion/completed-snapshot";
import type { CalculationModeMap } from "@/domain/calculation-mode";

export interface IUserProfile {
  id: string; // References auth.users(id)
  username: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IPersonnel {
  id: string;
  firstName: string;
  lastName: string;
  middleInitial?: string | null;
  credentials: string; // e.g. "MD, FPSP", "RMT"
  prcLicenseNumber: string;
  role: PersonnelRole;
  signatureImageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IReportTemplate {
  id: string;
  templateCode: string;
  templateTitle: string;
  catalogTitle?: string;
  examinationFamily: ExaminationFamily;
  rendererFamily: RendererFamily;
  colorPalette: string; // Hex color code or palette descriptor
  supportsRemarks: boolean;
  defaultRemarks?: string | null;
  requiresKitInfo: boolean;
  supportedDemographics?: Record<string, unknown> | null;
  conditionalRules?: Record<string, unknown>[] | null;
  isActive: boolean;
}

export interface ITemplateParameter {
  id: string;
  templateCode: string;
  parameterCode: string;
  parameterName: string;
  inputType: InputType;
  unit?: string | null;
  defaultValue?: string | null;
  options?: string[] | null;
  referenceRule?: ReferenceRuleSpec | null;
  computedFormula?: Record<string, unknown> | null;
  isRequired: boolean;
  isSelectable: boolean;
  displayOrder: number;
}

export interface ITemplateSignatoryRequirement {
  id: string;
  templateCode: string;
  requiredPathologistsCount: number;
  requiredMedtechsCount: number;
}

export interface ILaboratoryResult {
  id: string;
  reportId: string;
  parameterCode: string;
  parameterName: string;
  resultValue: string;
  rawResultValue?: string | null;
  formattedResultValue?: string | null;
  unit?: string | null;
  evaluationOutcome: EvaluationOutcome;
  referenceRuleSnapshot?: ReferenceRuleSpec | null;
  computationMetadata?: Record<string, unknown> | null;
  displayOrder: number;
}

export function getResultDisplayValue(result: ILaboratoryResult): string {
  return result.formattedResultValue || result.resultValue || "";
}

export interface IRepeatableFindingValue {
  id: string;
  category: string;
  value: string;
  displayOrder: number;
}

export interface IReportEncodingData {
  requestedBy?: string;
  additionalFields?: Record<string, string>;
  repeatableFindings?: Record<string, IRepeatableFindingValue[]>;
  /**
   * Operator intent per formula-bound parameter. Absent map or absent key means Auto, so legacy
   * reports need no migration. This lives in encodingData rather than on the result because
   * reevaluation replaces a computed result's computationMetadata wholesale.
   */
  calculationModes?: CalculationModeMap;
}

export interface ILaboratoryReport {
  id: string;
  sessionId: string;
  templateCode: string;
  templateTitle: string;
  rendererFamily: RendererFamily;
  reagentKitInfo?: ReagentKitInfo | null;
  remarks?: string | null;
  encodingData?: IReportEncodingData;
  results: ILaboratoryResult[];
  signatories: SignatorySnapshot[];
}

export interface IPatientReportSession {
  id: string;
  accessionNumber: string | null;
  status: SessionStatus;
  demographics: PatientDemographics;
  reports: ILaboratoryReport[];
  createdAt: string;
  completedAt?: string | null;
  expiresAt?: string | null; // NULL for draft, completed_at + 30 days for completed
  completedSnapshot?: CompletedSessionSnapshot | null;
}

export interface IAutoSuggestion {
  id: string;
  category: "physician" | "referrer" | "company";
  suggestionText: string;
  usageCount: number;
  lastUsedAt: string;
}

/**
 * A requesting physician in the managed directory that backs the report "Requested By" field.
 *
 * Deliberately NOT a `personnel` role. `IPersonnel` models a PRC-licensed signatory of this
 * laboratory and requires credentials, a licence number and a signature reference; a requesting
 * physician has none of those here. The only thing the report needs is the name exactly as it
 * must print, so that is the only substantive field this record carries.
 */
export interface IPhysician {
  id: string;
  /** The full display name exactly as it prints on a report, e.g. "Dr. Ralph Roland Asperas". */
  fullName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * One physician's association with one examination template.
 *
 * Normalized deliberately - one row per (physician, template) pair rather than an array column on
 * either side. The pairing is what the database can constrain: the pair is unique, and a partial
 * unique index admits at most one `isDefault` row per template. Neither guarantee is expressible
 * against a JSON array, and both are guarantees the encoding screen relies on when it offers a
 * single pre-selected physician for the examination being encoded.
 *
 * `isDefault` is a property of the PAIR, not of the physician: the same physician may be the
 * default for one examination and merely an option for another.
 */
export interface IPhysicianExaminationAssignment {
  physicianId: string;
  /** References `report_templates.template_code`, e.g. "FECALYSIS". */
  templateCode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
