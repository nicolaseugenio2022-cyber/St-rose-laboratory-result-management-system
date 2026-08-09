/**
 * Generic Report Resolver
 *
 * Report-neutral resolution pipeline.
 * Does NOT contain template/report-code condition chains.
 *
 * Architecture:
 * ClinicalReportDefinition + Generic Validation Rules + FormulaRegistry + FormatterRegistry -> Resolved Parameters
 */

import { ClinicalReportDefinition, ParameterSpec, ValidationPolicy } from "@/domain/types/report-definition";
import { ILaboratoryResult } from "@/domain/models/interfaces";
import { FormulaRegistry } from "./formula-registry";
import { formatHalfUp, formatWithSuffix } from "./formatter-registry";
import { EvaluationOutcome } from "@/domain/types";
import { evaluateParameterValue, type EvaluationContext } from "./parameter-evaluation-service";

export function isValueValidForPolicy(val: number, policy: ValidationPolicy = "StrictPositive"): boolean {
  if (!Number.isFinite(val)) return false;
  switch (policy) {
    case "StrictPositive":
      return val > 0;
    case "NonNegative":
    case "AllowZero":
      return val >= 0;
    case "AnyFinite":
      return true;
    default:
      return val > 0;
  }
}

export function getPolicyDescription(policy: ValidationPolicy = "StrictPositive"): string {
  switch (policy) {
    case "StrictPositive":
      return "must be a finite number > 0";
    case "NonNegative":
    case "AllowZero":
      return "must be a finite number >= 0";
    case "AnyFinite":
      return "must be a finite number";
    default:
      return "must be a finite number > 0";
  }
}

export function resolveComputedValidationMessage(
  param: ParameterSpec,
  evaluationOutcome: EvaluationOutcome,
  computationMetadata?: Record<string, unknown> | null
): string | null {
  if (evaluationOutcome !== "Invalid" || computationMetadata?.pending === true) return null;

  const unroundedValue = computationMetadata?.unroundedValue;
  const resultPolicy = param.formulaBinding?.resultValidationPolicy || "StrictPositive";
  if (
    resultPolicy === "StrictPositive" &&
    typeof unroundedValue === "number" &&
    Number.isFinite(unroundedValue) &&
    unroundedValue <= 0
  ) {
    return "Computed result ≤ 0";
  }

  const resolverError = computationMetadata?.error;
  return typeof resolverError === "string" && resolverError.trim()
    ? resolverError
    : "Invalid computed result";
}

export interface GenericResolverInput {
  definition: ClinicalReportDefinition;
  rawInputs: Record<string, string>; // parameterCode -> entered string
  evaluationContext?: EvaluationContext;
}

export interface ResolvedParameterResult {
  parameterCode: string;
  parameterName: string;
  resultValue: string;                // Primary display value
  rawResultValue: string | null;     // Unformatted entered value or unrounded computed number
  formattedResultValue: string | null; // Formatted display string with suffix/precision
  evaluationOutcome: EvaluationOutcome;
  computationMetadata?: Record<string, unknown> | null;
  displayOrder: number;
  isValid: boolean;
}

export class GenericReportResolver {
  public static resolveReport(input: GenericResolverInput): ResolvedParameterResult[] {
    const { definition, rawInputs, evaluationContext = {} } = input;
    const results: ResolvedParameterResult[] = [];

    for (const param of definition.parameters) {
      const resolved = GenericReportResolver.resolveParameter(param, rawInputs, evaluationContext);
      results.push(resolved);
    }

    return results;
  }

