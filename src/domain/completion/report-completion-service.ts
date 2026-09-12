import type { IPatientReportSession, ILaboratoryReport, IRepeatableFindingValue } from "@/domain/models/interfaces";
import type { ClinicalReportDefinition, ParameterSpec } from "@/domain/types/report-definition";
import {
  CURRENT_COMPLETED_SNAPSHOT_VERSION,
  type CompletedReportSnapshot,
  type CompletedResultSnapshot,
  type CompletedSessionSnapshot,
  type FrozenRenderContractMetadata,
} from "./completed-snapshot";
import { ReportDefinitionRegistry } from "@/domain/definitions/report-definition-registry";
import { GenericReportResolver } from "@/services/generic-report-resolver";
import { normalizeCalculationModes, resolveCalculationMode } from "@/domain/calculation-mode";
import { stripFixedSuffix } from "@/services/formatter-registry";
import { ValidationError } from "@/lib/errors";
import { resolveReferenceDisplay } from "@/domain/reference-display";
import { isValidDateOfBirth, resolvePatientAge } from "@/domain/patient-age";
import { persistedRendererFamily } from "@/domain/renderer-family";
import {
  CompletionIssueAccumulator,
  fieldIssue,
  reportIssue,
  resultIssue,
  sessionIssue,
  type CompletionIssue,
} from "./completion-issues";

const STANDARD_SIGNATORIES = { requiredPathologistsCount: 1, requiredMedtechsCount: 1 };
const STANDARD_RENDER_CONTRACT_VERSION = 1;
const STANDARD_STATIC_CONTENT_VERSION = "standard-report-v1";

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function findResult(report: ILaboratoryReport, parameter: ParameterSpec) {
  const accepted = [parameter.parameterCode, ...(parameter.legacyParameterCodes || [])];
  return report.results.find((result) => accepted.includes(result.parameterCode));
}

function rawInputValue(parameter: ParameterSpec, value: string): string {
  return parameter.suffixSpec ? stripFixedSuffix(value, parameter.suffixSpec.suffix) : value;
}

function freezeRenderContractMetadata(definition: ClinicalReportDefinition): FrozenRenderContractMetadata {
  return {
    renderContractVersion: definition.renderContract?.renderContractVersion ?? STANDARD_RENDER_CONTRACT_VERSION,
    printedTitle: definition.reportTitle ?? null,
    staticContentVersion: definition.renderContract?.staticContentVersion ?? STANDARD_STATIC_CONTENT_VERSION,
  };
}

function validateDemographics(session: IPatientReportSession, issues: CompletionIssueAccumulator): void {
  const demographics = session.demographics;
  if (!nonBlank(demographics.fullName)) issues.add("demographics.fullName", "Patient full name is required.", sessionIssue("PatientFullNameRequired"));
  // A date of birth, once supplied, must be a real date on or before the examination date -
  // otherwise no age can be derived from it and the report would print one the record does not
  // support.
  if (demographics.dateOfBirth && !isValidDateOfBirth(demographics.dateOfBirth, demographics.examinationDate)) {
    issues.add("demographics.dateOfBirth", "Patient date of birth must be a real date on or before the examination date.", sessionIssue("PatientDateOfBirthInvalid"));
  }
  // Age is required, but a patient under one month old completes zero years AND zero months, so a
  // "greater than zero" test would reject a genuine newborn. A derivable date of birth is
  // therefore accepted as the age in its own right; without one, the typed number still has to be
  // positive exactly as before.
  const resolvedAge = resolvePatientAge(demographics);
  if (resolvedAge.source !== "DateOfBirth" && (!Number.isFinite(demographics.age) || demographics.age <= 0)) {
    issues.add("demographics.age", "Patient age must be greater than zero.", sessionIssue("PatientAgeRequired"));
  }
  if (!demographics.sex) issues.add("demographics.sex", "Patient sex is required.", sessionIssue("PatientSexRequired"));
  if (!nonBlank(demographics.examinationDate)) issues.add("demographics.examinationDate", "Examination date is required.", sessionIssue("ExaminationDateRequired"));
  // Patient Status is deliberately ignored. Address is snapshotted exactly but remains optional.
}

