/**
 * Laboratory Remarks Verification Script
 *
 * The laboratory's standing remark is "TEST/S RECHECKED; RESULT/S VERIFIED". It was previously
 * declared on CBC alone, so sixteen other examinations were issued with an empty REMARKS band.
 *
 * The rule is a SEEDING rule, applied once when a report is created, and nothing re-derives it
 * afterwards. A render-time substitution for a blank used to exist on the draft path; it made Live
 * Preview disagree with the completed report - completion freezes `report.remarks` verbatim - and
 * it silently restored a remark the operator had deliberately cleared.
 *
 * What this pins:
 *   - the exact text, including its punctuation and casing;
 *   - every newly created report starts at it, whichever examination it is - all 17;
 *   - a report definition that declares its own remark keeps that one;
 *   - an operator-authored remark is never overwritten, and completion freezes it verbatim;
 *   - it is SUBSTITUTED for a blank, never appended, so it cannot appear twice;
 *   - a CLEARED remark stays cleared: blank in encoding, in the draft render model, and in the
 *     composed primitive list that Live Preview, Browser Print and PDF are all built from;
 *   - reopening an existing draft preserves its stored remark exactly, a blank one included;
 *   - a completed report renders the remark frozen into its own snapshot and is never restated,
 *     so a report already issued with an empty remark keeps printing an empty remark;
 *   - draft and completed agree for the same stored value - the parity the defect broke.
 */

import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import * as laboratoryRemarksModule from "../src/domain/laboratory-remarks";
import {
  DEFAULT_LABORATORY_REMARK,
  initialLaboratoryRemarks,
} from "../src/domain/laboratory-remarks";
import { buildEncodingReport } from "../src/app/(dashboard)/workspace/_lib/encoding/report-encoding";
import { resolveSessionRenderModel } from "../src/rendering/model";
import { composeNativeLivePreviewReportPage } from "../src/rendering/native/live-preview-composer";
import type { CompletedSessionSnapshot } from "../src/domain/completion/completed-snapshot";
import type { ILaboratoryReport, IPatientReportSession } from "../src/domain/models/interfaces";
import type { NativeTextPrimitive } from "../src/rendering/native/types";
import type { PatientDemographics, RendererFamily } from "../src/domain/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`❌ Laboratory remarks verification failed: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

// ── The text itself ──
assert(
  DEFAULT_LABORATORY_REMARK === "TEST/S RECHECKED; RESULT/S VERIFIED",
  `the standing remark is exactly "TEST/S RECHECKED; RESULT/S VERIFIED"`
);

// ── The rule is a seeding rule and nothing else ──
// A display-time variant is what broke Preview/completion parity. The module must not carry one,
// not even as an unused export a later edit could wire back into the render path without noticing.
assert(
  JSON.stringify(Object.keys(laboratoryRemarksModule).sort()) ===
    JSON.stringify(["DEFAULT_LABORATORY_REMARK", "initialLaboratoryRemarks"]),
  "the laboratory remarks module exposes the constant and the seeding rule only - no display-time fallback survives, dead or live"
);

// ── The seeding rule ──
assert(initialLaboratoryRemarks("") === DEFAULT_LABORATORY_REMARK, "a definition declaring an empty remark seeds the laboratory default");
assert(initialLaboratoryRemarks(null) === DEFAULT_LABORATORY_REMARK, "a definition declaring no remark seeds the laboratory default");
assert(initialLaboratoryRemarks("   ") === DEFAULT_LABORATORY_REMARK, "a whitespace-only declaration is treated as absent");
assert(initialLaboratoryRemarks("HAEMOLYSED SPECIMEN") === "HAEMOLYSED SPECIMEN", "a definition's own declared remark outranks the laboratory default");
assert(
  (initialLaboratoryRemarks(DEFAULT_LABORATORY_REMARK).match(/RECHECKED/g) || []).length === 1,
  "the remark is substituted for a blank, never appended, so seeding it over itself yields one copy"
);

// ── Every registered examination seeds it ──
const definitions = ReportDefinitionRegistry.getAllDefinitions();
assert(definitions.length === 17, "the report registry exposes all 17 examinations");
for (const definition of definitions) {
  const report = buildEncodingReport({
    definition,
    sessionId: "remarks-session",
    reportId: `remarks-${definition.templateCode}`,
    rendererFamily: definition.rendererFamily as RendererFamily,
    signatories: [],
  });
  const expected = initialLaboratoryRemarks(definition.defaultRemarks);
  assert(report.remarks === expected, `${definition.templateCode} starts at its expected remark`);
  assert((report.remarks || "").trim().length > 0, `${definition.templateCode} never starts with a blank remark`);
  assert(
    ((report.remarks || "").match(/RECHECKED/g) || []).length <= 1,
    `${definition.templateCode} carries the standing remark at most once - it is substituted, never appended`
  );
}

