import type { CompletedSessionSnapshot } from "@/domain/completion/completed-snapshot";
import type { IRepeatableFindingValue } from "@/domain/models/interfaces";
import type { EvaluationOutcome, PatientSex, ReagentKitInfo } from "@/domain/types";
import type { CertificateStaticContentSpec, CertificateStaticSegmentSpec } from "@/domain/types/report-definition";

export const CANONICAL_REPORT_LOGO_SOURCE = "/st-rose-logo-official.png" as const;

export type ResolvedRenderOrigin = "Draft" | "Completed";
export type ResolvedLayoutFamily =
  | "StandardAdaptiveTabular"
  | "CompactResultGrid"
  | "MicroscopyTwoColumn"
  | "Certificate";
export type ResolvedOmissionState = "Render" | "Omit";

export interface ResolvedDemographicsRenderModel {
  fullName: string;
  age: number | null;
  ageUnit: "years" | "months" | "days";
  ageDisplay: string;
  sex: PatientSex | "";
  address: string;
  examinationDate: string;
  examinationDateDisplay: string;
  referrerName: string;
  companyName: string;
}

export interface ResolvedResultRenderModel {
  parameterCode: string;
  label: string;
  rawValue: string | null;
  formattedValue: string;
  referenceDisplay: string | null;
  unit: string | null;
  unitDisplay: string | null;
  suffix: string | null;
  evaluationOutcome: EvaluationOutcome;
  computationMetadata: Record<string, unknown> | null;
  displayOrder: number;
  omission: ResolvedOmissionState;
  conditionalLabel: string | null;
}

export interface ResolvedRequestedByRenderModel {
  label: string;
  value: string;
  isRequired: boolean;
}

export interface ResolvedStatusRenderModel {
  type: "Omitted" | "Static" | "Dynamic";
  staticLabel: string | null;
  value: string;
}

export interface ResolvedSignatureAsset {
  source: string;
  failurePolicy: "OmitImage";
}

export interface ResolvedSignatorySlot {
  slotId: string;
  personnelRole: "Pathologist" | "MedicalTechnologist";
  semanticRole: "Pathologist" | "MedicalTechnologist" | "Examiner" | "Verifier";
  displayOrder: number;
  personnelId: string;
  printedFullName: string;
  printedCredentials: string;
  printedNameWithCredentials: string;
  printedPrcLicenseNumber: string;
  licenseDisplay: string;
  signatureAsset: ResolvedSignatureAsset | null;
}

export interface ResolvedResultSection {
  id: string;
  label: string;
  beforeParameterCode: string;
}

export interface ResolvedCertificateStaticSegment {
  sourceKind: CertificateStaticSegmentSpec["kind"];
  text: string;
  resultValue?: string;
}

export type ResolvedCertificateStaticContent = Omit<CertificateStaticContentSpec, "narrativeParagraphs"> & {
  narrativeParagraphs: Array<{
    id: string;
    segments: ResolvedCertificateStaticSegment[];
  }>;
};

export interface ResolvedReportRenderModel {
  templateCode: string;
  templateTitle: string;
  layoutFamily: ResolvedLayoutFamily;
  renderContractVersion: number;
  printedTitle: string | null;
  staticContentVersion: string;
  staticContent: ResolvedCertificateStaticContent | null;
  resultSections: ResolvedResultSection[];
  ageDisplay: string;
  requestedBy: ResolvedRequestedByRenderModel;
  status: ResolvedStatusRenderModel;
  additionalFields: Record<string, string>;
  results: ResolvedResultRenderModel[];
  remarks: string;
  reagentKitInfo: ReagentKitInfo | null;
  repeatableFindings: Record<string, IRepeatableFindingValue[]>;
  signatories: ResolvedSignatorySlot[];
  suppressAbnormalIndicators: boolean;
}

export interface ResolvedSessionRenderModel {
  origin: ResolvedRenderOrigin;
  accessionNumber: string;
  completedAt: string | null;
  snapshotVersion: CompletedSessionSnapshot["snapshotVersion"] | null;
  logoSource: typeof CANONICAL_REPORT_LOGO_SOURCE;
  demographics: ResolvedDemographicsRenderModel;
  reports: ResolvedReportRenderModel[];
}
