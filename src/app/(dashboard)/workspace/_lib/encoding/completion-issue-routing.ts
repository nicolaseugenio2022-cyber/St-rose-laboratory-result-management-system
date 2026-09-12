import type { CompletionIssue } from "@/domain/completion/completion-issues";
import type { ClinicalReportDefinition } from "@/domain/types/report-definition";

/**
 * Turns a blocking completion condition into somewhere the operator can go and something they can
 * read.
 *
 * ROUTING COMES FROM THE KIND, NEVER FROM WORDING. Every destination below is selected by the
 * issue's `kind` and its codes. No message is parsed, and no sentence decides where focus lands -
 * which is what made the previous single generic sentence unusable for routing.
 *
 * THE SENTENCE IS COMPOSED HERE, from the kind plus the labels the definitions already carry. The
 * domain never sends wording to the UI, and the UI never invents a requirement: it names the field
 * the definition names.
 */

/** Which part of the Workspace has to be open before the control can be focused. */
export type CompletionIssueSection = "PatientDemographics" | "ReportSetup" | "Results" | "ReportDetails";

export interface RoutedCompletionIssue {
  kind: CompletionIssue["kind"];
  /** The examination this belongs to; null for the visit as a whole. */
  templateCode: string | null;
  /** The examination's catalog title, for a summary line that names it. */
  templateTitle: string | null;
  section: CompletionIssueSection;
  /** The control to focus, as a selector. Null when the condition has no single control. */
  selector: string | null;
  /**
   * The sentence shown to the operator.
   *
   * Named `summary` rather than `message` deliberately. Checkpoint B4 asserts that the Workspace
   * source contains no `.message` access at all, which is how it proves no caught error's text can
   * reach the operator. That guarantee is worth keeping literal, and this field carries no error
   * text at all: it is composed here from the issue kind and the definition's own labels.
   */
  summary: string;
}

function parameterName(definition: ClinicalReportDefinition | null, parameterCode: string | null): string {
  const parameter = definition?.parameters.find((item) => item.parameterCode === parameterCode);
  return parameter?.parameterName || parameterCode || "This result";
}

function additionalFieldLabel(definition: ClinicalReportDefinition | null, fieldCode: string | null): string {
  const field = (definition?.additionalEncodingFields || []).find((item) => item.fieldCode === fieldCode);
  return field?.label || fieldCode || "This field";
}

function requestedByLabel(definition: ClinicalReportDefinition | null): string {
  return definition?.requestedByPolicy.fieldLabel || "Requested By";
}

function resultSelector(parameterCode: string | null): string | null {
  return parameterCode ? `[data-param-code="${parameterCode}"] [data-encoding-input]` : null;
}

/**
 * The SELECTION checkbox, not the result field.
 *
 * A deselected parameter's result input is disabled, and `focus()` on a disabled control does
 * nothing - so the one condition whose remedy is re-checking the parameter would have scrolled
 * the row into view and landed nowhere. The checkbox is the control that fixes it.
 */
function selectionSelector(parameterCode: string | null): string | null {
  return parameterCode ? `[data-param-code="${parameterCode}"] [data-parameter-selector]` : null;
}

export interface CompletionRoutingDefinitions {
  getDefinition(templateCode: string): ClinicalReportDefinition | null;
}

