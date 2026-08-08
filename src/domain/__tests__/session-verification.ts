import { PatientReportSessionAggregate } from "../models/patient-report-session-aggregate";
import { LaboratoryReportDomain } from "../models/laboratory-report-domain";
import { AccessionNumberGenerator } from "../services/accession-number-generator";
import { calculateExpirationDate, getRemainingRetentionDays } from "../../lib/utils";
import { referenceEvaluationService } from "../../services/reference-evaluation-service";

/**
 * Phase 3 Patient Report Session Verification Script
 * Validates aggregate domain logic, state transitions, signatory validation, and retention math.
 */
export async function verifyPatientReportSessionPhase3(): Promise<{
  accessionNumberFormatValid: boolean;
  signatoryValidationHivPass: boolean;
  deselectedScrubbingPass: boolean;
  retentionMathValid: boolean;
  validationDecouplingPass: boolean;
}> {
  // 1. Verify Accession Number Generator
  const accessionNo = AccessionNumberGenerator.generate(1, "2026-08-07");
  const accessionNumberFormatValid = accessionNo === "SR-20260807-0001";

  // 2. Setup mock signatories
  const pathologist = {
    personnelId: "p-01",
    role: "Pathologist" as const,
    printedFullName: "Dr. Maria Santos",
    printedCredentials: "MD, FPSP",
    printedPrcLicenseNumber: "PRC-1234567",
    signatureImageUrl: "/signatures/dr-santos.png",
    displayOrder: 1,
  };

  const medtech1 = {
    personnelId: "mt-01",
    role: "MedicalTechnologist" as const,
    printedFullName: "Juan Dela Cruz",
    printedCredentials: "RMT",
    printedPrcLicenseNumber: "PRC-7654321",
    signatureImageUrl: "/signatures/j-delacruz.png",
    displayOrder: 2,
  };

  const medtech2 = {
    personnelId: "mt-02",
    role: "MedicalTechnologist" as const,
    printedFullName: "Ana Reyes",
    printedCredentials: "RMT",
    printedPrcLicenseNumber: "PRC-9988776",
    signatureImageUrl: "/signatures/a-reyes.png",
    displayOrder: 3,
  };

  // 3. Test HIV_RESULT report with 3 signatories (1 Pathologist + 2 MedTechs)
  const hivReport = new LaboratoryReportDomain({
    id: "rep-hiv-1",
    sessionId: "sess-01",
    templateCode: "HIV_RESULT",
    templateTitle: "HIV Result Form",
    rendererFamily: "NarrativeCertificate",
    reagentKitInfo: { kitBrand: "Abbott", lotNumber: "LOT99", expirationDate: "2027-12-31" },
    remarks: "Confidential official laboratory result.",
    results: [
      {
        id: "res-hiv-1",
        reportId: "rep-hiv-1",
        parameterCode: "HIV_SCREENING",
        parameterName: "HIV 1/2 Screening",
        resultValue: "NON-REACTIVE",
        evaluationOutcome: "Normal",
        displayOrder: 1,
        isSelected: true,
      },
    ],
    signatories: [pathologist, medtech1, medtech2],
  });

  // Test CBC report with 2 signatories (1 Pathologist + 1 MedTech) and 1 deselected result
  const cbcReport = new LaboratoryReportDomain({
    id: "rep-cbc-1",
    sessionId: "sess-01",
    templateCode: "CBC",
    templateTitle: "Complete Blood Count",
    rendererFamily: "Tabular",
    results: [
      {
        id: "res-cbc-1",
        reportId: "rep-cbc-1",
        parameterCode: "HGB",
        parameterName: "Hemoglobin",
        resultValue: "140",
        unit: "g/dL",
        evaluationOutcome: "Normal",
        displayOrder: 1,
        isSelected: true,
      },
      {
        id: "res-cbc-2",
        reportId: "rep-cbc-1",
        parameterCode: "PLT",
        parameterName: "Platelet Count",
        resultValue: "250",
        unit: "x10^9/L",
        evaluationOutcome: "Normal",
        displayOrder: 2,
        isSelected: false, // Deselected parameter!
      },
    ],
    signatories: [pathologist, medtech1],
  });

  // 4. Create Session Aggregate
  const session = new PatientReportSessionAggregate({
    id: "sess-01",
    accessionNumber: accessionNo,
    demographics: {
      fullName: "Pedro Penduko",
      age: 35,
      ageUnit: "years",
      sex: "Male",
      patientStatus: "OutPatient",
      examinationDate: "2026-08-07",
      requestingPhysician: "Dr. Jose Rizal",
    },
    reports: [hivReport, cbcReport],
  });

  // Complete session with signatory requirements lookup
  const getRequirements = (code: string) => {
    if (code === "HIV_RESULT") return { requiredPathologistsCount: 1, requiredMedtechsCount: 2 };
    return { requiredPathologistsCount: 1, requiredMedtechsCount: 1 };
  };

  session.completeSession(getRequirements);

  const signatoryValidationHivPass = session.status === "Completed" && session.completedAt !== null;

  // Verify deselected parameter scrubbing
  const cbcResultsAfterComplete = session.reports.find((r) => r.templateCode === "CBC")?.results || [];
  const deselectedScrubbingPass = cbcResultsAfterComplete.length === 1 && cbcResultsAfterComplete[0].parameterCode === "HGB";

  // Verify retention math
  const completedDate = new Date(session.completedAt!);
  const expectedExpiration = calculateExpirationDate(completedDate);
  const remainingDays = getRemainingRetentionDays(session.expiresAt!);
  const retentionMathValid = session.expiresAt === expectedExpiration.toISOString() && remainingDays >= 29 && remainingDays <= 30;

  // Verify Validation vs Clinical Interpretation Decoupling
  const rule = { evaluationType: "NumericRange" as const, minValue: 120, maxValue: 160 };
  const emptyEval = referenceEvaluationService.evaluateResult("", rule); // Expect "NoEvaluation"
  const invalidEval = referenceEvaluationService.evaluateResult("abc", rule); // Expect "Invalid" (NOT "Abnormal")
  const normalEval = referenceEvaluationService.evaluateResult("140", rule); // Expect "Normal"
  const abnormalEval = referenceEvaluationService.evaluateResult("50", rule); // Expect "Abnormal"

  const validationDecouplingPass = 
    emptyEval === "NoEvaluation" &&
    invalidEval === "Invalid" &&
    normalEval === "Normal" &&
    abnormalEval === "Abnormal";

  return {
    accessionNumberFormatValid,
    signatoryValidationHivPass,
    deselectedScrubbingPass,
    retentionMathValid,
    validationDecouplingPass,
  };
}
