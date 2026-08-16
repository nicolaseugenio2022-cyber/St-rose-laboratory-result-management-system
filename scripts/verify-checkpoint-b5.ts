/** Checkpoint B5: completion validation and immutable snapshot verification. */
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import { PatientReportSessionAggregate } from "../src/domain/models/patient-report-session-aggregate";
import { LaboratoryReportDomain, LaboratoryResultDomain } from "../src/domain/models/laboratory-report-domain";
import { buildEncodingReport, applyEncodingResultValue, applyParameterSelection } from "../src/features/workspace/encoding/report-encoding";
import type { ClinicalReportDefinition, ParameterSpec } from "../src/domain/types/report-definition";
import type { PatientDemographics, RendererFamily, SignatorySnapshot } from "../src/domain/types";
import { ValidationError, DomainInvariantError } from "../src/lib/errors";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as ts from "typescript";
import { cloneAndFreezeSnapshot } from "../src/domain/completion/completed-snapshot";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`✓ ${message}`);
}

const codes = ReportDefinitionRegistry.getRegisteredTemplateCodes();
const pathologist: SignatorySnapshot = { personnelId: "pathologist", role: "Pathologist", printedFullName: "DR. PATHOLOGIST", printedCredentials: "MD", printedPrcLicenseNumber: "P-1", signatureImageUrl: "/signature.png", displayOrder: 1 };
const medtech = (order: number): SignatorySnapshot => ({ personnelId: `medtech-${order}`, role: "MedicalTechnologist", printedFullName: `MEDTECH ${order}`, printedCredentials: "RMT", printedPrcLicenseNumber: `M-${order}`, signatureImageUrl: null, displayOrder: order + 1 });
const demographics = (address = "EDITED STORED ADDRESS", patientStatus = "" as PatientDemographics["patientStatus"]): PatientDemographics => ({ fullName: "B5 PATIENT", age: 31, ageUnit: "years", sex: "Female", address, patientStatus, examinationDate: "2026-08-09", requestingPhysician: "" });

function valueFor(parameter: ParameterSpec): string {
  if (parameter.defaultValue) return parameter.defaultValue;
  if (parameter.parameterCode === "CHOLESTEROL") return "155";
  if (parameter.parameterCode === "TRIGLYCERIDES") return "700";
  if (parameter.inputType === "SingleSelect") return parameter.options?.[0] || "";
  if (parameter.inputType === "Combobox") return parameter.options?.[0] || "Encoded Value";
  if (parameter.inputType === "NumericText") return "1";
  if (parameter.inputType === "FreeText") return "Encoded Value";
  return "";
}

function validReport(definition: ClinicalReportDefinition): LaboratoryReportDomain {
  const signatoryRequirement = definition.signatoryRequirements || { requiredPathologistsCount: 1, requiredMedtechsCount: 1 };
  let report = buildEncodingReport({ definition, sessionId: `session-${definition.templateCode}`, reportId: `report-${definition.templateCode}`, rendererFamily: definition.rendererFamily as RendererFamily, signatories: [pathologist, ...Array.from({ length: signatoryRequirement.requiredMedtechsCount }, (_, index) => medtech(index + 1))] });
  for (const parameter of definition.parameters) {
    if (parameter.inputType !== "Computed") report = applyEncodingResultValue(report, definition, parameter.parameterCode, valueFor(parameter), "NoEvaluation");
  }
  report = new LaboratoryReportDomain({
    ...report,
    encodingData: {
      ...(report.encodingData || {}),
      requestedBy: report.encodingData?.requestedBy || (definition.requestedByPolicy.isRequired ? "Dr. Required Physician" : ""),
      additionalFields: Object.fromEntries((definition.additionalEncodingFields || []).map((field) => [field.fieldCode, field.isRequired ? "2026-08-09 10:30" : ""])),
      repeatableFindings: report.encodingData?.repeatableFindings || {},
    },
    reagentKitInfo: definition.requiresKitInfo ? { kitBrand: "", lotNumber: "LOT-B5", expirationDate: "2028-12" } : undefined,
  });
  return report;
}

function sessionFor(definition: ClinicalReportDefinition, report = validReport(definition), address = "EDITED STORED ADDRESS"): PatientReportSessionAggregate {
  return new PatientReportSessionAggregate({ id: `session-${definition.templateCode}`, accessionNumber: `B5-${definition.templateCode}`, demographics: demographics(address), reports: [report] });
}

function expectValidation(action: () => void, message: string, fieldFragment?: string): void {
  try { action(); } catch (error) {
    assert(error instanceof ValidationError, `${message} returns a validation error`);
    if (fieldFragment) assert(Object.keys(error.fieldErrors || {}).some((key) => key.includes(fieldFragment)), `${message} identifies ${fieldFragment}`);
    return;
  }
  throw new Error(`ASSERTION FAILED: ${message} should block completion`);
}

console.log("=== CHECKPOINT B5 VERIFICATION STARTED ===");
assert(codes.length === 17, "all 17 reports have completion coverage");

for (const code of codes) {
  const definition = ReportDefinitionRegistry.getDefinition(code)!;
  const session = sessionFor(definition);
  session.demographics.patientStatus = "" as PatientDemographics["patientStatus"];
  session.completeSession();
  assert(session.status === "Completed" && session.completedSnapshot?.reports.length === 1, `${code} completes through its declarative policy with Patient Status absent`);
  assert(session.completedSnapshot?.reports[0].results.every((result) => result.formattedResultValue !== undefined), `${code} freezes formatted result values`);

  const required = definition.parameters.find((parameter) => parameter.isRequired && parameter.inputType !== "Computed");
  if (required) {
    const report = validReport(definition);
    report.results = report.results.map((result) => result.parameterCode === required.parameterCode ? new LaboratoryResultDomain({ ...result, resultValue: "", rawResultValue: "", formattedResultValue: "" }) : result);
    expectValidation(() => sessionFor(definition, report).completeSession(), `${code} missing required result`, required.parameterCode);
  }
}

for (const code of codes) {
  const definition = ReportDefinitionRegistry.getDefinition(code)!;
  if (definition.requestedByPolicy.isRequired) {
    const report = validReport(definition);
    const blank = new LaboratoryReportDomain({ ...report, encodingData: { ...(report.encodingData || {}), requestedBy: "" } });
    expectValidation(() => sessionFor(definition, blank).completeSession(), `${code} missing ${definition.requestedByPolicy.fieldLabel || "Requested By"}`, "requestedBy");
  }
}

for (const definition of ReportDefinitionRegistry.getAllDefinitions().filter((item) => item.requiresKitInfo)) {
  const report = new LaboratoryReportDomain({ ...validReport(definition), reagentKitInfo: { kitBrand: "", lotNumber: "", expirationDate: "" } });
  expectValidation(() => sessionFor(definition, report).completeSession(), `${definition.templateCode} missing required kit data`, "kit");
}

const cbc = ReportDefinitionRegistry.getDefinition("CBC")!;
for (const [field, mutate] of [
  ["fullName", (value: PatientDemographics) => ({ ...value, fullName: "" })],
  ["age", (value: PatientDemographics) => ({ ...value, age: 0 })],
  ["sex", (value: PatientDemographics) => ({ ...value, sex: "" as PatientDemographics["sex"] })],
  ["examinationDate", (value: PatientDemographics) => ({ ...value, examinationDate: "" })],
] as const) {
  const session = sessionFor(cbc);
  session.demographics = mutate(session.demographics);
  expectValidation(() => session.completeSession(), `required demographic ${field}`, `demographics.${field}`);
}

const fecalysis = ReportDefinitionRegistry.getDefinition("FECALYSIS")!;
let fecalReport = validReport(fecalysis);
fecalReport = applyEncodingResultValue(fecalReport, fecalysis, "PUS_CELLS", "0-2/HPF", "NoEvaluation");
const fecalSession = sessionFor(fecalysis, fecalReport);
fecalSession.completeSession();
assert(fecalSession.status === "Completed", "optional Fecalysis blanks do not block completion");
const frozenPus = fecalSession.completedSnapshot!.reports[0].results.find((result) => result.parameterCode === "PUS_CELLS")!;
assert(frozenPus.rawResultValue === "0-2" && frozenPus.formattedResultValue === "0-2 /HPF" && frozenPus.suffix === " /HPF", "snapshot freezes raw, deduplicated suffix, and final Fecalysis display form");

const missingStandardSignatories = new LaboratoryReportDomain({ ...validReport(cbc), signatories: [] });
expectValidation(() => sessionFor(cbc, missingStandardSignatories).completeSession(), "CBC missing standard signatories", "signatories");