function resolveRequestedBy(report: ILaboratoryReport, definition: ClinicalReportDefinition, session: IPatientReportSession): string {
  if (report.encodingData && Object.prototype.hasOwnProperty.call(report.encodingData, "requestedBy")) {
    return report.encodingData.requestedBy || "";
  }
  if (nonBlank(session.demographics.requestingPhysician)) return session.demographics.requestingPhysician;
  return definition.requestedByPolicy.defaultPhysician || "";
}

function validateRepeatableFindings(report: ILaboratoryReport, definition: ClinicalReportDefinition, issues: CompletionIssueAccumulator): Record<string, IRepeatableFindingValue[]> {
  const source = report.encodingData?.repeatableFindings || {};
  const frozen: Record<string, IRepeatableFindingValue[]> = {};
  for (const [category, values] of Object.entries(source)) {
    const spec = definition.repeatableFindings?.find((item) => item.findingCategory === category);
    const populated = values.filter((item) => nonBlank(item.value)).map((item, index) => ({ ...item, displayOrder: index + 1 }));
    if (spec?.maxEntries != null && populated.length > spec.maxEntries) issues.add(`reports.${definition.templateCode}.repeatable.${category}`, `A maximum of ${spec.maxEntries} findings is allowed.`, fieldIssue("RepeatableFindingLimitExceeded", definition.templateCode, category));
    if (spec?.allowedOptions) {
      populated.forEach((item, index) => {
        if (!spec.allowedOptions?.includes(item.value)) issues.add(`reports.${definition.templateCode}.repeatable.${category}.${index}`, `Invalid repeatable finding '${item.value}'.`, fieldIssue("RepeatableFindingInvalid", definition.templateCode, category));
      });
    }
    if (populated.length > 0) frozen[category] = populated;
  }
  return frozen;
}

