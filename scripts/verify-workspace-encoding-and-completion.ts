/**
 * WORKSPACE-QA-01: completion validation routing, renderer compatibility, Encoding column policy.
 *
 * Three Workspace defects proved together, because all three share one failure mode - a rule that
 * was stated in one place and then resolved from another:
 *
 *   - RENDERER COMPATIBILITY. The live registry row supplies `rendererFamily` to the draft
 *     aggregate, and completion froze that value into the snapshot, while the composition a report
 *     is laid out by is resolved from the declarative definition. For ESR, CT_BT and FECALYSIS the
 *     two disagree, so a newly completed report could not be rendered at all: the composer's
 *     coherence guard refused it. Every one of the 17 examinations is proved here against the
 *     registry's own families, not against families derived from the definition - a fixture that
 *     derives both sides from the definition is structurally incapable of reproducing the defect,
 *     which is exactly why the existing C-series gates did not catch it.
 *
 *   - COMPLETION VALIDATION ROUTING. The Workspace pre-validated two demographics fields, and
 *     every other blocking condition arrived as one generic sentence with nothing to route on. The
 *     blocking conditions are now collected as CLOSED, structured issues carrying a kind, a
 *     template code and a parameter or field code - never a human-readable message - so the
 *     summary can name the examination and focus the field without parsing any prose.
 *
 *   - ENCODING COLUMN POLICY. Which worksheet columns an examination shows is declared once, on
 *     the definition, and resolved once. No component branches on a template code.
 *
 * INVOCATION: WITHOUT `--conditions=react-server`. This verifier renders the Encoding worksheet
 * through `react-dom/server`, which the react-server condition forbids.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/verify-workspace-encoding-and-completion.ts
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import { ReportCompletionService } from "../src/domain/completion/report-completion-service";
import type { CompletionIssue } from "../src/domain/completion/completion-issues";
import { LaboratoryReportDomain } from "../src/domain/models/laboratory-report-domain";
import {
  collectSessionCompletionIssues,
  isReportCompletable,
} from "../src/domain/completion/report-completion-service";
import { persistedRendererFamily } from "../src/domain/renderer-family";
import { SYSTEM_CONSTANTS } from "../src/lib/constants";
import { isRoutedInvalidControl } from "../src/app/(dashboard)/workspace/_lib/encoding/completion-issue-routing";
import { calculateExpirationDate } from "../src/lib/utils";
import { resolveCompletedSessionRenderModel, resolveSessionRenderModel } from "../src/rendering/model";
import { composeNativeLivePreviewReportPage } from "../src/rendering/native/live-preview-composer";
import { INITIAL_REPORT_TEMPLATES } from "../src/services/registry-seed-data";
import { applyEncodingResultValue, applyParameterSelection, buildEncodingReport } from "../src/app/(dashboard)/workspace/_lib/encoding/report-encoding";
import { resolveWorksheetColumnPolicy } from "../src/app/(dashboard)/workspace/_lib/encoding/worksheet-columns";
import { getReportEncodingProgress } from "../src/app/(dashboard)/workspace/_lib/encoding/encoding-progress";
import type { ILaboratoryReport, IPatientReportSession } from "../src/domain/models/interfaces";
import type { PatientDemographics, RendererFamily, SignatorySnapshot } from "../src/domain/types";
import type { ClinicalReportDefinition, ParameterSpec } from "../src/domain/types/report-definition";

/**
 * The worksheet is loaded the way checkpoint B4 loads it: RequestedBySection reaches the Workspace
 * server-action modules, which are an RPC boundary the browser never loads locally, so they are
 * stubbed in the require cache. That leaves the `server-only` marker itself untouched and keeps the
 * privileged Supabase client out of this process entirely.
 */
