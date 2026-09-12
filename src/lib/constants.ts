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
    /**
     * How long a COMPLETED session is retained, in days, measured from its ORIGINAL completion.
     *
     * The client reduced this from 30 days to 7. It is the single behavioural definition of the
     * window: nothing in SQL computes an expiry - `expires_at` is always supplied by the
     * application - and no second copy of the number decides anything. Every sentence that states
     * the duration reads it from here, so wording cannot drift from behaviour again.
     *
     * The ANCHOR is unchanged and stays completion time. Replacement never re-stamps `completed_at`
     * or `expires_at`, so a replaced report keeps the window it was issued with.
     */
    COMPLETED_REPORT_DAYS: 7,
    /**
     * How close to expiry a retained completed session has to be before it is called
     * "expiring soon", in days.
     *
     * It has to be smaller than the window, or the label is true of every retained record and
     * therefore tells the operator nothing. At 30 days a 7-day warning distinguished the last
     * quarter of the window; at a 7-day window it covered all of it, which is what this value
     * corrects. Two days leaves a usable middle: expiring today or tomorrow is urgent, the day
     * after is a warning, and everything else is simply retained.
     *
     * Declared here, once, next to the window, because the dashboard count, the dashboard row
     * marker and the History retention chip all have to agree about it.
     */
    EXPIRING_SOON_DAYS: 2,
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