function composeReportSnapshot(session: IPatientReportSession, report: ILaboratoryReport, definition: ClinicalReportDefinition, issues: CompletionIssueAccumulator): CompletedReportSnapshot {
  const prefix = `reports.${definition.templateCode}`;
  const requestedBy = resolveRequestedBy(report, definition, session);
  if (definition.requestedByPolicy.isRequired && !nonBlank(requestedBy)) issues.add(`${prefix}.requestedBy`, `${definition.requestedByPolicy.fieldLabel || "Requested By"} is required.`, reportIssue("RequestedByRequired", definition.templateCode));

  const additionalFields = { ...(report.encodingData?.additionalFields || {}) };
  for (const field of definition.additionalEncodingFields || []) {
    if (field.isRequired && !nonBlank(additionalFields[field.fieldCode])) issues.add(`${prefix}.additional.${field.fieldCode}`, `${field.label} is required.`, fieldIssue("AdditionalFieldRequired", definition.templateCode, field.fieldCode));
    if (field.inputType === "SingleSelect" && nonBlank(additionalFields[field.fieldCode]) && field.options && !field.options.includes(additionalFields[field.fieldCode])) issues.add(`${prefix}.additional.${field.fieldCode}`, `${field.label} has an invalid selection.`, fieldIssue("AdditionalFieldInvalid", definition.templateCode, field.fieldCode));
  }

  if (definition.requiresKitInfo) {
    if (!nonBlank(report.reagentKitInfo?.lotNumber)) issues.add(`${prefix}.kit.lotNumber`, "Reagent lot number is required.", fieldIssue("KitLotNumberRequired", definition.templateCode, "lotNumber"));
    if (!nonBlank(report.reagentKitInfo?.expirationDate)) issues.add(`${prefix}.kit.expirationDate`, "Reagent expiration date is required.", fieldIssue("KitExpirationDateRequired", definition.templateCode, "expirationDate"));
  }

  const signatoryRequirements = definition.signatoryRequirements || STANDARD_SIGNATORIES;
  const pathologists = report.signatories.filter((item) => item.role === "Pathologist").length;
  const medtechs = report.signatories.filter((item) => item.role === "MedicalTechnologist").length;
  if (pathologists < signatoryRequirements.requiredPathologistsCount) issues.add(`${prefix}.signatories.pathologists`, `${signatoryRequirements.requiredPathologistsCount} Pathologist signatory is required.`, fieldIssue("PathologistSignatoryRequired", definition.templateCode, "pathologists"));
  if (medtechs < signatoryRequirements.requiredMedtechsCount) issues.add(`${prefix}.signatories.medtechs`, `${signatoryRequirements.requiredMedtechsCount} Medical Technologist signatory is required.`, fieldIssue("MedtechSignatoryRequired", definition.templateCode, "medtechs"));

  const rawInputs: Record<string, string> = {};
  for (const parameter of definition.parameters) {
    const result = findResult(report, parameter);
    rawInputs[parameter.parameterCode] = rawInputValue(parameter, result?.resultValue || "");
  }
  const calculationModes = normalizeCalculationModes(report.encodingData?.calculationModes);
  const resolved = GenericReportResolver.resolveReport({
    definition,
    rawInputs,
    evaluationContext: { sex: session.demographics.sex || null },
    calculationModes,
  });
  const results: CompletedResultSnapshot[] = [];
  // Rows that actually REPORT something, counted separately from rows that merely exist. The
  // minimum-content rule below is about what the document says, and a checked parameter left
  // blank says nothing - so it must not be able to satisfy that rule on its own.
  let substantiveResultCount = 0;

  for (const parameter of [...definition.parameters].sort((a, b) => a.displayOrder - b.displayOrder)) {
    const source = findResult(report, parameter);
    const selected = (source as (typeof source & { isSelected?: boolean }))?.isSelected ?? true;
    const resolvedResult = resolved.find((item) => item.parameterCode === parameter.parameterCode)!;
    const rawValue = rawInputs[parameter.parameterCode] || "";
    const key = `${prefix}.results.${parameter.parameterCode}`;

    if (parameter.isRequired && !selected) issues.add(key, `${parameter.parameterName} is required and cannot be deselected.`, resultIssue("ResultRequiredParameterDeselected", definition.templateCode, parameter.parameterCode));
    // A checked parameter may be left INTENTIONALLY blank. The operator ran the panel but did not
    // report that analyte, and refusing to complete the session forced them to invent a value or
    // uncheck a parameter they had genuinely considered. A blank is therefore not an error - it is
    // simply not reported, and the omission below keeps it out of the record entirely.
    //
    // "Blank" is whitespace-only, never falsiness: "0", "0.0", "false", "Negative" and
    // "Nonreactive" are all real clinical results and every one of them is non-blank here.
    if (selected && nonBlank(rawValue) && parameter.inputType === "NumericText" && !Number.isFinite(Number(rawValue))) issues.add(key, `${parameter.parameterName} must be numeric.`, resultIssue("ResultNotNumeric", definition.templateCode, parameter.parameterCode));
    if (selected && nonBlank(rawValue) && parameter.inputType === "SingleSelect" && !parameter.conditionalChoiceSpec && parameter.options && !parameter.options.includes(rawValue)) issues.add(key, `${parameter.parameterName} has an invalid selection.`, resultIssue("ResultInvalidSelection", definition.templateCode, parameter.parameterCode));
    if (selected && nonBlank(rawValue) && parameter.conditionalChoiceSpec) {
      const separator = rawValue.indexOf(":");
      const label = separator >= 0 ? rawValue.slice(0, separator).trim() : "";
      const value = separator >= 0 ? rawValue.slice(separator + 1).trim() : "";
      if (!parameter.conditionalChoiceSpec.labelChoices.includes(label) || !parameter.conditionalChoiceSpec.resultOptions.includes(value)) issues.add(key, `${parameter.parameterName} is incomplete or invalid.`, resultIssue("ResultConditionalChoiceIncomplete", definition.templateCode, parameter.parameterCode));
    }
    if (selected && resolvedResult.evaluationOutcome === "Invalid") issues.add(key, `${parameter.parameterName} is invalid.`, resultIssue("ResultInvalid", definition.templateCode, parameter.parameterCode));
    // Only an Auto result can fail to be COMPUTED. A Manual entry is already covered by the
    // required and invalid checks above, and telling the operator their typed value "could not
    // be computed" would be false - this assignment is last, so it would also mask those.
    const calculationMode = resolveCalculationMode(parameter.formulaBinding, parameter.parameterCode, calculationModes);
    // An Auto computed parameter whose dependencies were ALL left blank is itself intentionally
    // blank, not a failed computation: nothing was reported for the analytes it derives from, so
    // reporting that it "could not be computed" would be false and would block a session the
    // operator legitimately wants to complete. The moment any dependency carries a value, an
    // uncomputable result is a genuine defect again and still blocks.
    const dependenciesProvided = (parameter.formulaBinding?.dependencies || []).some((dependency) => nonBlank(rawInputs[dependency]));
    if (parameter.inputType === "Computed" && calculationMode === "Auto" && dependenciesProvided && (!resolvedResult.isValid || !nonBlank(resolvedResult.formattedResultValue))) issues.add(key, `${parameter.parameterName} could not be computed from valid dependencies.`, resultIssue("ResultNotComputed", definition.templateCode, parameter.parameterCode));

    // WHAT REACHES THE FROZEN RECORD: every SELECTED parameter, whether or not it reported a value.
    //
    // A checked parameter the operator did not report stays in the snapshot, named, with an empty
    // result - the approved client requirement. The three states therefore remain distinguishable in
    // the frozen record itself: a row with a value, a row with an empty value, and no row at all for a
    // parameter that was deselected. Dropping the blank row collapsed the first two of those into
    // "parameter absent", which is what made a completed report disagree with the draft it was frozen
    // from. A computed parameter is judged on what it computed, everything else on what was entered.
    //
    // TWO EXCLUSIONS, both unchanged and both declarative. A DESELECTED parameter is excluded. And a
    // parameter whose definition declares `blankOmission` is excluded while blank, which is the
    // client-approved Fecalysis optional-finding and Urinalysis amorphous-crystal rule; it is read
    // from the definition, so no template code is tested here.
    //
    // NOTHING IS FABRICATED for a blank row: the value stays empty, and the evaluation outcome is
    // whatever the resolver produced for an empty entry, which is never a clinical classification.
    const reportableValue = parameter.inputType === "Computed" ? resolvedResult.formattedResultValue : rawValue;
    const reportsSomething = nonBlank(reportableValue);
    if (!selected) continue;
    if (!reportsSomething && parameter.blankOmission) continue;
    if (reportsSomething) substantiveResultCount += 1;
    results.push({
      parameterCode: parameter.parameterCode,
      parameterName: parameter.parameterName,
      rawResultValue: resolvedResult.rawResultValue,
      formattedResultValue: resolvedResult.formattedResultValue || "",
      referenceDisplay: resolveReferenceDisplay(
        parameter.referenceRule,
        session.demographics.sex || null,
        parameter.suffixSpec?.suffix || parameter.unit
      ),
      referenceRule: parameter.referenceRule ? structuredClone(parameter.referenceRule) : null,
      unit: parameter.unit || null,
      suffix: parameter.suffixSpec?.suffix || null,
      evaluationOutcome: resolvedResult.evaluationOutcome,
      computationMetadata: resolvedResult.computationMetadata ? structuredClone(resolvedResult.computationMetadata) : null,
      displayOrder: parameter.displayOrder,
    });
  }

  // A report has to SAY something. Individual parameters may be left blank - they are kept, named,
  // with an empty result - but a report in which every one of them is blank would be an issued
  // clinical document carrying no result at all. So the boundary counts SUBSTANTIVE rows, not rows:
  // keeping blank rows in the snapshot must not quietly turn an empty report into a completable one.
  const repeatableFindings = validateRepeatableFindings(report, definition, issues);
  const hasRepeatableFinding = Object.values(repeatableFindings).some((findings) => findings.length > 0);
  if (substantiveResultCount === 0 && !hasRepeatableFinding) {
    issues.add(`${prefix}.results`, `${definition.templateTitle} must report at least one result.`, reportIssue("ReportHasNoResult", definition.templateCode));
  }

  return {
    templateCode: definition.templateCode,
    templateTitle: report.templateTitle,
    // The DEFINITION owns the renderer family, not the live aggregate.
    //
    // The aggregate carries whatever `report_templates.renderer_family` the hydrated registry
    // supplied, and for ESR, CT_BT and FECALYSIS that row disagrees with the approved declarative
    // definition. Freezing the aggregate's value produced a completed report whose frozen family
    // resolved to one layout while the composition resolved from the definition produced another,
    // and the composer's coherence guard then refused to render the issued report at all. The
    // definition is the same source the composition is selected from, so taking the family from it
    // is what makes the two incapable of disagreeing.
    rendererFamily: persistedRendererFamily(definition.rendererFamily),
    ...freezeRenderContractMetadata(definition),
    requestedBy,
    additionalFields,
    results,
    remarks: report.remarks || "",
    reagentKitInfo: report.reagentKitInfo ? { ...report.reagentKitInfo } : null,
    repeatableFindings,
    signatories: report.signatories.map((item) => ({ ...item })),
  };
}