const chemistry = ReportDefinitionRegistry.getDefinition("CHEM_10")!;
let invalidChem = validReport(chemistry);
invalidChem = applyEncodingResultValue(invalidChem, chemistry, "TRIGLYCERIDES", "", "NoEvaluation");
expectValidation(() => sessionFor(chemistry, invalidChem).completeSession(), "missing computed dependency", "LDL");
invalidChem = validReport(chemistry);
invalidChem = applyEncodingResultValue(invalidChem, chemistry, "TRIGLYCERIDES", "1", "NoEvaluation");
expectValidation(() => sessionFor(chemistry, invalidChem).completeSession(), "negative computed LDL", "LDL");

const chemistrySession = sessionFor(chemistry);
chemistrySession.completeSession();
const chemistrySnapshot = chemistrySession.completedSnapshot!.reports[0];
const hdl = chemistrySnapshot.results.find((result) => result.parameterCode === "HDL")!;
const ldl = chemistrySnapshot.results.find((result) => result.parameterCode === "LDL")!;
assert(hdl.formattedResultValue === "41.33" && hdl.rawResultValue === "41.333333333333336", "HDL freezes rounded display and unrounded raw value");
assert(hdl.computationMetadata?.formulaId === "hdl-client-formula" && Array.isArray(hdl.computationMetadata.dependencies) && hdl.computationMetadata.precision === 2, "HDL freezes formula ID, dependencies, precision, and computation evidence");
assert(ldl.formattedResultValue === "26.33" && ldl.computationMetadata?.formulaId === "ldl-client-formula", "LDL freezes the exact client-formula display and identity");
assert(ldl.computationMetadata?.unroundedHdlIntermediate === 41.333333333333336 && ldl.computationMetadata?.unroundedValue === 26.333333333333343, "LDL freezes its unrounded HDL dependency and unrounded result without a triglyceride cutoff");
assert(chemistrySnapshot.results.find((result) => result.parameterCode === "FBS")?.evaluationOutcome === "Low", "B5 freezes resolved LOW manual Chemistry outcome");
assert(chemistrySnapshot.results.find((result) => result.parameterCode === "TRIGLYCERIDES")?.evaluationOutcome === "High", "B5 freezes resolved HIGH manual Chemistry outcome");
assert(hdl.evaluationOutcome === "Normal" && ldl.evaluationOutcome === "Normal", "B5 freezes computed clinical evaluation outcomes from unrounded values");

let suppliedInvalidChem = validReport(chemistry);
suppliedInvalidChem = applyEncodingResultValue(suppliedInvalidChem, chemistry, "CHOLESTEROL", "231", "NoEvaluation", { sex: "Female" });
suppliedInvalidChem = applyEncodingResultValue(suppliedInvalidChem, chemistry, "TRIGLYCERIDES", "325", "NoEvaluation", { sex: "Female" });
assert(suppliedInvalidChem.results.find((result) => result.parameterCode === "HDL")?.resultValue === "61.60" && suppliedInvalidChem.results.find((result) => result.parameterCode === "HDL")?.evaluationOutcome === "Normal", "supplied Chemistry example resolves HDL 61.60 as NORMAL");
assert(suppliedInvalidChem.results.find((result) => result.parameterCode === "LDL")?.resultValue === "" && suppliedInvalidChem.results.find((result) => result.parameterCode === "LDL")?.evaluationOutcome === "Invalid", "supplied Chemistry example preserves blank INVALID negative LDL");
expectValidation(() => sessionFor(chemistry, suppliedInvalidChem).completeSession(), "supplied negative LDL computation", "LDL");

const urine = ReportDefinitionRegistry.getDefinition("URINALYSIS")!;
let urineReport = validReport(urine);
urineReport = new LaboratoryReportDomain({ ...urineReport, encodingData: { ...(urineReport.encodingData || {}), repeatableFindings: { "Additional Microscopic Findings": [
  { id: "finding-1", category: "Additional Microscopic Findings", value: "Calcium Oxalate Crystals: Rare", displayOrder: 1 },
  { id: "finding-blank", category: "Additional Microscopic Findings", value: "", displayOrder: 2 },
  { id: "finding-2", category: "Additional Microscopic Findings", value: "WBC seen in clumps", displayOrder: 3 },
] } } });
const urineSession = sessionFor(urine, urineReport);
urineSession.completeSession();
const frozenFindings = urineSession.completedSnapshot!.reports[0].repeatableFindings["Additional Microscopic Findings"];
assert(frozenFindings.length === 2 && frozenFindings[0].value === "Calcium Oxalate Crystals: Rare" && frozenFindings[1].value === "WBC seen in clumps", "Urinalysis freezes populated repeatable findings in order and permits optional blanks");
const invalidConditionalReport = applyEncodingResultValue(validReport(urine), urine, "AMORPHOUS_CRYSTAL", "Amorphous Urates", "NoEvaluation");
expectValidation(() => sessionFor(urine, invalidConditionalReport).completeSession(), "incomplete conditional Urinalysis finding", "AMORPHOUS_CRYSTAL");

const hiv = ReportDefinitionRegistry.getDefinition("HIV_RESULT")!;
const missingHivField = new LaboratoryReportDomain({ ...validReport(hiv), encodingData: { requestedBy: "Dr. Referrer", additionalFields: { examinationDateTime: "" }, repeatableFindings: {} } });
expectValidation(() => sessionFor(hiv, missingHivField).completeSession(), "HIV missing Date & Time", "examinationDateTime");
const missingHivVerifier = new LaboratoryReportDomain({ ...validReport(hiv), signatories: [pathologist, medtech(1)] });
expectValidation(() => sessionFor(hiv, missingHivVerifier).completeSession(), "HIV missing second Medical Technologist", "medtechs");
const hivSession = sessionFor(hiv);
hivSession.completeSession();
assert(hivSession.completedSnapshot!.reports[0].requestedBy === "Dr. Required Physician" && hivSession.completedSnapshot!.reports[0].additionalFields.examinationDateTime === "2026-08-09 10:30" && hivSession.completedSnapshot!.reports[0].signatories.length === 3, "HIV freezes Referring Doctor, supplemental demographics, and all three signatories");
assert(hivSession.completedSnapshot!.reports[0].reagentKitInfo?.lotNumber === "LOT-B5" && hivSession.completedSnapshot!.reports[0].remarks === "", "HIV freezes reagent kit and remarks data");
assert(hivSession.completedSnapshot!.snapshotVersion === 2, "new completions use completed snapshot version 2");
assert(hivSession.completedSnapshot!.reports[0].renderContractVersion === 1 && hivSession.completedSnapshot!.reports[0].printedTitle === "HIV 1 & 2 RAPID TEST CERTIFICATE" && hivSession.completedSnapshot!.reports[0].staticContentVersion === "hiv-certificate-v1", "HIV freezes render contract version, printed title, and specialized static-content version");
for (const address of ["EDITED HIV PATIENT ADDRESS", ""]) {
  const addressedHivSession = sessionFor(hiv, validReport(hiv), address);
  addressedHivSession.completeSession();
  assert(addressedHivSession.completedSnapshot!.demographics.address === address, `HIV completion preserves the ${address ? "edited" : "intentionally blank"} Patient Address exactly without applying a rendering default`);
}

const cbcSnapshotSession = sessionFor(cbc);
cbcSnapshotSession.completeSession();
assert(cbcSnapshotSession.completedSnapshot!.reports[0].printedTitle === null && cbcSnapshotSession.completedSnapshot!.reports[0].staticContentVersion === "standard-report-v1", "CBC freezes its absent printed title and standard static-content contract version");
const frozenHemoglobin = cbcSnapshotSession.completedSnapshot!.reports[0].results.find((result) => result.parameterCode === "HEMOGLOBIN")!;
assert(frozenHemoglobin.referenceDisplay !== null && frozenHemoglobin.referenceRule !== null, "snapshot freezes CBC reference display and reference-rule evidence");
assert(frozenHemoglobin.referenceDisplay === "120–140 g/L", "B5 freezes the Female sex-resolved reference display with its declared unit");
assert(frozenHemoglobin.evaluationOutcome === "Low", "B5 freezes the exact sex-resolved LOW CBC outcome");
const maleCbcSession = sessionFor(cbc);
maleCbcSession.demographics.sex = "Male";
maleCbcSession.completeSession();
assert(maleCbcSession.completedSnapshot!.reports[0].results.find((result) => result.parameterCode === "HEMOGLOBIN")?.referenceDisplay === "130–160 g/L", "B5 freezes the Male reference after a demographics Sex change");

const bloodTyping = ReportDefinitionRegistry.getDefinition("BLOOD_TYPING")!;
const bloodTypingSession = sessionFor(bloodTyping);
bloodTypingSession.completeSession();
assert(bloodTypingSession.completedSnapshot!.reports[0].results.every((result) => result.evaluationOutcome === "Entered"), "B5 freezes Blood Typing as neutral ENTERED without fake clinical classification");
const esr = ReportDefinitionRegistry.getDefinition("ESR")!;
const esrSession = sessionFor(esr);
esrSession.completeSession();
assert(esr.parameters[0].evaluationPolicy.mode === "Unresolved" && esrSession.completedSnapshot!.reports[0].results[0].evaluationOutcome === "Entered", "valid unresolved ESR completes and freezes ENTERED");

