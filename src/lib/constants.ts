/**
 * System-Wide Architectural Constants
 * Aligned 100% with frozen architecture specifications.
 */

export const SYSTEM_CONSTANTS = {
  APP: {
    NAME: "St. Rose Laboratory Result Management System",
    SHORT_NAME: "St. Rose Lab",
    VERSION: "2.0.0",
    LOGO_PATH: "/st-rose-logo.png",
  },
  BRANDING: {
    PRIMARY_COLOR: "#093982",
    PRIMARY_HOVER: "#1d5ea5",
    ACTIVE_NAV_BG: "#ebf3fa",
    ACTIVE_NAV_TEXT: "#093982",
    FOCUS_RING: "#093982",
  },
  RETENTION: {
    COMPLETED_REPORT_DAYS: 30,
  },
  A4_PAGE: {
    WIDTH_MM: 210,
    HEIGHT_MM: 297,
    MARGIN_MM: 15,
  },
  STORAGE_BUCKETS: {
    PERSONNEL_SIGNATURES: "personnel-signatures",
  },
  ROLES: {
    ADMIN: "Admin",
    USER: "User",
  } as const,
  USER_STATUS: {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
  } as const,
  SESSION_STATUS: {
    DRAFT: "Draft",
    COMPLETED: "Completed",
  } as const,
  PATIENT_STATUS: {
    OUTPATIENT: "OutPatient",
    INPATIENT: "InPatient",
    ER: "ER",
  } as const,
  PATIENT_SEX: {
    MALE: "Male",
    FEMALE: "Female",
  } as const,
  RENDERER_FAMILIES: {
    TABULAR: "Tabular",
    SIMPLE_RESULT: "SimpleResult",
    DIAGNOSTIC_GRID: "DiagnosticGrid",
    NARRATIVE_CERTIFICATE: "NarrativeCertificate",
  } as const,
} as const;