/**
 * The one pass that decides whether a session can be completed, and composes it if it can.
 *
 * Extracted so the Workspace can ask the SAME rule what is blocking completion before it submits,
 * instead of pre-checking the two fields it happened to know about and then surfacing one generic
 * sentence for everything else. There is exactly one rule set: the issues the operator is shown and
 * the conditions the server enforces are produced by this function, so they cannot disagree.
 *
 * It never throws for a validation failure - it reports one. Only a genuine defect, such as a
 * definition declaring a renderer family nothing can render, still raises.
 */
function composeSessionSnapshot(
  session: IPatientReportSession,
  completedAt: string
): { issues: CompletionIssueAccumulator; snapshot: CompletedSessionSnapshot | null } {
  const issues = new CompletionIssueAccumulator();
  validateDemographics(session, issues);
  if (session.reports.length === 0) {
    issues.add("reports", "At least one laboratory report is required.", sessionIssue("NoReportSelected"));
  }
  const reports = session.reports.map((report) => {
    const definition = ReportDefinitionRegistry.getDefinition(report.templateCode);
    if (!definition) {
      // A selected examination that cannot be defined fails CLOSED and NAMES ITSELF. It is never
      // dropped from the session, which would complete a visit silently missing a report.
      issues.add(
        `reports.${report.templateCode}`,
        "No approved declarative definition is registered.",
        reportIssue("ReportDefinitionMissing", report.templateCode)
      );
      return null;
    }
    return composeReportSnapshot(session, report, definition, issues);
  }).filter((item): item is CompletedReportSnapshot => item !== null);
  if (!issues.isEmpty) return { issues, snapshot: null };
  // The age is frozen at completion - value, unit and final wording - so a later correction to
  // the age rule cannot restate a report that has already been issued. It is written only when
  // an age actually resolves; an unresolvable age freezes nothing rather than freezing a blank,
  // which keeps absence meaning 'no frozen wording' rather than 'wording was empty'.
  const resolvedAge = resolvePatientAge(session.demographics);
  const frozenAge =
    resolvedAge.value !== null && resolvedAge.unit !== null
      ? { value: resolvedAge.value, unit: resolvedAge.unit, display: resolvedAge.display }
      : null;
  return {
    issues,
    snapshot: {
      snapshotVersion: CURRENT_COMPLETED_SNAPSHOT_VERSION,
      completedAt,
      demographics: structuredClone(session.demographics),
      frozenAge,
      reports,
    },
  };
}

