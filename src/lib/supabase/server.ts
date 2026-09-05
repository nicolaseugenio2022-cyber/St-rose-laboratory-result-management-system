import "server-only";

// Application-owned authentication. Supabase Auth is NOT used; Supabase provides database and storage only.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseSecretKey) {
  throw new Error("Missing required server environment variable SUPABASE_SECRET_KEY.");
}

if (!supabaseUrl) {
  throw new Error("Missing required environment variable NEXT_PUBLIC_SUPABASE_URL.");
}

/**
 * The transport itself must be encrypted, or the credential correction below is moot.
 *
 * `stripSelfIssuedBearer` keeps the opaque server key out of `Authorization` so it travels only in
 * `apikey` - but `apikey` is still a header, and over `http:` it crosses the wire in clear text
 * along with every row it fetches. Existence of the variable was previously the only requirement,
 * so a misconfigured deployment could downgrade the whole database transport silently.
 *
 * Failing at module load is deliberate: this module builds the client at import time, so an
 * unencrypted target must stop the server starting rather than surface later as a request that
 * quietly succeeded over plaintext. The URL is parsed rather than string-matched so that neither
 * `https://x@http:` nor casing tricks can satisfy it.
 */
const supabaseProtocol = (() => {
  try {
    return new URL(supabaseUrl).protocol;
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid absolute URL.");
  }
})();

if (supabaseProtocol !== "https:") {
  throw new Error(
    `NEXT_PUBLIC_SUPABASE_URL must use https: - refusing to send the server key over '${supabaseProtocol}'.`
  );
}

/**
 * Transport resilience for READS ONLY (M6 P2).
 *
 * Measured baseline on this deployment: healthy reads p50 ~105ms, p90 ~213ms, worst observed
 * healthy request 3.4s - against an occasional pathological connection stall (one observed 10s
 * undici connect timeout while curl stayed healthy). Without a bound, a stalled response could
 * hold a server action for undici's 300s default.
 *
 * Policy, deliberately asymmetric by HTTP method:
 *
 * - GET/HEAD (PostgREST selects and counts - idempotent by construction): a TOTAL budget of
 *   READ_TOTAL_BUDGET_MS shared across at most two attempts, each capped at
 *   READ_ATTEMPT_TIMEOUT_MS. One retry, only for proven transient transport failures or our own
 *   attempt timeout. A completed HTTP response - any status, including 4xx/5xx - is returned
 *   untouched and never retried. A caller's own AbortSignal always wins and is never retried.
 *   Worst-case read wait is the total budget (~8s), not attempts x timeout.
 *
 * - POST/PATCH/DELETE and anything else: delegated to fetch byte-for-byte, with the caller's
 *   original init untouched. No timeout is added and no retry ever happens, because a client-side
 *   abort on a write yields an AMBIGUOUS outcome - the statement may have committed server-side
 *   after the client stopped listening. Session RPCs, audit inserts, login-attempt and lockout
 *   writes therefore keep exactly the transport semantics they had before this change; write
 *   retry policy stays where the domain already owns it (e.g. the first-login audit wrapper).
 *
 * The per-attempt signal stays attached to the returned Response, so a body that stalls AFTER
 * headers is also aborted at the attempt bound - but that failure surfaces in the caller's body
 * read (supabase-js), outside this wrapper, and is NOT retried.
 *
 * SINGLE RETRY OWNER. postgrest-js ships its own default-ON retry layer (3 retries, 1s/2s/4s
 * backoff, GET/HEAD, plus automatic 503/520 status retries). Left enabled it stacks on this
 * wrapper - up to 8 socket attempts and a ~39s worst-case stall for one read. `db.retry` is
 * therefore disabled on the client below, making this wrapper the only retry layer end to end:
 * at most two network attempts per read, worst case bounded by the total budget. Disabling it
 * intentionally also removes PostgREST's automatic 503/520 status retries: the approved contract
 * is that a completed HTTP response - any status - is returned to the caller untouched and never
 * automatically retried. storage-js, supabase-js core and undici fetch contain no retry layer of
 * their own (verified against the installed versions; supabase-js 2.112.2).
 */
