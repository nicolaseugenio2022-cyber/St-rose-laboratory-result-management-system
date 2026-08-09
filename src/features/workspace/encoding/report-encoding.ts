import {
  ILaboratoryReport,
  IRepeatableFindingValue,
} from "@/domain/models/interfaces";
import {
  LaboratoryReportDomain,
  LaboratoryResultDomain,
} from "@/domain/models/laboratory-report-domain";
import { RendererFamily, SignatorySnapshot, EvaluationOutcome } from "@/domain/types";
import {
  ClinicalReportDefinition,
  ConditionalChoiceSpec,
  ParameterSpec,
} from "@/domain/types/report-definition";
import { GenericReportResolver } from "@/services/generic-report-resolver";
import type { EvaluationContext } from "@/services/parameter-evaluation-service";
import { stripFixedSuffix } from "@/services/formatter-registry";

export interface BuildEncodingReportInput {
  definition: ClinicalReportDefinition;
  sessionId: string;
  reportId: string;
  rendererFamily: RendererFamily;
  signatories: SignatorySnapshot[];
  existingReport?: ILaboratoryReport | null;
  legacyRequestedBy?: string | null;
  legacyAdditionalFields?: Record<string, string | undefined>;
  evaluationContext?: EvaluationContext;
}

function hasOwnRequestedBy(report?: ILaboratoryReport | null): boolean {
  return Boolean(
    report?.encodingData &&
      Object.prototype.hasOwnProperty.call(report.encodingData, "requestedBy")
  );
}

function findLegacyResult(
  parameter: ParameterSpec,
  results: ILaboratoryReport["results"]
) {
  const acceptedCodes = [parameter.parameterCode, ...(parameter.legacyParameterCodes || [])];
  return results.find((result) => acceptedCodes.includes(result.parameterCode));
}

function normalizeStoredEditableValue(parameter: ParameterSpec, value: string): string {
  return parameter.suffixSpec
    ? stripFixedSuffix(value, parameter.suffixSpec.suffix)
    : value;
}

function resolveLegacyConditionalValue(
  parameter: ParameterSpec,
  results: ILaboratoryReport["results"],
  candidateValue: string
): string {
  if (!parameter.conditionalChoiceSpec) return candidateValue;
  const label = candidateValue.trim();
  if (!label || label.toLowerCase() === "none" || label.includes(":")) return label === "None" ? "" : label;

  const severity = results.find((result) => result.parameterCode === "CRYSTAL_SEVERITY")?.resultValue?.trim();
  return severity ? `${label}: ${severity}` : label;
}

function buildInitialResults(
  definition: ClinicalReportDefinition,
  reportId: string,
  existingResults: ILaboratoryReport["results"] = []
): LaboratoryResultDomain[] {
  const consumedCodes = new Set<string>();

  const definitionResults = [...definition.parameters]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((parameter) => {
      const legacyResult = findLegacyResult(parameter, existingResults);
      if (legacyResult) consumedCodes.add(legacyResult.parameterCode);

      const initialValue = legacyResult
        ? resolveLegacyConditionalValue(
            parameter,
            existingResults,
            normalizeStoredEditableValue(parameter, legacyResult.resultValue || "")
          )
        : parameter.defaultValue || "";

      return new LaboratoryResultDomain({
        id: legacyResult?.id || `res-${reportId}-${parameter.parameterCode}`,
        reportId,
        parameterCode: parameter.parameterCode,
        parameterName: parameter.parameterName,
        resultValue: initialValue,
        rawResultValue: legacyResult?.rawResultValue ?? initialValue,
        formattedResultValue: legacyResult?.formattedResultValue ?? null,
        unit: parameter.unit,
        evaluationOutcome: legacyResult?.evaluationOutcome || "NoEvaluation",
        referenceRuleSnapshot: legacyResult?.referenceRuleSnapshot || null,
        computationMetadata: legacyResult?.computationMetadata || null,
        displayOrder: parameter.displayOrder,
        isSelected: parameter.isRequired
          ? true
          : ((legacyResult as LaboratoryResultDomain | undefined)?.isSelected ?? true),
      });
    });

  consumedCodes.add("CRYSTAL_SEVERITY");
  consumedCodes.add("OTHER_FINDINGS");

  const unmappedLegacyResults = existingResults
    .filter((result) => !consumedCodes.has(result.parameterCode))
    .map((result) => new LaboratoryResultDomain({ ...result }));

  return [...definitionResults, ...unmappedLegacyResults];
}

