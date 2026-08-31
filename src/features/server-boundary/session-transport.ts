import type { IPatientReportSession, ILaboratoryReport } from "@/domain/models/interfaces";
import type { CompletedReportSnapshot, CompletedSessionSnapshot } from "@/domain/completion/completed-snapshot";
import type { SignatorySnapshot } from "@/domain/types";
import { LaboratoryReportDomain } from "@/domain/models/laboratory-report-domain";
import { PatientReportSessionAggregate } from "@/domain/models/patient-report-session-aggregate";

/**
 * The session as the browser is allowed to see it.
 *
 * This type used to be a bare alias for `IPatientReportSession`, and `toSessionTransport` a blind
 * `JSON.parse(JSON.stringify(session))`. That shipped **every** enumerable field, including each
 * signatory's `signatureImageUrl` - which is `/api/signatures/proxy?path=<storage object path>` -
 * on both the live `reports[]` rows and inside the frozen `completedSnapshot`. Narrowing the
 * personnel directory (UX-10M6S3) and the draft render channel (UX-10M6S3-R1) closed the two
 * places the Workspace *composed* a reference, but left this one, where it simply *received* one:
 * every save, completion, replacement and reopen handed the storage path straight back.
 *
 * So the transport is now a real projection rather than an alias. Signatories cross as
 * `ClientSignatory`, which cannot express a storage path at all.
 */

/**
 * A signatory, as the browser sees one.
 *
 * `signatureImageUrl` is absent - not renamed. What replaces it is an **opaque authenticated
 * address**: a URL built from identifiers the client already legitimately holds, which the server
 * resolves back to an object path. Holding it lets the browser paint a signature; it does not tell
 * the browser where the object lives, and it is never accepted back as authority (the mutation
 * schema in `action-inputs.ts` strips unknown keys, and `signatory-resolution.ts` re-reads the
 * reference server-side before anything is persisted).
 */
export interface ClientSignatory {
  personnelId: string;
  role: SignatorySnapshot["role"];
  printedFullName: string;
  printedCredentials: string;
  printedPrcLicenseNumber: string;
  displayOrder: number;
  /** Opaque, server-resolved, render-only. Never a storage path. */
  signatureAddress?: string | null;
}

type ClientReport = Omit<ILaboratoryReport, "signatories"> & { signatories: ClientSignatory[] };

type ClientCompletedReport = Omit<CompletedReportSnapshot, "signatories"> & {
  signatories: ClientSignatory[];
};

type ClientCompletedSnapshot = Omit<CompletedSessionSnapshot, "reports"> & {
  reports: ClientCompletedReport[];
};

export type PatientReportSessionTransport = Omit<
  IPatientReportSession,
  "reports" | "completedSnapshot"
> & {
  reports: ClientReport[];
  completedSnapshot?: ClientCompletedSnapshot | null;
};

/**
 * The frozen address for one completed report's signatory.
 *
 * `reportId` identifies the `report_signatories` row written at completion; `personnelId` picks
 * the signatory within it. The server reads that row - never current personnel - so a Pathologist
 * replacing their signature today cannot change what an already-issued report renders.
 *
 * Both identifiers are non-sensitive: the client already holds them, and neither reveals where
 * the object is stored.
 */
function frozenSignatureAddress(reportId: string, personnelId: string): string {
  return `/api/signatures/proxy?reportId=${encodeURIComponent(reportId)}&personnelId=${encodeURIComponent(personnelId)}`;
}

/**
 * Project one signatory, optionally stamping a frozen address.
 *
 * Field by field, never a spread: a spread would carry `signatureImageUrl` straight through, and
 * would carry whatever field is added to `SignatorySnapshot` next.
 */
function toClientSignatory(
  signatory: SignatorySnapshot,
  reportId: string | null
): ClientSignatory {
  const entry: ClientSignatory = {
    personnelId: signatory.personnelId,
    role: signatory.role,
    printedFullName: signatory.printedFullName,
    printedCredentials: signatory.printedCredentials,
    printedPrcLicenseNumber: signatory.printedPrcLicenseNumber,
    displayOrder: signatory.displayOrder,
  };
  // Only a COMPLETED session's signatory gets an address, and only when one was actually frozen.
  // A draft gets none even if a legacy row still carries a stored reference: a draft is authored
  // against personnel as they are right now, so the Workspace derives its own `?personnelId=`
  // address for it. Gating on the caller-supplied reportId alone was not enough - draft reports
  // have ids too, so a pre-M6S2 draft row would have been stamped with a frozen address that
  // misrepresents it as historical.
  if (reportId && signatory.signatureImageUrl) {
    entry.signatureAddress = frozenSignatureAddress(reportId, signatory.personnelId);
  }
  return entry;
}

/**
 * Serialize a session for the browser.
 *
 * The live `reports[]` rows and the frozen `completedSnapshot` are projected separately because
 * only the live rows carry an `id`. A completed snapshot report identifies itself by
 * `templateCode`, so it is paired back to its live row by that code to obtain the `reportId` its
 * address needs - the same pairing the renderer already relies on to match a snapshot report to
 * its definition.
 */
export function toSessionTransport(
  session: IPatientReportSession
): PatientReportSessionTransport {
  const reportIdByTemplate = new Map<string, string>();
  for (const report of session.reports) {
    reportIdByTemplate.set(report.templateCode, report.id);
  }

  // Frozen addresses belong to completed work only. `completedSnapshot` is the authority on that,
  // with `status` as the fallback for a pre-snapshot completed record.
  const isCompleted = Boolean(session.completedSnapshot) || session.status === "Completed";

  const reports: ClientReport[] = session.reports.map((report) => ({
    ...(JSON.parse(JSON.stringify({ ...report, signatories: [] })) as ClientReport),
    signatories: report.signatories.map((signatory) =>
      toClientSignatory(signatory, isCompleted ? report.id : null)
    ),
  }));

  const snapshot = session.completedSnapshot;
  const completedSnapshot: ClientCompletedSnapshot | null = snapshot
    ? {
        ...(JSON.parse(JSON.stringify({ ...snapshot, reports: [] })) as ClientCompletedSnapshot),
        reports: snapshot.reports.map((report) => ({
          ...(JSON.parse(
            JSON.stringify({ ...report, signatories: [] })
          ) as ClientCompletedReport),
          signatories: report.signatories.map((signatory) =>
            toClientSignatory(signatory, reportIdByTemplate.get(report.templateCode) ?? null)
          ),
        })),
      }
    : null;

  const { reports: _liveReports, completedSnapshot: _snapshot, ...scalars } = session;
  return {
    ...(JSON.parse(JSON.stringify(scalars)) as Omit<
      IPatientReportSession,
      "reports" | "completedSnapshot"
    >),
    reports,
    completedSnapshot,
  };
}

/**
 * Rebuild the aggregate from a transport.
 *
 * `signatureAddress` rides along harmlessly: it is render-only, the mutation schema strips it on
 * the way back in, and `signatory-resolution.ts` overwrites the persisted reference from the
 * authoritative personnel record before anything is written. What the aggregate does NOT get is a
 * `signatureImageUrl` from the client, because the transport cannot carry one.
 */
export function fromSessionTransport(
  session: PatientReportSessionTransport
): PatientReportSessionAggregate {
  return new PatientReportSessionAggregate({
    ...session,
    reports: session.reports.map((report) => new LaboratoryReportDomain({
      ...report,
      results: report.results,
      signatories: report.signatories,
    })),
  });
}