const READ_ATTEMPT_TIMEOUT_MS = 5_000;
const READ_TOTAL_BUDGET_MS = 8_000;
const READ_RETRY_DELAY_MS = 150;

/** Transient transport failure codes: connection-level faults where nothing reached PostgREST. */
const TRANSIENT_TRANSPORT_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
]);

/**
 * QA-01R-R1: never present the opaque server key as a Bearer token.
 *
 * What is established:
 *   - supabase-js 2.112.2 places the opaque server key in `Authorization: Bearer …` for REST
 *     requests. It ships `isNewApiKey` to prevent exactly that, but wires the protection only into
 *     `functionsFetch` (index.cjs:644); the REST client is built on the unprotected `this.fetch`
 *     (index.cjs:643, consumed at :651), and with no Supabase Auth session the bearer falls back
 *     to the raw key.
 *   - Supabase documents that new-format opaque keys are not JWTs and belong in `apikey` only -
 *     the library repeats this verbatim at index.cjs:263-268.
 *   - One captured login failed with PGRST303 (HTTP 401, "JWT claims validation or parsing
 *     failed"), surfacing as a postgrest-js plain-object envelope.
 *   - Another request under the SAME key and the SAME code succeeded end to end.
 *
 * So the provider-side intermittency - why PostgREST rejected one request and accepted another -
 * is NOT established, and this comment does not claim it. What is deterministic is the precondition
 * being removed: after this normalization no PostgREST request carries a bearer token that is not a
 * JWT, which is what Supabase documents as correct regardless of how the server chooses to treat
 * an invalid one.
 *
 * The correction is deliberately narrow. The header is dropped ONLY when its value is exactly the
 * bearer form of this deployment's own opaque key, so:
 *   - `apikey` is untouched and remains the sole credential, which is what PostgREST expects;
 *   - a genuine user JWT in Authorization is never removed;
 *   - a legacy JWT-format key is never touched, because `isOpaqueApiKey` is false for it and the
 *     library's Bearer fallback remains correct for that key type.
 *
 * The key value is compared, never logged.
 */
function isOpaqueApiKey(value: string): boolean {
  return value.startsWith("sb_secret_") || value.startsWith("sb_publishable_");
}

/**
 * The headers this dispatch will ACTUALLY send.
 *
 * `init.headers` wins when present, because `fetch(input, init)` lets init override a Request's own
 * headers. When it is absent the headers still exist - they are the input `Request`'s - and reading
 * only `init` there was the gap: a caller that passes `new Request(url, { headers })` and no init
 * kept its self-issued bearer, which is exactly the header this normalizer exists to remove.
 */
function effectiveHeaders(input: RequestInfo | URL, init?: RequestInit): Headers | null {
  if (init?.headers) return new Headers(init.headers as HeadersInit);
  if (typeof Request !== "undefined" && input instanceof Request) return new Headers(input.headers);
  return null;
}

function stripSelfIssuedBearer(
  input: RequestInfo | URL,
  init?: RequestInit
): RequestInit | undefined {
  if (!supabaseSecretKey || !isOpaqueApiKey(supabaseSecretKey)) return init;

  const headers = effectiveHeaders(input, init);
  if (!headers) return init;

  const selfIssued = `Bearer ${supabaseSecretKey}`;
  if (headers.get("Authorization") !== selfIssued) return init;

  headers.delete("Authorization");
  // Returned as an init override even when the caller supplied none: init headers take precedence
  // over the input Request's, so this is what actually removes it from the wire.
  return { ...init, headers };
}

function isReadRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method =
    init?.method ?? (typeof input === "object" && "method" in input ? input.method : undefined);
  const normalized = (method ?? "GET").toUpperCase();
  return normalized === "GET" || normalized === "HEAD";
}

/** Walks the cause chain (including AggregateError members from multi-address connects). */
function isTransientTransportError(error: unknown, depth = 0): boolean {
  if (depth > 4 || !error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; cause?: unknown; errors?: unknown[] };
  if (typeof candidate.code === "string" && TRANSIENT_TRANSPORT_CODES.has(candidate.code)) return true;
  if (Array.isArray(candidate.errors) && candidate.errors.some((inner) => isTransientTransportError(inner, depth + 1))) {
    return true;
  }
  return isTransientTransportError(candidate.cause, depth + 1);
}

function isAttemptTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

/** Exported for the offline P2 verification harness only; production use is via supabaseServer. */
export async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // Normalized once, before either dispatch path, so reads and writes are covered identically.
  // The input is passed too, because the headers may live on it rather than on `init`.
  const request = stripSelfIssuedBearer(input, init);

  // REDIRECTS ARE REFUSED, on both paths.
  //
  // The https: requirement above constrains only the URL this process dials. Fetch follows
  // redirects by default, and `apikey` is a CUSTOM header - unlike `Authorization`, nothing in
  // the Fetch standard strips it on a cross-origin hop - so an https -> http redirect would
  // carry the server key to an unencrypted endpoint and defeat that check entirely.
  //
  // Failing closed is the deliberate trade. PostgREST does not redirect, and Storage streams
  // authenticated objects rather than answering 3xx, so this should never fire; if it ever
  // does, it surfaces as a loud request failure instead of a silent cleartext credential.


  if (!isReadRequest(input, request)) {
    // Writes: original semantics, untouched. No added signal, no timeout, no retry - except
    // the redirect policy, which applies to every credentialed dispatch (see below).
    return fetch(input, { ...request, redirect: "error" });
  }

  const deadline = Date.now() + READ_TOTAL_BUDGET_MS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const attemptSignal = AbortSignal.timeout(Math.min(READ_ATTEMPT_TIMEOUT_MS, remaining));
    const signal = request?.signal ? AbortSignal.any([request.signal, attemptSignal]) : attemptSignal;

    try {
      return await fetch(input, { ...request, signal, redirect: "error" });
    } catch (error) {
      // Caller cancellation always wins and is never retried.
      if (request?.signal?.aborted) throw error;
      lastError = error;
      const retryable = isAttemptTimeout(error) || isTransientTransportError(error);
      if (attempt === 2 || !retryable) throw error;
      if (deadline - Date.now() <= READ_RETRY_DELAY_MS) throw error;
      await new Promise((resolve) => setTimeout(resolve, READ_RETRY_DELAY_MS));
    }
  }

  throw lastError ?? new Error("Read request budget exhausted before any attempt completed.");
}

/**
 * Classifies the value THROWN by a repository's `if (error) throw error` when a read failed at
 * the transport layer, for callers that render a graceful retry surface (M6 resilience
 * follow-up).
 *
 * This is a different layer from the attempt-level helpers above. When the fetch promise
 * rejects, postgrest-js (2.112.2, shouldThrowOnError off) converts the rejection into a
 * RESOLVED envelope whose error member is a PLAIN OBJECT LITERAL - not an Error instance -
 * with message `"<Name>: <message>"` and `code`/`hint` both empty strings. A completed HTTP
 * error response instead carries a nonempty PostgREST/SQLSTATE `code` (or, for a non-JSON
 * body, no `code` member at all), and app-internal failures are real Error instances. Those
 * facts make this predicate narrow: it accepts only the two rejection-conversion shapes our
 * own read policy can produce (attempt timeout, undici transport failure).
 *
 * Deliberately fail-closed: if a future supabase-js/postgrest-js upgrade changes the envelope
 * shape, values stop matching and callers fall through to their generic error path - the
 * retryable classification silently narrows, never widens. Do not broaden it speculatively.
 */
export function isTransientSupabaseReadFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null || error instanceof Error) return false;
  const { message, code, hint } = error as { message?: unknown; code?: unknown; hint?: unknown };
  if (code !== "" || hint !== "" || typeof message !== "string") return false;
  return message.startsWith("TimeoutError:") || message.startsWith("TypeError: fetch failed");
}

export const supabaseServer = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  db: {
    // Sole retry owner is resilientFetch above. See SINGLE RETRY OWNER in the policy comment.
    retry: false,
  },
  global: {
    fetch: resilientFetch,
  },
});
