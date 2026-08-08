/**
 * Core Domain Value Types & Enums
 * Aligned 100% with DOMAIN_MODEL.md, DATABASE_DESIGN.md, and REPORT_REGISTRY_ARCHITECTURE.md
 */

export type UserRole = "Admin" | "User";

export type UserStatus = "Active" | "Inactive";

export type SessionStatus = "Draft" | "Completed";

export type PatientStatus = "OutPatient" | "InPatient" | "ER";

export type PatientSex = "Male" | "Female";

export type PersonnelRole = "Pathologist" | "MedicalTechnologist";

export type RendererFamily = "Tabular" | "SimpleResult" | "DiagnosticGrid" | "NarrativeCertificate";

export type ExaminationFamily = 
  | "Hematology" 
  | "Clinical Chemistry" 
  | "Clinical Microscopy" 
  | "Serology & Immunology"
  | "Blood Bank";

export type InputType = 
  | "NumericText" 
  | "FreeText" 
  | "SingleSelect" 
  | "MultiSelect" 
  | "Combobox" 
  | "Computed";

export type EvaluationStrategy = 
  | "NumericRange" 
  | "LessThan" 
  | "GreaterThan" 
  | "ExpectedValue" 
  | "AllowedValues" 
  | "Informational" 
  | "NoEvaluation";

export type EvaluationOutcome = "Normal" | "Abnormal" | "Informational" | "NoEvaluation" | "Invalid";

export interface PatientDemographics {
  fullName: string;
  age: number;
  ageUnit: "years" | "months" | "days";
  sex: PatientSex;
  address?: string;
  patientStatus: PatientStatus;
  examinationDate: string; // YYYY-MM-DD
  requestingPhysician: string;
  referrerName?: string;
  companyName?: string;
}

export interface ReagentKitInfo {
  kitBrand: string;
  lotNumber: string;
  expirationDate: string; // YYYY-MM-DD
}

export interface SignatorySnapshot {
  personnelId: string;
  role: PersonnelRole;
  printedFullName: string;
  printedCredentials: string;
  printedPrcLicenseNumber: string;
  signatureImageUrl?: string | null;
  displayOrder: number;
}

export interface ReferenceRuleSpec {
  evaluationType: EvaluationStrategy;
  minValue?: number | null;
  maxValue?: number | null;
  expectedValue?: string | null;
  allowedValues?: string[] | null;
}
