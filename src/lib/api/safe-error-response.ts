import "server-only";

import { ForbiddenError } from "@/lib/errors";
import {
  AccountOwnsReportsError,
  DuplicateUsernameError,
  LastActiveAdminError,
  SelfDeactivationError,
  SelfDeletionError,
  UserNotFoundError,
} from "@/services/userService";

/**
 * The allowlist of error classes whose message may cross to a browser (SHADCN-07B1).
 *
 * Every entry is a class this application defines, whose message is a fixed sentence written for
 * an operator. None is constructed from a database response, so none can carry a constraint name,
 * a column, a table, a SQLSTATE, a hint, a `details` payload or any part of a row.
 *
 * The handlers previously returned `error.message` for ANY caught value. `catch (error: any)` in
 * the collection route did not even require an Error, so a PostgREST rejection - a plain object
 * whose `message` is composed by Postgres - was returned verbatim with HTTP 400. That is the
 * disclosure this list closes, and it closes it by naming what is safe rather than by guessing
 * what is dangerous: an unrecognised value is generic by default, so a future throw site is safe
 * before anyone reviews it.
 *
 * `instanceof` is the test, never the message text or the `name` string, so an attacker-influenced
 * value cannot impersonate a safe class by carrying its name.
 */
const SAFE_DOMAIN_ERRORS = [
  AccountOwnsReportsError,
  DuplicateUsernameError,
  ForbiddenError,
  LastActiveAdminError,
  SelfDeactivationError,
  SelfDeletionError,
  UserNotFoundError,
] as const;

/** True only for an instance of an explicitly allowlisted domain error class. */
export function isSafeDomainError(error: unknown): error is Error {
  return SAFE_DOMAIN_ERRORS.some((domainError) => error instanceof domainError);
}

/**
 * The message a route handler may return for a caught value.
 *
 * `fallbackMessage` is each handler's own existing generic string, passed in rather than centralised,
 * so this change alters no user-facing wording: a recognised domain failure reads exactly as it did,
 * and everything else reads as that route already read when it had no message to show.
 */
export function safeApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return isSafeDomainError(error) ? error.message : fallbackMessage;
}
