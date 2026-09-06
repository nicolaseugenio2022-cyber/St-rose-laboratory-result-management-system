import { ILaboratoryReport } from "@/domain/models/interfaces";
import { LaboratoryResultDomain } from "@/domain/models/laboratory-report-domain";
import { ClinicalReportDefinition } from "@/domain/types/report-definition";
import { normalizeCalculationModes, resolveCalculationMode } from "@/domain/calculation-mode";
import { parseConditionalChoiceValue } from "./report-encoding";

/**
 * The single encoding-completion rule for the Workspace.
 *
 * This is the rule that previously lived inline in DynamicResultForm and drew the per-report
 * progress meter. It is extracted here unchanged so the session-level indicator can count whole
 * reports from the same rule rather than restating it - a second copy of "what counts as encoded"
 * would be a duplicated clinical semantic, and it could drift out from under the B4 assertions
 * that pin the rendered per-report counter.
 *
 * Pure and stateless: it derives from the report and its definition only, and never mutates
 * either. Nothing here changes parameter selection, calculation mode, or evaluation.
 */

/** The structural shape the completion rule reads - deliberately narrower than a full result. */
type CompletableResult = {
  parameterCode: string;
  resultValue: string;
  evaluationOutcome?: LaboratoryResultDomain["evaluationOutcome"];
};

export interface ReportEncodingProgress {
  /** Selected results belonging to this definition. The progress denominator. */
  selectedCount: number;
  /** Selected results satisfying the completion rule. The progress numerator. */
  completedCount: number;
  /** Rounded percentage, 0 when nothing is selected. */
  completionPercent: number;
  /** A report is complete only with at least one selected result and every one of them complete. */
  isComplete: boolean;
  /**
   * True when a **selected** result for this report evaluated to `Invalid`.
   *
   * Strictly `Invalid`, and nothing else. `High`, `Low` and `Abnormal` are ordinary clinical
   * outcomes that an operator is expected to encode and complete; treating any of them as a
   * defect would flag a correct abnormal result as a problem. `Invalid` is the only outcome that
   * blocks completion, which is what makes it the one worth surfacing on the work queue.
   *
   * Derived here, from the same selected-result set the counter uses, so the queue's indicator
   * and the report's meter can never disagree about which results are in scope. Deselected
   * parameters are excluded by `selectedResultsOf`, matching the rule that a deselected parameter
   * skips validation and evaluation entirely.
   */
  hasInvalidResult: boolean;
}

/**
 * Selected results for this definition, in the report's own order.
 *
 * A result is counted only when the definition still declares its parameter, so a stale result
 * left by a definition change cannot inflate either half of the counter.
 */
function selectedResultsOf(
  report: ILaboratoryReport,
  definition: ClinicalReportDefinition
): CompletableResult[] {
  return report.results.filter(
    (result) =>
      definition.parameters.some((parameter) => parameter.parameterCode === result.parameterCode) &&
      ((result as LaboratoryResultDomain).isSelected ?? true)
  );
}

/**
 * Non-empty does not imply complete.
 *
 * A conditional choice stores one flat "Label: Result" string, so a finding chosen before its
 * result is representable and must not advance progress. parseConditionalChoiceValue owns the
 * parsing rules - it returns an empty half for anything the spec does not declare - so both
 * halves surviving it is the completeness test.
 *
 * A Manual formula-bound value keeps the operator's exact string even when it is rejected, so
 * non-empty stops implying complete for it too. Completion already refuses these results, and the
 * counter has to agree or it reports work that cannot be completed. Mode comes from the shared
 * resolution rule, never from inbound computationMetadata. Auto is untouched: a rejected Auto
 * result is already blanked by the resolver and excluded by the blank check above.
 */
function isCompletedResult(
  result: CompletableResult,
  definition: ClinicalReportDefinition,
  calculationModes: ReturnType<typeof normalizeCalculationModes>
): boolean {
  if (result.resultValue.trim() === "") return false;
  const parameter = definition.parameters.find((item) => item.parameterCode === result.parameterCode);
  if (
    parameter?.formulaBinding &&
    resolveCalculationMode(parameter.formulaBinding, result.parameterCode, calculationModes) === "Manual" &&
    result.evaluationOutcome === "Invalid"
  ) return false;
  const choiceSpec = parameter?.conditionalChoiceSpec;
  if (!choiceSpec) return true;
  const parsed = parseConditionalChoiceValue(result.resultValue, choiceSpec);
  return parsed.label !== "" && parsed.result !== "";
}

/** Per-report encoding progress: the numbers the report card's meter draws. */
export function getReportEncodingProgress(
  report: ILaboratoryReport,
  definition: ClinicalReportDefinition
): ReportEncodingProgress {
  const calculationModes = normalizeCalculationModes(report.encodingData?.calculationModes);
  const selected = selectedResultsOf(report, definition);
  const completedCount = selected.filter((result) => isCompletedResult(result, definition, calculationModes)).length;
  return {
    selectedCount: selected.length,
    completedCount,
    completionPercent: selected.length ? Math.round(completedCount / selected.length * 100) : 0,
    isComplete: selected.length > 0 && completedCount === selected.length,
    // Exact equality against the one outcome that blocks completion. Never a truthiness test and
    // never a set membership check that could quietly grow to include High or Low.
    hasInvalidResult: selected.some((result) => result.evaluationOutcome === "Invalid"),
  };
}

/**
 * One selected examination. The caller resolves the pair it already holds; a template still
 * loading, removed from the registry, or not yet built into a report arrives with a missing half
 * and counts as incomplete rather than being dropped from the denominator.
 */
export interface SessionEncodingProgressEntry {
  report?: ILaboratoryReport | null;
  definition?: ClinicalReportDefinition | null;
}

export interface SessionEncodingProgress {
  /** Selected examinations whose every selected result is complete. */
  completedReports: number;
  /** Selected examinations, complete or not. */
  totalReports: number;
}

/** Session-level progress across the currently selected examinations. */
export function getSessionEncodingProgress(
  entries: readonly SessionEncodingProgressEntry[]
): SessionEncodingProgress {
  const completedReports = entries.filter(
    (entry) =>
      Boolean(entry.report) &&
      Boolean(entry.definition) &&
      getReportEncodingProgress(entry.report!, entry.definition!).isComplete
  ).length;
  return { completedReports, totalReports: entries.length };
}
