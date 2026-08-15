/** Checkpoint B5: completion validation and immutable snapshot verification. */
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import { PatientReportSessionAggregate } from "../src/domain/models/patient-report-session-aggregate";
import { LaboratoryReportDomain, LaboratoryResultDomain } from "../src/domain/models/laboratory-report-domain";
import { buildEncodingReport, applyEncodingResultValue, applyParameterSelection } from "../src/features/workspace/encoding/report-encoding";
import type { ClinicalReportDefinition, ParameterSpec } from "../src/domain/types/report-definition";
import type { PatientDemographics, RendererFamily, SignatorySnapshot } from "../src/domain/types";
import { ValidationError, DomainInvariantError } from "../src/lib/errors";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
const liveCodeIndexOf = (source: string, occurrence: string) => {
  let index = source.indexOf(occurrence);
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
const repositorySource = readNormalizedSource("src/repositories/supabase-session-repository.ts");
const migrationSource = readNormalizedSource("supabase/migrations/20260809104941_add_completed_report_snapshots.sql");
const evaluationMigrationSource = readNormalizedSource("supabase/migrations/20260809140000_expand_evaluation_outcomes.sql");
const completionTransactionMigrationSource = readNormalizedSource("supabase/migrations/20260815180000_atomic_accession_assignment.sql");
const functionDefinitionSource = (functionName: string) => {
  const start = completionTransactionMigrationSource.indexOf(`CREATE OR REPLACE FUNCTION ${functionName}`);
  if (start < 0) return "";
  const end = completionTransactionMigrationSource.indexOf("$function$;", start);
  return end < 0 ? "" : completionTransactionMigrationSource.slice(start, end + "$function$;".length);
};
const resolveAccessionFunctionSource = functionDefinitionSource("resolve_session_accession_number");
const reportTreeFunctionSource = functionDefinitionSource("persist_session_report_tree");
const saveDraftFunctionSource = functionDefinitionSource("save_draft_session");
const completionFunctionSource = functionDefinitionSource("complete_patient_report_session");
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
assert(repositorySource.includes("encoding_data: report.encodingData") && repositorySource.includes("completed_snapshot: session.completedSnapshot"), "draft encoding data and completed snapshots are wired to persistence");
assert(repositorySource.includes("raw_result_value") && repositorySource.includes("formatted_result_value") && repositorySource.includes("computation_metadata"), "raw, formatted, and computation evidence are persisted and restored");
assert(migrationSource.includes("completed_snapshot JSONB") && migrationSource.includes("encoding_data JSONB") && migrationSource.includes("'Invalid'"), "additive migration supports frozen JSONB snapshots, draft encoding metadata, and invalid draft outcomes");
assert(evaluationMigrationSource.includes("'Low'") && evaluationMigrationSource.includes("'High'") && evaluationMigrationSource.includes("'Entered'") && evaluationMigrationSource.includes("'Abnormal'"), "additive evaluation migration permits new outcomes while retaining legacy compatibility");
assert(/CREATE OR REPLACE FUNCTION\s+complete_patient_report_session\s*\(payload jsonb\)[\s\S]*?SECURITY INVOKER/i.test(completionTransactionMigrationSource), "completion transaction function uses SECURITY INVOKER");
assert(/SECURITY INVOKER\s+SET search_path = public, pg_temp/i.test(completionFunctionSource), "completion transaction function pins its search_path");
const executeRevocation = completionTransactionMigrationSource.match(/REVOKE EXECUTE ON FUNCTION\s+complete_patient_report_session\s*\(jsonb\)\s+FROM\s+[^;]+;/i)?.[0] || "";
assert(/\bPUBLIC\b/.test(executeRevocation), "completion transaction function revokes EXECUTE from PUBLIC");
assert(/\banon\b/.test(executeRevocation), "completion transaction function revokes EXECUTE from anon");
assert(/\bauthenticated\b/.test(executeRevocation), "completion transaction function revokes EXECUTE from authenticated");
const functionPrivilegeGrants = Array.from(completionTransactionMigrationSource.matchAll(/GRANT\s+(EXECUTE|ALL(?:\s+PRIVILEGES)?)\s+ON\s+FUNCTION\s+(?:public\.)?complete_patient_report_session\s*\(jsonb\)\s+TO\s+([^;]+);/gi));
assert(functionPrivilegeGrants.length === 1 && functionPrivilegeGrants[0][1].toUpperCase() === "EXECUTE" && functionPrivilegeGrants[0][2].trim().toLowerCase() === "service_role", "completion transaction function grants EXECUTE strictly to service_role");
assert(!functionPrivilegeGrants.some((grant) => /\b(?:PUBLIC|anon|authenticated)\b/i.test(grant[2])), "completion transaction function never grants EXECUTE to PUBLIC, anon, or authenticated");
assert(completionTransactionMigrationSource.includes("target_session_id uuid := (payload -> 'session' ->> 'id')::uuid") && completionTransactionMigrationSource.includes("target_report_id := (report_payload ->> 'id')::uuid") && !completionTransactionMigrationSource.includes("report_payload ->> 'session_id'") && !completionTransactionMigrationSource.includes("result_payload ->> 'report_id'") && !completionTransactionMigrationSource.includes("signatory_payload ->> 'report_id'"), "completion transaction derives report and child parent keys from payload nesting");
const reportUpsertSource = completionTransactionMigrationSource.slice(
  completionTransactionMigrationSource.indexOf("INSERT INTO laboratory_reports", completionTransactionMigrationSource.indexOf("CREATE OR REPLACE FUNCTION persist_session_report_tree")),
  completionTransactionMigrationSource.indexOf("FOR result_payload IN", completionTransactionMigrationSource.indexOf("CREATE OR REPLACE FUNCTION persist_session_report_tree"))
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
assert(saveDraftAccessionResolutions.length === 1 && completionAccessionResolutions.length === 1 && !saveDraftFunctionSource.includes("allocate_accession_number") && !completionFunctionSource.includes("allocate_accession_number") && !completionTransactionMigrationSource.includes("payload -> 'session' ->> 'accession_number'"), "both persistence functions resolve accession server-side and never read a client accession value");
const advisoryLockIndex = resolveAccessionFunctionSource.indexOf("PERFORM pg_advisory_xact_lock(hashtextextended(target_session_id::text, 0));");
const accessionLookupIndex = resolveAccessionFunctionSource.indexOf("SELECT accession_number");
const nullAllocationBranch = resolveAccessionFunctionSource.match(/IF v_accession IS NULL THEN([\s\S]*?)END IF;/i)?.[1] || "";
assert(advisoryLockIndex >= 0 && accessionLookupIndex > advisoryLockIndex && (resolveAccessionFunctionSource.match(/allocate_accession_number\(\)/g) || []).length === 1 && nullAllocationBranch.includes("v_accession := allocate_accession_number();"), "accession resolution locks before lookup and allocates only on the null branch");
assert(/PERFORM persist_session_report_tree\(\s*target_session_id,\s*COALESCE\(payload -> 'reports', '\[\]'::jsonb\),\s*false,\s*false\s*\);/i.test(saveDraftFunctionSource) && /PERFORM persist_session_report_tree\(\s*target_session_id,\s*COALESCE\(payload -> 'reports', '\[\]'::jsonb\),\s*true,\s*true\s*\);/i.test(completionFunctionSource), "draft and completion delegate child writes with their exact filtering and signatory switches");
function assertServiceRoleOnlyFunction(functionName: string, signaturePattern: string, label: string): void {
  const functionSource = functionDefinitionSource(functionName);
  assert(/LANGUAGE plpgsql\s+SECURITY INVOKER\s+SET search_path = public, pg_temp/i.test(functionSource), `${label} is SECURITY INVOKER with a pinned search_path`);
  const revocation = completionTransactionMigrationSource.match(new RegExp(`REVOKE EXECUTE ON FUNCTION\\s+${functionName}\\s*\\(${signaturePattern}\\)\\s+FROM\\s+([^;]+);`, "i"))?.[1] || "";
  assert(/\bPUBLIC\b/.test(revocation) && /\banon\b/.test(revocation) && /\bauthenticated\b/.test(revocation), `${label} revokes EXECUTE from PUBLIC, anon, and authenticated`);
  const grants = Array.from(completionTransactionMigrationSource.matchAll(new RegExp(`GRANT\\s+(EXECUTE|ALL(?:\\s+PRIVILEGES)?)\\s+ON\\s+FUNCTION\\s+(?:public\\.)?${functionName}\\s*\\(${signaturePattern}\\)\\s+TO\\s+([^;]+);`, "gi")));
  assert(grants.length === 1 && grants[0][1].toUpperCase() === "EXECUTE" && grants[0][2].trim().toLowerCase() === "service_role", `${label} grants EXECUTE exactly once and only to service_role`);
}
assertServiceRoleOnlyFunction("resolve_session_accession_number", "uuid", "accession resolution function");
assertServiceRoleOnlyFunction("persist_session_report_tree", "uuid,\\s*jsonb,\\s*boolean,\\s*boolean", "report-tree persistence function");
assertServiceRoleOnlyFunction("save_draft_session", "jsonb", "draft transaction function");
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

console.log("=== ALL CHECKPOINT B5 VERIFICATION TESTS PASSED ===");
