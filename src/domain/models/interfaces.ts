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
  unit?: string | null;
  evaluationOutcome: EvaluationOutcome;
  referenceRuleSnapshot?: ReferenceRuleSpec | null;
  displayOrder: number;
}

export interface ILaboratoryReport {
  id: string;
  sessionId: string;
  templateCode: string;
  templateTitle: string;
  rendererFamily: RendererFamily;
  reagentKitInfo?: ReagentKitInfo | null;
  remarks?: string | null;
  results: ILaboratoryResult[];
  signatories: SignatorySnapshot[];
}

export interface IPatientReportSession {
  id: string;
  accessionNumber: string;
  status: SessionStatus;
  demographics: PatientDemographics;
  reports: ILaboratoryReport[];
  createdAt: string;
  completedAt?: string | null;
  expiresAt?: string | null; // NULL for draft, completed_at + 30 days for completed
}

export interface IAutoSuggestion {
  id: string;
  category: "physician" | "referrer" | "company";
  suggestionText: string;
  usageCount: number;
  lastUsedAt: string;
}