const workspaceRequire = createRequire(join(process.cwd(), "package.json"));
function stubModule(relativePath: string, exports: Record<string, unknown>): void {
  const id = workspaceRequire.resolve(join(process.cwd(), relativePath));
  workspaceRequire.cache[id] = { id, filename: id, loaded: true, children: [], paths: [], exports } as never;
}
stubModule("src/features/server-boundary/server-actions", { listAutoSuggestionsAction: async () => [] });
stubModule("src/app/(dashboard)/workspace/_actions/workspace-physician-actions", {
  listWorkspacePhysiciansAction: async () => [],
});
const { DynamicResultForm } = workspaceRequire(
  join(process.cwd(), "src/app/(dashboard)/workspace/_components/DynamicResultForm")
) as { DynamicResultForm: unknown };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`❌ Workspace encoding/completion verification failed: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

const ALL_TEMPLATE_CODES = [
  "CBC", "ESR", "CT_BT", "CHEM_8", "CHEM_10", "HDL_LDL", "RBS", "HBA1C", "FECALYSIS",
  "URINALYSIS", "HBSAG", "RPR", "PREG_TEST", "DENGUE_DUO", "HIV_RESULT", "BLOOD_TYPING", "OGTT",
] as const;

/** The eight worksheets the client asked to reflow to Parameter / Result / Status. */
const COLUMN_OMITTING_CODES = [
  "BLOOD_TYPING", "HBSAG", "RPR", "PREG_TEST", "DENGUE_DUO", "URINALYSIS", "FECALYSIS", "HIV_RESULT",
] as const;

const demographics: PatientDemographics = {
  fullName: "QA WORKSPACE SYNTHETIC",
  age: 31,
  ageUnit: "years",
  sex: "Female",
  address: "Santa Rosa",
  patientStatus: "OutPatient",
  examinationDate: "2026-09-12",
  requestingPhysician: "",
  referrerName: "",
  companyName: "",
};

function pathologist(): SignatorySnapshot {
  return {
    personnelId: "pathologist",
    role: "Pathologist",
    printedFullName: "DR. PATHOLOGIST",
    printedCredentials: "MD, FPSP",
    printedPrcLicenseNumber: "P-100",
    signatureImageUrl: null,
    displayOrder: 1,
  };
}

function medtech(index: number): SignatorySnapshot {
  return {
    personnelId: `medtech-${index}`,
    role: "MedicalTechnologist",
    printedFullName: `MEDICAL TECHNOLOGIST ${index}`,
    printedCredentials: "RMT",
    printedPrcLicenseNumber: `M-${200 + index}`,
    signatureImageUrl: null,
    displayOrder: 1 + index,
  };
}

function signatoriesFor(definition: ClinicalReportDefinition): SignatorySnapshot[] {
  const medtechs = definition.signatoryRequirements?.requiredMedtechsCount ?? 1;
  return [pathologist(), ...Array.from({ length: medtechs }, (_, index) => medtech(index + 1))];
}

function inputValue(parameter: ParameterSpec): string {
  if (parameter.parameterCode === "CHOLESTEROL") return "250";
  if (parameter.parameterCode === "TRIGLYCERIDES") return "700";
  if (parameter.inputType === "Computed") return "";
  if (parameter.inputType === "NumericText") return "100";
  if (parameter.conditionalChoiceSpec) {
    return `${parameter.conditionalChoiceSpec.labelChoices[0]}: ${parameter.conditionalChoiceSpec.resultOptions[0]}`;
  }
  return parameter.defaultValue?.trim() || parameter.options?.[0] || "EXACT VALUE";
}

/**
 * The renderer family the LIVE REGISTRY carries for a template - the production pairing, and the
 * one the existing gates never exercised.
 */
function registryRendererFamily(templateCode: string): RendererFamily {
  const template = INITIAL_REPORT_TEMPLATES.find((candidate) => candidate.templateCode === templateCode);
  if (!template) throw new Error(`No registry row for '${templateCode}'.`);
  return template.rendererFamily;
}

function definitionOf(templateCode: string): ClinicalReportDefinition {
  const definition = ReportDefinitionRegistry.getDefinition(templateCode);
  if (!definition) throw new Error(`No definition for '${templateCode}'.`);
  return definition;
}

function withResult(
  report: ILaboratoryReport,
  definition: ClinicalReportDefinition,
  parameterCode: string,
  value: string
): ILaboratoryReport {
  return applyEncodingResultValue(report, definition, parameterCode, value, "NoEvaluation", {
    sex: demographics.sex,
  });
}

function reportFor(definition: ClinicalReportDefinition, rendererFamily: RendererFamily): ILaboratoryReport {
  let report: ILaboratoryReport = buildEncodingReport({
    definition,
    sessionId: "session-qa01",
    reportId: `report-${definition.templateCode}`,
    rendererFamily,
    signatories: signatoriesFor(definition),
  });
  for (const parameter of definition.parameters) {
    if (parameter.inputType === "Computed") continue;
    report = withResult(report, definition, parameter.parameterCode, inputValue(parameter));
  }
  if (definition.requiresKitInfo) {
    report = new LaboratoryReportDomain({
      ...report,
      reagentKitInfo: { kitBrand: "EXACT KIT", lotNumber: "LOT-QA01", expirationDate: "2028-12-31" },
    });
  }
  const requiredAdditionalFields = (definition.additionalEncodingFields || []).filter((field) => field.isRequired);
  if (requiredAdditionalFields.length > 0) {
    report = new LaboratoryReportDomain({
      ...report,
      encodingData: {
        ...(report.encodingData || {}),
        additionalFields: {
          ...(report.encodingData?.additionalFields || {}),
          ...Object.fromEntries(
            requiredAdditionalFields.map((field) => [
              field.fieldCode,
              field.options?.[0] ?? "2026-09-12T08:00",
            ])
          ),
        },
      },
    });
  }
  return report;
}

function sessionFor(reports: ILaboratoryReport[]): IPatientReportSession {
  return {
    id: "session-qa01",
    accessionNumber: "ACC-QA01",
    status: "Draft",
    demographics,
    reports,
    createdAt: "2026-09-12T00:00:00.000Z",
    completedAt: null,
  };
}

// ── Renderer compatibility: every examination completes and composes from the REGISTRY pairing ──

console.log("\n-- Renderer compatibility --");

const mismatchedCodes: string[] = [];
for (const templateCode of ALL_TEMPLATE_CODES) {
  const definition = definitionOf(templateCode);
  if (registryRendererFamily(templateCode) !== persistedRendererFamily(definition.rendererFamily)) {
    mismatchedCodes.push(templateCode);
  }
}
// The negative control for every assertion below: if the registry and the definitions agreed
// everywhere, the registry-paired fixture would prove nothing, because it would be identical to
// the definition-paired fixture the existing gates already build.
assert(
  mismatchedCodes.length > 0,
  `the registry and the definitions still disagree for at least one examination - measured ${mismatchedCodes.join(", ") || "none"}`
);

for (const templateCode of ALL_TEMPLATE_CODES) {
  const definition = definitionOf(templateCode);
  const report = reportFor(definition, registryRendererFamily(templateCode));
  const snapshot = ReportCompletionService.validateAndCompose(
    sessionFor([report]),
    "2026-09-12T01:00:00.000Z"
  );
  assert(
    snapshot.reports.length === 1 && snapshot.reports[0].templateCode === templateCode,
    `${templateCode} composes exactly one completed report snapshot`
  );
  assert(
    snapshot.reports[0].rendererFamily === persistedRendererFamily(definition.rendererFamily),
    `${templateCode} freezes the definition's renderer family - measured "${snapshot.reports[0].rendererFamily}"`
  );
  const resolved = resolveCompletedSessionRenderModel(snapshot, ReportDefinitionRegistry, {
    accessionNumber: "ACC-QA01",
  });
  const completedPage = composeNativeLivePreviewReportPage(resolved, resolved.reports[0]);
  assert(
    completedPage.templateCode === templateCode && completedPage.primitives.length > 0,
    `${templateCode} composes a Live Preview page from its completed snapshot - measured ${completedPage.primitives.length} primitive(s)`
  );
}

// A snapshot already stored with the registry's family - the live rows this defect produced -
// still renders, and renders through the definition's layout rather than being refused.
for (const templateCode of mismatchedCodes) {
  const definition = definitionOf(templateCode);
  const report = reportFor(definition, registryRendererFamily(templateCode));
  const snapshot = ReportCompletionService.validateAndCompose(
    sessionFor([report]),
    "2026-09-12T01:00:00.000Z"
  );
  const legacySnapshot = {
    ...snapshot,
    reports: snapshot.reports.map((entry) => ({
      ...entry,
      rendererFamily: registryRendererFamily(templateCode),
    })),
  };
  const resolvedLegacy = resolveCompletedSessionRenderModel(legacySnapshot, ReportDefinitionRegistry, {
    accessionNumber: "ACC-QA01",
  });
  const page = composeNativeLivePreviewReportPage(resolvedLegacy, resolvedLegacy.reports[0]);
  const draftResolved = resolveSessionRenderModel(sessionFor([report]), ReportDefinitionRegistry);
  const draftPage = composeNativeLivePreviewReportPage(draftResolved, draftResolved.reports[0]);
  assert(
    page.compositionSource === draftPage.compositionSource,
    `a ${templateCode} snapshot stored with the registry's family composes through the same layout as its draft - measured "${page.compositionSource}" against "${draftPage.compositionSource}"`
  );
}

