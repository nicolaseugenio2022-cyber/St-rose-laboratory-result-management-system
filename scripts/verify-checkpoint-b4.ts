/** Checkpoint B4: definition-driven Workspace Encoding integration verification. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import { buildEncodingReport, applyEncodingResultValue, applyParameterSelection, applyAllSelectableParameters, reevaluateEncodingReport, addRepeatableFinding, updateRepeatableFinding, moveRepeatableFinding, removeRepeatableFinding, formatConditionalChoiceValue, parseConditionalChoiceValue } from "../src/features/workspace/encoding/report-encoding";
import { PatientReportSessionAggregate } from "../src/domain/models/patient-report-session-aggregate";
import { LaboratoryReportDomain, LaboratoryResultDomain } from "../src/domain/models/laboratory-report-domain";
import { PatientDemographics, RendererFamily } from "../src/domain/types";
import { PatientDemographicsForm } from "../src/features/workspace/components/PatientDemographicsForm";
import { NumericTextInput } from "../src/features/workspace/components/controls/NumericTextInput";
import { SingleSelectInput } from "../src/features/workspace/components/controls/SingleSelectInput";
import { ComboboxInput } from "../src/features/workspace/components/controls/ComboboxInput";
import { FreeTextInput } from "../src/features/workspace/components/controls/FreeTextInput";
import { ComputedInput } from "../src/features/workspace/components/controls/ComputedInput";
import { DEFAULT_NEW_SESSION_ADDRESS, initializeNewSessionAddress } from "../src/features/workspace/encoding/new-session-demographics";
import { resolveReferenceDisplay } from "../src/domain/reference-display";
import { evaluateEncodingResult } from "../src/features/workspace/encoding/evaluate-encoding-result";
import { ParameterRow } from "../src/features/workspace/components/controls/ParameterRow";
import { evaluateParameterValue } from "../src/services/parameter-evaluation-service";
import { GenericReportResolver } from "../src/services/generic-report-resolver";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`✓ ${message}`);
}

const codes = ["CHEM_8", "HDL_LDL", "CHEM_10", "RBS", "HBA1C", "HBSAG", "RPR", "DENGUE_DUO", "PREG_TEST", "HIV_RESULT", "CBC", "BLOOD_TYPING", "CT_BT", "ESR", "FECALYSIS", "OGTT", "URINALYSIS"];
const noOp = () => undefined;
const build = (code: string, existingReport?: LaboratoryReportDomain, legacyRequestedBy = "") => {
  const definition = ReportDefinitionRegistry.getDefinition(code)!;
  return buildEncodingReport({ definition, sessionId: "session-b4", reportId: `report-${code}`, rendererFamily: definition.rendererFamily as RendererFamily, signatories: [], existingReport, legacyRequestedBy });
};

console.log("=== CHECKPOINT B4 VERIFICATION STARTED ===");

const accessionMigrationSource = readFileSync(join(process.cwd(), "supabase/migrations/20260815160000_accession_allocation.sql"), "utf8");
const accessionMigrationCompact = accessionMigrationSource.replace(/\s+/g, " ");
const sequenceTableDefinition = accessionMigrationSource.match(/CREATE TABLE IF NOT EXISTS accession_sequences\s*\(([\s\S]*?)\);/i)?.[1] || "";
const accessionAllocatorSource = accessionMigrationSource.match(/CREATE OR REPLACE FUNCTION allocate_accession_number\(\)[\s\S]*?\$\$;/i)?.[0] || "";
const accessionSeedSource = accessionMigrationSource.match(/INSERT INTO accession_sequences\s*\(year_key,\s*next_seq\)\s*SELECT[\s\S]*?ON CONFLICT\s*\(year_key\)\s*DO UPDATE[\s\S]*?;/i)?.[0] || "";
const accessionSeedCompact = accessionSeedSource.replace(/\s+/g, " ");
assert(/\byear_key\s+INTEGER\s+PRIMARY\s+KEY\b/i.test(sequenceTableDefinition), "accession sequence table is keyed by Manila calendar year_key");
assert(!/\bdate\b|\bdate_key\b|\bday_key\b/i.test(sequenceTableDefinition), "accession sequence table contains no date-keyed column");
assert(!/\bSELECT\b[\s\S]*?\bFROM\s+accession_sequences\b/i.test(accessionMigrationSource), "accession allocation has no SELECT-before-write read-then-write path");
assert(!/\b(?:MAX|COUNT)\s*\(/i.test(accessionAllocatorSource), "accession allocation does not use MAX or COUNT");
assert(/INSERT INTO accession_sequences \(year_key, next_seq\) VALUES \(v_year, 1\) ON CONFLICT \(year_key\) DO UPDATE SET next_seq = accession_sequences\.next_seq \+ 1 RETURNING next_seq INTO v_seq;/i.test(accessionMigrationCompact), "accession allocation uses one atomic yearly ON CONFLICT UPDATE RETURNING statement");
assert(/v_day\s*:=\s*\(timezone\('Asia\/Manila',\s*now\(\)\)\)::date/i.test(accessionMigrationSource), "accession allocation derives the Manila day once from server-side now()");
assert(/v_year\s*:=\s*extract\(year from v_day\)::int/i.test(accessionMigrationSource), "accession allocation derives year_key from the same Manila day");
assert(!/\bCURRENT_DATE\b/i.test(accessionMigrationSource), "accession allocation never uses CURRENT_DATE");
assert(/CASE\s+WHEN\s+length\(v_seq::text\)\s*>=\s*4\s+THEN\s+v_seq::text\s+ELSE\s+lpad\(v_seq::text,\s*4,\s*'0'\)\s+END/i.test(accessionMigrationSource), "accession suffix uses an explicit non-truncating minimum-width length guard");
assert(!/RETURN\s+'SR-'[\s\S]*?\|\|\s*lpad\(v_seq::text,\s*4,\s*'0'\)\s*;/i.test(accessionMigrationSource), "a bare unconditional four-character lpad is not the accession suffix formatter");
assert(/INSERT INTO accession_sequences \(year_key, next_seq\) SELECT y, m FROM \( SELECT substring\(accession_number from 4 for 4\)::int AS y, MAX\(substring\(accession_number from 13\)::int\) AS m FROM patient_report_sessions WHERE accession_number ~ '\^SR-\\d\{8\}-\\d\+\$' GROUP BY 1 \) s/i.test(accessionSeedCompact), "accession sequence seed derives persisted yearly maxima through an anchored SR-YYYYMMDD-digits regex filter");
assert(/ON CONFLICT \(year_key\) DO UPDATE SET next_seq = GREATEST\(accession_sequences\.next_seq, EXCLUDED\.next_seq\);/i.test(accessionSeedCompact), "accession sequence seed upserts with GREATEST and can never lower an existing counter");
assert(/ALTER TABLE accession_sequences ENABLE ROW LEVEL SECURITY;/i.test(accessionMigrationCompact), "accession sequence table has row-level security enabled");
assert(/REVOKE ALL ON accession_sequences FROM PUBLIC;/i.test(accessionMigrationCompact), "accession sequence table privileges are revoked from PUBLIC");
assert(/REVOKE ALL ON accession_sequences FROM [^;]*\banon\b/i.test(accessionMigrationSource), "accession sequence table privileges are explicitly revoked from anon");
assert(/REVOKE ALL ON accession_sequences FROM [^;]*\bauthenticated\b/i.test(accessionMigrationSource), "accession sequence table privileges are explicitly revoked from authenticated");
assert(/GRANT SELECT, INSERT, UPDATE ON accession_sequences TO service_role;/i.test(accessionMigrationCompact), "accession sequence table grants only allocator-required operations to service_role");
assert(/REVOKE EXECUTE ON FUNCTION allocate_accession_number\(\) FROM [^;]*\bPUBLIC\b/i.test(accessionMigrationSource), "allocate_accession_number EXECUTE is revoked from PUBLIC");
assert(/REVOKE EXECUTE ON FUNCTION allocate_accession_number\(\) FROM [^;]*\banon\b/i.test(accessionMigrationSource), "allocate_accession_number EXECUTE is revoked from anon");
assert(/REVOKE EXECUTE ON FUNCTION allocate_accession_number\(\) FROM [^;]*\bauthenticated\b/i.test(accessionMigrationSource), "allocate_accession_number EXECUTE is revoked from authenticated");

const guidedWorkspaceSource = readFileSync(join(process.cwd(), "src/features/workspace/GuidedWorkspace.tsx"), "utf8").replace(/\r\n/g, "\n");
assert(!guidedWorkspaceSource.includes("AccessionNumberGenerator.generate"), "GuidedWorkspace no longer generates accession numbers client-side");
assert(!guidedWorkspaceSource.includes("p-01"), "GuidedWorkspace contains no hardcoded placeholder personnel id");
assert(!/(?:const|let|var)\s+(?:\[\s*)?availablePersonnel(?:\s*,[^\]]*)?\]?\s*=\s*(?:useState<[^>]+>\s*\()?\s*\[\s*\{[\s\S]*/.test(guidedWorkspaceSource), "GuidedWorkspace contains no literal availablePersonnel array of personnel objects");
const serverActionsSource = readFileSync(join(process.cwd(), "src/features/server-boundary/server-actions.ts"), "utf8").replace(/\r\n/g, "\n");
const standaloneAllocationRpcPattern = /\brpc\s*\(\s*(["'`])allocate_accession_number\1/i;
const standaloneAllocationActionPattern = /allocateAccessionNumberAction/;
const allocationFunctionNamePattern = /allocate_accession_number/i;
assert(!standaloneAllocationRpcPattern.test(serverActionsSource) && !standaloneAllocationActionPattern.test(serverActionsSource), "server actions expose no standalone accession allocation action or RPC");
assert(!standaloneAllocationRpcPattern.test(guidedWorkspaceSource) && !standaloneAllocationActionPattern.test(guidedWorkspaceSource) && !allocationFunctionNamePattern.test(guidedWorkspaceSource), "GuidedWorkspace contains no standalone accession allocation reference");
assert(/accessionNumber:\s*null/.test(guidedWorkspaceSource), "GuidedWorkspace initializes a new session with accessionNumber: null");
assert(guidedWorkspaceSource.includes('"Not assigned"'), 'GuidedWorkspace renders the exact literal "Not assigned" for an unassigned accession');
const renderingEngineSource = readFileSync(join(process.cwd(), "src/rendering/SharedRenderingEngine.tsx"), "utf8").replace(/\r\n/g, "\n");
const a4DocumentCssSource = readFileSync(join(process.cwd(), "src/rendering/styles/a4-document.css"), "utf8").replace(/\r\n/g, "\n");
const handlePrintBody = renderingEngineSource.match(/const handlePrint = \(\) => \{([\s\S]*?)\n  \};/)?.[1] || "";
const handleExportPDFBody = renderingEngineSource.match(/const handleExportPDF = \(\) => \{([\s\S]*?)\n  \};/)?.[1] || "";
const printButtonTag = renderingEngineSource.match(/<button(?=[^>]*onClick=\{handlePrint\})[^>]*>/)?.[0] || "";
const exportButtonTag = renderingEngineSource.match(/<button(?=[^>]*onClick=\{handleExportPDF\})[^>]*>/)?.[0] || "";
const livePreviewViewportTag = renderingEngineSource.match(/<div(?=[^>]*data-live-preview-viewport="true")[^>]*>/)?.[0] || "";
const unassignedPrintNoticeTag = renderingEngineSource.match(/\{!isAccessionAssigned \? \(\s*(<div(?=[^>]*data-unassigned-print-notice="true")[^>]*>)/)?.[1] || "";
const a4PrintMediaBlock = a4DocumentCssSource.match(/@media print \{([\s\S]*?)\n\}/)?.[1] || "";
assert(/const isAccessionAssigned = session\.accessionNumber !== null;/.test(renderingEngineSource), "SharedRenderingEngine derives accession assignment from the session accession number");
assert(handlePrintBody.indexOf("if (!isAccessionAssigned) return;") >= 0 && handlePrintBody.indexOf("if (!isAccessionAssigned) return;") < handlePrintBody.indexOf("window.print();"), "SharedRenderingEngine guards browser print before invoking window.print");
assert(handleExportPDFBody.indexOf("if (!isAccessionAssigned) return;") >= 0 && handleExportPDFBody.indexOf("if (!isAccessionAssigned) return;") < handleExportPDFBody.indexOf("setIsExportingPDF(true);"), "SharedRenderingEngine guards PDF export before setting export state when accession is unassigned");
assert(/disabled=\{!isAccessionAssigned\}/.test(printButtonTag) && /disabled=\{isExportingPDF \|\| !isAccessionAssigned\}/.test(exportButtonTag), "Print and Export buttons are disabled while accession is unassigned");
assert(/data-accession-unassigned=\{isAccessionAssigned \? undefined : "true"\}/.test(livePreviewViewportTag), "SharedRenderingEngine marks only the unassigned rendering surface for print suppression");
assert(/\[data-accession-unassigned="true"\]\s*\{\s*display:\s*none !important;\s*\}/.test(a4PrintMediaBlock), "a4-document print media hides the unassigned rendering surface");
assert(/className="[^"]*\bhidden\b[^"]*"/.test(unassignedPrintNoticeTag), "SharedRenderingEngine renders the screen-hidden print notice only when accession is unassigned");
assert(renderingEngineSource.indexOf(unassignedPrintNoticeTag) < renderingEngineSource.indexOf(livePreviewViewportTag), "SharedRenderingEngine keeps the unassigned print notice outside and before the report-page container");
assert(/\[data-unassigned-print-notice="true"\]\s*\{\s*display:\s*block !important;\s*\}/.test(a4PrintMediaBlock), "a4-document print media reveals the unassigned print notice");
const listActivePersonnelActionBody = serverActionsSource.match(/export async function listActivePersonnelAction\(\): Promise<IPersonnel\[\]>\s*\{([\s\S]*?)\n\}/)?.[1] || "";
const personnelAuthorizationIndex = listActivePersonnelActionBody.indexOf("requireOperationalCaller()");
const personnelReadIndex = listActivePersonnelActionBody.indexOf("findAllActive()");
assert(personnelAuthorizationIndex >= 0 && personnelReadIndex > personnelAuthorizationIndex, "listActivePersonnelAction authorizes the operational caller before reading personnel");

const personnelRepositorySource = readFileSync(join(process.cwd(), "src/repositories/supabase-personnel-repository.ts"), "utf8");
assert(/import\s+["']server-only["'];/.test(personnelRepositorySource), "SupabasePersonnelRepository imports server-only");
assert(/class\s+SupabasePersonnelRepository\s+implements\s+IPersonnelRepository/.test(personnelRepositorySource), "SupabasePersonnelRepository implements the pinned IPersonnelRepository contract");
const findAllActiveBody = personnelRepositorySource.match(/async findAllActive\(\): Promise<IPersonnel\[\]>\s*\{([\s\S]*?)\n\s*\}/)?.[1] || "";
assert(/\.eq\(["']is_active["'],\s*true\)/.test(findAllActiveBody), "SupabasePersonnelRepository findAllActive filters is_active = true");
assert(!/\b(?:SupabaseClient|Postgrest(?:Client|Builder|FilterBuilder|TransformBuilder)|Database)\b/.test(personnelRepositorySource), "SupabasePersonnelRepository introduces no concrete Supabase type outside the established repository pattern");

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidGenerationDefinition = ReportDefinitionRegistry.getDefinition("CBC")!;
const generatedReport = buildEncodingReport({
  definition: uuidGenerationDefinition,
  sessionId: crypto.randomUUID(),
  reportId: crypto.randomUUID(),
  rendererFamily: uuidGenerationDefinition.rendererFamily as RendererFamily,
  signatories: [],
});
assert(uuidPattern.test(generatedReport.id) && generatedReport.results.length > 0 && generatedReport.results.every((result) => uuidPattern.test(result.id)), "new Encoding report and results use RFC-4122 UUID ids");

const reuseFixtureReportId = "fixture-report-id-that-is-not-a-uuid";
const reuseFixtureResultIds = generatedReport.results.map((_, index) => `fixture-result-${index + 1}-that-is-not-a-uuid`);
const reuseFixtureReport = new LaboratoryReportDomain({
  ...generatedReport,
  id: reuseFixtureReportId,
  results: generatedReport.results.map((result, index) => new LaboratoryResultDomain({
    ...result,
    id: reuseFixtureResultIds[index],
    reportId: reuseFixtureReportId,
  })),
});
const reusedReport = buildEncodingReport({
  definition: uuidGenerationDefinition,
  sessionId: "different-session-id",
  reportId: "different-report-id",
  rendererFamily: uuidGenerationDefinition.rendererFamily as RendererFamily,
  signatories: [],
  existingReport: reuseFixtureReport,
});
assert(reusedReport.id === reuseFixtureReportId && reusedReport.results.length === reuseFixtureResultIds.length && reusedReport.results.every((result, index) => result.id === reuseFixtureResultIds[index]), "existing report and result fixture ids are reused unchanged");

assert(ReportDefinitionRegistry.getRegisteredTemplateCodes().length === 17, "all 17 report definitions are registered");
const expectedEvaluationMatrix: Record<string, Record<string, number>> = {
  CHEM_8: { NumericAutomatic: 6 }, HDL_LDL: { NumericAutomatic: 8 }, CHEM_10: { NumericAutomatic: 10 },
  RBS: { NumericAutomatic: 1 }, HBA1C: { NumericAutomatic: 1 }, HBSAG: { ValidEntryOnly: 1 },
  RPR: { ValidEntryOnly: 1 }, DENGUE_DUO: { ValidEntryOnly: 3 }, PREG_TEST: { ValidEntryOnly: 1 },
  HIV_RESULT: { ValidEntryOnly: 1 }, CBC: { NumericAutomatic: 10 }, BLOOD_TYPING: { ValidEntryOnly: 2 },
  CT_BT: { ValidEntryOnly: 2 }, ESR: { Unresolved: 1 }, FECALYSIS: { ValidEntryOnly: 11 },
  OGTT: { NumericAutomatic: 3 }, URINALYSIS: { ValidEntryOnly: 12 },
};
let auditedParameterCount = 0;
for (const code of codes) {
  const definition = ReportDefinitionRegistry.getDefinition(code)!;
  const report = build(code);
  assert(Boolean(definition), `${code} definition resolves`);
  assert(JSON.stringify(report.results.slice(0, definition.parameters.length).map((r) => r.parameterCode)) === JSON.stringify(definition.parameters.map((p) => p.parameterCode)), `${code} Encoding uses exact declarative parameter order`);
  assert(definition.parameters.every((p) => report.results.find((r) => r.parameterCode === p.parameterCode)?.resultValue === (p.defaultValue || "")), `${code} exact result defaults initialize only from its definition`);
  assert(definition.statusPolicy.demographicCollection === false, `${code} does not collect Patient Status`);
  auditedParameterCount += definition.parameters.length;
  const actualModes = definition.parameters.reduce<Record<string, number>>((counts, parameter) => {
    counts[parameter.evaluationPolicy.mode] = (counts[parameter.evaluationPolicy.mode] || 0) + 1;
    return counts;
  }, {});
  assert(JSON.stringify(actualModes) === JSON.stringify(expectedEvaluationMatrix[code]), `${code} matches its approved declarative evaluation classification`);
}
assert(auditedParameterCount === 74, "all 74 parameters have an explicit evaluation policy");
assert(ReportDefinitionRegistry.getAllDefinitions().every((definition) => definition.parameters.every((parameter) => parameter.evaluationPolicy.mode !== "QualitativeAutomatic")), "no qualitative clinical classification is invented without an approved rule");

const demographics: PatientDemographics = { fullName: "Test Patient", age: 21, ageUnit: "years", sex: "Male", address: "", patientStatus: "" as PatientDemographics["patientStatus"], examinationDate: "2026-08-09", requestingPhysician: "" };
const demographicsMarkup = renderToStaticMarkup(React.createElement(PatientDemographicsForm, { demographics, onChange: noOp }));
assert(!demographicsMarkup.includes("Patient Status"), "Patient Status is absent from the Encoding demographics DOM");
assert(!demographicsMarkup.includes("Requesting Physician"), "legacy shared Requesting Physician is absent from demographics");
assert(demographicsMarkup.includes(">Address<") && !demographicsMarkup.includes("Patient Address"), "shared demographic field label is exactly Address");
new PatientReportSessionAggregate({ id: "s", accessionNumber: "a", demographics, reports: [] }).validateDemographics();
assert(true, "Patient Status and legacy shared physician are never required by demographic validation");

assert(initializeNewSessionAddress("") === DEFAULT_NEW_SESSION_ADDRESS, "new blank session initializes Address to STA. ROSA, NUEVA ECIJA");
assert(initializeNewSessionAddress("Existing Patient Address") === "Existing Patient Address", "new-session initialization never overwrites an existing non-empty address");
let editedDemographics: PatientDemographics = { ...demographics, address: DEFAULT_NEW_SESSION_ADDRESS };
const formTree = PatientDemographicsForm({ demographics: editedDemographics, onChange: (updated) => { editedDemographics = updated; } });
function findAddressControl(node: React.ReactNode): React.ReactElement<Record<string, unknown>> | null {
  if (!React.isValidElement(node)) return null;
  const element = node as React.ReactElement<Record<string, unknown>>;
  if (element.type === "textarea") return element;
  const children = (element.props as { children?: React.ReactNode }).children;
  for (const child of React.Children.toArray(children)) {
    const found = findAddressControl(child);
    if (found) return found;
  }
  return null;
}
const addressControl = findAddressControl(formTree);
assert(addressControl !== null && addressControl.props.readOnly !== true && addressControl.props.disabled !== true, "Address remains fully editable/typeable");
(addressControl!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "CABANATUAN CITY" } });
assert(editedDemographics.address === "CABANATUAN CITY", "staff may replace the initialized Address value");

const sessionWithAddress = new PatientReportSessionAggregate({ id: "address-session", accessionNumber: "address-accession", demographics: { ...demographics, address: "Saved Draft Address" }, reports: [] });
const firstReport = build("CBC");
const secondReport = build("CHEM_10");
const switchedSession = new PatientReportSessionAggregate({ ...sessionWithAddress, reports: [firstReport, secondReport] });
assert(switchedSession.demographics.address === "Saved Draft Address", "switching report tabs/definitions does not reset Address");
const restoredSession = new PatientReportSessionAggregate({ ...switchedSession, demographics: { ...switchedSession.demographics } });
assert(restoredSession.demographics.address === "Saved Draft Address", "saved/restored non-empty Address is preserved");
const restoredClearedSession = new PatientReportSessionAggregate({ ...switchedSession, demographics: { ...switchedSession.demographics, address: "" } });
assert(restoredClearedSession.demographics.address === "", "an intentionally cleared restored Address remains blank without fallback report text");

for (const code of codes) {
  const definition = ReportDefinitionRegistry.getDefinition(code)!;
  const initialized = build(code);
  assert(initialized.encodingData?.requestedBy === (definition.requestedByPolicy.defaultPhysician || ""), `${code} applies only its report-scoped Requested By default`);
  const staffValue = new LaboratoryReportDomain({ ...initialized, encodingData: { ...initialized.encodingData, requestedBy: "Dr. Staff Entered" } });
  assert(build(code, staffValue).encodingData?.requestedBy === "Dr. Staff Entered", `${code} never overwrites staff-entered Requested By`);
  const explicitlyBlank = new LaboratoryReportDomain({ ...initialized, encodingData: { ...initialized.encodingData, requestedBy: "" } });
  assert(build(code, explicitlyBlank).encodingData?.requestedBy === "", `${code} preserves an explicitly cleared Requested By value`);
}
const legacyFallback = build("CBC", undefined, "Dr. Legacy Draft Physician");
assert(legacyFallback.encodingData?.requestedBy === "Dr. Legacy Draft Physician", "legacy shared physician migrates into an initially absent report-scoped value");

const selectableRequired = { ...ReportDefinitionRegistry.getDefinition("CBC")!.parameters[0], isRequired: true, isSelectable: true };
let clickedSelection: boolean | null = null;
const selectableRow = ParameterRow({ parameter: selectableRequired, isSelected: true, onToggleSelect: (selected) => { clickedSelection = selected; }, children: React.createElement("input") });
function findCheckbox(node: React.ReactNode): React.ReactElement<Record<string, unknown>> | null {
  if (!React.isValidElement(node)) return null;
  const element = node as React.ReactElement<Record<string, unknown>>;
  if (element.type === "input" && element.props.type === "checkbox") return element;
  for (const child of React.Children.toArray(element.props.children as React.ReactNode)) {
    const found = findCheckbox(child);
    if (found) return found;
  }
  return null;
}
const selectableCheckbox = findCheckbox(selectableRow)!;
assert(selectableCheckbox.props.tabIndex === -1 && selectableCheckbox.props.disabled === false, "selectable checkbox is mouse-enabled while excluded from Tab order regardless of required state");
(selectableCheckbox.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: false } });
assert(clickedSelection === false, "mouse checkbox change deselects an explicitly selectable required parameter in a draft");
const lockedCheckbox = findCheckbox(ParameterRow({ parameter: { ...selectableRequired, isSelectable: false }, isSelected: true, onToggleSelect: noOp, children: React.createElement("input") }))!;
assert(lockedCheckbox.props.disabled === true, "explicitly non-selectable parameter checkbox remains locked");
const deselectedRequiredDraft = applyParameterSelection(build("CBC"), ReportDefinitionRegistry.getDefinition("CBC")!, selectableRequired.parameterCode, false);
assert((deselectedRequiredDraft.results.find((result) => result.parameterCode === selectableRequired.parameterCode) as LaboratoryResultDomain).isSelected === false, "required selectable parameter may remain deselected in a saveable draft");
const bulkDeselectedDraft = applyAllSelectableParameters(build("CBC"), ReportDefinitionRegistry.getDefinition("CBC")!, false);
assert(ReportDefinitionRegistry.getDefinition("CBC")!.parameters.filter((parameter) => parameter.isSelectable).every((parameter) => (bulkDeselectedDraft.results.find((result) => result.parameterCode === parameter.parameterCode) as LaboratoryResultDomain).isSelected === false), "bulk selection follows isSelectable without inventing a required-field lock");

const controls = { NumericText: NumericTextInput, SingleSelect: SingleSelectInput, Combobox: ComboboxInput, FreeText: FreeTextInput, Computed: ComputedInput } as const;
for (const definition of ReportDefinitionRegistry.getAllDefinitions()) {
  for (const parameter of definition.parameters) {
    const Component = controls[parameter.inputType as keyof typeof controls];
    assert(Boolean(Component) || Boolean(parameter.conditionalChoiceSpec), `${definition.templateCode}/${parameter.parameterCode} has a supported declarative Encoding control`);
    if (!Component) continue;
    const props = parameter.inputType === "Computed"
      ? { parameter, value: "", isSelected: true, onToggleSelect: noOp }
      : { parameter, value: parameter.defaultValue || "", isSelected: true, onToggleSelect: noOp, onChange: noOp };
    const markup = renderToStaticMarkup(React.createElement(Component as React.ComponentType<any>, props));
    assert(markup.includes(`data-control-type="${parameter.inputType}"`), `${definition.templateCode}/${parameter.parameterCode} renders its exact control type`);
    assert(markup.includes('data-parameter-selector="true"') && markup.includes('tabindex="-1"'), `${definition.templateCode}/${parameter.parameterCode} selector is excluded from Tab order`);
    if (parameter.inputType === "Computed") assert(markup.includes("disabled=\"\"") && markup.includes("readOnly=\"\""), `${definition.templateCode}/${parameter.parameterCode} computed control is read-only and skipped`);
    if (parameter.options) for (const option of parameter.options) assert(markup.includes(`value="${option}"`), `${definition.templateCode}/${parameter.parameterCode} contains exact option ${option}`);
    if (parameter.suffixSpec) assert(markup.includes("data-fixed-suffix=\"true\"") && markup.includes(parameter.suffixSpec.suffix.trim()), `${definition.templateCode}/${parameter.parameterCode} fixed suffix is outside its editable value`);
  }
}

const cbcHemoglobin = ReportDefinitionRegistry.getDefinition("CBC")!.parameters.find((parameter) => parameter.parameterCode === "HEMOGLOBIN")!;
const chemDefinition = ReportDefinitionRegistry.getDefinition("CHEM_10")!;
const chemUricAcid = ReportDefinitionRegistry.getDefinition("CHEM_10")!.parameters.find((parameter) => parameter.parameterCode === "URIC_ACID")!;
assert(resolveReferenceDisplay(cbcHemoglobin.referenceRule, "Male", cbcHemoglobin.unit) === "130–160 g/L", "male CBC reference resolves visibly from declarative data");
assert(resolveReferenceDisplay(cbcHemoglobin.referenceRule, "Female", cbcHemoglobin.unit) === "120–140 g/L", "female CBC reference updates from current Sex");
assert(resolveReferenceDisplay(cbcHemoglobin.referenceRule, null, cbcHemoglobin.unit) === "Male: 130–160 g/L; Female: 120–140 g/L", "unset Sex displays all labeled declarative reference variants");
assert(resolveReferenceDisplay(chemUricAcid.referenceRule, "Female", chemUricAcid.unit) === "2.4–5.7 mg/dL", "Chemistry uses the same sex-aware reference resolver as CBC");
const cbcRowMarkup = renderToStaticMarkup(React.createElement(NumericTextInput, { parameter: cbcHemoglobin, value: "", isSelected: true, patientSex: "Female", onChange: noOp, onToggleSelect: noOp }));
const chemRowMarkup = renderToStaticMarkup(React.createElement(NumericTextInput, { parameter: chemUricAcid, value: "", isSelected: true, patientSex: "Female", onChange: noOp, onToggleSelect: noOp }));
assert(cbcRowMarkup.includes("data-parameter-row") && chemRowMarkup.includes("data-parameter-row") && cbcRowMarkup.includes("Ref:") && chemRowMarkup.includes("Ref:"), "CBC and Chemistry share one tabular parameter row with visible references");
assert(evaluateEncodingResult("1asd", cbcHemoglobin) === "Invalid", "non-empty malformed NumericText is invalid");
for (const validNumeric of ["1", "1.25", ".5"]) assert(evaluateEncodingResult(validNumeric, cbcHemoglobin) !== "Invalid", `NumericText accepts valid ${validNumeric} input`);
const invalidNumericMarkup = renderToStaticMarkup(React.createElement(NumericTextInput, { parameter: cbcHemoglobin, value: "1asd", isSelected: true, patientSex: "Female", onChange: noOp, onToggleSelect: noOp }));
const invalidHelperIndex = invalidNumericMarkup.indexOf("data-validation-message");
const controlColumnIndex = invalidNumericMarkup.indexOf("data-control-column");
const statusColumnIndex = invalidNumericMarkup.indexOf("data-status-column");
assert(invalidNumericMarkup.includes('aria-invalid="true"') && invalidNumericMarkup.includes('aria-describedby="HEMOGLOBIN-numeric-error"'), "malformed NumericText preserves aria-invalid and associates its visible helper");
assert((invalidNumericMarkup.match(/Invalid number/g) || []).length === 1 && !invalidNumericMarkup.includes("Invalid numeric result"), "malformed NumericText displays exactly one 'Invalid number' helper");
assert(controlColumnIndex >= 0 && invalidHelperIndex > controlColumnIndex && invalidHelperIndex < statusColumnIndex, "numeric validation helper renders in the control column before the badge-only status column");
for (const [value, expectedOutcome] of [["120", "Low"], ["145", "Normal"], ["170", "High"]] as const) {
  const validMarkup = renderToStaticMarkup(React.createElement(NumericTextInput, { parameter: cbcHemoglobin, value, isSelected: true, patientSex: "Male", onChange: noOp, onToggleSelect: noOp }));
  assert(validMarkup.includes(`>${expectedOutcome}</span>`) && !validMarkup.includes("data-validation-message") && !validMarkup.includes("aria-describedby"), `valid ${expectedOutcome.toUpperCase()} NumericText has no validation helper`);
}

assert(evaluateParameterValue(cbcHemoglobin, "", { sex: "Male" }) === "NoEvaluation", "blank applicable result remains PENDING");
assert(evaluateParameterValue(cbcHemoglobin, "120", { sex: "Male" }) === "Low", "CBC Male Hemoglobin 120 is LOW");
assert(evaluateParameterValue(cbcHemoglobin, "145", { sex: "Male" }) === "Normal", "CBC Male Hemoglobin 145 is NORMAL");
assert(evaluateParameterValue(cbcHemoglobin, "170", { sex: "Male" }) === "High", "CBC Male Hemoglobin 170 is HIGH");
assert(evaluateParameterValue(cbcHemoglobin, "120", { sex: "Female" }) === "Normal", "CBC Female Hemoglobin 120 is NORMAL");
const fbs = chemDefinition.parameters.find((parameter) => parameter.parameterCode === "FBS")!;
const cholesterol = chemDefinition.parameters.find((parameter) => parameter.parameterCode === "CHOLESTEROL")!;
const triglycerides = chemDefinition.parameters.find((parameter) => parameter.parameterCode === "TRIGLYCERIDES")!;
assert(evaluateParameterValue(fbs, "110", { sex: "Male" }) === "Normal", "CHEM10 FBS 110 is NORMAL at the inclusive boundary");
assert(evaluateParameterValue(cholesterol, "231", { sex: "Male" }) === "High", "CHEM10 Cholesterol 231 is HIGH under the strict less-than rule");
assert(evaluateParameterValue(cholesterol, "199", { sex: "Male" }) === "Normal" && evaluateParameterValue(cholesterol, "200", { sex: "Male" }) === "High", "strict less-than boundary distinguishes NORMAL from HIGH");
assert(evaluateParameterValue(triglycerides, "325", { sex: "Male" }) === "High", "CHEM10 Triglycerides 325 is HIGH");
const syntheticGreaterThan = { ...fbs, evaluationPolicy: { mode: "NumericAutomatic", strategy: "GreaterThan", boundary: { minValue: 10 } } } as typeof fbs;
assert(evaluateParameterValue(syntheticGreaterThan, "10") === "Low" && evaluateParameterValue(syntheticGreaterThan, "11") === "Normal", "generic strict greater-than policy distinguishes LOW from NORMAL");
const chemistryExample = GenericReportResolver.resolveReport({ definition: chemDefinition, rawInputs: { FBS: "110", CHOLESTEROL: "231", TRIGLYCERIDES: "325" }, evaluationContext: { sex: "Male" } });
assert(chemistryExample.find((result) => result.parameterCode === "HDL")?.formattedResultValue === "61.60" && chemistryExample.find((result) => result.parameterCode === "HDL")?.evaluationOutcome === "Normal", "computed HDL 61.60 is NORMAL through the same generic pipeline");
assert(chemistryExample.find((result) => result.parameterCode === "LDL")?.formattedResultValue === "" && chemistryExample.find((result) => result.parameterCode === "LDL")?.evaluationOutcome === "Invalid", "negative client-formula LDL remains blank and INVALID");
const ldlParameter = chemDefinition.parameters.find((parameter) => parameter.parameterCode === "LDL")!;
const invalidLdl = chemistryExample.find((result) => result.parameterCode === "LDL")!;
const invalidLdlMarkup = renderToStaticMarkup(React.createElement(ComputedInput, { parameter: ldlParameter, value: invalidLdl.formattedResultValue || "", isSelected: true, evaluationOutcome: invalidLdl.evaluationOutcome, computationMetadata: invalidLdl.computationMetadata, onToggleSelect: noOp }));
assert(invalidLdlMarkup.includes('aria-invalid="true"') && invalidLdlMarkup.includes('aria-describedby="LDL-computed-error"') && invalidLdlMarkup.includes("Computed result ≤ 0"), "rejected StrictPositive LDL displays its resolver-derived computed-result reason");
assert(invalidLdlMarkup.indexOf("data-validation-message") > invalidLdlMarkup.indexOf("data-control-column") && invalidLdlMarkup.indexOf("data-validation-message") < invalidLdlMarkup.indexOf("data-status-column"), "computed validation helper uses the shared control-column placement");
const pendingChemistry = GenericReportResolver.resolveReport({ definition: chemDefinition, rawInputs: {}, evaluationContext: { sex: "Male" } });
assert(pendingChemistry.find((result) => result.parameterCode === "HDL")?.evaluationOutcome === "NoEvaluation" && pendingChemistry.find((result) => result.parameterCode === "LDL")?.evaluationOutcome === "NoEvaluation", "computed fields with blank dependencies remain PENDING rather than INVALID");
const pendingLdl = pendingChemistry.find((result) => result.parameterCode === "LDL")!;
const pendingLdlMarkup = renderToStaticMarkup(React.createElement(ComputedInput, { parameter: ldlParameter, value: "", isSelected: true, evaluationOutcome: pendingLdl.evaluationOutcome, computationMetadata: pendingLdl.computationMetadata, onToggleSelect: noOp }));
assert(pendingLdlMarkup.includes(">Pending</span>") && !pendingLdlMarkup.includes("data-validation-message") && !pendingLdlMarkup.includes("aria-describedby"), "blank computed dependencies remain PENDING without an error helper");

let sexAwareCbc = build("CBC");
sexAwareCbc = applyEncodingResultValue(sexAwareCbc, ReportDefinitionRegistry.getDefinition("CBC")!, "HEMOGLOBIN", "120", "NoEvaluation", { sex: "Male" });
assert(sexAwareCbc.results.find((result) => result.parameterCode === "HEMOGLOBIN")?.evaluationOutcome === "Low", "stored draft outcome resolves using Male demographics");
sexAwareCbc = reevaluateEncodingReport(sexAwareCbc, ReportDefinitionRegistry.getDefinition("CBC")!, { sex: "Female" });
assert(sexAwareCbc.results.find((result) => result.parameterCode === "HEMOGLOBIN")?.evaluationOutcome === "Normal", "Sex change immediately recomputes the affected stored outcome");

const bloodTypingAbo = ReportDefinitionRegistry.getDefinition("BLOOD_TYPING")!.parameters.find((parameter) => parameter.parameterCode === "ABO_TYPING")!;
assert(evaluateParameterValue(bloodTypingAbo, "A") === "Entered", "Blood Typing uses neutral ENTERED instead of fake clinical classification");
const fecalColor = ReportDefinitionRegistry.getDefinition("FECALYSIS")!.parameters.find((parameter) => parameter.parameterCode === "COLOR")!;
assert(evaluateParameterValue(fecalColor, "Brown") === "Entered", "valid microscopy entry uses neutral ENTERED");
const esrParameter = ReportDefinitionRegistry.getDefinition("ESR")!.parameters[0];
assert(esrParameter.evaluationPolicy.mode === "Unresolved", "ESR declares unresolved automatic clinical classification");
assert(evaluateParameterValue(esrParameter, "") === "NoEvaluation" && evaluateParameterValue(esrParameter, "not-a-number") === "Invalid" && evaluateParameterValue(esrParameter, "10", { sex: "Male" }) === "Entered", "ESR resolves blank PENDING, malformed INVALID, and valid numeric ENTERED");

let chem = build("CHEM_10");
chem = applyEncodingResultValue(chem, chemDefinition, "CHOLESTEROL", "100", "Normal");
chem = applyEncodingResultValue(chem, chemDefinition, "TRIGLYCERIDES", "500", "Abnormal");
assert(chem.results.find((r) => r.parameterCode === "HDL")?.resultValue === "26.67", "HDL is computed read-only through the reusable resolver");
assert(chem.results.find((r) => r.parameterCode === "LDL")?.resultValue === "26.67", "LDL uses unrounded HDL computation through the reusable resolver");

const hbaDefinition = ReportDefinitionRegistry.getDefinition("HBA1C")!;
const legacyHba = new LaboratoryReportDomain({ id: "legacy-hba", sessionId: "s", templateCode: "HBA1C", templateTitle: "HBA1C", rendererFamily: "SimpleResult", results: [new LaboratoryResultDomain({ id: "r", reportId: "legacy-hba", parameterCode: "HBA1C", parameterName: "HBA1C", resultValue: "7.2%", unit: "%", evaluationOutcome: "NoEvaluation", displayOrder: 1 })], signatories: [] });
const migratedHba = buildEncodingReport({ definition: hbaDefinition, sessionId: "s", reportId: "legacy-hba", rendererFamily: "SimpleResult", signatories: [], existingReport: legacyHba });
assert(migratedHba.results[0].resultValue === "7.2", "legacy percent suffix is deduplicated from editable input");
const urineDefinition = ReportDefinitionRegistry.getDefinition("URINALYSIS")!;
const legacyUrine = new LaboratoryReportDomain({ id: "legacy-u", sessionId: "s", templateCode: "URINALYSIS", templateTitle: "Urinalysis", rendererFamily: "DiagnosticGrid", results: [new LaboratoryResultDomain({ id: "w", reportId: "legacy-u", parameterCode: "WBC", parameterName: "WBC", resultValue: "0-2/HPF", unit: "/HPF", evaluationOutcome: "NoEvaluation", displayOrder: 7 }), new LaboratoryResultDomain({ id: "c", reportId: "legacy-u", parameterCode: "CLARITY", parameterName: "Clarity", resultValue: "Clear", unit: null, evaluationOutcome: "NoEvaluation", displayOrder: 2 }), new LaboratoryResultDomain({ id: "o", reportId: "legacy-u", parameterCode: "OTHER_FINDINGS", parameterName: "Other", resultValue: "WBC seen in clumps", unit: null, evaluationOutcome: "NoEvaluation", displayOrder: 20 })], signatories: [] });
const migratedUrine = buildEncodingReport({ definition: urineDefinition, sessionId: "s", reportId: "legacy-u", rendererFamily: "DiagnosticGrid", signatories: [], existingReport: legacyUrine });
assert(migratedUrine.results.find((r) => r.parameterCode === "WBC")?.resultValue === "0-2", "legacy /HPF suffix is removed from the editable portion");
assert(migratedUrine.results.find((r) => r.parameterCode === "TRANSPARENCY")?.resultValue === "Clear", "legacy parameter aliases remain compatible");
assert(migratedUrine.encodingData?.repeatableFindings?.["Additional Microscopic Findings"]?.[0]?.value === "WBC seen in clumps", "legacy Urinalysis other finding migrates to repeatable findings");

const conditional = formatConditionalChoiceValue("Amorphous Urates", "Rare");
assert(conditional === "Amorphous Urates: Rare" && parseConditionalChoiceValue(conditional, urineDefinition.parameters.find((p) => p.parameterCode === "AMORPHOUS_CRYSTAL")!.conditionalChoiceSpec!).result === "Rare", "Urinalysis conditional amorphous finding round-trips declaratively");
let findings = [] as ReturnType<typeof addRepeatableFinding>;
for (let i = 0; i < 25; i += 1) findings = addRepeatableFinding(findings, "Additional Microscopic Findings", `f-${i}`);
findings = updateRepeatableFinding(findings, "f-0", "Calcium Oxalate Crystals: Rare");
findings = moveRepeatableFinding(findings, "f-0", 1);
findings = removeRepeatableFinding(findings, "f-24");
assert(findings.length === 24 && findings[1].value === "Calcium Oxalate Crystals: Rare", "Urinalysis supports unlimited editable findings and preserves visual order after reorder/remove");

const workspaceSources = ["src/features/workspace/components/DynamicResultForm.tsx", "src/features/workspace/components/controls/NumericTextInput.tsx", "src/features/workspace/components/controls/SingleSelectInput.tsx", "src/features/workspace/components/controls/ComboboxInput.tsx", "src/features/workspace/components/controls/FreeTextInput.tsx"].map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");
assert(!workspaceSources.includes("querySelector") && !workspaceSources.includes('e.key === "Enter"'), "Encoding relies on native DOM Tab order with no manual Enter/querySelector focus logic");

const fecalysis = build("FECALYSIS");
assert(fecalysis.results.find((r) => r.parameterCode === "BACTERIA")?.resultValue === "4+" && fecalysis.results.find((r) => r.parameterCode === "BLOOD")?.resultValue === "", "Fecalysis exact defaults and optional blanks are preserved");
for (const code of ["HBA1C", "DENGUE_DUO"]) {
  const definition = ReportDefinitionRegistry.getDefinition(code)!;
  const report = build(code);
  assert(report.reagentKitInfo?.lotNumber === (definition.defaultKitInfo?.lotNumber || "") && report.reagentKitInfo?.expirationDate === (definition.defaultKitInfo?.expirationDate || ""), `${code} initializes editable reagent lot/expiration defaults exactly`);
}
const hiv = build("HIV_RESULT");
assert(ReportDefinitionRegistry.getDefinition("HIV_RESULT")?.requestedByPolicy.fieldLabel === "Referring Doctor" && hiv.encodingData?.additionalFields?.examinationDateTime === "", "HIV uses dedicated required Referring Doctor and Date & Time demographics field");

console.log("=== ALL CHECKPOINT B4 VERIFICATION TESTS PASSED ===");
