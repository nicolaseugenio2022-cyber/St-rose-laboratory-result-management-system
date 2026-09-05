import "server-only";

import { isTransientSupabaseReadFailure } from "@/lib/supabase/server";

/**
 * The complete, closed set of fields a sanitized server-side diagnostic may carry (SHADCN-07B1).
 *
 * Nothing here is derived from a value a caller supplied or a record the database returned. The
 * error's own message, stack, `hint`, `details`, payload and any username, address, token or
 * credential are deliberately absent and must never be added: a swallowed loader failure is
 * observable by its SHAPE, which is what identifies the failing dependency, and never by its
 * content.
 *
 * Three properties hold for every field below, and all three are load-bearing:
 *
 *   1. **No field is a pass-through.** An earlier revision accepted any identifier-shaped string
 *      for `errorName` and any short alphanumeric string for `postgrestCode`. That is not
 *      sufficient: `sk_live_ABC123`, `SECRET_TOKEN_123` and `PASSWORD123` are all
 *      identifier-shaped, so a thrown value carrying a key in `name` or `code` would have been
 *      logged verbatim. Both fields are now matched against a CLOSED set - an explicit allowlist
 *      of names, and two exact classifier formats - so an unrecognised value is replaced, never
 *      emitted.
 *   2. **A rejected value is replaced, never repaired.** No truncation, lower-casing or other
 *      normalization is attempted, because a truncated or reshaped secret is still a secret and a
 *      normalized one may re-enter the allowlist.
 *   3. **Describing an error can never itself throw.** Every property read goes through
 *      `readProperty`, so a getter or Proxy trap that throws yields `undefined` instead of
 *      turning a diagnostic into a second failure inside a catch block.
 */
export type SafeErrorShape = {
  /** Whether the thrown value was a real Error instance rather than a plain object. */
  isError: boolean;
  /** An allowlisted error name, `"object"`, or a `typeof` keyword. Never a caller-supplied string. */
  errorName: string;
  /** A recognised SQLSTATE or PostgREST classifier, else null. */
  postgrestCode: string | null;
  /** The existing bounded-transport classification, reused rather than re-derived. */
  transientRead: boolean;
};

/**
 * The only error names this application needs to tell apart, and the only ones ever emitted.
 *
 * The standard ECMAScript constructors, plus the two `DOMException` names the bounded read policy
 * in `supabase/server.ts` actually turns on - `TimeoutError` for its own attempt bound and
 * `AbortError` for a caller cancellation. `AggregateError` appears because a multi-address connect
 * failure arrives as one.
 *
 * Application-defined error classes are deliberately absent: they carry no diagnostic value in a
 * log line that already records the route and stage, and admitting them would mean maintaining a
 * second, growing allowlist. They report as `"Error"`.
 */
const ALLOWED_ERROR_NAMES = new Set([
  "AbortError",
  "AggregateError",
  "Error",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TimeoutError",
  "TypeError",
  "URIError",
]);

/** SQLSTATE: exactly five uppercase alphanumerics - `23505`, `42P01`. */
const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;

/** PostgREST: `PGRST` followed by exactly three digits - `PGRST116`. */
const POSTGREST_PATTERN = /^PGRST[0-9]{3}$/;

/**
 * Read one property without trusting the object.
 *
 * A rejected value is not necessarily a well-behaved record: an accessor or a Proxy `get` trap
 * may throw, and that must not escape a diagnostic call sited inside a `catch`.
 */
function readProperty(source: unknown, key: string): unknown {
  try {
    return (source as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

/** `instanceof` consults the prototype chain, which a Proxy trap can make throw. */
function isErrorInstance(value: unknown): boolean {
  try {
    return value instanceof Error;
  } catch {
    return false;
  }
}

/**
 * Name the thrown value without quoting it.
 *
 * An Error reports its own name only if that name is on the allowlist, and otherwise the literal
 * `"Error"`. A non-null object always reports `"object"` - its constructor name is NOT consulted,
 * because a constructor name is as attacker-influenced as any other string and reading it bought
 * nothing that `postgrestCode` does not already say. Anything else reports `typeof`, which is
 * drawn from a fixed set of JavaScript keywords and is therefore always safe to emit.
 */
function errorNameOf(error: unknown, isError: boolean): string {
  if (isError) {
    const name = readProperty(error, "name");
    return typeof name === "string" && ALLOWED_ERROR_NAMES.has(name) ? name : "Error";
  }

  if (typeof error === "object" && error !== null) return "object";

  return typeof error;
}

/**
 * Read a PostgREST or SQLSTATE classifier off a rejected envelope.
 *
 * Only a NON-Error object is inspected: postgrest-js converts a transport rejection into a plain
 * object literal, which is exactly the shape that otherwise reduces to the single uninformative
 * token `"object"`. An Error instance already identifies itself by `name`.
 *
 * The two accepted formats are the real bounded classifier shapes and nothing wider. A value that
 * is merely short and alphanumeric - `PASSWORD123`, `ABCDEFGH` - matches neither and becomes null.
 */
function postgrestCodeOf(error: unknown, isError: boolean): string | null {
  if (isError || typeof error !== "object" || error === null) return null;

  const code = readProperty(error, "code");
  if (typeof code !== "string") return null;

  return SQLSTATE_PATTERN.test(code) || POSTGREST_PATTERN.test(code) ? code : null;
}

/**
 * Classify transport transience, failing closed.
 *
 * The classifier reads `message`, `code` and `hint` off the candidate, so a hostile or exotic
 * value could make it throw. `false` is the safe answer: it is the value that causes a caller to
 * treat the failure as permanent, which surfaces it rather than degrading quietly.
 */
function transientReadOf(error: unknown): boolean {
  try {
    return isTransientSupabaseReadFailure(error);
  } catch {
    return false;
  }
}

/**
 * Reduce any thrown value to the closed, non-sensitive shape above.
 *
 * Callers spread this into a fixed-identifier log line. It classifies; it never quotes.
 */
export function describeErrorShape(error: unknown): SafeErrorShape {
  const isError = isErrorInstance(error);
  return {
    isError,
    errorName: errorNameOf(error, isError),
    postgrestCode: postgrestCodeOf(error, isError),
    transientRead: transientReadOf(error),
  };
}