/** A fixed instant, because nothing here is frozen: only the blocking conditions are read. */
const ISSUE_PROBE_COMPLETED_AT = "1970-01-01T00:00:00.000Z";

/**
 * Everything blocking completion of this session, as closed structured data.
 *
 * Pure: it writes nothing, freezes nothing and mutates neither the session nor its reports.
 */
export function collectSessionCompletionIssues(session: IPatientReportSession): CompletionIssue[] {
  return composeSessionSnapshot(session, ISSUE_PROBE_COMPLETED_AT).issues.issues;
}

/**
 * Whether this ONE report could be completed, judged by the completion rule itself.
 *
 * The progress indicator asks this rather than counting filled fields, because a CHECKED parameter
 * may be left intentionally blank: the blank row is kept on the issued report, named, with an empty
 * result, so a report with one result and nine deliberate blanks is completable - and an indicator
 * that called it incomplete was reporting outstanding work the approved rule says does not exist.
 *
 * Session-level conditions - a missing patient name, a missing examination date - are NOT this
 * report's business and are excluded, so one report is never shown as unready because another part
 * of the visit is outstanding.
 */
export function isReportCompletable(session: IPatientReportSession, report: ILaboratoryReport): boolean {
  const issues = collectSessionCompletionIssues({ ...session, reports: [report] });
  return !issues.some((issue) => issue.templateCode === report.templateCode);
}

export class ReportCompletionService {
  static validateAndCompose(session: IPatientReportSession, completedAt: string): CompletedSessionSnapshot {
    const { issues, snapshot } = composeSessionSnapshot(session, completedAt);
    if (!snapshot) {
      const errors = issues.fieldErrors;
      throw new ValidationError(`Session cannot be completed: ${Object.values(errors).join(" ")}`, errors);
    }
    return snapshot;
  }
}
