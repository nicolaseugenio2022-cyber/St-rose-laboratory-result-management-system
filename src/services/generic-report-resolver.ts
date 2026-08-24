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
import {
  resolveCalculationMode,
  type CalculationModeMap,
  type ResultProvenance,
} from "@/domain/calculation-mode";

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
  /** Operator intent per formula-bound parameter. Absent means every parameter resolves as Auto. */
  calculationModes?: CalculationModeMap;
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
    const { definition, rawInputs, evaluationContext = {}, calculationModes = {} } = input;
    const results: ResolvedParameterResult[] = [];

    for (const param of definition.parameters) {
      const resolved = GenericReportResolver.resolveParameter(
        param,
        rawInputs,
        evaluationContext,
        calculationModes,
        definition.parameters
      );
      results.push(resolved);
    }

    return results;
  }

  /**
   * Manual entry for a formula-bound parameter. The formula is never evaluated, so no formula
   * metadata is produced and nothing here can overwrite what the operator typed.
   *
   * Order matters: syntax, then the binding's result policy, then clinical evaluation. Reference
   * classification on its own would accept 0 and negatives as ordinary Low findings, because a
   * reference range answers "is this normal", not "is this a valid result".
   */
  private static resolveManualEntry(
    param: ParameterSpec,
    rawInputs: Record<string, string>,
    evaluationContext: EvaluationContext,
    resultPolicy: ValidationPolicy
  ): ResolvedParameterResult {
    const precision = param.formulaBinding?.precision ?? param.displayPrecision ?? 2;
    const entered = rawInputs[param.parameterCode] ?? "";
    const trimmed = entered.trim();
    const identity = {
      parameterCode: param.parameterCode,
      parameterName: param.parameterName,
      displayOrder: param.displayOrder,
    };
    const metadata = (extra: Record<string, unknown>) => ({
      calculationMode: "Manual" as const,
      provenance: "Manual" as ResultProvenance,
      precision,
      resultValidationPolicy: resultPolicy,
      ...extra,
    });

    if (trimmed === "") {
      return {
        ...identity,
        resultValue: entered,
        rawResultValue: null,
        formattedResultValue: "",
        evaluationOutcome: "NoEvaluation",
        computationMetadata: metadata({ pending: true, isResultValid: false }),
        isValid: false,
      };
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return {
        ...identity,
        resultValue: entered,
        rawResultValue: entered,
        formattedResultValue: "",
        evaluationOutcome: "Invalid",
        computationMetadata: metadata({ error: "Invalid number", isResultValid: false }),
        isValid: false,
      };
    }

    if (!isValueValidForPolicy(parsed, resultPolicy)) {
      return {
        ...identity,
        resultValue: entered,
        rawResultValue: entered,
        formattedResultValue: "",
        evaluationOutcome: "Invalid",
        computationMetadata: metadata({
          error: "Entered result " + getPolicyDescription(resultPolicy),
          isResultValid: false,
        }),
        isValid: false,
      };
    }

    // Valid entry: the parameter's own reference rules classify it, so a positive out-of-range
    // value stays a real High/Low finding instead of becoming a validation error.
    const evaluationOutcome = evaluateParameterValue(param, trimmed, evaluationContext, parsed);
    return {
      ...identity,
      resultValue: entered,
      rawResultValue: entered,
      formattedResultValue: formatHalfUp(parsed, precision),
      evaluationOutcome,
      computationMetadata: metadata({ isResultValid: true }),
      isValid: evaluationOutcome !== "Invalid",
    };
  }

  public static resolveParameter(
    param: ParameterSpec,
    rawInputs: Record<string, string>,
    evaluationContext: EvaluationContext = {},
    calculationModes: CalculationModeMap = {},
    siblingParameters: readonly ParameterSpec[] = []
  ): ResolvedParameterResult {
    // 1. Computed Parameter Resolution
    if (param.formulaBinding) {
      const binding = param.formulaBinding;
      const depPolicy = binding.dependencyValidationPolicy || binding.validationPolicy || "StrictPositive";
      const resultPolicy = binding.resultValidationPolicy || "StrictPositive";

      if (resolveCalculationMode(binding, param.parameterCode, calculationModes) === "Manual") {
        return GenericReportResolver.resolveManualEntry(param, rawInputs, evaluationContext, resultPolicy);
      }

      const numericDependencies: Record<string, number | null> = {};
      const manualInputs: Record<string, number> = {};
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

      // Active dependencies are formula-bound parameters this formula consumes only while THEY are
      // Manual. While such a parameter is Auto it is skipped entirely and the formula derives the
      // value itself, which is what preserves the exact unrounded intermediate. When it is Manual
      // the entered value becomes a real dependency and is held to the same dependency policy, so a
      // blank, non-numeric, zero or negative entry blocks the calculation exactly as any other
      // missing or invalid dependency would.
      for (const activeCode of binding.activeDependencies || []) {
        const sibling = siblingParameters.find((item) => item.parameterCode === activeCode);
        if (resolveCalculationMode(sibling?.formulaBinding, activeCode, calculationModes) !== "Manual") continue;
        const rawActive = rawInputs[activeCode];
        if (rawActive === undefined || rawActive === null || rawActive.trim() === "") {
          hasMissingDependency = true;
          numericDependencies[activeCode] = null;
          continue;
        }
        const numActive = Number(rawActive);
        if (!isValueValidForPolicy(numActive, depPolicy)) {
          hasInvalidDependency = true;
          numericDependencies[activeCode] = null;
          continue;
        }
        numericDependencies[activeCode] = numActive;
        manualInputs[activeCode] = numActive;
      }
      const effectiveDependencies = [...binding.dependencies, ...Object.keys(manualInputs)];

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
            calculationMode: "Auto",
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
            calculationMode: "Auto",
            error: `Missing or invalid formula dependencies (${getPolicyDescription(depPolicy)}).`,
            dependencies: numericDependencies,
            dependencyValidationPolicy: depPolicy,
          },
          displayOrder: param.displayOrder,
          isValid: false,
        };
      }

      try {
        const evaluationResult = FormulaRegistry.evaluateFormula(
          binding.formulaId,
          numericDependencies,
          manualInputs
        );
        const { unroundedValue, computationMetadata } = evaluationResult;
        // Provenance is derived here, never taken from the caller and never keyed off a template
        // code. A formula that consumed an entered HDL reports hdlSource "Manual", which is the only
        // case that may be described as the standard-input equation.
        const hdlSource = (computationMetadata as Record<string, unknown> | undefined)?.hdlSource;
        const provenance: ResultProvenance =
          hdlSource === "Manual"
            ? "StandardInputCalculation"
            : hdlSource === "ClientFormula"
              ? "ClientFormulaComposite"
              : "ClientFormula";

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
            calculationMode: "Auto",
            provenance,
            dependencies: effectiveDependencies,
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