// ── Encoding column policy ──

console.log("\n-- Encoding column policy --");

for (const templateCode of ALL_TEMPLATE_CODES) {
  const definition = definitionOf(templateCode);
  const policy = resolveWorksheetColumnPolicy(definition);
  const omits = (COLUMN_OMITTING_CODES as readonly string[]).includes(templateCode);
  assert(
    policy.showUnitColumn === !omits && policy.showReferenceColumn === !omits,
    `${templateCode} ${omits ? "omits" : "keeps"} the Unit and Reference worksheet columns`
  );

  const report = reportFor(definition, registryRendererFamily(templateCode));
  const markup = renderToStaticMarkup(
    React.createElement(DynamicResultForm as never, {
      definition,
      report,
      patientSex: demographics.sex,
      onChangeReport: () => undefined,
    } as never)
  );
  assert(
    markup.includes(">Unit<") === !omits && markup.includes(">Reference<") === !omits,
    `${templateCode} ${omits ? "renders no" : "renders a"} Unit and Reference column header`
  );
  assert(
    markup.includes(policy.rowTracks.split(" ")[0]),
    `${templateCode} renders the worksheet with its resolved grid tracks`
  );
  if (omits) {
    assert(
      !markup.includes("data-reference-display"),
      `${templateCode} renders no reference cell in the worksheet`
    );
  }
  // A fixed suffix is part of the result expression, not a column: it stays visible on a worksheet
  // whose Unit column is gone, which is what keeps "/HPF" in front of the operator.
  const suffixParameters = definition.parameters.filter((parameter) => parameter.suffixSpec);
  for (const parameter of suffixParameters) {
    assert(
      markup.includes('data-fixed-suffix="true"') && markup.includes(parameter.suffixSpec!.suffix.trim()),
      `${templateCode}/${parameter.parameterCode} keeps its fixed suffix visible outside the editable value`
    );
  }
}

// ── Completion validation routing ──

console.log("\n-- Completion validation routing --");

const cbc = definitionOf("CBC");
const urinalysis = definitionOf("URINALYSIS");

// A complete, valid session raises no issue at all, for every examination at once.
const completeReports = ALL_TEMPLATE_CODES.map((templateCode) =>
  reportFor(definitionOf(templateCode), registryRendererFamily(templateCode))
);
assert(
  collectSessionCompletionIssues(sessionFor(completeReports)).length === 0,
  "a valid 17-examination session raises no completion issue"
);

// The patient name reaches completion. A typed name is never reported missing.
const namedSession = sessionFor([reportFor(cbc, registryRendererFamily("CBC"))]);
assert(
  !collectSessionCompletionIssues(namedSession).some((issue: CompletionIssue) => issue.kind === "PatientFullNameRequired"),
  "a session carrying a patient name raises no missing-name issue"
);
const blankNameSession = {
  ...namedSession,
  demographics: { ...demographics, fullName: "   " },
};
const blankNameIssues = collectSessionCompletionIssues(blankNameSession);
assert(
  blankNameIssues.some((issue: CompletionIssue) => issue.kind === "PatientFullNameRequired" && issue.templateCode === null),
  "a blank patient name raises exactly the missing-name issue, against no examination"
);

// Requested By is a per-report field and is never confused with the patient name.
assert(
  blankNameIssues.every((issue: CompletionIssue) => issue.kind !== "RequestedByRequired"),
  "a blank patient name never presents as a Requested By failure"
);

// A blocking result failure names its own examination AND its own parameter, with no prose.
const invalidResultReport = withResult(reportFor(cbc, registryRendererFamily("CBC")), cbc, "HEMOGLOBIN", "not-a-number");
const resultIssues = collectSessionCompletionIssues(sessionFor([invalidResultReport]));
// The kind is whichever of the two result rules reported last, exactly as the message for this key
// has always been: a non-numeric entry is also an Invalid evaluation, and both write one entry. What
// the routing needs, and what is asserted, is that the issue names this examination and this
// parameter.
assert(
  resultIssues.some(
    (issue: CompletionIssue) =>
      (issue.kind === "ResultNotNumeric" || issue.kind === "ResultInvalid") &&
      issue.templateCode === "CBC" &&
      issue.parameterCode === "HEMOGLOBIN"
  ),
  "a non-numeric CBC result routes to CBC/HEMOGLOBIN"
);
assert(
  resultIssues.every((issue: CompletionIssue) => !Object.values(issue).some((value) => typeof value === "string" && value.includes(" "))),
  "no completion issue carries a human-readable sentence for the UI to parse"
);

// A failure in a NON-ACTIVE report is still reported, and still names that report.
const multiSession = sessionFor([
  reportFor(cbc, registryRendererFamily("CBC")),
  withResult(reportFor(urinalysis, registryRendererFamily("URINALYSIS")), urinalysis, "COLOR", "   "),
]);
const multiIssues = collectSessionCompletionIssues(multiSession);
assert(
  multiIssues.every((issue: CompletionIssue) => issue.templateCode !== "CBC"),
  "a valid examination in a multi-examination session raises no issue of its own"
);

// A CHECKED parameter left blank is NOT a blocking issue - the approved omission rule - and a
// report carrying at least one result stays completable.
const blankUrinalysis = withResult(reportFor(urinalysis, registryRendererFamily("URINALYSIS")), urinalysis, "COLOR", "   ");
assert(
  collectSessionCompletionIssues(sessionFor([blankUrinalysis])).length === 0,
  "a checked URINALYSIS parameter left blank raises no completion issue"
);
assert(
  isReportCompletable(sessionFor([blankUrinalysis]), blankUrinalysis),
  "a URINALYSIS report with one blank checked parameter is still completable"
);

// An EMPTY report is not completable, and says why against itself.
let emptyUrinalysis: ILaboratoryReport = reportFor(urinalysis, registryRendererFamily("URINALYSIS"));
for (const parameter of urinalysis.parameters) {
  emptyUrinalysis = withResult(emptyUrinalysis, urinalysis, parameter.parameterCode, "");
}
assert(
  !isReportCompletable(sessionFor([emptyUrinalysis]), emptyUrinalysis),
  "a URINALYSIS report with no result at all is not completable"
);
assert(
  collectSessionCompletionIssues(sessionFor([emptyUrinalysis])).some(
    (issue: CompletionIssue) => issue.kind === "ReportHasNoResult" && issue.templateCode === "URINALYSIS"
  ),
  "a report with no result raises ReportHasNoResult against its own examination"
);

