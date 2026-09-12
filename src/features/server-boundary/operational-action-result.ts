import "server-only";

import { describeErrorShape } from "@/lib/safe-error";

/**
 * Typed, serializable outcomes for the operational Workspace and History Server Actions
 * (SHADCN-07B2, first module-bounded implementation of SHADCN-07A finding QA-09R-B).
 *
 * WHY THIS EXISTS. A Server Action that throws does not deliver its message to the browser. Next.js
 * replaces the message of an uncaught Server Action error with a fixed redaction string plus an
 * opaque `digest` before it crosses the wire. So every EXPECTED refusal - a session that is no
 * longer a draft, a report outside its replacement window, a draft that is already gone - reached
 * the operator as "An unexpected error has occurred" and a hex digest. The information was not
 * leaked; it was destroyed. Returning the outcome instead of throwing it is what makes an expected
 * refusal sayable.
 *
 * WHAT IS DELIBERATELY NOT HERE. The result carries a code and a message and nothing else. No
 * `fieldErrors`, no `cause`, no `digest`, no stack, no SQLSTATE, no PostgREST `message`/`details`/
 * `hint`, no relation or column name, no query text, no row, no internal metadata.
 *
 * THE MESSAGE IS DERIVED FROM THE CODE, NEVER PASSED ALONGSIDE IT. `operationalFailure` takes the
 * code only and looks the sentence up here. An earlier revision took both, which meant a call site
 * could pair any code with any message - including the wrong one - and nothing would notice. One
 * code, one sentence, one lookup: a mismatch is now unrepresentable rather than merely unlikely,
 * and adding a code without a sentence is a compile error because the map is keyed by the union.
 *
 * NO CAUGHT ERROR'S MESSAGE IS EVER READ. Not `error.message`, not for a recognised domain class.
 * A recognised `ValidationError` or `DomainInvariantError` selects one of OUR sentences by TYPE;
 * its own message, its `fieldErrors` and its `cause` are discarded. That is stricter than the
 * SHADCN-07B1 API allowlist, which does pass an allowlisted domain message through, and it is
 * stricter on purpose: `ReportCompletionService.validateAndCompose` composes its message from
 * accumulated clinical validation text, so "every ValidationError message is fixed wording" is not
 * a property anyone can promise for the class as a whole.
 *
 * UNEXPECTED FAILURES STAY UNEXPECTED. Infrastructure, Supabase/PostgREST, RPC, malformed-response
 * and programming faults are NOT converted. They go through `reportUnexpectedActionFailure`, which
 * records only the 07B1 sanitized shape and rethrows, so the segment error boundary still fires
 * and the defect stays loud.
 */
/**
 * Why the operational guard deliberately refused a caller, as a CLOSED set (SHADCN-07B2-R2).
 *
 * These four values mirror the `reasonCode` already recorded on the guard's SecurityDenial audit
 * event; they are the guard's own decision, not an inference about it.
 *
 * This type exists because a DELIBERATE refusal and an ACCIDENTAL failure are different events and
 * must never be conflated. The guard's four refusals previously threw a plain `Error`, so the only
 * way to recognise one from outside was to catch everything - which silently reclassified a failed
 * denial-audit write, a Supabase outage, and an ordinary programming fault as "you are not
 * authorized". That told the operator something false, and it hid a real defect behind a routine
 * refusal. Throwing a closed type is what makes the distinction checkable rather than assumed.
 *
 * The reason travels for SERVER-SIDE diagnosis only. It is never surfaced: all four map to the one
 * `OPERATIONAL_ACCESS_DENIED` sentence, so no refusal reveals which condition failed.
 */
export type OperationalAccessDenialReason =
  | "unauthenticated"
  | "first_login_incomplete"
  | "account_inactive"
  | "role_not_authorized";

