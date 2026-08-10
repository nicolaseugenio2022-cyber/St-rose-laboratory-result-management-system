import type { CertificateStaticContentSpec } from "@/domain/types/report-definition";

/**
 * Versioned static wording transcribed from the approved HIV report reference.
 * The PNG is provenance evidence only; renderers consume this declarative data.
 */
export const HIV_CERTIFICATE_STATIC_CONTENT_VERSION = "hiv-certificate-v1";

export const HIV_CERTIFICATE_STATIC_CONTENT: CertificateStaticContentSpec = {
  kind: "Certificate",
  heading: "AIDS FREE CERTIFICATE",
  salutation: "TO WHOM IT MAY CONCERN:",
  narrativeParagraphs: [
    {
      id: "certification",
      segments: [
        { kind: "Text", text: "This is to certify that " },
        { kind: "PatientName" },
        { kind: "Text", text: " of " },
        { kind: "PatientAddress" },
        { kind: "Text", text: " was examined for Acquired Immune Deficiency Syndrome (AIDS) based on laboratory test for HIV-1/2." },
      ],
    },
    {
      id: "result-statement",
      segments: [
        { kind: "Text", text: "Said applicant / employee is found to be [ " },
        { kind: "ResultMark", resultValue: "Nonreactive" },
        { kind: "Text", text: " ] Non-reactive or Negative; [ " },
        { kind: "ResultMark", resultValue: "Reactive" },
        { kind: "Text", text: " ] Reactive or Positive at the time of examination." },
      ],
    },
  ],
  sectionTitle: "SEROLOGY (HIV)",
  fieldLabels: {
    orderDate: "Order Date:",
    orderTime: "Order Time:",
    patientName: "Name:",
    age: "Age:",
    sex: "Sex:",
    referringDoctor: "Referring Doctor:",
    company: "Company:",
  },
  resultTable: {
    testHeader: "TEST",
    resultHeader: "RESULT",
    testLabel: "Anti HIV-1/2 (Screening)",
  },
  kitLabels: {
    lotNumber: "LOT NO:",
    expirationDate: "EXP:",
  },
  signatoryLabels: {
    performedBy: "PERFORMED BY:",
    verifiedBy: "VERIFIED BY:",
    licenseNumber: "License no.",
    medicalTechnologist: "Medical Technologist",
    pathologist: "Pathologist",
  },
};