// ONE owner for completability. The encoded tally and the completion rule answer different
// questions, and the progress module must not answer the second one: a local copy of "can this be
// completed" was free to drift from the rule the Complete button enforces, which is the
// disagreement the operator experiences as a session refused while the queue says it is ready.
const tallyProgress = getReportEncodingProgress(blankUrinalysis, urinalysis);
assert(
  !("isCompletable" in tallyProgress),
  "the encoding tally exposes no completability flag of its own"
);
assert(
  tallyProgress.completedCount < tallyProgress.selectedCount && isReportCompletable(sessionFor([blankUrinalysis]), blankUrinalysis),
  `a partly encoded report is still completable - measured ${tallyProgress.completedCount}/${tallyProgress.selectedCount}`
);

// An examination with no registered definition fails CLOSED rather than disappearing.
const unregistered = {
  ...reportFor(cbc, registryRendererFamily("CBC")),
  templateCode: "NOT_A_TEMPLATE",
} as ILaboratoryReport;
assert(
  collectSessionCompletionIssues(sessionFor([unregistered])).some(
    (issue: CompletionIssue) => issue.kind === "ReportDefinitionMissing" && issue.templateCode === "NOT_A_TEMPLATE"
  ),
  "an examination with no registered definition raises a named, actionable issue"
);

// The domain still throws for the same session, with the same field-error keys it always carried.
let threw = false;
try {
  ReportCompletionService.validateAndCompose(blankNameSession, "2026-09-12T01:00:00.000Z");
} catch (error: unknown) {
  threw = true;
  const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors ?? {};
  assert(
    Object.keys(fieldErrors).includes("demographics.fullName"),
    "the thrown ValidationError still carries its established fieldErrors keys"
  );
}
assert(threw, "completion still refuses an invalid session by throwing");

// -- Draft Live Preview row visibility --
//
// SELECTION decides whether a row appears on the draft sheet; the entered value decides only what
// the row says. Asserted across a numeric, a select, a free-text and a computed examination,
// because one rule has to hold for all of them - and asserted in BOTH directions, so a regression
// that restores blank-row omission fails here rather than being noticed by an operator.

console.log("\n-- Draft Live Preview row visibility --");

function draftRow(
  definition: ClinicalReportDefinition,
  report: ILaboratoryReport,
  parameterCode: string
) {
  const model = resolveSessionRenderModel(sessionFor([report]), ReportDefinitionRegistry);
  const row = model.reports[0].results.find((result) => result.parameterCode === parameterCode);
  if (!row) throw new Error(`No draft row for ${definition.templateCode}/${parameterCode}.`);
  return row;
}

function blankedReport(definition: ClinicalReportDefinition): ILaboratoryReport {
  let report = reportFor(definition, registryRendererFamily(definition.templateCode));
  for (const parameter of definition.parameters) {
    report = withResult(report, definition, parameter.parameterCode, "");
  }
  return report;
}

for (const [templateCode, parameterCode] of [
  ["CBC", "HEMOGLOBIN"],
  ["HBSAG", "HBSAG_RESULT"],
  ["URINALYSIS", "WBC"],
  ["CHEM_10", "LDL"],
] as const) {
  const definition = definitionOf(templateCode);
  const report = blankedReport(definition);
  const row = draftRow(definition, report, parameterCode);
  assert(
    row.omission === "Render",
    `a checked blank ${templateCode}/${parameterCode} stays on the draft sheet - measured ${row.omission}`
  );
  const declared = definition.parameters.find((parameter) => parameter.parameterCode === parameterCode)!;
  assert(
    row.formattedValue.trim() === "" && row.label === declared.parameterName,
    `a checked blank ${templateCode}/${parameterCode} carries its own name and no fabricated result - measured "${row.formattedValue}"`
  );
  assert(
    row.evaluationOutcome !== "Invalid",
    `a checked blank ${templateCode}/${parameterCode} is not marked Invalid - measured ${row.evaluationOutcome}`
  );
  // Unit and reference presentation is the parameter's own, unchanged by blankness.
  assert(
    row.unit === (declared.unit || null) && row.suffix === (declared.suffixSpec?.suffix || null),
    `a checked blank ${templateCode}/${parameterCode} keeps its declared unit presentation`
  );

  const deselected = draftRow(
    definition,
    applyParameterSelection(report, definition, parameterCode, false),
    parameterCode
  );
  assert(
    deselected.omission === "Omit",
    `a deselected ${templateCode}/${parameterCode} is omitted from the draft sheet - measured ${deselected.omission}`
  );
}

// A real result still reaches the row, and "0" is a real result.
const cbcDefinition = definitionOf("CBC");
const cbcZero = withResult(blankedReport(cbcDefinition), cbcDefinition, "BASOPHIL", "0");
const zeroRow = draftRow(cbcDefinition, cbcZero, "BASOPHIL");
assert(
  zeroRow.omission === "Render" && Number(zeroRow.formattedValue) === 0 && zeroRow.formattedValue.trim() !== "",
  `a checked CBC/BASOPHIL of 0 renders its zero, formatted by its own precision - measured "${zeroRow.formattedValue}" / ${zeroRow.omission}`
);
const populatedRow = draftRow(cbcDefinition, reportFor(cbcDefinition, registryRendererFamily("CBC")), "HEMOGLOBIN");
assert(
  populatedRow.omission === "Render" && populatedRow.formattedValue.trim() !== "",
  "a populated result still renders with its value"
);

// A select result renders exactly what was chosen.
const hbsagDefinition = definitionOf("HBSAG");
const hbsagRow = draftRow(hbsagDefinition, reportFor(hbsagDefinition, registryRendererFamily("HBSAG")), "HBSAG_RESULT");
assert(
  hbsagRow.omission === "Render" && hbsagRow.formattedValue.trim() === "Nonreactive",
  `a chosen HBSAG result renders as chosen - measured "${hbsagRow.formattedValue}"`
);

