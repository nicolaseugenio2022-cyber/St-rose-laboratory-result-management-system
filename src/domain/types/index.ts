/**
 * Core Domain Value Types & Enums
 * Aligned 100% with DOMAIN_MODEL.md, DATABASE_DESIGN.md, and REPORT_REGISTRY_ARCHITECTURE.md
 */

export type UserRole = "Admin" | "Developer" | "User";

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

export type EvaluationOutcome =
  | "Low"
  | "Normal"
  | "High"
  | "Entered"
  | "Abnormal"
  | "Informational"
  | "NoEvaluation"
  | "Invalid";

export interface PatientDemographics {
  fullName: string;
  /**
   * The patient's date of birth, YYYY-MM-DD. Optional, and it must stay optional: every session
   * recorded before this field existed has none, and those records are read exactly as they were
   * written rather than migrated.
   *
   * Where it is present it is the authority on age - `age` and `ageUnit` below are then a derived
   * copy kept for the session list, which projects a fixed set of columns. Where it is absent the
   * stored pair is all there is, and it is used unchanged. `resolvePatientAge` in
   * `@/domain/patient-age` owns that decision; nothing else may re-derive it.
   */
  dateOfBirth?: string;
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
