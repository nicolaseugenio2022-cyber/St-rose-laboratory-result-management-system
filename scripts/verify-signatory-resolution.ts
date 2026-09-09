/**
 * UX-10M6S2 — server-side signature resolution for completion and replacement.
 *
 * The invariant under test: a `signatureImageUrl` supplied by the browser must never reach
 * either persisted record. Before this slice it reached both — `report-completion-service.ts`
 * copies `report.signatories` straight into `completedSnapshot`, and
 * `supabase-session-repository.ts` copies `sig.signatureImageUrl` straight into the RPC
 * payload, and nothing in that chain re-reads personnel.
 *
 * Two sentinels are used throughout so "the client value is gone" and "the server value
 * arrived" are separately provable. An assertion that only checked for the server value would
 * pass a resolver that appended rather than replaced.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import { PatientReportSessionAggregate } from "../src/domain/models/patient-report-session-aggregate";
import { LaboratoryReportDomain } from "../src/domain/models/laboratory-report-domain";
import { buildEncodingReport, applyEncodingResultValue } from "../src/app/(dashboard)/workspace/_lib/encoding/report-encoding";
import type { ClinicalReportDefinition, ParameterSpec } from "../src/domain/types/report-definition";
import type { PatientDemographics, RendererFamily, SignatorySnapshot } from "../src/domain/types";
import type { IPersonnel } from "../src/domain/models/interfaces";
import { ValidationError } from "../src/lib/errors";
import {
  applyResolvedSignatories,
  resolveSignatoriesForPersistence,
  type PersonnelLookup,
} from "../src/features/server-boundary/signatory-resolution";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Signatory resolution verification failed: ${message}`);
  process.stdout.write(`✓ ${message}\n`);
}

/* ------------------------------------------------------------------ sentinels */

const CLIENT_SENTINEL: string = "/api/signatures/proxy?path=CLIENT-SUPPLIED-FORGERY.png";
const SERVER_SENTINEL: string = "/api/signatures/proxy?path=SERVER-AUTHORITATIVE.png";
/**
 * A third sentinel, distinct from both. Medical Technologists may now hold a signature image,
 * so "the MedTech reference came from the MedTech's own authoritative record" has to be
 * provable separately from "the Pathologist reference arrived" - a single server sentinel would
 * let a resolver that copied one person's reference onto another pass.
 */
const MEDTECH_SERVER_SENTINEL: string =
  "/api/signatures/proxy?path=SERVER-AUTHORITATIVE-MEDTECH.png";

/* ------------------------------------------------------------------ fixtures */