export class OperationalAccessDeniedError extends Error {
  constructor(public readonly reason: OperationalAccessDenialReason) {
    super("Operational access denied.");
    this.name = "OperationalAccessDeniedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type OperationalActionErrorCode =
  /** The frozen operational guard refused this caller. One code for all four of its reasons. */
  | "OPERATIONAL_ACCESS_DENIED"
  /** Saving as a draft requires a draft. */
  | "DRAFT_SAVE_LIFECYCLE_INVALID"
  /** Completion requires a draft. */
  | "COMPLETION_LIFECYCLE_INVALID"
  /** Replacement requires a completed report inside its retention window. */
  | "REPLACEMENT_LIFECYCLE_INVALID"
  /** The repository refused on ownership or retention. Deliberately indistinguishable. */
  | "SESSION_UNAVAILABLE"
  /** Reopen refused: ownership, status, or retention. Deliberately indistinguishable. */
  | "SESSION_NOT_REOPENABLE"
  /** Draft deletion refused: missing, not owned, or not a draft. Deliberately indistinguishable. */
  | "DRAFT_NOT_DELETABLE"
  /** A recognised domain validation failure while resolving signatories against personnel. */
  | "SIGNATORY_VALIDATION_FAILED"
  /** A recognised domain validation failure raised by completion or replacement composition. */
  | "REPORT_VALIDATION_FAILED"
  /** Administrator deletion refused: missing, not completed, or already gone. Indistinguishable. */
  | "COMPLETED_SESSION_NOT_DELETABLE";

/**
 * The single code-to-sentence mapping. `Record<OperationalActionErrorCode, string>` is what makes
 * the set total: a new code without a sentence does not compile.
 *
 * `SESSION_UNAVAILABLE`, `SESSION_NOT_REOPENABLE` and `DRAFT_NOT_DELETABLE` are written to be TRUE
 * and IDENTICAL for every underlying cause - the row does not exist, it belongs to another
 * account, it is the wrong status, its retention window has lapsed. The repository already folds
 * those into one indistinguishable outcome, and these sentences preserve that at the surface, so
 * no typed refusal becomes an existence oracle. Saying "it is not yours" would be more helpful and
 * would leak exactly the fact the query was shaped to withhold.
 */
const OPERATIONAL_ACTION_MESSAGE: Record<OperationalActionErrorCode, string> = {
  // Truthful for all four refusal reasons at once, and specific to none of them. "Sign in again"
  // alone was wrong for first_login_incomplete, where the session is valid and the account setup
  // is what is outstanding; naming that condition would leak which check failed.
  OPERATIONAL_ACCESS_DENIED:
    "You are not currently authorized to perform this action. Sign in again, or complete any outstanding account setup, and retry.",
  DRAFT_SAVE_LIFECYCLE_INVALID:
    "This session is no longer a draft, so it cannot be saved as one. Reload the session and try again.",
  COMPLETION_LIFECYCLE_INVALID:
    "Only a draft session can be completed. Reload the session and try again.",
  // The window is written out rather than interpolated. checkpoint B5 reads this map as source text
  // and requires each lifecycle sentence to be a double-quoted literal, which is how it proves the
  // three codes cannot collapse onto one sentence. A template literal defeats that extraction, so
  // the number is stated here and the focused verifier asserts it still equals
  // SYSTEM_CONSTANTS.RETENTION.COMPLETED_REPORT_DAYS - drift is caught without weakening B5.
  REPLACEMENT_LIFECYCLE_INVALID:
    "This report can no longer be replaced. Replacement requires a completed report inside its 7-day retention window. Reload and try again.",
  SESSION_UNAVAILABLE:
    "This session is no longer available for this operation. Reload and try again.",
  SESSION_NOT_REOPENABLE:
    "This session is not available to reopen. Refresh your history and try again.",
  DRAFT_NOT_DELETABLE:
    "This draft is not available to delete. Refresh your history and try again.",
  SIGNATORY_VALIDATION_FAILED:
    "The assigned signatories could not be verified against the personnel directory. Check the signatories and try again.",
  REPORT_VALIDATION_FAILED:
    "This report did not pass validation and was not saved. Review the encoded results and try again.",
  COMPLETED_SESSION_NOT_DELETABLE:
    "This completed session is no longer available to delete. Refresh your history and try again.",
};

/**
 * A plain object, by construction: two string fields plus the caller's own data. Nothing here is a
 * class instance, a Map, a Date, or an Error, so it survives the Server Action serialization
 * boundary intact rather than arriving as an empty `{}`.
 *
 * Exactly three keys on the failure arm - `success`, `code`, `error` - and no fourth.
 */
export type OperationalActionResult<T> =
  | { success: true; data: T }
  | { success: false; code: OperationalActionErrorCode; error: string };

export function operationalSuccess<T>(data: T): OperationalActionResult<T> {
  return { success: true, data };
}

/**
 * The only way to build a failure, and it takes the code alone. There is no parameter through
 * which a call site could pass `error.message`, a template string, or any value derived from a
 * caught error - the message is looked up here or it does not exist.
 */
export function operationalFailure<T>(
  code: OperationalActionErrorCode
): OperationalActionResult<T> {
  return { success: false, code, error: OPERATIONAL_ACTION_MESSAGE[code] };
}

/**
 * Record an UNEXPECTED failure and re-raise it unchanged.
 *
 * Returns `never`: it always throws, so a caller that ends a branch with it is exhaustive and
 * TypeScript knows the expected-failure branches above it are the only ones that return.
 *
 * The log line carries fixed route/stage identifiers and the 07B1 sanitized shape - `isError`, an
 * allowlisted `errorName`, a recognised SQLSTATE/PostgREST classifier, and the bounded-transport
 * flag. Never the message, the stack, the payload, a session, a patient, or a credential.
 */
export function reportUnexpectedActionFailure(
  route: string,
  stage: string,
  error: unknown
): never {
  console.error("Operational server action failed.", {
    route,
    stage,
    ...describeErrorShape(error),
  });
  throw error;
}