const requiredSelectable = cbc.parameters.find((parameter) => parameter.isRequired && parameter.isSelectable)!;
const requiredDeselectedReport = applyParameterSelection(validReport(cbc), cbc, requiredSelectable.parameterCode, false);
expectValidation(() => sessionFor(cbc, requiredDeselectedReport).completeSession(), "deselected required selectable parameter", requiredSelectable.parameterCode);
let invalidNumericReport = validReport(cbc);
invalidNumericReport = applyEncodingResultValue(invalidNumericReport, cbc, "HEMOGLOBIN", "asdf", "Invalid");
expectValidation(() => sessionFor(cbc, invalidNumericReport).completeSession(), "invalid NumericText result", "HEMOGLOBIN");
for (const value of ["1", "1.25", ".5"]) {
  const validNumericReport = applyEncodingResultValue(validReport(cbc), cbc, "HEMOGLOBIN", value, "NoEvaluation");
  const validNumericSession = sessionFor(cbc, validNumericReport);
  validNumericSession.completeSession();
  assert(validNumericSession.status === "Completed", `valid NumericText '${value}' remains completable`);
}

for (const address of ["STAFF REPLACED ADDRESS", ""]) {
  const session = sessionFor(cbc, validReport(cbc), address);
  session.completeSession();
  assert(session.completedSnapshot!.demographics.address === address, `completion preserves exact stored Address ${address ? "value" : "clearing"} without applying the new-session default`);
}

const immutableSession = sessionFor(cbc);
immutableSession.completeSession();
const frozenAddress = immutableSession.completedSnapshot!.demographics.address;
assert(Object.isFrozen(immutableSession.completedSnapshot) && Object.isFrozen(immutableSession.completedSnapshot!.reports[0].results), "completed snapshots are recursively frozen");
immutableSession.reports[0].results = [new LaboratoryResultDomain({ ...immutableSession.reports[0].results[0], resultValue: "CHANGED AFTER COMPLETION" })];
assert(immutableSession.completedSnapshot!.demographics.address === frozenAddress && !immutableSession.completedSnapshot!.reports[0].results.some((result) => result.formattedResultValue === "CHANGED AFTER COMPLETION"), "historical snapshot is independent from later mutable report data and is not recomputed");
try { immutableSession.completeSession(); throw new Error("expected completion guard"); } catch (error) { assert(error instanceof DomainInvariantError, "completed sessions cannot be completed/recomputed again"); }

const replacementSession = sessionFor(cbc);
replacementSession.completeSession();
const originalReplacementSnapshot = replacementSession.completedSnapshot!;
const originalReplacementSnapshotJson = JSON.stringify(originalReplacementSnapshot);
const replacementAnchors = {
  id: replacementSession.id,
  accessionNumber: replacementSession.accessionNumber,
  createdAt: replacementSession.createdAt,
  completedAt: replacementSession.completedAt,
  expiresAt: replacementSession.expiresAt,
};
replacementSession.reports[0] = applyEncodingResultValue(
  replacementSession.reports[0],
  cbc,
  "HEMOGLOBIN",
  "135",
  "NoEvaluation"
);
const recompletedSession = replacementSession.recompleteSession();
assert(
  recompletedSession !== replacementSession &&
    recompletedSession.completedSnapshot !== originalReplacementSnapshot &&
    JSON.stringify(recompletedSession.completedSnapshot) !== originalReplacementSnapshotJson &&
    replacementSession.completedSnapshot === originalReplacementSnapshot &&
    JSON.stringify(replacementSession.completedSnapshot) === originalReplacementSnapshotJson &&
    recompletedSession.id === replacementAnchors.id &&
    recompletedSession.accessionNumber === replacementAnchors.accessionNumber &&
    recompletedSession.createdAt === replacementAnchors.createdAt &&
    recompletedSession.completedAt === replacementAnchors.completedAt &&
    recompletedSession.expiresAt === replacementAnchors.expiresAt,
  "replacement re-completion recomposes a different aggregate snapshot while preserving the original snapshot and immutable identity anchors"
);
assert(
  recompletedSession.reports[0].signatories !== replacementSession.reports[0].signatories,
  "replacement re-completion isolates cloned report signatory arrays"
);

const nullCompletionAnchorSession = new PatientReportSessionAggregate({
  id: "completed-without-anchor",
  accessionNumber: "B5-NULL-ANCHOR",
  status: "Completed",
  demographics: demographics(),
  reports: [validReport(cbc)],
  completedAt: null,
});
try {
  nullCompletionAnchorSession.recompleteSession();
  throw new Error("expected completion-anchor guard");
} catch (error) {
  assert(
    error instanceof DomainInvariantError &&
      error.message === "Completed session requires a completion timestamp for re-completion.",
    "recompleteSession rejects a Completed session whose completedAt is null"
  );
}

const version2Snapshot = immutableSession.completedSnapshot!;
const legacyV1Reports = version2Snapshot.reports.map(({ renderContractVersion: _renderContractVersion, printedTitle: _printedTitle, staticContentVersion: _staticContentVersion, ...report }) => report);
const legacyV1Snapshot = cloneAndFreezeSnapshot({ ...version2Snapshot, snapshotVersion: 1, reports: legacyV1Reports });
assert(legacyV1Snapshot.snapshotVersion === 1 && legacyV1Snapshot.reports[0].printedTitle === undefined, "legacy snapshot v1 remains loadable without historically unavailable render metadata");
assert(legacyV1Snapshot.reports[0].results[0].formattedResultValue === version2Snapshot.reports[0].results[0].formattedResultValue, "legacy snapshot v1 clinical values remain snapshot-authoritative");

const legacyCompleted = new PatientReportSessionAggregate({ id: "legacy-completed", accessionNumber: "LEGACY-C", status: "Completed", demographics: demographics("LEGACY ADDRESS"), reports: [new LaboratoryReportDomain({ ...validReport(cbc), results: [new LaboratoryResultDomain({ ...validReport(cbc).results[0], resultValue: "LEGACY FINAL VALUE" })] })], completedAt: "2025-01-01T00:00:00.000Z", completedSnapshot: null });
assert(legacyCompleted.completedSnapshot === null && legacyCompleted.reports[0].results[0].resultValue === "LEGACY FINAL VALUE", "legacy completed rows remain authoritative and are not synthesized from current definitions");
const legacyDraft = new LaboratoryReportDomain({ id: "legacy-draft", sessionId: "legacy", templateCode: "CBC", templateTitle: "CBC", rendererFamily: "Tabular", results: [new LaboratoryResultDomain({ id: "legacy-rbc", reportId: "legacy-draft", parameterCode: "RBC", parameterName: "RBC", resultValue: "4.5", unit: null, evaluationOutcome: "NoEvaluation", displayOrder: 3 })], signatories: [] });
const loadedLegacyDraft = buildEncodingReport({ definition: cbc, sessionId: "legacy", reportId: "legacy-draft", rendererFamily: "Tabular", signatories: [], existingReport: legacyDraft, legacyRequestedBy: "Dr. Legacy" });
assert(loadedLegacyDraft.results.find((result) => result.parameterCode === "RBC_COUNT")?.resultValue === "4.5" && loadedLegacyDraft.encodingData?.requestedBy === "Dr. Legacy", "legacy drafts tolerate missing B5 fields and reconcile aliases without data loss");

const invalidDraft = sessionFor(chemistry, invalidChem);
assert(invalidDraft.status === "Draft", "incomplete or invalid reports remain valid draft aggregates and are saveable before completion");

const readNormalizedSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
const stripSqlComments = (source: string) => {
  let result = "";
  let state: "code" | "string" | "line-comment" | "block-comment" = "code";
  let blockCommentDepth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (state === "string") {
      result += character;
      if (character === "'" && nextCharacter === "'") {
        result += nextCharacter;
        index += 1;
      } else if (character === "'") {
        state = "code";
      }
      continue;
    }

    if (state === "line-comment") {
      if (character === "\n") {
        result += character;
        state = "code";
      } else {
        result += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (character === "/" && nextCharacter === "*") {
        result += "  ";
        index += 1;
        blockCommentDepth += 1;
      } else if (character === "*" && nextCharacter === "/") {
        result += "  ";
        index += 1;
        blockCommentDepth -= 1;
        if (blockCommentDepth === 0) state = "code";
      } else {
        result += character === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (character === "'") {
      result += character;
      state = "string";
    } else if (character === "-" && nextCharacter === "-") {
      result += "  ";
      index += 1;
      state = "line-comment";
    } else if (character === "/" && nextCharacter === "*") {
      result += "  ";
      index += 1;
      state = "block-comment";
      blockCommentDepth = 1;
    } else {
      result += character;
    }
  }

  return result;
};
const readNormalizedSqlSource = (relativePath: string) => stripSqlComments(readNormalizedSource(relativePath));
const liveCodeIndexOf = (source: string, occurrence: string, fromIndex = 0) => {
  let index = source.indexOf(occurrence, fromIndex);
  while (index >= 0) {
    const lineStart = source.lastIndexOf("\n", index - 1) + 1;
    const linePrefix = source.slice(lineStart, index);
    const blockCommentStart = source.lastIndexOf("/*", index);
    const blockCommentEnd = source.lastIndexOf("*/", index);
    if (!linePrefix.includes("//") && blockCommentStart <= blockCommentEnd) return index;
    index = source.indexOf(occurrence, index + occurrence.length);
  }
  return -1;
};
const liveCodeIndicesOf = (source: string, occurrence: string) => {
  const indices: number[] = [];
  let fromIndex = 0;
  while (fromIndex < source.length) {
    const index = liveCodeIndexOf(source, occurrence, fromIndex);
    if (index < 0) break;
    indices.push(index);
    fromIndex = index + occurrence.length;
  }
  return indices;
};
const extractBracedSource = (source: string, openingBraceIndex: number) => {
  if (openingBraceIndex < 0 || source[openingBraceIndex] !== "{") return "";
  let depth = 0;
  let state: "code" | "single-string" | "double-string" | "template-string" | "line-comment" | "block-comment" = "code";
  for (let index = openingBraceIndex; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (state === "line-comment") {
      if (character === "\n") state = "code";
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && nextCharacter === "/") {
        state = "code";
        index += 1;
      }
      continue;
    }
    if (state !== "code") {
      if (character === "\\") {
        index += 1;
      } else if (
        (state === "single-string" && character === "'") ||
        (state === "double-string" && character === '"') ||
        (state === "template-string" && character === "`")
      ) {
        state = "code";
      }
      continue;
    }

    if (character === "/" && nextCharacter === "/") {
      state = "line-comment";
      index += 1;
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      state = "block-comment";
      index += 1;
      continue;
    }
    if (character === "'") {
      state = "single-string";
      continue;
    }
    if (character === '"') {
      state = "double-string";
      continue;
    }
    if (character === "`") {
      state = "template-string";
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(openingBraceIndex, index + 1);
  }
  return "";
};
const topLevelShorthandPropertyKeys = (objectSource: string) => {
  if (objectSource.length === 0) return null;
  const parsedSource = ts.createSourceFile(
    "replacement-details.ts",
    `const replacementDetails = ${objectSource};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const declaration = parsedSource.statements[0];
  if (!declaration || !ts.isVariableStatement(declaration)) return null;
  const initializer = declaration.declarationList.declarations[0]?.initializer;
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) return null;

  const keys: string[] = [];
  for (const property of initializer.properties) {
    if (!ts.isShorthandPropertyAssignment(property) || !ts.isIdentifier(property.name)) return null;
    keys.push(property.name.text);
  }
  return keys;
};
const domainAggregateSource = readNormalizedSource("src/domain/models/patient-report-session-aggregate.ts");
const repositorySource = readNormalizedSource("src/repositories/supabase-session-repository.ts");
const serverActionsSource = readNormalizedSource("src/features/server-boundary/server-actions.ts");
const migrationSource = readNormalizedSqlSource("supabase/migrations/20260809104941_add_completed_report_snapshots.sql");
const evaluationMigrationSource = readNormalizedSqlSource("supabase/migrations/20260809140000_expand_evaluation_outcomes.sql");
const timestampedMigrationSources = readdirSync(join(process.cwd(), "supabase/migrations"))
  .filter((fileName) => /^\d{14}_.+\.sql$/.test(fileName))
  .sort((left, right) => left.localeCompare(right))
  .map((fileName) => ({
    fileName,
    source: readNormalizedSqlSource(`supabase/migrations/${fileName}`),
  }));
const resolveFunctionDefinition = (functionName: string) => {
  let newestDefinition: { migration: (typeof timestampedMigrationSources)[number]; start: number } | null = null;
  const definitionStartPattern = new RegExp(`CREATE OR REPLACE FUNCTION\\s+(?:public\\.)?${functionName}\\s*\\(`, "gi");

  for (const migration of timestampedMigrationSources) {
    for (const match of migration.source.matchAll(definitionStartPattern)) {
      newestDefinition = { migration, start: match.index };
    }
  }

  if (!newestDefinition) return { definitionSource: "", migrationSource: "", migrationFileName: "" };

  const { migration, start } = newestDefinition;
  const laterDefinitionMatch = /CREATE OR REPLACE FUNCTION\s+(?:public\.)?[A-Za-z_][A-Za-z0-9_]*\s*\(/i.exec(
    migration.source.slice(start + 1)
  );
  const definitionBoundary = laterDefinitionMatch
    ? start + 1 + laterDefinitionMatch.index
    : migration.source.length;
  const candidateSource = migration.source.slice(start, definitionBoundary);
  const bodyStartMatch = /\bAS\s+(\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$)/i.exec(candidateSource);
  if (!bodyStartMatch) {
    throw new Error(
      `FUNCTION RESOLUTION FAILED: ${functionName} has no AS dollar-quote tag in supabase/migrations/${migration.fileName}`
    );
  }

  const dollarQuoteTag = bodyStartMatch[1];
  const bodyStart = start + bodyStartMatch.index + bodyStartMatch[0].length;
  const terminator = `${dollarQuoteTag};`;
  const end = migration.source.indexOf(terminator, bodyStart);
  if (end < 0 || end >= definitionBoundary) {
    throw new Error(
      `FUNCTION RESOLUTION FAILED: ${functionName} has an unterminated definition in supabase/migrations/${migration.fileName}`
    );
  }

  return {
    definitionSource: migration.source.slice(start, end + terminator.length),
    migrationSource: migration.source,
    migrationFileName: migration.fileName,
  };
};
const functionDefinitionSource = (functionName: string) => resolveFunctionDefinition(functionName).definitionSource;
const resolveAccessionFunctionSource = functionDefinitionSource("resolve_session_accession_number");
const reportTreeFunctionSource = functionDefinitionSource("persist_session_report_tree");
const saveDraftFunctionSource = functionDefinitionSource("save_draft_session");
const completionFunctionSource = functionDefinitionSource("complete_patient_report_session");
const retentionFunctionSource = functionDefinitionSource("assert_session_within_retention");
const replacementFunctionSource = functionDefinitionSource("replace_completed_session");
const completionFunctionMigrationSource = resolveFunctionDefinition("complete_patient_report_session").migrationSource;
const recompleteSessionSource = domainAggregateSource.slice(
  domainAggregateSource.indexOf("  public recompleteSession("),
  domainAggregateSource.indexOf("  public replaceReport(")
);
const getRecentSessionsSource = repositorySource.slice(
  repositorySource.indexOf("  async getRecentSessions("),
  repositorySource.indexOf("  async saveDraft(")
);
const saveDraftSource = repositorySource.slice(
  repositorySource.indexOf("  async saveDraft("),
  repositorySource.indexOf("  async completeSession(")
);
const completeSessionSource = repositorySource.slice(
  repositorySource.indexOf("  async completeSession("),
  repositorySource.indexOf("  async replaceSession(")
);
const replaceSessionSource = repositorySource.slice(
  repositorySource.indexOf("  async replaceSession("),
  repositorySource.indexOf("  async purgeExpiredSessions(")
);
const replaceSessionActionDeclaration = "export async function replaceSessionAction(";
const replaceSessionActionStart = liveCodeIndexOf(serverActionsSource, replaceSessionActionDeclaration);
const replaceSessionActionEnd = replaceSessionActionStart >= 0
  ? serverActionsSource.indexOf(
      "\nexport async function",
      replaceSessionActionStart + replaceSessionActionDeclaration.length
    )
  : -1;
const replaceSessionActionSource = replaceSessionActionStart >= 0
  ? serverActionsSource.slice(
      replaceSessionActionStart,
      replaceSessionActionEnd >= 0 ? replaceSessionActionEnd : serverActionsSource.length
    )
  : "";
assert(replaceSessionActionStart >= 0, "replaceSessionAction exists and is exported");

const replaceActionCallerIndex = liveCodeIndexOf(
  replaceSessionActionSource,
  "const caller = await requireOperationalCaller();"
);
const replaceActionRepositoryIndex = liveCodeIndexOf(
  replaceSessionActionSource,
  "new SupabasePatientReportSessionRepository"
);
const replaceActionCallIndex = liveCodeIndexOf(
  replaceSessionActionSource,
  "repository.replaceSession("
);
assert(
  replaceActionCallerIndex >= 0 &&
    replaceActionRepositoryIndex > replaceActionCallerIndex &&
    replaceActionCallIndex > replaceActionRepositoryIndex,
  "replaceSessionAction authorizes before repository construction and replacement"
);

const replacementStatusGuardIndex = liveCodeIndexOf(
  replaceSessionActionSource,
  'if (transport.status !== "Completed") {'
);
const replacementStatusGuardSource = extractBracedSource(
  replaceSessionActionSource,
  replacementStatusGuardIndex >= 0
    ? replaceSessionActionSource.indexOf("{", replacementStatusGuardIndex)
    : -1
);
const replacementDenialEmitIndex = liveCodeIndexOf(
  replacementStatusGuardSource,
  "await auditService.emit({"
);
const replacementDenialEventIndex = liveCodeIndexOf(
  replacementStatusGuardSource,
  'eventType: "SessionReplacementDenied"'
);
const replacementDenialThrowIndex = liveCodeIndexOf(
  replacementStatusGuardSource,
  'throw new Error("Only completed sessions may be replaced.");'
);
assert(
  replacementStatusGuardIndex >= 0 &&
    replacementDenialEmitIndex >= 0 &&
    liveCodeIndexOf(replacementStatusGuardSource, 'category: "SecurityDenial"') > replacementDenialEmitIndex &&
    replacementDenialEventIndex > replacementDenialEmitIndex &&
    liveCodeIndexOf(replacementStatusGuardSource, "actorRole: caller.role") > replacementDenialEventIndex &&
    liveCodeIndexOf(replacementStatusGuardSource, "targetRole: null") > replacementDenialEventIndex &&
    liveCodeIndexOf(replacementStatusGuardSource, "performedByUserId: caller.userId") > replacementDenialEventIndex &&
    liveCodeIndexOf(replacementStatusGuardSource, "performedByUsername: caller.username") > replacementDenialEventIndex &&
    liveCodeIndexOf(replacementStatusGuardSource, 'details: { reasonCode: "session_not_completed" }') > replacementDenialEventIndex &&
    replacementDenialThrowIndex > replacementDenialEventIndex,
  "replaceSessionAction rejects non-completed input with the required SecurityDenial before throwing"
);

const replaceActionRecompletionIndex = liveCodeIndexOf(
  replaceSessionActionSource,
  "const replacement = fromSessionTransport(transport).recompleteSession();"
);
assert(
  replaceActionRecompletionIndex > replaceActionRepositoryIndex &&
    replaceActionRecompletionIndex < replaceActionCallIndex,
  "replaceSessionAction recompletes the session before calling replaceSession"
);

const replacementSuccessEventIndex = liveCodeIndexOf(
  replaceSessionActionSource,
  'eventType: "SessionReplaced"'
);
const replacementReturnIndex = liveCodeIndexOf(
  replaceSessionActionSource,
  "return toSessionTransport("
);
assert(
  replacementSuccessEventIndex > replaceActionCallIndex &&
    replacementReturnIndex > replacementSuccessEventIndex,
  "replaceSessionAction emits SessionReplaced only after successful replacement and before returning"
);
const awaitedReplacementCallIndex = liveCodeIndexOf(
  replaceSessionActionSource,
  "const replaced = await repository.replaceSession("
);
const replacementCallIndices = liveCodeIndicesOf(
  replaceSessionActionSource,
  "repository.replaceSession("
);
const allReplacementCallIndices = liveCodeIndicesOf(
  replaceSessionActionSource,
  "replaceSession("
);
assert(
  awaitedReplacementCallIndex >= 0 &&
    awaitedReplacementCallIndex < replacementSuccessEventIndex &&
    replacementCallIndices.length > 0 &&
    allReplacementCallIndices.length === replacementCallIndices.length &&
    allReplacementCallIndices.every(
      (index, callIndex) => index === replacementCallIndices[callIndex] + "repository.".length
    ) &&
    replacementCallIndices.every(
      (index) => replaceSessionActionSource.slice(index - "await ".length, index) === "await "
    ),
  "replaceSessionAction awaits replacement success before emitting SessionReplaced"
);

const postReplacementActionSource = replaceActionCallIndex >= 0
  ? replaceSessionActionSource.slice(replaceActionCallIndex)
  : "";
const replacementSuccessEmitIndex = liveCodeIndexOf(
  postReplacementActionSource,
  "await auditService.emit({"
);
const replacementSuccessEmitSource = extractBracedSource(
  postReplacementActionSource,
  replacementSuccessEmitIndex >= 0
    ? postReplacementActionSource.indexOf("{", replacementSuccessEmitIndex)
    : -1
);
assert(
  liveCodeIndexOf(replacementSuccessEmitSource, 'category: "SessionReport"') >= 0 &&
    liveCodeIndexOf(replacementSuccessEmitSource, 'eventType: "SessionReplaced"') >= 0 &&
    liveCodeIndexOf(replacementSuccessEmitSource, "targetReference: replaced.accessionNumber") >= 0,
  "replaceSessionAction emits SessionReplaced as SessionReport with the replaced accession reference"
);

const replacementDetailsPropertyIndex = liveCodeIndexOf(
  replacementSuccessEmitSource,
  "details: {"
);
const replacementDetailsSource = extractBracedSource(
  replacementSuccessEmitSource,
  replacementDetailsPropertyIndex >= 0
    ? replacementSuccessEmitSource.indexOf("{", replacementDetailsPropertyIndex)
    : -1
);
const prohibitedReplacementDetailFields = [
  "demographics",
  "patientName",
  "requestingPhysician",
  "resultValue",
  "rawResultValue",
  "formattedResultValue",
  "remarks",
  "signator",
  "signatories",
  "printedFullName",
  "printedCredentials",
  "prcLicense",
  "completedSnapshot",
] as const;
assert(
  replacementDetailsPropertyIndex >= 0 &&
    liveCodeIndexOf(replacementDetailsSource, "reportCount") >= 0 &&
    liveCodeIndexOf(replacementDetailsSource, "templateCodes") >= 0 &&
    prohibitedReplacementDetailFields.every(
      (field) => liveCodeIndexOf(replacementDetailsSource, field) < 0
    ),
  "SessionReplaced audit details contain only the non-clinical replacement summary"
);
const allowedReplacementDetailKeys = ["reportCount", "templateCodes"] as const;
const replacementDetailKeys = topLevelShorthandPropertyKeys(replacementDetailsSource);
assert(
  replacementDetailsSource.length > 0 &&
    replacementDetailKeys !== null &&
    replacementDetailKeys.length === allowedReplacementDetailKeys.length &&
    allowedReplacementDetailKeys.every(
      (key) =>
        replacementDetailKeys.includes(key) &&
        liveCodeIndexOf(replacementDetailsSource, key) >= 0
    ),
  "SessionReplaced audit details use exactly the shorthand reportCount and templateCodes properties"
);
assert(
  liveCodeIndexOf(
    replaceSessionActionSource,
    "const reportCount = replaced.reports.length;"
  ) >= 0 &&
    liveCodeIndexOf(
      replaceSessionActionSource,
      "const templateCodes = replaced.reports.map((report) => report.templateCode);"
    ) >= 0,
  "SessionReplaced audit summary derives reportCount and templateCodes from the replaced reports"
);
assert(
  liveCodeIndexOf(serverActionsSource, "developer_involved") < 0,
  "server actions never write developer_involved from application code"
);
assert(repositorySource.includes("encoding_data: report.encodingData") && repositorySource.includes("completed_snapshot: session.completedSnapshot"), "draft encoding data and completed snapshots are wired to persistence");
assert(repositorySource.includes("raw_result_value") && repositorySource.includes("formatted_result_value") && repositorySource.includes("computation_metadata"), "raw, formatted, and computation evidence are persisted and restored");
assert(migrationSource.includes("completed_snapshot JSONB") && migrationSource.includes("encoding_data JSONB") && migrationSource.includes("'Invalid'"), "additive migration supports frozen JSONB snapshots, draft encoding metadata, and invalid draft outcomes");
assert(evaluationMigrationSource.includes("'Low'") && evaluationMigrationSource.includes("'High'") && evaluationMigrationSource.includes("'Entered'") && evaluationMigrationSource.includes("'Abnormal'"), "additive evaluation migration permits new outcomes while retaining legacy compatibility");
assert(/CREATE OR REPLACE FUNCTION\s+complete_patient_report_session\s*\(payload jsonb\)[\s\S]*?SECURITY INVOKER/i.test(completionFunctionSource), "completion transaction function uses SECURITY INVOKER");
assert(/SECURITY INVOKER\s+SET search_path = public, pg_temp/i.test(completionFunctionSource), "completion transaction function pins its search_path");
const executeRevocation = completionFunctionMigrationSource.match(/REVOKE EXECUTE ON FUNCTION\s+complete_patient_report_session\s*\(jsonb\)\s+FROM\s+[^;]+;/i)?.[0] || "";
assert(/\bPUBLIC\b/.test(executeRevocation), "completion transaction function revokes EXECUTE from PUBLIC");
assert(/\banon\b/.test(executeRevocation), "completion transaction function revokes EXECUTE from anon");
assert(/\bauthenticated\b/.test(executeRevocation), "completion transaction function revokes EXECUTE from authenticated");
const functionPrivilegeGrants = Array.from(completionFunctionMigrationSource.matchAll(/GRANT\s+(EXECUTE|ALL(?:\s+PRIVILEGES)?)\s+ON\s+FUNCTION\s+(?:public\.)?complete_patient_report_session\s*\(jsonb\)\s+TO\s+([^;]+);/gi));
assert(functionPrivilegeGrants.length === 1 && functionPrivilegeGrants[0][1].toUpperCase() === "EXECUTE" && functionPrivilegeGrants[0][2].trim().toLowerCase() === "service_role", "completion transaction function grants EXECUTE strictly to service_role");
assert(!functionPrivilegeGrants.some((grant) => /\b(?:PUBLIC|anon|authenticated)\b/i.test(grant[2])), "completion transaction function never grants EXECUTE to PUBLIC, anon, or authenticated");
assert(completionFunctionSource.includes("target_session_id uuid := (payload -> 'session' ->> 'id')::uuid") && reportTreeFunctionSource.includes("target_report_id := (report_payload ->> 'id')::uuid") && !reportTreeFunctionSource.includes("report_payload ->> 'session_id'") && !reportTreeFunctionSource.includes("result_payload ->> 'report_id'") && !reportTreeFunctionSource.includes("signatory_payload ->> 'report_id'"), "completion transaction derives report and child parent keys from payload nesting");
const reportUpsertSource = reportTreeFunctionSource.slice(
  reportTreeFunctionSource.indexOf("INSERT INTO laboratory_reports"),
  reportTreeFunctionSource.indexOf("FOR result_payload IN")
);
const resultUpsertSource = reportTreeFunctionSource.slice(
  reportTreeFunctionSource.indexOf("INSERT INTO laboratory_results"),
  reportTreeFunctionSource.indexOf("END IF;", reportTreeFunctionSource.indexOf("INSERT INTO laboratory_results"))
);
assert(/ON CONFLICT\s*\(id\)\s*DO UPDATE SET[\s\S]*WHERE laboratory_reports\.session_id = target_session_id;/i.test(reportUpsertSource), "report upsert guards the locked conflicting row's session ownership");
assert(/ON CONFLICT\s*\(id\)\s*DO UPDATE SET[\s\S]*WHERE laboratory_results\.report_id = target_report_id;/i.test(resultUpsertSource), "result upsert guards the locked conflicting row's report ownership");
const writeCountFunctionSources = {
  written_session_count: [saveDraftFunctionSource, completionFunctionSource],
  written_report_count: [reportTreeFunctionSource],
  written_result_count: [reportTreeFunctionSource],
  written_signatory_count: [reportTreeFunctionSource],
} as const;
for (const [writeCountName, functionSources] of Object.entries(writeCountFunctionSources)) {
  const shortfallAssertion = new RegExp(`GET DIAGNOSTICS ${writeCountName} = ROW_COUNT;\\s*IF ${writeCountName} < 1 THEN\\s*RAISE EXCEPTION [^;]+;\\s*END IF;`, "i");
  assert(functionSources.every((functionSource) => shortfallAssertion.test(functionSource)), `completion transaction raises on a ${writeCountName.replace("written_", "").replace("_count", "")} write shortfall`);
}
assert(/GROUP BY \(report_element ->> 'id'\)::uuid\s+HAVING count\(\*\) > 1[\s\S]*duplicate report id/i.test(reportTreeFunctionSource), "completion transaction rejects duplicate report ids");
assert(/GROUP BY \(result_element ->> 'id'\)::uuid\s+HAVING count\(\*\) > 1[\s\S]*duplicate result id/i.test(reportTreeFunctionSource), "completion transaction rejects duplicate result ids across report nesting");
const resultValueTruthinessFilter = /IF\s+NOT\s+p_skip_empty_results\s+OR\s*\(\s*result_payload\s*->\s*'result_value'\s+IS\s+NOT\s+NULL\s+AND\s+result_payload\s*->\s*'result_value'\s*<>\s*'null'::jsonb\s+AND\s+result_payload\s*->\s*'result_value'\s*<>\s*'""'::jsonb\s+AND\s+result_payload\s*->\s*'result_value'\s*<>\s*'0'::jsonb\s+AND\s+result_payload\s*->\s*'result_value'\s*<>\s*'false'::jsonb\s*\)\s+THEN/i;
assert(resultValueTruthinessFilter.test(reportTreeFunctionSource), "completion transaction mirrors repository truthiness filtering for result values");
const sessionConflictUpdateSource = (functionSource: string) =>
  functionSource.match(/INSERT INTO patient_report_sessions\s*\([\s\S]*?ON CONFLICT\s*\(id\)\s*DO UPDATE SET([\s\S]*?);/i)?.[1] || "";
const saveDraftSessionConflictUpdateSource = sessionConflictUpdateSource(saveDraftFunctionSource);
const completionSessionConflictUpdateSource = sessionConflictUpdateSource(completionFunctionSource);
const retentionPredicateIndex = liveCodeIndexOf(
  getRecentSessionsSource,
  '.or(`status.eq.Draft,expires_at.is.null,expires_at.gte.${retentionTimestamp}`)'
);
assert(
  /const retentionTimestamp = new Date\(\)\.toISOString\(\);/.test(getRecentSessionsSource) &&
    retentionPredicateIndex >= 0,
  "getRecentSessions applies the retention predicate in the database query"
);
assert(!/\.filter\s*\(/.test(getRecentSessionsSource), "getRecentSessions does not perform retention exclusion in JavaScript");
assert(saveDraftSessionConflictUpdateSource.length > 0 && !/\baccession_number\b/i.test(saveDraftSessionConflictUpdateSource), "save_draft_session keeps accession_number out of its session conflict update");
assert(completionSessionConflictUpdateSource.length > 0 && !/\baccession_number\b/i.test(completionSessionConflictUpdateSource), "complete_patient_report_session keeps accession_number out of its session conflict update");
assert(!saveDraftSource.includes("accession_number") && !saveDraftSource.includes("session.accessionNumber") && !completeSessionSource.includes("accession_number") && !completeSessionSource.includes("session.accessionNumber"), "repository write payloads never submit or reference a client accession number");
const saveDraftAccessionResolutions = saveDraftFunctionSource.match(/v_accession\s*:=\s*resolve_session_accession_number\(target_session_id\);/g) || [];
const completionAccessionResolutions = completionFunctionSource.match(/v_accession\s*:=\s*resolve_session_accession_number\(target_session_id\);/g) || [];
assert(saveDraftAccessionResolutions.length === 1 && completionAccessionResolutions.length === 1 && !saveDraftFunctionSource.includes("allocate_accession_number") && !completionFunctionSource.includes("allocate_accession_number") && !saveDraftFunctionSource.includes("payload -> 'session' ->> 'accession_number'") && !completionFunctionSource.includes("payload -> 'session' ->> 'accession_number'"), "both persistence functions resolve accession server-side and never read a client accession value");
const advisoryLockIndex = resolveAccessionFunctionSource.indexOf("PERFORM pg_advisory_xact_lock(hashtextextended(target_session_id::text, 0));");
const accessionLookupIndex = resolveAccessionFunctionSource.indexOf("SELECT accession_number");
const nullAllocationBranch = resolveAccessionFunctionSource.match(/IF v_accession IS NULL THEN([\s\S]*?)END IF;/i)?.[1] || "";
assert(advisoryLockIndex >= 0 && accessionLookupIndex > advisoryLockIndex && (resolveAccessionFunctionSource.match(/allocate_accession_number\(\)/g) || []).length === 1 && nullAllocationBranch.includes("v_accession := allocate_accession_number();"), "accession resolution locks before lookup and allocates only on the null branch");
assert(/PERFORM persist_session_report_tree\(\s*target_session_id,\s*COALESCE\(payload -> 'reports', '\[\]'::jsonb\),\s*false,\s*false\s*\);/i.test(saveDraftFunctionSource) && /PERFORM persist_session_report_tree\(\s*target_session_id,\s*COALESCE\(payload -> 'reports', '\[\]'::jsonb\),\s*true,\s*true\s*\);/i.test(completionFunctionSource), "draft and completion delegate child writes with their exact filtering and signatory switches");
function assertServiceRoleOnlyFunction(functionName: string, signaturePattern: string, label: string): void {
  const { definitionSource: functionSource, migrationSource: authoritativeMigrationSource } = resolveFunctionDefinition(functionName);
  assert(/LANGUAGE plpgsql\s+SECURITY INVOKER\s+SET search_path = public, pg_temp/i.test(functionSource), `${label} is SECURITY INVOKER with a pinned search_path`);
  const revocation = authoritativeMigrationSource.match(new RegExp(`REVOKE EXECUTE ON FUNCTION\\s+${functionName}\\s*\\(${signaturePattern}\\)\\s+FROM\\s+([^;]+);`, "i"))?.[1] || "";
  assert(/\bPUBLIC\b/.test(revocation) && /\banon\b/.test(revocation) && /\bauthenticated\b/.test(revocation), `${label} revokes EXECUTE from PUBLIC, anon, and authenticated`);
  const grants = Array.from(authoritativeMigrationSource.matchAll(new RegExp(`GRANT\\s+(EXECUTE|ALL(?:\\s+PRIVILEGES)?)\\s+ON\\s+FUNCTION\\s+(?:public\\.)?${functionName}\\s*\\(${signaturePattern}\\)\\s+TO\\s+([^;]+);`, "gi")));
  assert(grants.length === 1 && grants[0][1].toUpperCase() === "EXECUTE" && grants[0][2].trim().toLowerCase() === "service_role", `${label} grants EXECUTE exactly once and only to service_role`);
}
assertServiceRoleOnlyFunction("resolve_session_accession_number", "uuid", "accession resolution function");
assertServiceRoleOnlyFunction("persist_session_report_tree", "uuid,\\s*jsonb,\\s*boolean,\\s*boolean", "report-tree persistence function");
assertServiceRoleOnlyFunction("save_draft_session", "jsonb", "draft transaction function");
assert(retentionFunctionSource.length > 0, "retention helper exists");
assertServiceRoleOnlyFunction("assert_session_within_retention", "uuid", "retention helper");
assert(replacementFunctionSource.length > 0, "completed-session replacement function exists");
assertServiceRoleOnlyFunction("replace_completed_session", "jsonb", "completed-session replacement function");
assert(/expires_at\s*<\s*now\(\)/i.test(retentionFunctionSource) && !/clock_timestamp\s*\(\)/i.test(retentionFunctionSource), "retention helper uses transaction-stable now() and never clock_timestamp()");
assert(/expires_at\s+IS\s+NOT\s+NULL/i.test(retentionFunctionSource), "retention helper treats a NULL expires_at as non-expiring");
for (const [label, functionSource] of [
  ["save_draft_session", saveDraftFunctionSource],
  ["complete_patient_report_session", completionFunctionSource],
] as const) {
  const retentionCheckIndex = liveCodeIndexOf(functionSource, "PERFORM assert_session_within_retention(target_session_id);");
  const accessionResolutionIndex = liveCodeIndexOf(functionSource, "resolve_session_accession_number(");
  const sessionInsertIndex = liveCodeIndexOf(functionSource, "INSERT INTO patient_report_sessions");
  assert(retentionCheckIndex >= 0, `${label} performs the authoritative retention check`);
  assert(retentionCheckIndex < accessionResolutionIndex && retentionCheckIndex < sessionInsertIndex, `${label} performs the retention check before accession resolution and the first session insert`);
}
const draftRpcIndex = saveDraftSource.indexOf('rpc("save_draft_session"');
assert(draftRpcIndex >= 0 && /const \{ data, error \} = await supabaseServer\.rpc\("save_draft_session", \{ payload \}\);\s*if \(error\) throw error;/.test(saveDraftSource), "saveDraft invokes the draft transaction RPC and throws its errors");
assert(!["patient_report_sessions", "laboratory_reports", "laboratory_results"].some((table) => saveDraftSource.includes(`.from("${table}")`)), "saveDraft contains no direct session, report, or result table write");
const draftCallerIndex = saveDraftSource.indexOf("this.requireCaller()");
const draftOwnershipIndex = saveDraftSource.indexOf("this.assertExistingSessionOwnership(session.id)");
const draftRetentionIndex = liveCodeIndexOf(saveDraftSource, "this.assertSessionWithinRetention(session.id)");
assert(draftCallerIndex >= 0 && draftOwnershipIndex > draftCallerIndex && draftRpcIndex > draftOwnershipIndex, "saveDraft requires its caller and verifies ownership before the draft transaction RPC");
assert(draftRetentionIndex > draftOwnershipIndex && draftRpcIndex > draftRetentionIndex, "saveDraft rejects expired completed sessions after ownership verification and before the draft transaction RPC");
const completionRpcIndex = completeSessionSource.indexOf('rpc("complete_patient_report_session"');
assert(completionRpcIndex >= 0, "completeSession invokes the completion transaction RPC");
assert(/const \{ data, error \} = await supabaseServer\.rpc\("complete_patient_report_session", \{ payload \}\);\s*if \(error\) throw error;/.test(completeSessionSource), "completeSession throws completion transaction RPC errors");
assert(!["patient_report_sessions", "laboratory_reports", "laboratory_results", "report_signatories"].some((table) => completeSessionSource.includes(`.from("${table}")`)), "completeSession contains no direct session, report, result, or signatory table write");
assert(completeSessionSource.indexOf("this.requireCaller()") >= 0 && completeSessionSource.indexOf("this.requireCaller()") < completionRpcIndex, "completeSession requires its caller before the completion transaction RPC");
const completionOwnershipIndex = completeSessionSource.indexOf("this.assertExistingSessionOwnership(session.id)");
const completionRetentionIndex = liveCodeIndexOf(completeSessionSource, "this.assertSessionWithinRetention(session.id)");
assert(completionOwnershipIndex >= 0 && completionOwnershipIndex < completionRpcIndex, "completeSession verifies existing session ownership before the completion transaction RPC");
assert(completionRetentionIndex > completionOwnershipIndex && completionRpcIndex > completionRetentionIndex, "completeSession rejects expired completed sessions after ownership verification and before the completion transaction RPC");
assert(completeSessionSource.indexOf("autoSuggestionLearningService.learnSuggestionsFromSessionDemographics") > completionRpcIndex, "completeSession learns auto-suggestions only after the completion transaction RPC");

const replacementBodyStart = replacementFunctionSource.indexOf("\nBEGIN");
const replacementBodySource = replacementBodyStart >= 0
  ? replacementFunctionSource.slice(replacementBodyStart + "\nBEGIN".length)
  : "";
assert(
  /^\s*PERFORM assert_session_within_retention\(target_session_id\);/i.test(replacementBodySource),
  "replacement transaction performs the authoritative retention check as its first statement"
);
assert(
  /SELECT\s+accession_number,\s*completed_at,\s*expires_at,\s*status\s+INTO\s+v_accession,\s*v_completed_at,\s*v_expires_at,\s*v_status\s+FROM\s+patient_report_sessions\s+WHERE\s+id\s*=\s*target_session_id\s+FOR UPDATE;/i.test(replacementFunctionSource) &&
    /IF NOT FOUND THEN\s*RAISE EXCEPTION [^;]+;\s*END IF;/i.test(replacementFunctionSource) &&
    /IF v_status\s*<>\s*'Completed' THEN\s*RAISE EXCEPTION [^;]+;\s*END IF;/i.test(replacementFunctionSource),
  "replacement transaction locks and validates the existing completed session"
);
const replacementSessionUpdateSource = replacementFunctionSource.match(
  /UPDATE patient_report_sessions\s+SET([\s\S]*?)\s+WHERE\s+id\s*=\s*target_session_id\s*;/i
)?.[1] || "";
assert(
  /\blast_replaced_at\s*=\s*now\(\)/i.test(replacementSessionUpdateSource),
  "replacement session UPDATE stamps last_replaced_at"
);
assert(
  replacementSessionUpdateSource.length > 0 &&
    !/\b(?:accession_number|created_at|completed_at|expires_at)\b/i.test(replacementSessionUpdateSource),
  "replacement session UPDATE preserves accession_number, created_at, completed_at, and expires_at"
);
assert(
  !/payload\s*->\s*'session'\s*->>\s*'completed_at'/i.test(replacementFunctionSource) &&
    !/payload\s*->\s*'session'\s*->>\s*'expires_at'/i.test(replacementFunctionSource),
  "replacement reads completed_at and expires_at from the stored session rather than the payload"
);
assert(
  /GET DIAGNOSTICS written_session_count = ROW_COUNT;\s*IF written_session_count < 1 THEN\s*RAISE EXCEPTION [^;]+;\s*END IF;/i.test(replacementFunctionSource),
  "replacement transaction raises on a session update shortfall"
);
const replacementDelegationIndex = liveCodeIndexOf(
  replacementFunctionSource,
  "PERFORM persist_session_report_tree("
);
const replacementBeforeDelegationSource = replacementDelegationIndex >= 0
  ? replacementFunctionSource.slice(0, replacementDelegationIndex)
  : "";
const staleReportDeleteSource = replacementBeforeDelegationSource.match(
  /DELETE FROM laboratory_reports[\s\S]*?;/i
)?.[0] || "";
const staleResultDeleteSource = replacementBeforeDelegationSource.match(
  /DELETE FROM laboratory_results[\s\S]*?;/i
)?.[0] || "";
const signatoryDeleteSource = replacementBeforeDelegationSource.match(
  /DELETE FROM report_signatories[\s\S]*?;/i
)?.[0] || "";
const firstReplacementDeleteIndex = replacementFunctionSource.search(/\bDELETE FROM\b/i);
const replacementBeforeFirstDeleteSource = firstReplacementDeleteIndex >= 0
  ? replacementFunctionSource.slice(0, firstReplacementDeleteIndex)
  : "";
assert(
  /report_element\s*->\s*'signatories'[\s\S]*GROUP BY\s*\(signatory_element\s*->>\s*'personnel_id'\)::uuid\s*HAVING count\(\*\) > 1[\s\S]*Payload contains a duplicate signatory personnel id within a report/i.test(
    replacementBeforeFirstDeleteSource
  ),
  "replacement transaction rejects duplicate signatory personnel ids within each report before cleanup"
);
assert(
  /report_element\s*->>\s*'id'\s+IS NULL[\s\S]*Payload contains a report with a null id/i.test(replacementBeforeFirstDeleteSource) &&
    /result_element\s*->>\s*'id'\s+IS NULL[\s\S]*Payload contains a result with a null id/i.test(replacementBeforeFirstDeleteSource) &&
    /signatory_element\s*->>\s*'personnel_id'\s+IS NULL[\s\S]*Payload contains a signatory with a null personnel_id/i.test(replacementBeforeFirstDeleteSource),
  "replacement transaction rejects null report, result, and signatory identifiers before cleanup"
);
assert(
  [staleReportDeleteSource, staleResultDeleteSource].every(
    (source) => /\bNOT EXISTS\s*\(/i.test(source) && !/\bNOT IN\b/i.test(source)
  ),
  "replacement cleanup uses null-safe NOT EXISTS for stale reports and results and never NOT IN"
);
assert(
  /session_id\s*=\s*target_session_id/i.test(staleReportDeleteSource) &&
    /NOT EXISTS\s*\([\s\S]*\(report_element\s*->>\s*'id'\)::uuid\s*=\s*stored_report\.id/i.test(staleReportDeleteSource),
  "replacement transaction deletes stale reports for only the target session before delegation"
);
assert(
  /session_id\s*=\s*target_session_id/i.test(staleResultDeleteSource) &&
    /NOT EXISTS\s*\([\s\S]*\(result_element\s*->>\s*'id'\)::uuid\s*=\s*stored_result\.id/i.test(staleResultDeleteSource),
  "replacement transaction deletes stale results for only the target session before delegation"
);
assert(
  /session_id\s*=\s*target_session_id/i.test(signatoryDeleteSource) &&
    !/\bNOT IN\b|payload\s*->/i.test(signatoryDeleteSource),
  "replacement transaction deletes all target-session signatories before delegation"
);
const replacementDeleteStatements = Array.from(
  replacementBeforeDelegationSource.matchAll(/DELETE FROM[\s\S]*?;/gi),
  (match) => match[0]
);
assert(
  replacementDeleteStatements.length === 3 &&
    replacementDeleteStatements.every((statement) => /\btarget_session_id\b/i.test(statement)),
  "replacement transaction scopes every cleanup DELETE to target_session_id"
);
const staleReportDeleteIndex = liveCodeIndexOf(replacementFunctionSource, "DELETE FROM laboratory_reports");
const staleResultDeleteIndex = liveCodeIndexOf(replacementFunctionSource, "DELETE FROM laboratory_results");
const signatoryDeleteIndex = liveCodeIndexOf(replacementFunctionSource, "DELETE FROM report_signatories");
assert(
  staleReportDeleteIndex >= 0 &&
    staleResultDeleteIndex > staleReportDeleteIndex &&
    signatoryDeleteIndex > staleResultDeleteIndex &&
    replacementDelegationIndex > signatoryDeleteIndex,
  "replacement transaction performs report, result, and signatory cleanup in order before delegation"
);
assert(
  /PERFORM persist_session_report_tree\(\s*target_session_id,\s*COALESCE\(payload -> 'reports', '\[\]'::jsonb\),\s*true,\s*true\s*\);/i.test(replacementFunctionSource),
  "replacement delegates report-tree persistence with exactly true, true"
);

assert(
  liveCodeIndexOf(domainAggregateSource, "  public recompleteSession(") >= 0,
  "recompleteSession exists"
);
const recompleteStatusGuardIndex = liveCodeIndexOf(recompleteSessionSource, 'if (this.status !== "Completed")');
const recompleteExpiryGuardIndex = liveCodeIndexOf(recompleteSessionSource, "if (this.isExpired())");
assert(
  recompleteStatusGuardIndex >= 0 && recompleteExpiryGuardIndex > recompleteStatusGuardIndex,
  "recompleteSession rejects non-completed and expired sessions"
);
const recompleteReturnIndex = liveCodeIndexOf(recompleteSessionSource, "return new PatientReportSessionAggregate(");
assert(
  recompleteReturnIndex >= 0 && liveCodeIndexOf(recompleteSessionSource, "this.completedSnapshot =") < 0,
  "recompleteSession returns a new aggregate without assigning to this.completedSnapshot"
);
const completionAnchorDeclarationIndex = liveCodeIndexOf(
  recompleteSessionSource,
  "const completionAnchor = this.completedAt;"
);
const completionAnchorNullGuardIndex = liveCodeIndexOf(
  recompleteSessionSource,
  "if (completionAnchor === null)"
);
const completionAnchorThrowIndex = liveCodeIndexOf(
  recompleteSessionSource,
  'throw new DomainInvariantError("Completed session requires a completion timestamp for re-completion.");'
);
const checkedCompletionCompositionIndex = liveCodeIndexOf(
  recompleteSessionSource,
  "ReportCompletionService.validateAndCompose(\n      replacementCandidate,\n      completionAnchor\n    )"
);
assert(
  completionAnchorDeclarationIndex > recompleteStatusGuardIndex &&
    completionAnchorNullGuardIndex > completionAnchorDeclarationIndex &&
    completionAnchorThrowIndex > completionAnchorNullGuardIndex &&
    checkedCompletionCompositionIndex > completionAnchorThrowIndex &&
    liveCodeIndexOf(recompleteSessionSource, "this.completedAt!") < 0,
  "recompleteSession rejects a null completion anchor and recomposes with the checked completedAt"
);
assert(
  liveCodeIndexOf(recompleteSessionSource, "signatories: [...report.signatories]") >= 0 &&
    liveCodeIndexOf(recompleteSessionSource, "signatories: report.signatories") < 0,
  "recompleteSession copies each report signatories array"
);
assert(
  liveCodeIndexOf(recompleteSessionSource, "completedSnapshot: snapshot") >= 0 &&
    liveCodeIndexOf(recompleteSessionSource, "completedSnapshot: this.completedSnapshot") < 0,
  "recompleteSession uses the newly recomposed snapshot rather than the original snapshot"
);

const replacementRpcIndex = liveCodeIndexOf(
  replaceSessionSource,
  'const { data, error } = await supabaseServer.rpc("replace_completed_session", { payload });'
);
const replacementRpcErrorIndex = liveCodeIndexOf(replaceSessionSource, "if (error) throw error;");
assert(
  replacementRpcIndex >= 0 && replacementRpcErrorIndex > replacementRpcIndex,
  "replaceSession invokes the replacement transaction RPC and throws its errors"
);
assert(
  liveCodeIndexOf(replaceSessionSource, "accession_number") < 0 &&
    liveCodeIndexOf(replaceSessionSource, "created_at") < 0 &&
    liveCodeIndexOf(replaceSessionSource, "created_by_user_id") < 0 &&
    liveCodeIndexOf(replaceSessionSource, "completed_at") < 0 &&
    liveCodeIndexOf(replaceSessionSource, "expires_at") < 0 &&
    liveCodeIndexOf(replaceSessionSource, "session.accessionNumber") < 0 &&
    liveCodeIndexOf(replaceSessionSource, "session.createdAt") < 0 &&
    liveCodeIndexOf(replaceSessionSource, "session.completedAt") < 0 &&
    liveCodeIndexOf(replaceSessionSource, "session.expiresAt") < 0,
  "replaceSession payload excludes database-owned anchors and dead creation or ownership fields"
);
const replacementCallerIndex = liveCodeIndexOf(replaceSessionSource, "this.requireCaller()");
const replacementOwnershipIndex = liveCodeIndexOf(
  replaceSessionSource,
  "this.assertExistingSessionOwnership(session.id)"
);
const replacementRetentionIndex = liveCodeIndexOf(
  replaceSessionSource,
  "this.assertSessionWithinRetention(session.id)"
);
assert(
  replacementCallerIndex >= 0 &&
    replacementOwnershipIndex > replacementCallerIndex &&
    replacementRetentionIndex > replacementOwnershipIndex &&
    replacementRpcIndex > replacementRetentionIndex,
  "replaceSession requires its caller, verifies ownership, and checks retention in order before the replacement RPC"
);
assert(
  liveCodeIndexOf(replaceSessionSource, "this.completeSession(") < 0,
  "replaceSession no longer delegates to completeSession"
);

console.log("=== ALL CHECKPOINT B5 VERIFICATION TESTS PASSED ===");