// The approved per-parameter declarations are untouched: a parameter whose definition declares
// blankOmission is still omitted while blank, which is the Fecalysis optional-finding and the
// Urinalysis amorphous-crystal rule. Read from the definition - no template code is tested.
for (const [templateCode, parameterCode] of [
  ["FECALYSIS", "PUS_CELLS"],
  ["URINALYSIS", "AMORPHOUS_CRYSTAL"],
] as const) {
  const definition = definitionOf(templateCode);
  const parameter = definition.parameters.find((candidate) => candidate.parameterCode === parameterCode)!;
  assert(parameter.blankOmission === true, `${templateCode}/${parameterCode} still declares blankOmission`);
  assert(
    draftRow(definition, blankedReport(definition), parameterCode).omission === "Omit",
    `a blank ${templateCode}/${parameterCode} is still omitted by its own declaration`
  );
}

// A computed parameter with nothing to compute from is visible and blank, never invented.
const chem10 = definitionOf("CHEM_10");
const ldlRow = draftRow(chem10, blankedReport(chem10), "LDL");
assert(
  ldlRow.omission === "Render" && ldlRow.formattedValue.trim() === "",
  `an uncomputable LDL is visible and blank - measured "${ldlRow.formattedValue}" / ${ldlRow.omission}`
);

// The composed page carries the blank row too: the parameter label with an empty RESULT cell.
const blankCbcModel = resolveSessionRenderModel(sessionFor([blankedReport(cbcDefinition)]), ReportDefinitionRegistry);
const blankCbcPage = composeNativeLivePreviewReportPage(blankCbcModel, blankCbcModel.reports[0]);
const hemoglobinPrimitives = blankCbcPage.primitives.filter(
  (primitive): primitive is typeof primitive & { text: string } =>
    primitive.kind === "text" && primitive.id.startsWith("result-HEMOGLOBIN-")
);
assert(hemoglobinPrimitives.length > 0, "the composed draft page carries the blank Hemoglobin row");
const hemoglobinValueText = hemoglobinPrimitives
  .filter((primitive) => primitive.id.startsWith("result-HEMOGLOBIN-value"))
  .map((primitive) => primitive.text)
  .join("");
assert(
  hemoglobinValueText.trim() === "",
  `the composed blank Hemoglobin RESULT cell is empty - measured "${hemoglobinValueText}"`
);

// -- The frozen record keeps a checked blank parameter --
//
// Three states have to stay distinguishable in the snapshot itself: a row with a value, a row with
// an empty value, and no row at all. Collapsing the middle one into "absent" is what made a
// completed report disagree with the draft it was frozen from, and it is what these assertions
// prevent from coming back.

console.log("\n-- The frozen record keeps a checked blank parameter --");

function completedSnapshotOf(definition: ClinicalReportDefinition, report: ILaboratoryReport) {
  return ReportCompletionService.validateAndCompose(sessionFor([report]), "2026-09-12T02:00:00.000Z");
}

const blankCbcReport = withResult(
  withResult(blankedReport(cbcDefinition), cbcDefinition, "HEMOGLOBIN", "130"),
  cbcDefinition,
  "BASOPHIL",
  "0"
);
const blankCbcSnapshot = completedSnapshotOf(cbcDefinition, blankCbcReport);
const frozenCbcResults = blankCbcSnapshot.reports[0].results;

for (const parameterCode of ["HEMATOCRIT", "EOSINOPHIL"]) {
  const frozen = frozenCbcResults.find((result) => result.parameterCode === parameterCode);
  assert(frozen !== undefined, `a checked blank CBC/${parameterCode} is kept in the frozen record`);
  assert(
    frozen!.formattedResultValue === "" && !(frozen!.rawResultValue || "").trim(),
    `the frozen blank CBC/${parameterCode} carries no fabricated result - measured "${frozen!.formattedResultValue}"`
  );
  assert(
    !["Invalid", "High", "Low", "Normal", "Abnormal"].includes(frozen!.evaluationOutcome),
    `the frozen blank CBC/${parameterCode} carries no fabricated status - measured ${frozen!.evaluationOutcome}`
  );
  assert(
    frozen!.parameterName === cbcDefinition.parameters.find((parameter) => parameter.parameterCode === parameterCode)!.parameterName,
    `the frozen blank CBC/${parameterCode} keeps its own parameter name`
  );
}

assert(
  frozenCbcResults.find((result) => result.parameterCode === "HEMOGLOBIN")!.formattedResultValue.trim() === "130",
  "a reported CBC/HEMOGLOBIN is frozen with its value"
);
assert(
  Number(frozenCbcResults.find((result) => result.parameterCode === "BASOPHIL")!.formattedResultValue) === 0,
  "a CBC/BASOPHIL of 0 is frozen as a real result, never swallowed as blank"
);

// A DESELECTED parameter is absent from the frozen record, which is what makes "present but empty"
// mean something different from "not selected". URINALYSIS is used because a CBC parameter is
// required and therefore cannot be deselected at all - a rule this change leaves exactly as it was.
const urinalysisForSelection = definitionOf("URINALYSIS");
const deselectable = urinalysisForSelection.parameters.find(
  (parameter) => parameter.isSelectable && !parameter.isRequired && !parameter.blankOmission
)!;
assert(deselectable !== undefined, "an optional, deselectable parameter exists to exercise deselection");
const urinalysisSelectionReport = reportFor(urinalysisForSelection, registryRendererFamily("URINALYSIS"));
const deselectedSnapshot = completedSnapshotOf(
  urinalysisForSelection,
  applyParameterSelection(urinalysisSelectionReport, urinalysisForSelection, deselectable.parameterCode, false)
);
assert(
  !deselectedSnapshot.reports[0].results.some((result) => result.parameterCode === deselectable.parameterCode),
  `a deselected ${deselectable.parameterCode} is absent from the frozen record`
);
assert(
  completedSnapshotOf(urinalysisForSelection, urinalysisSelectionReport).reports[0].results.some(
    (result) => result.parameterCode === deselectable.parameterCode
  ),
  `the same ${deselectable.parameterCode} IS frozen while it stays selected`
);

