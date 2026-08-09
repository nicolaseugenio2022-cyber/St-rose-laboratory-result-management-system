import type { IPatientReportSession, ILaboratoryReport, IRepeatableFindingValue } from "@/domain/models/interfaces";
import type { ClinicalReportDefinition, ParameterSpec } from "@/domain/types/report-definition";
import type { CompletedReportSnapshot, CompletedResultSnapshot, CompletedSessionSnapshot } from "./completed-snapshot";
import { ReportDefinitionRegistry } from "@/domain/definitions/report-definition-registry";
import { GenericReportResolver } from "@/services/generic-report-resolver";
import { stripFixedSuffix } from "@/services/formatter-registry";
import { ValidationError } from "@/lib/errors";
import { resolveReferenceDisplay } from "@/domain/reference-display";

const STANDARD_SIGNATORIES = { requiredPathologistsCount: 1, requiredMedtechsCount: 1 };

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

function validateDemographics(session: IPatientReportSession, errors: Record<string, string>): void {
  const demographics = session.demographics;
  if (!nonBlank(demographics.fullName)) errors["demographics.fullName"] = "Patient full name is required.";
  if (!Number.isFinite(demographics.age) || demographics.age <= 0) errors["demographics.age"] = "Patient age must be greater than zero.";
  if (!demographics.sex) errors["demographics.sex"] = "Patient sex is required.";
  if (!nonBlank(demographics.examinationDate)) errors["demographics.examinationDate"] = "Examination date is required.";
  // Patient Status is deliberately ignored. Address is snapshotted exactly but remains optional.
}

function resolveRequestedBy(report: ILaboratoryReport, definition: ClinicalReportDefinition, session: IPatientReportSession): string {
  if (report.encodingData && Object.prototype.hasOwnProperty.call(report.encodingData, "requestedBy")) {
    return report.encodingData.requestedBy || "";
  }
  if (nonBlank(session.demographics.requestingPhysician)) return session.demographics.requestingPhysician;
  return definition.requestedByPolicy.defaultPhysician || "";
}

function validateRepeatableFindings(report: ILaboratoryReport, definition: ClinicalReportDefinition, errors: Record<string, string>): Record<string, IRepeatableFindingValue[]> {
  const source = report.encodingData?.repeatableFindings || {};
  const frozen: Record<string, IRepeatableFindingValue[]> = {};
  for (const [category, values] of Object.entries(source)) {
    const spec = definition.repeatableFindings?.find((item) => item.findingCategory === category);
    const populated = values.filter((item) => nonBlank(item.value)).map((item, index) => ({ ...item, displayOrder: index + 1 }));
    if (spec?.maxEntries != null && populated.length > spec.maxEntries) errors[`reports.${definition.templateCode}.repeatable.${category}`] = `A maximum of ${spec.maxEntries} findings is allowed.`;
    if (spec?.allowedOptions) {
      populated.forEach((item, index) => {
        if (!spec.allowedOptions?.includes(item.value)) errors[`reports.${definition.templateCode}.repeatable.${category}.${index}`] = `Invalid repeatable finding '${item.value}'.`;
      });
    }
    if (populated.length > 0) frozen[category] = populated;
  }
  return frozen;
}

