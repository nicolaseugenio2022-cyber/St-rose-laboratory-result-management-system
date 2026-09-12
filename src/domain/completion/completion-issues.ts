/**
 * What is blocking completion, as CLOSED structured data rather than prose.
 *
 * WHY THIS EXISTS. Completion can refuse a session for any of two dozen reasons across demographics,
 * results, reagent kit information, signatories, additional fields and repeatable findings. Every
 * one of them used to reach the operator as one sentence - "Review the encoded results and try
 * again" - because the only machine-readable thing the failure carried was a flat
 * `Record<string, string>` of dotted keys mapped to English. The Workspace therefore pre-checked the
 * two fields it could check itself and had nothing to route on for the rest, which is how a session
 * with a patient name correctly filled in could still be refused with no field to go to.
 *
 * WHAT AN ISSUE CARRIES, AND WHAT IT NEVER CARRIES. A `kind` from a closed set, plus the identifiers
 * needed to find the control: a template code, a parameter code, a field code. All three are
 * DEFINITION metadata. No entered value, no patient datum, no message, no `Error`, no cause, no
 * stack, no SQLSTATE or PostgREST text, no row, no signature path, no credential. Nothing here is
 * derived from a caught error.
 *
 * ROUTING IS NEVER PARSED FROM WORDING. The UI composes its own sentence from the `kind` and the
 * definitions it already holds. It never reads a message to decide where to send the operator,
 * which is the defect that made the old flat map unusable for routing in the first place.
 *
 * THE MESSAGE MAP IS KEPT ALONGSIDE, UNCHANGED. `ValidationError.fieldErrors` keeps exactly the
 * dotted keys and exactly the wording it has always carried, in the same order, so every existing
 * consumer and assertion sees what it saw before. The accumulator records both halves from one call,
 * so the structured issue and the message can never describe different failures.
 */

export type CompletionIssueKind =
  /** Session-level demographics. */
  | "PatientFullNameRequired"
  | "PatientDateOfBirthInvalid"
  | "PatientAgeRequired"
  | "PatientSexRequired"
  | "ExaminationDateRequired"
  /** Session-level structure. */
  | "NoReportSelected"
  | "ReportDefinitionMissing"
  /** Report setup. */
  | "RequestedByRequired"
  | "AdditionalFieldRequired"
  | "AdditionalFieldInvalid"
  | "KitLotNumberRequired"
  | "KitExpirationDateRequired"
  | "PathologistSignatoryRequired"
  | "MedtechSignatoryRequired"
  /** Results. */
  | "ResultRequiredParameterDeselected"
  | "ResultNotNumeric"
  | "ResultInvalidSelection"
  | "ResultConditionalChoiceIncomplete"
  | "ResultInvalid"
  | "ResultNotComputed"
  | "ReportHasNoResult"
  /** Repeatable findings. */
  | "RepeatableFindingLimitExceeded"
  | "RepeatableFindingInvalid";

/**
 * One blocking condition.
 *
 * `templateCode` is null only for a session-level condition. `parameterCode` and `fieldCode` are
 * null unless the condition belongs to one parameter or one named field, and they are never both
 * set. Every value is a code, never a label and never a sentence.
 */
export interface CompletionIssue {
  kind: CompletionIssueKind;
  templateCode: string | null;
  parameterCode: string | null;
  fieldCode: string | null;
}

interface AccumulatedIssue {
  message: string;
  issue: CompletionIssue;
}

/**
 * Collects the blocking conditions of one completion attempt.
 *
 * Keyed exactly as the flat map it replaces was: one entry per dotted key, the first write fixing
 * the entry's position and a later write to the same key replacing its contents. That is what a
 * repeated `errors[key] = message` assignment already did, so the message map this produces is
 * identical - same keys, same wording, same order - to the one completion has always thrown.
 */
export class CompletionIssueAccumulator {
  private readonly entries = new Map<string, AccumulatedIssue>();

  add(key: string, message: string, issue: CompletionIssue): void {
    this.entries.set(key, { message, issue });
  }

  get isEmpty(): boolean {
    return this.entries.size === 0;
  }

  /** The established `ValidationError.fieldErrors` shape, unchanged. */
  get fieldErrors(): Record<string, string> {
    const fieldErrors: Record<string, string> = {};
    for (const [key, entry] of this.entries) fieldErrors[key] = entry.message;
    return fieldErrors;
  }

  get issues(): CompletionIssue[] {
    return Array.from(this.entries.values(), (entry) => entry.issue);
  }
}

export function sessionIssue(kind: CompletionIssueKind): CompletionIssue {
  return { kind, templateCode: null, parameterCode: null, fieldCode: null };
}

export function reportIssue(kind: CompletionIssueKind, templateCode: string): CompletionIssue {
  return { kind, templateCode, parameterCode: null, fieldCode: null };
}

export function resultIssue(
  kind: CompletionIssueKind,
  templateCode: string,
  parameterCode: string
): CompletionIssue {
  return { kind, templateCode, parameterCode, fieldCode: null };
}

export function fieldIssue(
  kind: CompletionIssueKind,
  templateCode: string,
  fieldCode: string
): CompletionIssue {
  return { kind, templateCode, parameterCode: null, fieldCode };
}