// The completed report RENDERS the blank row, named, with an empty result cell - so Preview after
// completion shows what Preview before completion showed.
const completedBlankModel = resolveCompletedSessionRenderModel(blankCbcSnapshot, ReportDefinitionRegistry, {
  accessionNumber: "ACC-QA01",
});
const completedBlankRow = completedBlankModel.reports[0].results.find(
  (result) => result.parameterCode === "HEMATOCRIT"
);
assert(
  completedBlankRow !== undefined && completedBlankRow.omission === "Render" && completedBlankRow.formattedValue.trim() === "",
  "a completed report renders its checked blank row with an empty result"
);
const completedBlankPage = composeNativeLivePreviewReportPage(completedBlankModel, completedBlankModel.reports[0]);
const completedHematocrit = completedBlankPage.primitives.filter(
  (primitive): primitive is typeof primitive & { text: string } =>
    primitive.kind === "text" && primitive.id.startsWith("result-HEMATOCRIT-")
);
assert(completedHematocrit.length > 0, "the composed COMPLETED page carries the blank Hematocrit row");
assert(
  completedHematocrit
    .filter((primitive) => primitive.id.startsWith("result-HEMATOCRIT-value"))
    .every((primitive) => primitive.text.trim() === ""),
  "the composed COMPLETED blank Hematocrit RESULT cell is empty"
);

// A HISTORICAL snapshot is unaffected: presentation did not change, so a stored record that never
// carried the blank row still renders without it, and no row is invented for it.
const historicalSnapshot = {
  ...blankCbcSnapshot,
  reports: blankCbcSnapshot.reports.map((report) => ({
    ...report,
    results: report.results.filter((result) => result.formattedResultValue.trim() !== ""),
  })),
};
const historicalModel = resolveCompletedSessionRenderModel(historicalSnapshot, ReportDefinitionRegistry, {
  accessionNumber: "ACC-QA01",
});
assert(
  !historicalModel.reports[0].results.some((result) => result.parameterCode === "HEMATOCRIT"),
  "a historical snapshot that never carried a blank row still renders without it"
);

// The minimum-content boundary is NOT widened: a report whose every parameter is blank is still
// refused, because the rule counts what the document REPORTS, not how many rows it has.
const allBlankCbcIssues = collectSessionCompletionIssues(sessionFor([blankedReport(cbcDefinition)]));
assert(
  allBlankCbcIssues.some((issue: CompletionIssue) => issue.kind === "ReportHasNoResult"),
  "a report whose every checked parameter is blank is still refused"
);

// A declared blankOmission parameter is still dropped from the frozen record while blank.
const fecalysis = definitionOf("FECALYSIS");
let fecalysisReport = reportFor(fecalysis, registryRendererFamily("FECALYSIS"));
fecalysisReport = withResult(fecalysisReport, fecalysis, "PUS_CELLS", "");
assert(
  !completedSnapshotOf(fecalysis, fecalysisReport).reports[0].results.some(
    (result) => result.parameterCode === "PUS_CELLS"
  ),
  "a blank FECALYSIS/PUS_CELLS is still omitted from the frozen record by its own declaration"
);

// An INVALID non-blank entry still blocks completion and still routes to its own parameter.
const invalidIssues = collectSessionCompletionIssues(
  sessionFor([withResult(blankCbcReport, cbcDefinition, "HEMATOCRIT", "not-a-number")])
);
assert(
  invalidIssues.some(
    (issue: CompletionIssue) =>
      issue.templateCode === "CBC" && issue.parameterCode === "HEMATOCRIT" &&
      (issue.kind === "ResultNotNumeric" || issue.kind === "ResultInvalid")
  ),
  "an invalid non-blank result still blocks completion and names its own parameter"
);
assert(
  !collectSessionCompletionIssues(sessionFor([blankCbcReport])).some(
    (issue: CompletionIssue) => issue.parameterCode === "HEMATOCRIT"
  ),
  "a checked blank result raises no issue of its own"
);

// -- Completed-session retention is seven days --

console.log("\n-- Completed-session retention --");

assert(
  SYSTEM_CONSTANTS.RETENTION.COMPLETED_REPORT_DAYS === 7,
  `the approved completed-session retention window is 7 days - measured ${SYSTEM_CONSTANTS.RETENTION.COMPLETED_REPORT_DAYS}`
);

// The window is measured from completion, and exactly one helper computes it.
const retentionAnchor = new Date("2026-09-12T00:00:00.000Z");
const expectedExpiry = new Date("2026-09-19T00:00:00.000Z");
assert(
  calculateExpirationDate(retentionAnchor).toISOString() === expectedExpiry.toISOString(),
  `completion on day 0 expires on day 7 - measured ${calculateExpirationDate(retentionAnchor).toISOString()}`
);

// The operator-facing replacement sentence must state the same number as the constant. It is a
// double-quoted literal because checkpoint B5 reads that map as source text, so this is what keeps
// the wording from drifting away from the behaviour.
const operationalResultSource = readFileSync("src/features/server-boundary/operational-action-result.ts", "utf8");
assert(
  operationalResultSource.includes(
    `inside its ${SYSTEM_CONSTANTS.RETENTION.COMPLETED_REPORT_DAYS}-day retention window`
  ),
  "the replacement refusal sentence states the approved retention window"
);
assert(
  !/\b30-day retention\b/.test(operationalResultSource),
  "no 30-day retention wording remains in the operational result contract"
);

// -- Administrator-only deletion of a completed session --

console.log("\n-- Administrator-only completed-session deletion --");

const serverActionsSource = readFileSync("src/features/server-boundary/server-actions.ts", "utf8");
const deleteActionStart = serverActionsSource.indexOf("export async function deleteCompletedSessionAction(");
assert(deleteActionStart >= 0, "deleteCompletedSessionAction is declared in server-actions.ts");
const deleteActionNext = serverActionsSource.indexOf("\nexport async function", deleteActionStart + 1);
const deleteActionSource = serverActionsSource.slice(
  deleteActionStart,
  deleteActionNext >= 0 ? deleteActionNext : serverActionsSource.length
);