const cbc = ReportDefinitionRegistry.getDefinition("CBC")!;

// A definition that declares its own remark keeps it end to end, through creation and not merely in
// the pure rule above. No shipped definition declares a remark other than the laboratory default,
// so this drives creation with a definition that does.
const ownRemarkDefinition = { ...cbc, defaultRemarks: "HAEMOLYSED SPECIMEN; REPEAT REQUESTED" };
const ownRemarkReport = buildEncodingReport({
  definition: ownRemarkDefinition,
  sessionId: "remarks-session",
  reportId: "remarks-own-declared",
  rendererFamily: cbc.rendererFamily as RendererFamily,
  signatories: [],
});
assert(
  ownRemarkReport.remarks === "HAEMOLYSED SPECIMEN; REPEAT REQUESTED",
  "creating a report from a definition that declares its own remark seeds that remark, not the laboratory default"
);
assert(
  !(ownRemarkReport.remarks || "").includes("RECHECKED"),
  "a definition's own declared remark is not joined with, or overwritten by, the laboratory default"
);

// ── Reopening an existing draft preserves exactly what it carries ──
function freshCbcReport(): ILaboratoryReport {
  return buildEncodingReport({
    definition: cbc,
    sessionId: "remarks-session",
    reportId: "remarks-fresh",
    rendererFamily: cbc.rendererFamily as RendererFamily,
    signatories: [],
  }) as ILaboratoryReport;
}

function reopenWithStoredRemark(storedRemarks: string): ILaboratoryReport {
  return buildEncodingReport({
    definition: cbc,
    sessionId: "remarks-session",
    reportId: "remarks-reopened",
    rendererFamily: cbc.rendererFamily as RendererFamily,
    signatories: [],
    existingReport: { ...freshCbcReport(), remarks: storedRemarks } as ILaboratoryReport,
  }) as ILaboratoryReport;
}

assert(
  reopenWithStoredRemark("").remarks === "",
  "reopening a report preserves a remark the operator deliberately cleared, rather than reseeding it"
);
assert(
  reopenWithStoredRemark("SPECIMEN CLOTTED").remarks === "SPECIMEN CLOTTED",
  "reopening a report preserves an operator-authored remark exactly as stored"
);
assert(
  reopenWithStoredRemark(DEFAULT_LABORATORY_REMARK).remarks === DEFAULT_LABORATORY_REMARK,
  "reopening a report that still carries the standing remark keeps exactly one copy of it"
);

// ── Render fixtures ──
const demographics: PatientDemographics = {
  fullName: "Remarks Patient",
  age: 30,
  ageUnit: "years",
  sex: "Female",
  address: "STA. ROSA, NUEVA ECIJA",
  patientStatus: "OutPatient",
  examinationDate: "2026-09-09",
  requestingPhysician: "",
};

const chem8 = ReportDefinitionRegistry.getDefinition("CHEM_8")!;

function reportWithRemarks(remarks: string | null): ILaboratoryReport {
  return {
    id: "remarks-report",
    sessionId: "remarks-session",
    templateCode: chem8.templateCode,
    templateTitle: chem8.templateTitle,
    rendererFamily: chem8.rendererFamily as RendererFamily,
    remarks,
    reagentKitInfo: null,
    encodingData: { requestedBy: "Dr. Requested", additionalFields: {}, repeatableFindings: {} },
    results: chem8.parameters.map((parameter) => ({
      id: `remarks-${parameter.parameterCode}`,
      reportId: "remarks-report",
      parameterCode: parameter.parameterCode,
      parameterName: parameter.parameterName,
      resultValue: "",
      evaluationOutcome: "NoEvaluation" as const,
      displayOrder: parameter.displayOrder,
    })),
    signatories: [],
  };
}

function draftSession(remarks: string | null): IPatientReportSession {
  return {
    id: "remarks-session",
    accessionNumber: "ACC-REMARKS",
    status: "Draft",
    demographics,
    reports: [reportWithRemarks(remarks)],
    createdAt: "2026-09-09T00:00:00.000Z",
    completedAt: null,
  };
}

// A completed report renders the remark frozen into its own snapshot. An empty frozen remark stays
// empty: what a report said when it was issued is what it keeps saying.
function completedSession(frozenRemarks: string): IPatientReportSession {
  const snapshot: CompletedSessionSnapshot = {
    snapshotVersion: 2,
    completedAt: "2026-09-09T01:00:00.000Z",
    demographics,
    reports: [{
      templateCode: chem8.templateCode,
      templateTitle: chem8.templateTitle,
      rendererFamily: chem8.rendererFamily as RendererFamily,
      renderContractVersion: chem8.renderContract?.renderContractVersion ?? 1,
      printedTitle: chem8.reportTitle ?? null,
      staticContentVersion: chem8.renderContract?.staticContentVersion ?? "standard-report-v1",
      requestedBy: "Dr. Requested",
      additionalFields: {},
      results: [],
      remarks: frozenRemarks,
      reagentKitInfo: null,
      repeatableFindings: {},
      signatories: [],
    }],
  };
  return { ...draftSession(frozenRemarks), status: "Completed", completedAt: snapshot.completedAt, completedSnapshot: snapshot };
}