  public static resolveParameter(
    param: ParameterSpec,
    rawInputs: Record<string, string>,
    evaluationContext: EvaluationContext = {}
  ): ResolvedParameterResult {
    // 1. Computed Parameter Resolution
    if (param.formulaBinding) {
      const binding = param.formulaBinding;
      const depPolicy = binding.dependencyValidationPolicy || binding.validationPolicy || "StrictPositive";
      const resultPolicy = binding.resultValidationPolicy || "StrictPositive";

      const numericDependencies: Record<string, number | null> = {};
      let hasInvalidDependency = false;
      let hasMissingDependency = false;

      for (const depCode of binding.dependencies) {
        const rawDep = rawInputs[depCode];
        if (rawDep === undefined || rawDep === null || rawDep.trim() === "") {
          hasMissingDependency = true;
          numericDependencies[depCode] = null;
          continue;
        }
        const numDep = Number(rawDep);

        if (!isValueValidForPolicy(numDep, depPolicy)) {
          hasInvalidDependency = true;
          numericDependencies[depCode] = null;
        } else {
          numericDependencies[depCode] = numDep;
        }
      }

      if (hasMissingDependency && !hasInvalidDependency) {
        return {
          parameterCode: param.parameterCode,
          parameterName: param.parameterName,
          resultValue: "",
          rawResultValue: null,
          formattedResultValue: "",
          evaluationOutcome: "NoEvaluation",
          computationMetadata: {
            formulaId: binding.formulaId,
            pending: true,
            dependencies: numericDependencies,
            dependencyValidationPolicy: depPolicy,
          },
          displayOrder: param.displayOrder,
          isValid: false,
        };
      }

      if (hasInvalidDependency) {
        return {
          parameterCode: param.parameterCode,
          parameterName: param.parameterName,
          resultValue: "",
          rawResultValue: null,
          formattedResultValue: "",
          evaluationOutcome: "Invalid",
          computationMetadata: {
            formulaId: binding.formulaId,
            error: `Missing or invalid formula dependencies (${getPolicyDescription(depPolicy)}).`,
            dependencies: numericDependencies,
            dependencyValidationPolicy: depPolicy,
          },
          displayOrder: param.displayOrder,
          isValid: false,
        };
      }

      try {
        const evaluationResult = FormulaRegistry.evaluateFormula(binding.formulaId, numericDependencies);
        const { unroundedValue, computationMetadata } = evaluationResult;

        // Declarative result validation policy enforcement
        const isResultValid = isValueValidForPolicy(unroundedValue, resultPolicy);
        const precision = binding.precision ?? 2;
        const formattedDisplay = isResultValid ? formatHalfUp(unroundedValue, precision) : "";
        const evaluationOutcome: EvaluationOutcome = isResultValid
          ? evaluateParameterValue(param, String(unroundedValue), evaluationContext, unroundedValue)
          : "Invalid";

        return {
          parameterCode: param.parameterCode,
          parameterName: param.parameterName,
          resultValue: formattedDisplay,
          rawResultValue: isResultValid ? String(unroundedValue) : null,
          formattedResultValue: formattedDisplay,
          evaluationOutcome,
          computationMetadata: {
            ...computationMetadata,
            dependencies: [...binding.dependencies],
            unroundedValue,
            formattedDisplay,
            precision,
            resultValidationPolicy: resultPolicy,
            isResultValid,
          },
          displayOrder: param.displayOrder,
          isValid: isResultValid,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Formula evaluation error";
        return {
          parameterCode: param.parameterCode,
          parameterName: param.parameterName,
          resultValue: "",
          rawResultValue: null,
          formattedResultValue: "",
          evaluationOutcome: "Invalid",
          computationMetadata: {
            formulaId: binding.formulaId,
            error: message,
          },
          displayOrder: param.displayOrder,
          isValid: false,
        };
      }
    }

    // 2. Standard Input Parameter Resolution
    const rawVal = rawInputs[param.parameterCode] || "";
    let formattedVal = rawVal;
    let isValid = true;

    if (param.inputType === "NumericText" && rawVal.trim() !== "") {
      const numericValue = Number(rawVal);
      isValid = Number.isFinite(numericValue);
      if (isValid && param.displayPrecision != null) {
        formattedVal = formatHalfUp(numericValue, param.displayPrecision);
      }
    }

    if (param.suffixSpec && rawVal.trim() !== "" && isValid) {
      formattedVal = formatWithSuffix(formattedVal, param.suffixSpec.suffix);
    }

    const evaluationOutcome = evaluateParameterValue(param, rawVal, evaluationContext);
    isValid = evaluationOutcome !== "Invalid";
    return {
      parameterCode: param.parameterCode,
      parameterName: param.parameterName,
      resultValue: formattedVal,
      rawResultValue: rawVal,
      formattedResultValue: formattedVal,
      evaluationOutcome,
      computationMetadata: null,
      displayOrder: param.displayOrder,
      isValid,
    };
  }
}
