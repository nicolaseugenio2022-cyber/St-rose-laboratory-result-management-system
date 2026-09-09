/**
 * Intentionally Blank Results and Optional Requested By
 *
 * Two client-reported behaviours, proved together because they share one failure mode - a
 * completion rule that refused work the laboratory legitimately wanted to record:
 *
 *   - a CHECKED parameter may be left blank. It does not block completion, it is not persisted as
 *     a result, and it does not appear on the report.
 *   - "Requested By" is optional on every examination. A session completes without one and the
 *     report stays valid.
 *
 * And the guard rail that makes both safe: BLANK MEANS WHITESPACE-ONLY, never falsiness. "0",
 * "0.0", "false", "Negative" and "Nonreactive" are real clinical results. A truthiness test would
 * silently discard every one of them, which is the exact defect this file exists to prevent.
 *
 * The omission rule is asserted on BOTH sides - the frozen snapshot and the resolved render model -
 * because they are two separate implementations of the same sentence, and a report that omits a
 * value from the record but still prints an empty row for it would satisfy neither.
 */

import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import { PatientReportSessionAggregate } from "../src/domain/models/patient-report-session-aggregate";
import { LaboratoryReportDomain } from "../src/domain/models/laboratory-report-domain";
import { applyEncodingResultValue, buildEncodingReport } from "../src/app/(dashboard)/workspace/_lib/encoding/report-encoding";
import { resolveDraftSessionRenderModel } from "../src/rendering/model";
import type { PatientDemographics, RendererFamily, SignatorySnapshot } from "../src/domain/types";
import type { ClinicalReportDefinition } from "../src/domain/types/report-definition";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`❌ Blank/optional result verification failed: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

const demographics: PatientDemographics = {
  fullName: "Blank Result Patient",
  age: 41,
  ageUnit: "years",
  sex: "Female",
  address: "STA. ROSA, NUEVA ECIJA",
  patientStatus: "OutPatient",
  examinationDate: "2026-09-09",
  requestingPhysician: "",
};

const pathologist: SignatorySnapshot = {
  personnelId: "pathologist-1", role: "Pathologist", printedFullName: "PATHOLOGIST ONE",
  printedCredentials: "MD", printedPrcLicenseNumber: "P-1", signatureImageUrl: null, displayOrder: 1,
};
const medtech = (id: number): SignatorySnapshot => ({
  personnelId: `medtech-${id}`, role: "MedicalTechnologist", printedFullName: `MEDTECH ${id}`,
  printedCredentials: "RMT", printedPrcLicenseNumber: `M-${id}`, signatureImageUrl: null, displayOrder: id + 1,
});

function signatoriesFor(definition: ClinicalReportDefinition): SignatorySnapshot[] {
  const required = definition.signatoryRequirements?.requiredMedtechsCount ?? 1;
  return [pathologist, ...Array.from({ length: required }, (_, index) => medtech(index + 1))];
}

function reportFor(definition: ClinicalReportDefinition): LaboratoryReportDomain {
  return buildEncodingReport({
    definition,
    sessionId: "blank-session",
    reportId: `blank-${definition.templateCode}`,
    rendererFamily: definition.rendererFamily as RendererFamily,
    signatories: signatoriesFor(definition),
  });
}

function sessionFor(definition: ClinicalReportDefinition, report: LaboratoryReportDomain): PatientReportSessionAggregate {
  return new PatientReportSessionAggregate({
    id: "blank-session",
    accessionNumber: "ACC-BLANK",
    status: "Draft",
    demographics: { ...demographics },
    reports: [report],
    createdAt: "2026-09-09T00:00:00.000Z",
    completedAt: null,
  });
}

function withKit(definition: ClinicalReportDefinition, report: LaboratoryReportDomain): LaboratoryReportDomain {
  return definition.requiresKitInfo
    ? new LaboratoryReportDomain({ ...report, reagentKitInfo: { kitBrand: "", lotNumber: "LOT-BLANK", expirationDate: "2028-12" } })
    : report;
}

// ── Values that are NOT blank and must survive completion untouched ──
// Each is entered into a parameter that accepts it, and read back out of the frozen snapshot.
const NON_BLANK_VALUES = ["0", "0.0", "false", "Negative", "Nonreactive"];

const urinalysis = ReportDefinitionRegistry.getDefinition("URINALYSIS")!;
for (const value of NON_BLANK_VALUES) {
  let report = reportFor(urinalysis);
  report = applyEncodingResultValue(report, urinalysis, "WBC", value, "Entered");
  const session = sessionFor(urinalysis, withKit(urinalysis, report));
  session.completeSession();
  const frozen = session.completedSnapshot!.reports[0].results.find((result) => result.parameterCode === "WBC");
  assert(frozen !== undefined, `"${value}" is retained as a result and never treated as blank`);
  assert(frozen!.rawResultValue === value, `"${value}" is frozen exactly as entered`);
}

// The qualitative screening reports carry "Negative"/"Nonreactive" as declared options; those must
// reach the record too, since they are the normal, expected finding.
for (const [templateCode, parameterCode, value] of [
  ["HBSAG", "HBSAG_RESULT", "Nonreactive"],
  ["RPR", "RPR_RESULT", "Nonreactive"],
  ["PREG_TEST", "PREG_RESULT", "Negative"],
] as const) {
  const definition = ReportDefinitionRegistry.getDefinition(templateCode)!;
  const parameter = definition.parameters.find((item) => item.parameterCode === parameterCode);
  if (!parameter) continue;
  let report = reportFor(definition);
  report = applyEncodingResultValue(report, definition, parameterCode, value, "Entered");
  const session = sessionFor(definition, withKit(definition, report));
  session.completeSession();
  const frozen = session.completedSnapshot!.reports[0].results.find((result) => result.parameterCode === parameterCode);
  assert(frozen?.rawResultValue === value, `${templateCode} freezes "${value}" as a reported result`);
}

// ── The reported case: two checked CBC parameters left intentionally blank ──
const cbc = ReportDefinitionRegistry.getDefinition("CBC")!;
let cbcReport = reportFor(cbc);
for (const parameter of cbc.parameters) {
  if (parameter.inputType === "Computed") continue;
  const value = parameter.parameterCode === "EOSINOPHIL" || parameter.parameterCode === "BASOPHIL" ? "" : "1";
  cbcReport = applyEncodingResultValue(cbcReport, cbc, parameter.parameterCode, value, "Entered");
}
const cbcSession = sessionFor(cbc, withKit(cbc, cbcReport));
cbcSession.completeSession();
assert(cbcSession.status === "Completed", "a CBC completes with Eosinophil and Basophil checked and intentionally blank");

const frozenCbc = cbcSession.completedSnapshot!.reports[0].results;
assert(!frozenCbc.some((result) => result.parameterCode === "EOSINOPHIL"), "the blank Eosinophil is absent from the frozen report");
assert(!frozenCbc.some((result) => result.parameterCode === "BASOPHIL"), "the blank Basophil is absent from the frozen report");
assert(frozenCbc.some((result) => result.parameterCode === "HEMOGLOBIN"), "the populated results are still reported");
assert(frozenCbc.length === cbc.parameters.filter((parameter) => parameter.inputType !== "Computed").length - 2, "exactly the two blank parameters were omitted, and nothing else");

// The same two parameters must also be absent from what Preview, Print and PDF compose.
const renderedCbc = resolveDraftSessionRenderModel({
  id: "blank-session",
  accessionNumber: "ACC-BLANK",
  status: "Draft",
  demographics,
  reports: [cbcReport],
  createdAt: "2026-09-09T00:00:00.000Z",
  completedAt: null,
}).reports[0];
const renderedCodes = renderedCbc.results.filter((result) => result.omission === "Render").map((result) => result.parameterCode);
assert(!renderedCodes.includes("EOSINOPHIL") && !renderedCodes.includes("BASOPHIL"), "the blank parameters are omitted from the rendered report, not printed as empty rows");
assert(renderedCodes.includes("HEMOGLOBIN"), "the populated parameters are still rendered");

// A zero is rendered, never swallowed as falsy.
let zeroReport = reportFor(cbc);
for (const parameter of cbc.parameters) {
  if (parameter.inputType === "Computed") continue;
  zeroReport = applyEncodingResultValue(zeroReport, cbc, parameter.parameterCode, parameter.parameterCode === "BASOPHIL" ? "0" : "1", "Entered");
}
const zeroRendered = resolveDraftSessionRenderModel({
  id: "blank-session", accessionNumber: "ACC-BLANK", status: "Draft", demographics,
  reports: [zeroReport], createdAt: "2026-09-09T00:00:00.000Z", completedAt: null,
}).reports[0];
assert(
  zeroRendered.results.some((result) => result.parameterCode === "BASOPHIL" && result.omission === "Render"),
  "a Basophil of 0 is rendered - blank is whitespace-only, never falsiness"
);

// ── A report must still say something ──
let emptyReport = reportFor(cbc);
for (const parameter of cbc.parameters) {
  if (parameter.inputType === "Computed") continue;
  emptyReport = applyEncodingResultValue(emptyReport, cbc, parameter.parameterCode, "", "Entered");
}
let refused = false;
try {
  sessionFor(cbc, withKit(cbc, emptyReport)).completeSession();
} catch {
  refused = true;
}
assert(refused, "a report with every result left blank is refused - an issued report must carry at least one result");

// ── Requested By is optional everywhere ──
for (const definition of ReportDefinitionRegistry.getAllDefinitions()) {
  assert(definition.requestedByPolicy.isRequired === false, `${definition.templateCode} declares Requested By optional`);
}

const blankRequestedBy = new LaboratoryReportDomain({
  ...withKit(urinalysis, reportFor(urinalysis)),
  encodingData: { ...(reportFor(urinalysis).encodingData || {}), requestedBy: "" },
});
let populated = blankRequestedBy;
for (const parameter of urinalysis.parameters) {
  if (parameter.inputType === "Computed" || parameter.conditionalChoiceSpec) continue;
  populated = applyEncodingResultValue(populated, urinalysis, parameter.parameterCode, parameter.options?.[0] || "1", "Entered");
}
const optionalSession = sessionFor(urinalysis, populated);
optionalSession.completeSession();
assert(optionalSession.status === "Completed", "a session completes with no requesting physician");
assert(optionalSession.completedSnapshot!.reports[0].requestedBy === "", "a blank Requested By is frozen as blank, with no substituted physician");

const renderedBlank = resolveDraftSessionRenderModel({
  id: "blank-session", accessionNumber: "ACC-BLANK", status: "Draft", demographics,
  reports: [populated], createdAt: "2026-09-09T00:00:00.000Z", completedAt: null,
}).reports[0];
assert(renderedBlank.requestedBy.value === "", "a blank Requested By renders as an empty value, never as placeholder text");
assert(!/Dr\./.test(renderedBlank.requestedBy.value), "a blank Requested By never acquires a fallback physician at render time");

console.log("\n✅ Blank and optional result verification passed.");