function composeReportSnapshot(session: IPatientReportSession, report: ILaboratoryReport, definition: ClinicalReportDefinition, errors: Record<string, string>): CompletedReportSnapshot {
  const prefix = `reports.${definition.templateCode}`;
  const requestedBy = resolveRequestedBy(report, definition, session);
  if (definition.requestedByPolicy.isRequired && !nonBlank(requestedBy)) errors[`${prefix}.requestedBy`] = `${definition.requestedByPolicy.fieldLabel || "Requested By"} is required.`;

  const additionalFields = { ...(report.encodingData?.additionalFields || {}) };
  for (const field of definition.additionalEncodingFields || []) {
    if (field.isRequired && !nonBlank(additionalFields[field.fieldCode])) errors[`${prefix}.additional.${field.fieldCode}`] = `${field.label} is required.`;
    if (field.inputType === "SingleSelect" && nonBlank(additionalFields[field.fieldCode]) && field.options && !field.options.includes(additionalFields[field.fieldCode])) errors[`${prefix}.additional.${field.fieldCode}`] = `${field.label} has an invalid selection.`;
  }

  if (definition.requiresKitInfo) {
    if (!nonBlank(report.reagentKitInfo?.lotNumber)) errors[`${prefix}.kit.lotNumber`] = "Reagent lot number is required.";
    if (!nonBlank(report.reagentKitInfo?.expirationDate)) errors[`${prefix}.kit.expirationDate`] = "Reagent expiration date is required.";
  }

  const signatoryRequirements = definition.signatoryRequirements || STANDARD_SIGNATORIES;
  const pathologists = report.signatories.filter((item) => item.role === "Pathologist").length;
  const medtechs = report.signatories.filter((item) => item.role === "MedicalTechnologist").length;
  if (pathologists < signatoryRequirements.requiredPathologistsCount) errors[`${prefix}.signatories.pathologists`] = `${signatoryRequirements.requiredPathologistsCount} Pathologist signatory is required.`;
  if (medtechs < signatoryRequirements.requiredMedtechsCount) errors[`${prefix}.signatories.medtechs`] = `${signatoryRequirements.requiredMedtechsCount} Medical Technologist signatory is required.`;

  const rawInputs: Record<string, string> = {};
  for (const parameter of definition.parameters) {
    const result = findResult(report, parameter);
    rawInputs[parameter.parameterCode] = rawInputValue(parameter, result?.resultValue || "");
  }
  const resolved = GenericReportResolver.resolveReport({
    definition,
    rawInputs,
    evaluationContext: { sex: session.demographics.sex || null },
  });
  const results: CompletedResultSnapshot[] = [];

  for (const parameter of [...definition.parameters].sort((a, b) => a.displayOrder - b.displayOrder)) {
    const source = findResult(report, parameter);
    const selected = (source as (typeof source & { isSelected?: boolean }))?.isSelected ?? true;
    const resolvedResult = resolved.find((item) => item.parameterCode === parameter.parameterCode)!;
    const rawValue = rawInputs[parameter.parameterCode] || "";
    const key = `${prefix}.results.${parameter.parameterCode}`;

    if (parameter.isRequired && !selected) errors[key] = `${parameter.parameterName} is required and cannot be deselected.`;
    if (parameter.isRequired && !nonBlank(parameter.inputType === "Computed" ? resolvedResult.formattedResultValue : rawValue)) errors[key] = `${parameter.parameterName} is required.`;
    if (selected && nonBlank(rawValue) && parameter.inputType === "NumericText" && !Number.isFinite(Number(rawValue))) errors[key] = `${parameter.parameterName} must be numeric.`;
    if (selected && nonBlank(rawValue) && parameter.inputType === "SingleSelect" && !parameter.conditionalChoiceSpec && parameter.options && !parameter.options.includes(rawValue)) errors[key] = `${parameter.parameterName} has an invalid selection.`;
    if (selected && nonBlank(rawValue) && parameter.conditionalChoiceSpec) {
      const separator = rawValue.indexOf(":");
      const label = separator >= 0 ? rawValue.slice(0, separator).trim() : "";
      const value = separator >= 0 ? rawValue.slice(separator + 1).trim() : "";
      if (!parameter.conditionalChoiceSpec.labelChoices.includes(label) || !parameter.conditionalChoiceSpec.resultOptions.includes(value)) errors[key] = `${parameter.parameterName} is incomplete or invalid.`;
    }
    if (selected && resolvedResult.evaluationOutcome === "Invalid") errors[key] = `${parameter.parameterName} is invalid.`;
    if (parameter.inputType === "Computed" && (!resolvedResult.isValid || !nonBlank(resolvedResult.formattedResultValue))) errors[key] = `${parameter.parameterName} could not be computed from valid dependencies.`;

    if (!selected || (!nonBlank(rawValue) && !parameter.isRequired && parameter.blankOmission)) continue;
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

  return {
    templateCode: definition.templateCode,
    templateTitle: report.templateTitle,
    rendererFamily: report.rendererFamily,
    requestedBy,
    additionalFields,
    results,
    remarks: report.remarks || "",
    reagentKitInfo: report.reagentKitInfo ? { ...report.reagentKitInfo } : null,
    repeatableFindings: validateRepeatableFindings(report, definition, errors),
    signatories: report.signatories.map((item) => ({ ...item })),
  };
}

export class ReportCompletionService {
  static validateAndCompose(session: IPatientReportSession, completedAt: string): CompletedSessionSnapshot {
    const errors: Record<string, string> = {};
    validateDemographics(session, errors);
    if (session.reports.length === 0) errors.reports = "At least one laboratory report is required.";
    const reports = session.reports.map((report) => {
      const definition = ReportDefinitionRegistry.getDefinition(report.templateCode);
      if (!definition) {
        errors[`reports.${report.templateCode}`] = "No approved declarative definition is registered.";
        return null;
      }
      return composeReportSnapshot(session, report, definition, errors);
    }).filter((item): item is CompletedReportSnapshot => item !== null);
    if (Object.keys(errors).length > 0) throw new ValidationError(`Session cannot be completed: ${Object.values(errors).join(" ")}`, errors);
    return { snapshotVersion: 1, completedAt, demographics: structuredClone(session.demographics), reports };
  }
}
