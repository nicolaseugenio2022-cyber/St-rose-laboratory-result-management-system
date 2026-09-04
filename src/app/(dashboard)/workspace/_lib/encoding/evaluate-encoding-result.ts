import { ParameterSpec } from "@/domain/types/report-definition";
import { EvaluationOutcome, PatientSex } from "@/domain/types";
import {
  evaluateParameterValue,
  resolveParameterEvaluation,
  type ParameterEvaluationResolution,
} from "@/services/parameter-evaluation-service";

export function evaluateEncodingResult(value: string, parameter: ParameterSpec, sex?: PatientSex | null): EvaluationOutcome {
  return evaluateParameterValue(parameter, value, { sex });
}

export function resolveEncodingResult(
  value: string,
  parameter: ParameterSpec,
  sex?: PatientSex | null
): ParameterEvaluationResolution {
  return resolveParameterEvaluation(parameter, value, { sex });
}

export function displayUnit(parameter: ParameterSpec): string | null {
  const suffix = parameter.suffixSpec?.suffix?.trim();
  if (suffix) return suffix;
  return parameter.unit?.trim() || null;
}