export function routeCompletionIssue(
  issue: CompletionIssue,
  definitions: CompletionRoutingDefinitions
): RoutedCompletionIssue {
  const definition = issue.templateCode ? definitions.getDefinition(issue.templateCode) : null;
  const base = {
    kind: issue.kind,
    templateCode: issue.templateCode,
    templateTitle: definition?.templateTitle ?? null,
  };
  switch (issue.kind) {
    case "PatientFullNameRequired":
      return { ...base, section: "PatientDemographics", selector: "#patient-full-name", summary: "Patient Full Name is required." };
    case "PatientDateOfBirthInvalid":
      return { ...base, section: "PatientDemographics", selector: "#patient-date-of-birth", summary: "Date of Birth must be a real date on or before the examination date." };
    case "PatientAgeRequired":
      return { ...base, section: "PatientDemographics", selector: "#patient-age", summary: "Patient Age must be greater than zero." };
    case "PatientSexRequired":
      return { ...base, section: "PatientDemographics", selector: "#patient-sex", summary: "Patient Sex is required." };
    case "ExaminationDateRequired":
      return { ...base, section: "PatientDemographics", selector: "#patient-examination-date", summary: "Examination Date is required." };
    case "NoReportSelected":
      return { ...base, section: "Results", selector: null, summary: "Select at least one examination for this session." };
    case "ReportDefinitionMissing":
      return {
        ...base,
        section: "Results",
        selector: null,
        // Named and actionable: the examination stays in the session, and the operator is told
        // which one cannot be encoded rather than finding it missing from the completed record.
        summary: `${issue.templateCode} has no approved encoding definition, so it cannot be completed. Remove it from this session to continue.`,
      };
    case "RequestedByRequired":
      return { ...base, section: "ReportSetup", selector: "[data-requested-by-input]", summary: `${requestedByLabel(definition)} is required.` };
    case "AdditionalFieldRequired":
      return { ...base, section: "ReportSetup", selector: `[data-additional-field="${issue.fieldCode}"]`, summary: `${additionalFieldLabel(definition, issue.fieldCode)} is required.` };
    case "AdditionalFieldInvalid":
      return { ...base, section: "ReportSetup", selector: `[data-additional-field="${issue.fieldCode}"]`, summary: `${additionalFieldLabel(definition, issue.fieldCode)} has an invalid selection.` };
    case "KitLotNumberRequired":
      return { ...base, section: "ReportDetails", selector: '[data-kit-field="lotNumber"]', summary: "Reagent lot number is required." };
    case "KitExpirationDateRequired":
      return { ...base, section: "ReportDetails", selector: '[data-kit-field="expirationDate"]', summary: "Reagent expiration date is required." };
    case "PathologistSignatoryRequired":
      return { ...base, section: "ReportDetails", selector: '[data-signatory-role="Pathologist"]', summary: "A Pathologist signatory is required." };
    case "MedtechSignatoryRequired":
      return { ...base, section: "ReportDetails", selector: '[data-signatory-role="MedicalTechnologist"]', summary: "A Medical Technologist signatory is required." };
    case "ResultRequiredParameterDeselected":
      return { ...base, section: "Results", selector: selectionSelector(issue.parameterCode), summary: `${parameterName(definition, issue.parameterCode)} is required and cannot be deselected.` };
    case "ResultNotNumeric":
      return { ...base, section: "Results", selector: resultSelector(issue.parameterCode), summary: `${parameterName(definition, issue.parameterCode)} must be numeric.` };
    case "ResultInvalidSelection":
      return { ...base, section: "Results", selector: resultSelector(issue.parameterCode), summary: `${parameterName(definition, issue.parameterCode)} has an invalid selection.` };
    case "ResultConditionalChoiceIncomplete":
      return { ...base, section: "Results", selector: resultSelector(issue.parameterCode), summary: `${parameterName(definition, issue.parameterCode)} is incomplete.` };
    case "ResultInvalid":
      return { ...base, section: "Results", selector: resultSelector(issue.parameterCode), summary: `${parameterName(definition, issue.parameterCode)} is invalid.` };
    case "ResultNotComputed":
      return { ...base, section: "Results", selector: resultSelector(issue.parameterCode), summary: `${parameterName(definition, issue.parameterCode)} could not be computed from the values entered.` };
    case "ReportHasNoResult":
      return { ...base, section: "Results", selector: null, summary: `${definition?.templateTitle || issue.templateCode} must report at least one result.` };
    case "RepeatableFindingLimitExceeded":
      return { ...base, section: "ReportDetails", selector: "[data-repeatable-findings]", summary: "Too many additional findings are recorded." };
    case "RepeatableFindingInvalid":
      return { ...base, section: "ReportDetails", selector: "[data-repeatable-findings]", summary: "An additional finding is not an allowed value." };
  }
}

/**
 * Whether THIS control is the one a completion failure resolved to.
 *
 * The routed issue already carries the selector it will focus, so a control marks itself
 * invalid by comparing against that same string rather than by anyone re-deriving which field
 * failed. One comparison, one source, so the control that is announced as invalid and the
 * control that receives focus can never be different controls.
 *
 * Presentation only: it changes no value, no handler and no validation rule.
 */
export function isRoutedInvalidControl(
  invalidFieldSelector: string | null | undefined,
  selector: string
): boolean {
  return Boolean(invalidFieldSelector) && invalidFieldSelector === selector;
}

export function routeCompletionIssues(
  issues: readonly CompletionIssue[],
  definitions: CompletionRoutingDefinitions
): RoutedCompletionIssue[] {
  return issues.map((issue) => routeCompletionIssue(issue, definitions));
}