const personnelRecord = (
  id: string,
  role: IPersonnel["role"],
  signatureImageUrl: string | null
): IPersonnel => ({
  id,
  firstName: "FIXTURE",
  lastName: role.toUpperCase(),
  middleInitial: null,
  credentials: role === "Pathologist" ? "MD" : "RMT",
  prcLicenseNumber: `PRC-${id}`,
  role,
  signatureImageUrl,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

function lookupOf(records: readonly IPersonnel[]): PersonnelLookup {
  return {
    async findById(id: string) {
      return records.find((record) => record.id === id) ?? null;
    },
  };
}

/** The client always sends the forged sentinel — that is the whole point of the fixture. */
const clientPathologist = (): SignatorySnapshot => ({
  personnelId: "path-1",
  role: "Pathologist",
  printedFullName: "DR. PATHOLOGIST",
  printedCredentials: "MD",
  printedPrcLicenseNumber: "P-1",
  signatureImageUrl: CLIENT_SENTINEL,
  displayOrder: 1,
});

const clientMedtech = (order: number): SignatorySnapshot => ({
  personnelId: `mt-${order}`,
  role: "MedicalTechnologist",
  printedFullName: `MEDTECH ${order}`,
  printedCredentials: "RMT",
  printedPrcLicenseNumber: `M-${order}`,
  // Whatever the client sends is irrelevant to the outcome - that is the point of the fixture.
  signatureImageUrl: CLIENT_SENTINEL,
  displayOrder: order + 1,
});

// `mt-1` holds a stored signature and `mt-2` does not, so both MedTech outcomes - resolve to
// the authoritative reference, and resolve to null when nothing is on file - are exercised
// against the same code path the Pathologist takes.
const AUTHORITATIVE = [
  personnelRecord("path-1", "Pathologist", SERVER_SENTINEL),
  personnelRecord("mt-1", "MedicalTechnologist", MEDTECH_SERVER_SENTINEL),
  personnelRecord("mt-2", "MedicalTechnologist", null),
];

/* ------------------------------------------------------------------ 1. unit behaviour */

async function main(): Promise<void> {
  assert(CLIENT_SENTINEL !== SERVER_SENTINEL, "the two sentinels are distinguishable");
  console.log("=== SIGNATORY RESOLUTION VERIFICATION STARTED ===");

  const resolvedUnit = await resolveSignatoriesForPersistence(
    [clientPathologist(), clientMedtech(1)],
    lookupOf(AUTHORITATIVE)
  );

  assert(
    resolvedUnit.every((entry) => entry.signatureImageUrl !== CLIENT_SENTINEL),
    "resolution rejects the client-supplied signature reference"
  );
  assert(
    resolvedUnit[0].signatureImageUrl === SERVER_SENTINEL,
    "resolution installs the exact authoritative Pathologist reference"
  );
  assert(
    resolvedUnit[1].signatureImageUrl === MEDTECH_SERVER_SENTINEL,
    "a Medical Technologist with a stored signature resolves to that authoritative reference"
  );
  assert(
    resolvedUnit[0].printedFullName === "DR. PATHOLOGIST" &&
      resolvedUnit[0].printedCredentials === "MD" &&
      resolvedUnit[0].printedPrcLicenseNumber === "P-1" &&
      resolvedUnit[0].displayOrder === 1,
    "printed identity and display order survive resolution unchanged"
  );

  const pathologistWithoutSignature = await resolveSignatoriesForPersistence(
    [clientPathologist()],
    lookupOf([personnelRecord("path-1", "Pathologist", null)])
  );
  assert(
    pathologistWithoutSignature[0].signatureImageUrl === null,
    "a Pathologist with no uploaded signature resolves to null rather than the client value"
  );

  // The mirror case for the newly eligible role. `mt-2` carries no stored signature, and the
  // client sends the forgery regardless: the absent-signature outcome must still be null and
  // must not fall back to the transported value.
  const medtechWithoutSignature = await resolveSignatoriesForPersistence(
    [clientMedtech(2)],
    lookupOf(AUTHORITATIVE)
  );
  assert(
    medtechWithoutSignature[0].signatureImageUrl === null,
    "a Medical Technologist with no uploaded signature resolves to null rather than the client value"
  );

  /* ------------------------------------------------------------------ 2. fail-closed */

  async function expectRejection(
    action: () => Promise<unknown>,
    message: string,
    fieldFragment: string
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      assert(error instanceof ValidationError, `${message} raises a validation error`);
      assert(
        Object.keys((error as ValidationError).fieldErrors || {}).some((key) =>
          key.includes(fieldFragment)
        ),
        `${message} identifies ${fieldFragment}`
      );
      return;
    }
    throw new Error(`Signatory resolution verification failed: ${message} should reject`);
  }

  await expectRejection(
    () => resolveSignatoriesForPersistence([clientPathologist()], lookupOf([])),
    "a signatory naming a nonexistent personnel record",
    "signatories"
  );

  await expectRejection(
    () =>
      resolveSignatoriesForPersistence(
        [clientPathologist()],
        lookupOf([personnelRecord("path-1", "MedicalTechnologist", null)])
      ),
    "a signatory whose role disagrees with the authoritative personnel record",
    "signatories"
  );

  /* ------------------------------------------------------------------ 3. snapshot equality */

  const definition: ClinicalReportDefinition = ReportDefinitionRegistry.getDefinition("CBC")!;

  // Fixture construction mirrors verify-checkpoint-b5's proven `validReport`, so this file
  // exercises a genuinely completable report rather than a shape of its own invention.
  function valueFor(parameter: ParameterSpec): string {
    if (parameter.defaultValue) return parameter.defaultValue;
    if (parameter.inputType === "SingleSelect") return parameter.options?.[0] || "";
    if (parameter.inputType === "Combobox") return parameter.options?.[0] || "Encoded Value";
    if (parameter.inputType === "NumericText") return "1";
    if (parameter.inputType === "FreeText") return "Encoded Value";
    return "";
  }

  function completableReport(): LaboratoryReportDomain {
    const requirement =
      definition.signatoryRequirements || { requiredPathologistsCount: 1, requiredMedtechsCount: 1 };
    let report = buildEncodingReport({
      definition,
      sessionId: "m6s2-session",
      reportId: "m6s2-report",
      rendererFamily: definition.rendererFamily as RendererFamily,
      signatories: [
        clientPathologist(),
        ...Array.from({ length: requirement.requiredMedtechsCount }, (_, index) =>
          clientMedtech(index + 1)
        ),
      ],
    });
    for (const parameter of definition.parameters) {
      if (parameter.inputType !== "Computed") {
        report = applyEncodingResultValue(
          report,
          definition,
          parameter.parameterCode,
          valueFor(parameter),
          "NoEvaluation"
        );
      }
    }
    report = new LaboratoryReportDomain({
      ...report,
      encodingData: {
        ...(report.encodingData || {}),
        requestedBy:
          report.encodingData?.requestedBy ||
          (definition.requestedByPolicy.isRequired ? "Dr. Required Physician" : ""),
        additionalFields: Object.fromEntries(
          (definition.additionalEncodingFields || []).map((field) => [
            field.fieldCode,
            field.isRequired ? "2026-08-09 10:30" : "",
          ])
        ),
        repeatableFindings: report.encodingData?.repeatableFindings || {},
      },
      reagentKitInfo: definition.requiresKitInfo
        ? { kitBrand: "", lotNumber: "LOT-M6S2", expirationDate: "2028-12" }
        : undefined,
    });
    return report;
  }

  const demographics: PatientDemographics = {
    fullName: "M6S2 PATIENT",
    age: 31,
    ageUnit: "years",
    sex: "Female",
    address: "TEST ADDRESS",
    patientStatus: "" as PatientDemographics["patientStatus"],
    examinationDate: "2026-08-09",
    requestingPhysician: "",
  };

  function sessionFixture(status: "Draft" | "Completed"): PatientReportSessionAggregate {
    return new PatientReportSessionAggregate({
      id: "m6s2-session",
      accessionNumber: "SR-20260101-0001",
      status,
      demographics: { ...demographics },
      reports: [completableReport()],
      completedAt: status === "Completed" ? "2026-08-09T00:00:00.000Z" : null,
      expiresAt: status === "Completed" ? "2099-01-01T00:00:00.000Z" : null,
    });
  }

  function snapshotSignatories(snapshot: unknown): SignatorySnapshot[] {
    const reports = (snapshot as { reports: { signatories: SignatorySnapshot[] }[] }).reports;
    return reports.flatMap((report) => report.signatories);
  }

  function snapshotUrls(snapshot: unknown): (string | null | undefined)[] {
    return snapshotSignatories(snapshot).map((s) => s.signatureImageUrl);
  }

  // ── initial completion ──────────────────────────────────────────────────────
  const draft = sessionFixture("Draft");
  await applyResolvedSignatories(draft.reports, lookupOf(AUTHORITATIVE));
  draft.completeSession();

  const completedUrls = snapshotUrls(draft.completedSnapshot);
  assert(
    !completedUrls.includes(CLIENT_SENTINEL),
    "completion: the client sentinel appears nowhere in the completed snapshot"
  );
  assert(
    completedUrls.filter((url) => url === SERVER_SENTINEL).length === 1,
    "completion: the completed snapshot carries exactly the authoritative Pathologist reference"
  );
  // Derived from the report's own signatory requirement rather than hardcoded: CBC requires
  // one Medical Technologist, and a fixed count would make this assertion a fixture fact.
  //
  // Policy reversal: a MedTech reference is no longer unconditionally null. Each MedTech
  // signatory is checked against ITS OWN authoritative record, so the two outcomes are pinned
  // together - a stored reference is installed verbatim, and an absent one still resolves to
  // null. Comparing per personnelId is what rules out a resolver that copied the Pathologist's
  // reference onto everyone, which a "not null" check would have accepted.
  const medtechSignatories = snapshotSignatories(draft.completedSnapshot).filter(
    (s) => s.role === "MedicalTechnologist"
  );
  const medtechCount = medtechSignatories.length;
  assert(medtechCount >= 1, "the fixture carries at least one Medical Technologist");
  assert(
    medtechSignatories.every((s) => {
      const authoritative = AUTHORITATIVE.find((record) => record.id === s.personnelId);
      return !!authoritative && s.signatureImageUrl === (authoritative.signatureImageUrl ?? null);
    }),
    "completion: every Medical Technologist reference equals that person's own authoritative reference"
  );
  assert(
    completedUrls.filter((url) => url === MEDTECH_SERVER_SENTINEL).length === 1,
    "completion: the completed snapshot carries the authoritative Medical Technologist reference"
  );

  // The RPC payload is built from the SAME live aggregate the snapshot was composed from, so
  // proving they read one source is what proves they cannot diverge.
  const liveUrls = draft.reports.flatMap((report) =>
    report.signatories.map((s) => s.signatureImageUrl ?? null)
  );
  assert(
    JSON.stringify(liveUrls) === JSON.stringify(completedUrls.map((url) => url ?? null)),
    "completion: the live aggregate the RPC payload reads matches the frozen snapshot exactly"
  );

  // ── replacement ─────────────────────────────────────────────────────────────
  const completedForReplacement = sessionFixture("Completed");
  await applyResolvedSignatories(completedForReplacement.reports, lookupOf(AUTHORITATIVE));
  const replacement = completedForReplacement.recompleteSession();

  const replacementUrls = snapshotUrls(replacement.completedSnapshot);
  assert(
    !replacementUrls.includes(CLIENT_SENTINEL),
    "replacement: the client sentinel appears nowhere in the replacement snapshot"
  );
  assert(
    replacementUrls.filter((url) => url === SERVER_SENTINEL).length === 1,
    "replacement: the replacement snapshot carries exactly the authoritative Pathologist reference"
  );
  assert(
    replacementUrls.filter((url) => url === MEDTECH_SERVER_SENTINEL).length === 1,
    "replacement: the replacement snapshot carries the authoritative Medical Technologist reference"
  );
  assert(
    snapshotSignatories(replacement.completedSnapshot)
      .filter((s) => s.role === "MedicalTechnologist")
      .every((s) => {
        const authoritative = AUTHORITATIVE.find((record) => record.id === s.personnelId);
        return !!authoritative && s.signatureImageUrl === (authoritative.signatureImageUrl ?? null);
      }),
    "replacement: every Medical Technologist reference equals that person's own authoritative reference"
  );
  const replacementLiveUrls = replacement.reports.flatMap((report) =>
    report.signatories.map((s) => s.signatureImageUrl ?? null)
  );
  assert(
    JSON.stringify(replacementLiveUrls) === JSON.stringify(replacementUrls.map((url) => url ?? null)),
    "replacement: the live aggregate the RPC payload reads matches the replacement snapshot exactly"
  );

  /* ------------------------------------------------------------------ 4. orchestration order */

  const actionsSource = readFileSync(
    join(process.cwd(), "src/features/server-boundary/server-actions.ts"),
    "utf8"
  ).replace(/\r\n/g, "\n");

  function bodyOf(name: string): string {
    const start = actionsSource.indexOf(`export async function ${name}(`);
    assert(start >= 0, `${name} is declared in server-actions.ts`);
    const end = actionsSource.indexOf("\n}\n", start);
    assert(end > start, `${name} body is locatable`);
    return actionsSource.slice(start, end);
  }

  const completeBody = bodyOf("completeSessionAction");
  const replaceBody = bodyOf("replaceSessionAction");

  for (const [label, body, domainCall] of [
    ["completeSessionAction", completeBody, "repository.completeSession("],
    ["replaceSessionAction", replaceBody, ".recompleteSession()"],
  ] as const) {
    const resolveIndex = body.indexOf("applyResolvedSignatories");
    const domainIndex = body.indexOf(domainCall);
    assert(resolveIndex >= 0, `${label} resolves signatories server-side`);
    assert(domainIndex >= 0, `${label} still reaches its domain composition call`);
    assert(
      resolveIndex < domainIndex,
      `${label} resolves BEFORE composition; resolving afterwards would let the frozen snapshot and the relational rows diverge`
    );
    assert(
      /await applyResolvedSignatories/.test(body),
      `${label} awaits resolution rather than firing it and continuing`
    );
  }

  assert(
    !/saveDraftAction[\s\S]{0,400}applyResolvedSignatories/.test(actionsSource),
    "saveDraftAction is unchanged; drafts are re-resolved at completion, not at save"
  );

  /* ------------------------------------------------------------------ 5. resolver hygiene */

  const resolverSource = readFileSync(
    join(process.cwd(), "src/features/server-boundary/signatory-resolution.ts"),
    "utf8"
  ).replace(/\r\n/g, "\n");

  assert(
    /^import "server-only";/m.test(resolverSource),
    "the resolver is server-only and cannot be pulled into a client bundle"
  );
  const resolveFn =
    resolverSource.match(/export async function resolveSignatoriesForPersistence[\s\S]*?\n\}/)?.[0] || "";
  assert(resolveFn.length > 0, "the resolution function is locatable");
  assert(
    !/signatory\.signatureImageUrl/.test(resolveFn),
    "resolution never reads the incoming signature reference"
  );
  assert(
    /record\.signatureImageUrl/.test(resolveFn),
    "resolution reads the reference from the authoritative personnel record"
  );
  assert(
    !/\.remove\(|\.delete\(|repository\.update\(/.test(resolverSource),
    "resolution deletes no storage object and modifies no personnel record"
  );

  process.stdout.write("\nSignatory resolution verification passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}
`);
  process.exit(1);
});
