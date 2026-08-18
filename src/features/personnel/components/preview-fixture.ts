// ============================================================================
// TEMPORARY — DELETE IN P2.
//
// The Personnel Directory read boundary is intentionally deferred to P2. These
// two rows exist only so the P1 UI shell (table, role labels, status badges,
// row controls) can be reviewed before any data source exists.
//
// They are read-only, never written anywhere, and never reach Supabase. The
// page renders them behind an explicit "preview data" notice so they are never
// mistaken for database records.
//
// P2 removes this file and drops the `isPreviewData` prop from the page.
// ============================================================================

import type { IPersonnel } from "@/domain/models/interfaces";

export const PERSONNEL_PREVIEW_FIXTURE: readonly IPersonnel[] = [
  {
    id: "preview-pathologist",
    firstName: "Maria",
    lastName: "Santos",
    middleInitial: "L",
    credentials: "MD, FPSP",
    prcLicenseNumber: "0012345",
    role: "Pathologist",
    signatureImageUrl: null,
    isActive: true,
    createdAt: "2026-01-05T00:00:00.000Z",
    updatedAt: "2026-01-05T00:00:00.000Z",
  },
  {
    id: "preview-medtech",
    firstName: "Juan",
    lastName: "Dela Cruz",
    middleInitial: null,
    credentials: "RMT",
    prcLicenseNumber: "0067890",
    role: "MedicalTechnologist",
    signatureImageUrl: null,
    isActive: false,
    createdAt: "2026-01-05T00:00:00.000Z",
    updatedAt: "2026-01-05T00:00:00.000Z",
  },
] as const;
