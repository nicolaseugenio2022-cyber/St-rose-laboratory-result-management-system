import { IReferenceEvaluationService } from "./interfaces";
import { ReferenceRuleSpec, EvaluationOutcome } from "../domain/types";

/**
 * Reference Evaluation Service Implementation.
 * Pure deterministic reference range grading engine.
 */
export class ReferenceEvaluationService implements IReferenceEvaluationService {
  evaluateResult(resultValue: string, rule?: ReferenceRuleSpec | null): EvaluationOutcome {
    if (!rule || !rule.evaluationType) {
      return "NoEvaluation";
    }

    const trimmedValue = (resultValue || "").trim();
    if (!trimmedValue) {
      return "NoEvaluation";
    }

    switch (rule.evaluationType) {
      case "NumericRange": {
        const num = parseFloat(trimmedValue);
        if (isNaN(num)) return "Abnormal";
        const min = rule.minValue ?? -Infinity;
        const max = rule.maxValue ?? Infinity;
        return num >= min && num <= max ? "Normal" : "Abnormal";
      }

      case "LessThan": {
        const num = parseFloat(trimmedValue);
        if (isNaN(num)) return "Abnormal";
        const max = rule.maxValue ?? Infinity;
        return num < max ? "Normal" : "Abnormal";
      }

      case "GreaterThan": {
        const num = parseFloat(trimmedValue);
        if (isNaN(num)) return "Abnormal";
        const min = rule.minValue ?? -Infinity;
        return num > min ? "Normal" : "Abnormal";
      }

      case "ExpectedValue": {
        if (!rule.expectedValue) return "NoEvaluation";
        return trimmedValue.toUpperCase() === rule.expectedValue.trim().toUpperCase()
          ? "Normal"
          : "Abnormal";
      }

      case "AllowedValues": {
        if (!rule.allowedValues || rule.allowedValues.length === 0) return "NoEvaluation";
        const normalizedAllowed = rule.allowedValues.map((v) => v.trim().toUpperCase());
        return normalizedAllowed.includes(trimmedValue.toUpperCase()) ? "Normal" : "Abnormal";
      }

      case "Informational":
        return "Informational";

      case "NoEvaluation":
      default:
        return "NoEvaluation";
    }
  }
}

export const referenceEvaluationService = new ReferenceEvaluationService();