// ORDER is the property, not mere presence. Authorization converts first, then the Administrator
// check refuses, and only then is any input parsed or any repository built - so an unauthorized
// caller is refused before the request is even read.
const accessRefusalIndex = deleteActionSource.indexOf(
  'if (!authorization.ok) return operationalFailure("OPERATIONAL_ACCESS_DENIED");'
);
const adminGateIndex = deleteActionSource.indexOf('if (caller.role !== "Admin") {');
const denialEmitIndex = deleteActionSource.indexOf("await auditService.emit({");
const denialEventIndex = deleteActionSource.indexOf('eventType: "CompletedSessionDeletionDenied"');
const parseIndex = deleteActionSource.indexOf("parseSessionLoadInput(input)");
const repositoryIndex = deleteActionSource.indexOf("new SupabasePatientReportSessionRepository");
assert(
  accessRefusalIndex >= 0 && adminGateIndex > accessRefusalIndex,
  "the Administrator check runs after the operational access refusal"
);
assert(
  parseIndex > adminGateIndex && repositoryIndex > adminGateIndex,
  "a non-Administrator is refused before the input is parsed and before any repository is built"
);
assert(
  denialEmitIndex > adminGateIndex && denialEventIndex > denialEmitIndex,
  "the Administrator refusal awaits its SecurityDenial audit"
);
assert(
  deleteActionSource.indexOf('details: { reasonCode: "role_not_authorized" }') > denialEventIndex,
  "the Administrator refusal records only a reason code"
);
assert(
  deleteActionSource.indexOf('return operationalFailure("OPERATIONAL_ACCESS_DENIED");', denialEventIndex) > denialEventIndex,
  "the Administrator refusal is RETURNED as a typed failure, never thrown"
);
// HISTORY-DELETION-INTEGRITY-R1 REPLACED THE ASSERTION THAT STOOD HERE. It required the success
// audit to be emitted in this action AFTER `repository.deleteCompletedSession(`, which pinned the
// exact ordering the defect lived in: the delete committed alone, and a fault on the following
// audit write destroyed a clinical record with no record of who destroyed it. Both writes now live
// in one database transaction inside `delete_completed_session`, so the guarantee moved rather than
// weakened, and the assertion moves with it - to `verify-completed-session-deletion-integrity.ts`,
// which proves the ordering, the single audit row and the rollback in the SQL that now owns them.
// What this file keeps is the half that remains this action's own: no second success audit here.
assert(
  !deleteActionSource.includes('eventType: "SessionCompletedDeleted"'),
  "the action emits no success audit of its own - the deletion transaction owns that event"
);
assert(
  deleteActionSource.includes("await repository.deleteCompletedSession(sessionId);"),
  "the action reaches the deletion only through the repository's transactional path"
);
// Scanned over LIVE CODE only. A prose comment naming what the audit must not carry is not a leak,
// and a raw substring check over the whole region would fail on the comment that documents the rule -
// the same false positive checkpoint B5 avoids by stripping comments before it searches.
const liveDeleteActionSource = deleteActionSource
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/.*/g, "$1 ");
for (const prohibited of ["demographics", "patientName", "fullName", "resultValue", "signator", "completedSnapshot"]) {
  assert(
    !liveDeleteActionSource.includes(prohibited),
    `the deletion audit carries no ${prohibited}`
  );
}

// The repository still refuses anything that is not exactly one COMPLETED session, so a concurrent
// deletion or a status change cannot be reported as a success that did not happen. HISTORY-DELETION-
// INTEGRITY-R1 moved WHERE that is decided: `.eq("status", "Completed")` and `deletedRows.length !== 1`
// were client-side predicates across two separately committing requests, and are now the locked
// re-read, the status re-decision and the `GET DIAGNOSTICS` row guard inside `delete_completed_session`.
// The two assertions naming those removed substrings are therefore replaced, not dropped - the SQL
// that now carries them is asserted in `verify-completed-session-deletion-integrity.ts`. The two
// typed refusals stay pinned here, because they are still constructed in this file.
const sessionRepositorySource = readFileSync("src/repositories/supabase-session-repository.ts", "utf8");
const deleteCompletedStart = sessionRepositorySource.indexOf("async deleteCompletedSession(");
assert(deleteCompletedStart >= 0, "deleteCompletedSession is declared in the session repository");
const deleteCompletedSource = sessionRepositorySource.slice(deleteCompletedStart, deleteCompletedStart + 2400);
for (const required of [
  'supabaseServer.rpc("delete_completed_session"',
  'if (data === "NOT_FOUND") throw new CompletedSessionNotDeletableError("not_found");',
  'if (data === "NOT_COMPLETED") throw new CompletedSessionNotDeletableError("not_completed");',
  'if (data !== "DELETED") {',
]) {
  assert(
    deleteCompletedSource.includes(required),
    `the completed deletion is predicated on ${required}`
  );
}
assert(
  !deleteCompletedSource.includes('.from("patient_report_sessions")'),
  "the completed deletion issues no direct session table write of its own"
);

// The UI fails CLOSED: without the Administrator capability the control does not exist at all, for
// either rendering, which is what makes the hidden button a convenience rather than the boundary.
const historyActionsModule = workspaceRequire(
  join(process.cwd(), "src/app/(app)/history/_components/HistorySessionActions")
) as { HistorySessionActions: unknown };
const completedEntry = {
  session: { id: "qa-session", status: "Completed" } as never,
  canReopen: true,
};
for (const variant of ["table", "card"] as const) {
  for (const canDeleteCompleted of [false, true]) {
    const markup = renderToStaticMarkup(
      React.createElement(historyActionsModule.HistorySessionActions as never, {
        entry: completedEntry,
        variant,
        isDeleting: false,
        onPreview: () => undefined,
        onReopen: () => undefined,
        onDeleteDraft: () => undefined,
        canDeleteCompleted,
        onDeleteCompleted: () => undefined,
      } as never)
    );
    assert(
      markup.includes("data-delete-completed") === canDeleteCompleted,
      `a completed session offers removal only with the Administrator capability (${variant}, canDeleteCompleted=${canDeleteCompleted})`
    );
  }
}

// -- History action group, expiring-soon threshold, invalid-control marking --

console.log("\n-- History actions, expiring-soon threshold, invalid-control marking --");

// THE ACTIONS CELL. Three controls in one wrapping group, every one of them labelled at the width
// the labels turn on, and none of them pushed to the cell boundary. The clipped icon-only square
// was the control that could not carry a label, so the shape is what is asserted here.
const historyActionsSource = readFileSync(
  "src/app/(app)/history/_components/HistorySessionActions.tsx",
  "utf8"
);
assert(
  historyActionsSource.includes('"flex flex-wrap items-center justify-start gap-1.5"'),
  "the table action group wraps inside its cell instead of overflowing it"
);
assert(
  !/justify-start gap-1\.5 whitespace-nowrap/.test(historyActionsSource),
  "the table action group no longer forces a single unwrappable line"
);
assert(
  (historyActionsSource.match(/className="ml-auto"/g) || []).length === 1,
  `the card footer has exactly one trailing action slot - measured ${(historyActionsSource.match(/className="ml-auto"/g) || []).length}`
);
assert(
  !/h-8 w-8 border border-brand-border p-0/.test(historyActionsSource),
  "no removal control is a fixed icon-only square in the table any more"
);
// The SAME destructive button the Personnel directory uses for its permanent deletion, so removing a
// record looks like removing a record wherever the operator is. The colour comes from the shared
// variant; History re-tints nothing.
const personnelTableSource = readFileSync(
  "src/app/(app)/personnel/_components/PersonnelTable.tsx",
  "utf8"
);
assert(
  personnelTableSource.includes('variant="danger"'),
  "the Personnel directory removal is the shared destructive button"
);
assert(
  (historyActionsSource.match(/variant="danger"/g) || []).length === 2 &&
    !/hover:bg-brand-danger-bg/.test(historyActionsSource),
  "both History removals use that same shared destructive button, with no local re-tinting"
);
assert(
  historyActionsSource.includes('const labelClass = isCard ? "" : "hidden min-[1400px]:inline";'),
  "the table labels turn on at the measured width where three labelled controls fit"
);