function buildRepeatableFindings(
  definition: ClinicalReportDefinition,
  existingReport?: ILaboratoryReport | null
): Record<string, IRepeatableFindingValue[]> {
  const existing = existingReport?.encodingData?.repeatableFindings || {};
  const result: Record<string, IRepeatableFindingValue[]> = Object.fromEntries(
    Object.entries(existing).map(([category, findings]) => [
      category,
      findings.map((finding) => ({ ...finding })),
    ])
  );

  const legacyOtherFinding = existingReport?.results.find(
    (item) => item.parameterCode === "OTHER_FINDINGS" && item.resultValue.trim() !== ""
  );
  const firstCategory = definition.repeatableFindings?.[0]?.findingCategory;
  if (legacyOtherFinding && firstCategory && !(result[firstCategory]?.length > 0)) {
    result[firstCategory] = [
      {
        id: legacyOtherFinding.id || `legacy-${firstCategory}-1`,
        category: firstCategory,
        value: legacyOtherFinding.resultValue,
        displayOrder: 1,
      },
    ];
  }

  return result;
}

export function buildEncodingReport(input: BuildEncodingReportInput): LaboratoryReportDomain {
  const {
    definition,
    existingReport,
    legacyRequestedBy,
    legacyAdditionalFields = {},
  } = input;
  const reportId = existingReport?.id || input.reportId;
  const existingAdditionalFields = existingReport?.encodingData?.additionalFields || {};
  const additionalFields = { ...existingAdditionalFields };

  for (const field of definition.additionalEncodingFields || []) {
    if (additionalFields[field.fieldCode] === undefined) {
      additionalFields[field.fieldCode] = legacyAdditionalFields[field.fieldCode] || "";
    }
  }

  const requestedBy = hasOwnRequestedBy(existingReport)
    ? existingReport?.encodingData?.requestedBy || ""
    : legacyRequestedBy?.trim()
      ? legacyRequestedBy
      : definition.requestedByPolicy.defaultPhysician || "";

  const defaultKit = definition.defaultKitInfo;
  const reagentKitInfo = existingReport?.reagentKitInfo
    ? { ...existingReport.reagentKitInfo }
    : definition.requiresKitInfo
      ? {
          kitBrand: "",
          lotNumber: defaultKit?.lotNumber || "",
          expirationDate: defaultKit?.expirationDate || "",
        }
      : undefined;

  const initializedReport = new LaboratoryReportDomain({
    id: reportId,
    sessionId: existingReport?.sessionId || input.sessionId,
    templateCode: definition.templateCode,
    templateTitle: definition.templateTitle,
    rendererFamily: existingReport?.rendererFamily || input.rendererFamily,
    remarks: existingReport ? existingReport.remarks : definition.defaultRemarks || "",
    reagentKitInfo,
    encodingData: {
      ...(existingReport?.encodingData || {}),
      requestedBy,
      additionalFields,
      repeatableFindings: buildRepeatableFindings(definition, existingReport),
    },
    results: buildInitialResults(definition, reportId, existingReport?.results),
    signatories: existingReport?.signatories || input.signatories,
  });
  return reevaluateEncodingReport(initializedReport, definition, input.evaluationContext);
}

export function reevaluateEncodingReport(
  report: ILaboratoryReport,
  definition: ClinicalReportDefinition,
  evaluationContext: EvaluationContext = {}
): LaboratoryReportDomain {
  const rawInputs = Object.fromEntries(report.results.map((result) => [result.parameterCode, result.resultValue]));
  const resolved = GenericReportResolver.resolveReport({ definition, rawInputs, evaluationContext });
  const results = report.results.map((result) => {
    const parameter = definition.parameters.find((item) => item.parameterCode === result.parameterCode);
    const resolvedResult = resolved.find((item) => item.parameterCode === result.parameterCode);
    if (!parameter || !resolvedResult) return new LaboratoryResultDomain({ ...result });
    if (parameter.inputType === "Computed") {
      return new LaboratoryResultDomain({
        ...result,
        resultValue: resolvedResult.formattedResultValue || "",
        rawResultValue: resolvedResult.rawResultValue,
        formattedResultValue: resolvedResult.formattedResultValue,
        evaluationOutcome: resolvedResult.evaluationOutcome,
        computationMetadata: resolvedResult.computationMetadata,
      });
    }
    return new LaboratoryResultDomain({
      ...result,
      formattedResultValue: resolvedResult.formattedResultValue,
      evaluationOutcome: resolvedResult.evaluationOutcome,
    });
  });
  return new LaboratoryReportDomain({ ...report, results });
}

