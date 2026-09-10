/**
 * Permanent deletion of a directory record: the typed refusals, and the words the screen uses.
 *
 * Client-safe on purpose - it imports nothing - so the refusal codes the server returns and the
 * sentences the directory shows for them live in one module and cannot drift apart.
 *
 * Deactivation remains the ordinary, reversible withdrawal. Deletion permanently removes the LIVE
 * directory record, and the server decides every condition for it: the record is inactive, no
 * laboratory report names a physician by printed text, and (for a physician) no examination
 * assignment still points at it. A refusal is data the screen explains, never an exception.
 */
export type RecordDeletionRefusal =
  | "NOT_FOUND"
  | "STILL_ACTIVE"
  | "REFERENCED_BY_REPORTS"
  | "HAS_ASSIGNMENTS";

/**
 * The two words a personnel deletion can be refused with.
 *
 * A personnel record carries no examination assignments, so it cannot be refused for them; and it
 * is never refused for being named by a report either. Every completed report keeps its signatory's
 * printed name, credentials, PRC licence and signature on its own frozen row, which references the
 * permanent identity rather than the live directory entry, so removing the entry changes nothing a
 * completed report renders.
 *
 * REFERENCED_BY_REPORTS remains in `RecordDeletionRefusal` because a PHYSICIAN is still refused for
 * it: a physician is named by printed text inside reports, sessions and completed snapshots, and no
 * separate row preserves that text independently of the directory.
 */
export type PersonnelDeletionRefusal = Exclude<
  RecordDeletionRefusal,
  "HAS_ASSIGNMENTS" | "REFERENCED_BY_REPORTS"
>;

/**
 * `auditRecorded` says whether the deletion's audit record is known to have been written. The
 * server deletes and audits in ONE database transaction, so the two commit together or not at all
 * and every success it returns carries `true`. The flag stays in the contract so the screen keeps
 * its warning for a deletion whose audit record could not be confirmed, rather than assuming one.
 */
export type RecordDeletionResult<Refusal extends RecordDeletionRefusal = RecordDeletionRefusal> =
  | { success: true; auditRecorded: boolean }
  | { success: false; error: Refusal };

export const RECORD_DELETION_REFUSAL_MESSAGES: Readonly<Record<RecordDeletionRefusal, string>> = {
  NOT_FOUND: "This record no longer exists. The directory has been refreshed.",
  STILL_ACTIVE: "Only inactive records can be deleted. Deactivate this record first.",
  REFERENCED_BY_REPORTS:
    "This record is used by laboratory reports and cannot be deleted. Keep it inactive instead.",
  HAS_ASSIGNMENTS:
    "This physician is still assigned to examinations. Open Edit, clear every examination assignment and save, then delete.",
};

/**
 * Follows the record's name when the deletion committed but its audit record could not be
 * confirmed. Never phrased as a failure - the record IS gone - and never silent, because a
 * permanent deletion that may be unrecorded is something an administrator must be told about.
 */
export const RECORD_DELETION_UNAUDITED_NOTICE =
  "was permanently deleted, but its audit record could not be confirmed. Report this to the system administrator so the audit trail can be checked.";

/**
 * For a request that failed without an answer. Whether the deletion committed is then unknown, so
 * this never claims it did not happen: the directory is re-read, and the list shows which it was.
 */
export const RECORD_DELETION_FAILURE_MESSAGE =
  "The deletion could not be confirmed. The directory has been re-read: if the record is no longer listed, it was deleted.";