// The column budget has to pay for that group, and lifecycle keeps the width its own wording
// was measured against.
const historyViewSource = readFileSync(
  "src/app/(app)/history/_components/SessionHistoryView.tsx",
  "utf8"
);
const columnWidths = (historyViewSource.match(/w-\[(\d+)%\]/g) || []).map((entry) =>
  Number(entry.replace(/\D/g, ""))
);
assert(
  columnWidths.length === 4 && columnWidths.reduce((total, width) => total + width, 0) === 100,
  `the four table columns still account for exactly 100% - measured ${columnWidths.join("/")}`
);
assert(
  columnWidths[3] >= 30 && columnWidths[2] >= 22,
  `actions has room for three labelled controls and lifecycle keeps its own - measured ${columnWidths.join("/")}`
);

// DOM ORDER is the keyboard order: Preview, then Replace, then the removal.
for (const variant of ["table", "card"] as const) {
  const markup = renderToStaticMarkup(
    React.createElement(historyActionsModule.HistorySessionActions as never, {
      entry: {
        session: { id: "qa-session", status: "Completed", accessionNumber: "SR-QA-0001" } as never,
        canReopen: true,
      },
      variant,
      isDeleting: false,
      onPreview: () => undefined,
      onReopen: () => undefined,
      onDeleteDraft: () => undefined,
      canDeleteCompleted: true,
      onDeleteCompleted: () => undefined,
    } as never)
  );
  const previewIndex = markup.indexOf("Preview");
  const replaceIndex = markup.indexOf("Replace");
  const deleteIndex = markup.indexOf("data-delete-completed");
  assert(
    previewIndex >= 0 && replaceIndex > previewIndex && deleteIndex > replaceIndex,
    `the action order is Preview, Replace, then removal (${variant})`
  );
  assert(
    markup.includes('aria-label="Delete completed session SR-QA-0001"'),
    `the removal keeps its accessible name whether or not its label is visible (${variant})`
  );
  // 44px touch targets in the card layout, which is the only one a finger ever sees.
  if (variant === "card") {
    const cardButtons = markup.match(/<button[^>]*>/g) || [];
    assert(
      cardButtons.length >= 3 && cardButtons.every((button) => button.includes("min-h-11")),
      `every card control keeps a 44px minimum target - measured ${cardButtons.length} control(s)`
    );
  }
}

// THE EXPIRING-SOON THRESHOLD. Smaller than the window, or the label is true of everything, and
// declared once so the dashboard count, the dashboard row marker and the History chip agree.
assert(
  SYSTEM_CONSTANTS.RETENTION.EXPIRING_SOON_DAYS === 2,
  `the expiring-soon threshold is 2 days - measured ${SYSTEM_CONSTANTS.RETENTION.EXPIRING_SOON_DAYS}`
);
assert(
  SYSTEM_CONSTANTS.RETENTION.EXPIRING_SOON_DAYS < SYSTEM_CONSTANTS.RETENTION.COMPLETED_REPORT_DAYS,
  "the expiring-soon threshold stays inside the retention window, so it still distinguishes records"
);
const sessionRowSource = readFileSync(
  "src/app/(app)/dashboard/_components/primitives/SessionRow.tsx",
  "utf8"
);
const recentWorkSource = readFileSync("src/app/(app)/dashboard/_lib/recent-work.ts", "utf8");
assert(
  sessionRowSource.includes("days <= EXPIRING_SOON_DAYS") && !/days <= \d/.test(sessionRowSource),
  "the dashboard row marker reads the shared threshold instead of restating a number"
);
assert(
  recentWorkSource.includes("SYSTEM_CONSTANTS.RETENTION.EXPIRING_SOON_DAYS") &&
    !/EXPIRING_SOON_DAYS = \d/.test(recentWorkSource),
  "the dashboard threshold is the shared declaration, not a second literal"
);
assert(
  historyViewSource.includes("daysRemaining <= SYSTEM_CONSTANTS.RETENTION.EXPIRING_SOON_DAYS") &&
    !/daysRemaining <= 7/.test(historyViewSource),
  "the History retention chip reads the shared threshold, so no tier covers the whole window"
);

// INVALID-CONTROL MARKING. The control that receives focus is the control announced as invalid,
// because both read the one selector the routed issue carries.
assert(
  isRoutedInvalidControl('[data-kit-field="lotNumber"]', '[data-kit-field="lotNumber"]') &&
    !isRoutedInvalidControl('[data-kit-field="lotNumber"]', '[data-kit-field="expirationDate"]') &&
    !isRoutedInvalidControl(null, '[data-kit-field="lotNumber"]'),
  "a control marks itself invalid only for the selector the routed issue actually carries"
);
for (const [path, selector] of [
  ["src/app/(dashboard)/workspace/_components/ReagentKitInfoSection.tsx", '[data-kit-field="lotNumber"]'],
  ["src/app/(dashboard)/workspace/_components/ReagentKitInfoSection.tsx", '[data-kit-field="expirationDate"]'],
  ["src/app/(dashboard)/workspace/_components/SignatorySelectionSection.tsx", '[data-signatory-role="Pathologist"]'],
  ["src/app/(dashboard)/workspace/_components/SignatorySelectionSection.tsx", '[data-signatory-role="MedicalTechnologist"]'],
  ["src/app/(dashboard)/workspace/_components/AdditionalEncodingFieldsSection.tsx", "[data-additional-field="],
] as const) {
  const source = readFileSync(path, "utf8");
  assert(
    source.includes("isRoutedInvalidControl(invalidFieldSelector") && source.includes(selector),
    `${selector} is announced as invalid when completion routes to it`
  );
}

console.log("\n✅ Workspace encoding and completion verification passed.");
