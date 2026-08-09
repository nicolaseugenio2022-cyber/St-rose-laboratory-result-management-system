import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { NumericBoundarySpec, ParameterSpec } from "@/domain/types/report-definition";

export interface EvaluationContext {
  sex?: PatientSex | null;
}

export interface ParameterEvaluationResolution {
  outcome: EvaluationOutcome;
  validationMessage: string | null;
}

function isValidConditionalChoice(value: string, parameter: ParameterSpec): boolean {
  const spec = parameter.conditionalChoiceSpec;
  if (!spec) return true;
  const separator = value.indexOf(":");
  if (separator < 0) return false;
  const label = value.slice(0, separator).trim();
  const result = value.slice(separator + 1).trim();
  return spec.labelChoices.includes(label) && spec.resultOptions.includes(result);
}

function isValidDeclaredEntry(value: string, parameter: ParameterSpec): boolean {
  if (parameter.inputType === "NumericText") return Number.isFinite(Number(value));
  if (parameter.inputType === "SingleSelect") {
    if (parameter.conditionalChoiceSpec) return isValidConditionalChoice(value, parameter);
    return !parameter.options || parameter.options.includes(value);
  }
  return true;
}

function evaluateNumeric(value: number, strategy: "NumericRange" | "LessThan" | "GreaterThan", boundary: NumericBoundarySpec): EvaluationOutcome {
  if (strategy === "LessThan") return value < (boundary.maxValue ?? Number.POSITIVE_INFINITY) ? "Normal" : "High";
  if (strategy === "GreaterThan") return value > (boundary.minValue ?? Number.NEGATIVE_INFINITY) ? "Normal" : "Low";
  if (boundary.minValue != null && value < boundary.minValue) return "Low";
  if (boundary.maxValue != null && value > boundary.maxValue) return "High";
  return "Normal";
}

export function resolveParameterEvaluation(
  parameter: ParameterSpec,
  rawValue: string,
  context: EvaluationContext = {},
  numericValue?: number | null
): ParameterEvaluationResolution {
  const trimmed = rawValue.trim();
  const hasNumericOverride = numericValue != null;
  if (!trimmed && !hasNumericOverride) {
    return { outcome: "NoEvaluation", validationMessage: null };
  }
  if (!isValidDeclaredEntry(trimmed, parameter)) {
    return {
      outcome: "Invalid",
      validationMessage: parameter.inputType === "NumericText" ? "Invalid number" : null,
    };
  }

  const policy = parameter.evaluationPolicy;
  if (policy.mode === "ValidEntryOnly" || policy.mode === "Unresolved") {
    return { outcome: "Entered", validationMessage: null };
  }

  if (policy.mode === "QualitativeAutomatic") {
    const normalized = trimmed.toLocaleUpperCase();
    const outcome = policy.expectedValues.some((value) => value.trim().toLocaleUpperCase() === normalized)
      ? "Normal"
      : policy.unexpectedOutcome;
    return { outcome, validationMessage: null };
  }

  const value = hasNumericOverride ? numericValue : Number(trimmed);
  if (value == null || !Number.isFinite(value)) {
    return { outcome: "Invalid", validationMessage: "Invalid number" };
  }
  const boundary = policy.sexBoundaries
    ? (context.sex ? policy.sexBoundaries[context.sex] : undefined)
    : policy.boundary;
  if (!boundary) return { outcome: "Entered", validationMessage: null };
  return {
    outcome: evaluateNumeric(value, policy.strategy, boundary),
    validationMessage: null,
  };
}

export function evaluateParameterValue(
  parameter: ParameterSpec,
  rawValue: string,
  context: EvaluationContext = {},
  numericValue?: number | null
): EvaluationOutcome {
  return resolveParameterEvaluation(parameter, rawValue, context, numericValue).outcome;
}