export function applyEncodingResultValue(
  report: ILaboratoryReport,
  definition: ClinicalReportDefinition,
  parameterCode: string,
  value: string,
  evaluationOutcome: EvaluationOutcome,
  evaluationContext: EvaluationContext = {}
): LaboratoryReportDomain {
  const parameter = definition.parameters.find((item) => item.parameterCode === parameterCode);
  const editableValue = parameter?.suffixSpec
    ? stripFixedSuffix(value, parameter.suffixSpec.suffix)
    : value;

  let nextResults = report.results.map((result) =>
    result.parameterCode === parameterCode
      ? new LaboratoryResultDomain({
          ...result,
          resultValue: editableValue,
          rawResultValue: editableValue,
          formattedResultValue: null,
          evaluationOutcome,
        })
      : new LaboratoryResultDomain({ ...result })
  );

  return reevaluateEncodingReport(new LaboratoryReportDomain({ ...report, results: nextResults }), definition, evaluationContext);
}

export function applyParameterSelection(
  report: ILaboratoryReport,
  definition: ClinicalReportDefinition,
  parameterCode: string,
  selected: boolean
): LaboratoryReportDomain {
  const parameter = definition.parameters.find((item) => item.parameterCode === parameterCode);
  if (!parameter?.isSelectable) return new LaboratoryReportDomain({ ...report });
  return new LaboratoryReportDomain({
    ...report,
    results: report.results.map((result) => result.parameterCode === parameterCode
      ? new LaboratoryResultDomain({ ...result, isSelected: selected })
      : new LaboratoryResultDomain({ ...result })),
  });
}

export function applyAllSelectableParameters(
  report: ILaboratoryReport,
  definition: ClinicalReportDefinition,
  selected: boolean
): LaboratoryReportDomain {
  return new LaboratoryReportDomain({
    ...report,
    results: report.results.map((result) => {
      const parameter = definition.parameters.find((item) => item.parameterCode === result.parameterCode);
      return new LaboratoryResultDomain({
        ...result,
        isSelected: parameter?.isSelectable ? selected : (result as LaboratoryResultDomain).isSelected,
      });
    }),
  });
}

export function getEditableResultValue(parameter: ParameterSpec, storedValue: string): string {
  return parameter.suffixSpec
    ? stripFixedSuffix(storedValue, parameter.suffixSpec.suffix)
    : storedValue;
}

export function formatConditionalChoiceValue(label: string, result: string): string {
  return label && result ? `${label}: ${result}` : "";
}

export function parseConditionalChoiceValue(
  value: string,
  spec: ConditionalChoiceSpec
): { label: string; result: string } {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex < 0) {
    return {
      label: spec.labelChoices.includes(value.trim()) ? value.trim() : "",
      result: "",
    };
  }

  const label = value.slice(0, separatorIndex).trim();
  const result = value.slice(separatorIndex + 1).trim();
  return {
    label: spec.labelChoices.includes(label) ? label : "",
    result: spec.resultOptions.includes(result) ? result : "",
  };
}

export function addRepeatableFinding(
  findings: IRepeatableFindingValue[],
  category: string,
  id: string
): IRepeatableFindingValue[] {
  return [
    ...findings,
    { id, category, value: "", displayOrder: findings.length + 1 },
  ];
}

export function updateRepeatableFinding(
  findings: IRepeatableFindingValue[],
  id: string,
  value: string
): IRepeatableFindingValue[] {
  return findings.map((finding) =>
    finding.id === id ? { ...finding, value } : finding
  );
}

export function removeRepeatableFinding(
  findings: IRepeatableFindingValue[],
  id: string
): IRepeatableFindingValue[] {
  return findings
    .filter((finding) => finding.id !== id)
    .map((finding, index) => ({ ...finding, displayOrder: index + 1 }));
}

export function moveRepeatableFinding(
  findings: IRepeatableFindingValue[],
  id: string,
  direction: -1 | 1
): IRepeatableFindingValue[] {
  const index = findings.findIndex((finding) => finding.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= findings.length) return findings;

  const reordered = [...findings];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return reordered.map((finding, order) => ({ ...finding, displayOrder: order + 1 }));
}
