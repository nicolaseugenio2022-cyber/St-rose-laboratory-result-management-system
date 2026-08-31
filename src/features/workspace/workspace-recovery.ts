/**
 * Tab-scoped accidental-refresh recovery for an unsaved, brand-new workspace session.
 *
 * Tab-scoped sessionStorage only, never the persistent per-origin store: a shared
 * laboratory workstation would otherwise retain patient data on disk after the user
 * leaves. The verifier bans that other API by name. Recovery is deliberately limited to
 * a session that has never been persisted — a payload carrying an accession number or a
 * non-Draft status is discarded rather than restored, so recovery can never resurrect a
 * persisted record and never participates in accession assignment.
 */
import type { PatientReportSessionTransport } from "@/features/server-boundary/session-transport";

const RECOVERY_KEY = "strose.workspace.recovery.v1";
const RECOVERY_VERSION = 1;
const RECOVERY_TTL_MS = 30 * 60 * 1000;

export interface WorkspaceRecoveryPayload {
  v: number;
  savedAt: string;
  session: PatientReportSessionTransport;
  selectedTemplateCodes: string[];
  activeTemplateCode: string | null;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function clearWorkspaceRecovery(): void {
  try {
    storage()?.removeItem(RECOVERY_KEY);
  } catch {
    // A storage failure must never block the workspace action that triggered the clear.
  }
}

/**
 * Strip any signature reference from the signatories about to be written to storage.
 *
 * Belt and braces. The Workspace no longer composes a reference into its signatories at all, so
 * in practice there is nothing here to remove - but this function is the last thing that runs
 * before clinical data lands in `sessionStorage` on a shared laboratory workstation, and it is
 * the one place a future regression upstream would become durable rather than transient. It costs
 * one map and removes an entire class of "how did that get on disk" question.
 *
 * Returns a new object; the caller's live session is never mutated.
 */
function withoutSignatureReferences(
  session: PatientReportSessionTransport
): PatientReportSessionTransport {
  return {
    ...session,
    reports: session.reports.map((report) => ({
      ...report,
      signatories: report.signatories.map(({ ...signatory }) => {
        delete (signatory as { signatureImageUrl?: unknown }).signatureImageUrl;
        return signatory;
      }),
    })),
  };
}

export function saveWorkspaceRecovery(
  payload: Omit<WorkspaceRecoveryPayload, "v" | "savedAt">
): void {
  // Never record a persisted session: only a brand-new unsaved one is recoverable.
  if (payload.session.accessionNumber !== null) return;
  if (payload.session.status !== "Draft") return;

  try {
    storage()?.setItem(
      RECOVERY_KEY,
      JSON.stringify({
        v: RECOVERY_VERSION,
        savedAt: new Date().toISOString(),
        ...payload,
        session: withoutSignatureReferences(payload.session),
      } satisfies WorkspaceRecoveryPayload)
    );
  } catch {
    // Quota or serialization failure degrades to no recovery, never to a broken workspace.
  }
}

/**
 * Returns the stored payload only for an accidental refresh of an unsaved fresh workspace.
 * Any other outcome deletes the payload, so stale clinical data does not linger.
 */
export function loadWorkspaceRecovery(): WorkspaceRecoveryPayload | null {
  const store = storage();
  if (!store) return null;

  let raw: string | null = null;
  try {
    raw = store.getItem(RECOVERY_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  if (!isAccidentalRefresh()) {
    clearWorkspaceRecovery();
    return null;
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearWorkspaceRecovery();
    return null;
  }

  const payload = parsed as WorkspaceRecoveryPayload | null;
  const isValid =
    Boolean(payload) &&
    payload!.v === RECOVERY_VERSION &&
    typeof payload!.savedAt === "string" &&
    Boolean(payload!.session) &&
    payload!.session.accessionNumber === null &&
    payload!.session.status === "Draft" &&
    Array.isArray(payload!.selectedTemplateCodes) &&
    Array.isArray(payload!.session.reports) &&
    Date.now() - new Date(payload!.savedAt).getTime() <= RECOVERY_TTL_MS;

  if (!isValid) {
    clearWorkspaceRecovery();
    return null;
  }

  return payload;
}

/**
 * True only for a reload. A deliberate navigation to the workspace — the New Session link —
 * reports "navigate" and must start clean. An unavailable Navigation Timing entry fails
 * closed: no restore.
 */
function isAccidentalRefresh(): boolean {
  try {
    const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    return entry?.type === "reload";
  } catch {
    return false;
  }
}
