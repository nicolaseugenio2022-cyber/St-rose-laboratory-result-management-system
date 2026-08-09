/**
 * System-Wide Architectural Constants
 * Aligned 100% with frozen architecture specifications.
 */

export const SYSTEM_CONSTANTS = {
  APP: {
    NAME: "St. Rose Laboratory Result Management System",
    SHORT_NAME: "St. Rose Lab",
    VERSION: "2.0.0",
    LOGO_PATH: "/st-rose-logo-official.png",
  },
  BRANDING: {
    PRIMARY_COLOR: "#0B6384",
    PRIMARY_HOVER: "#084D68",
    TINT_COLOR: "#E8F3F6",
    DECORATIVE_PINK: "#F8A8B8",
    ACCESSIBLE_ROSE: "#8E3F58",
    TEXT_COLOR: "#0F172A",
    MUTED_COLOR: "#475569",
    WHITE_COLOR: "#FFFFFF",
    ACTIVE_NAV_BG: "#E8F3F6",
    ACTIVE_NAV_TEXT: "#0B6384",
    FOCUS_RING: "#0B6384",
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
