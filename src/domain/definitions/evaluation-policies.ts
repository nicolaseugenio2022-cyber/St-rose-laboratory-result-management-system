import type { EvaluationPolicySpec } from "@/domain/types/report-definition";

export const validEntryOnly = (): EvaluationPolicySpec => ({ mode: "ValidEntryOnly" });

export const unresolvedEvaluation = (reason: string): EvaluationPolicySpec => ({
  mode: "Unresolved",
  reason,
});

export const numericRange = (minValue: number, maxValue: number): EvaluationPolicySpec => ({
  mode: "NumericAutomatic",
  strategy: "NumericRange",
  boundary: { minValue, maxValue },
});

export const lessThan = (maxValue: number): EvaluationPolicySpec => ({
  mode: "NumericAutomatic",
  strategy: "LessThan",
  boundary: { maxValue },
});

export const greaterThan = (minValue: number): EvaluationPolicySpec => ({
  mode: "NumericAutomatic",
  strategy: "GreaterThan",
  boundary: { minValue },
});

export const sexSpecificRange = (
  male: { minValue: number; maxValue: number },
  female: { minValue: number; maxValue: number }
): EvaluationPolicySpec => ({
  mode: "NumericAutomatic",
  strategy: "NumericRange",
  sexBoundaries: { Male: male, Female: female },
});