const draftRemarks = (stored: string | null) => resolveSessionRenderModel(draftSession(stored)).reports[0].remarks;
const completedRemarks = (frozen: string) => resolveSessionRenderModel(completedSession(frozen)).reports[0].remarks;

// The composed primitive list is what Live Preview, Browser Print and the PDF exporter are all
// built from, so asserting on it proves all three surfaces at once rather than the model alone.
function composedRemarkLines(session: IPatientReportSession): string[] {
  const model = resolveSessionRenderModel(session);
  const page = composeNativeLivePreviewReportPage(model, model.reports[0]);
  return page.primitives
    .filter((primitive): primitive is NativeTextPrimitive =>
      primitive.kind === "text" && primitive.id.startsWith("remarks-value-line-"))
    .map((primitive) => primitive.text);
}

// ── A cleared remark stays cleared, on every draft surface ──
assert(
  draftRemarks("") === "",
  "a draft report whose remark the operator cleared renders blank - the laboratory default is never silently restored at render time"
);
assert(
  draftRemarks(null) === "",
  "a draft report carrying no remark at all renders blank rather than re-deriving the laboratory default"
);
assert(
  !draftRemarks("").includes("RECHECKED"),
  "no fragment of the standing remark reappears in a cleared draft's render model"
);
assert(
  composedRemarkLines(draftSession("")).join("") === "",
  "the composed primitive list for a cleared draft carries no remark text, so Live Preview, Browser Print and PDF all show it blank"
);

// ── An authored remark renders exactly as written ──
assert(
  draftRemarks("SAMPLE CLOTTED") === "SAMPLE CLOTTED",
  "a draft report renders an authored remark exactly, with no default applied over it"
);
assert(
  draftRemarks("  spaced  Remark  ") === "  spaced  Remark  ",
  "a draft remark keeps its exact spacing and casing - it is neither trimmed, re-cased, nor treated as blank"
);
assert(
  composedRemarkLines(draftSession("SAMPLE CLOTTED")).join(" ").includes("SAMPLE CLOTTED"),
  "an authored remark reaches the composed primitive list verbatim"
);
assert(
  composedRemarkLines(draftSession(DEFAULT_LABORATORY_REMARK)).join(" ").match(/RECHECKED/g)!.length === 1,
  "a draft still carrying the seeded remark composes exactly one copy of it - substituted, never appended"
);

// ── Completed snapshots render exactly what they froze ──
assert(
  completedRemarks("") === "",
  "a completed report whose frozen remark is empty still renders empty - the default is never applied retroactively"
);
assert(
  completedRemarks(DEFAULT_LABORATORY_REMARK) === DEFAULT_LABORATORY_REMARK,
  "a completed report renders the remark frozen into its snapshot"
);
assert(
  completedRemarks("FROZEN CUSTOM REMARK") === "FROZEN CUSTOM REMARK",
  "a completed report's authored remark is rendered exactly as frozen"
);
assert(
  composedRemarkLines(completedSession("")).join("") === "",
  "the composed primitive list for a completed report frozen with an empty remark carries no remark text"
);

// ── Draft/completed parity: the guarantee the render-time substitution broke ──
for (const stored of ["", DEFAULT_LABORATORY_REMARK, "SAMPLE CLOTTED", "   "]) {
  assert(
    draftRemarks(stored) === completedRemarks(stored),
    `draft and completed render the same remark for the stored value ${JSON.stringify(stored)} - Live Preview cannot disagree with the issued report`
  );
  assert(
    JSON.stringify(composedRemarkLines(draftSession(stored))) ===
      JSON.stringify(composedRemarkLines(completedSession(stored))),
    `the composed remark primitives are identical draft and completed for the stored value ${JSON.stringify(stored)}`
  );
}

// ── Encoding to render, end to end ──
// The operator clears the field, the report is reopened, and the surface stays blank. This is the
// exact sequence the defect broke: encoding stored "", Preview showed the default, completion froze
// the blank.
const clearedThroughEncoding = reopenWithStoredRemark("");
assert(clearedThroughEncoding.remarks === "", "the cleared remark survives a reopen through the encoding builder");
const clearedSession: IPatientReportSession = {
  ...draftSession(""),
  reports: [{ ...clearedThroughEncoding, id: "remarks-report", sessionId: "remarks-session" }],
};
assert(
  resolveSessionRenderModel(clearedSession).reports[0].remarks === "",
  "a reopened, deliberately cleared report renders blank - encoding, Live Preview and completion agree on the stored blank"
);

console.log("\n✅ Laboratory remarks verification passed.");
