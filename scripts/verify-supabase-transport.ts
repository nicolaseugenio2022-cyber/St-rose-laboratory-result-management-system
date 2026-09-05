/**
 * QA-01R-R1 — server Supabase credential transport.
 *
 * Behavioural, not textual: every assertion drives the real `resilientFetch` with a stubbed
 * `globalThis.fetch` that captures the outgoing headers. No network, no database, no real key.
 *
 * The defect: supabase-js 2.112.2 sends `Authorization: Bearer <supabaseKey>` on PostgREST
 * requests. For new-format opaque keys (`sb_secret_…`) that value is not a JWT, which Supabase
 * documents as incorrect - such keys belong in `apikey` only. The library ships `isNewApiKey` to
 * prevent exactly this but wires it only into `functionsFetch`, never the REST client.
 *
 * One captured login failed with PGRST303 (HTTP 401); another succeeded under the same key and
 * code. The provider-side intermittency is therefore NOT established and is not asserted here.
 * What these assertions pin is the deterministic part: no PostgREST request leaves carrying a
 * bearer token that is not a JWT.
 *
 * Only fabricated keys appear here. The real deployment key is never read, printed, or compared.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://verifier.invalid";

const OPAQUE_KEY = "sb_secret_VERIFIER_FAKE_NOT_A_REAL_KEY";
const LEGACY_JWT_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.verifierfake";
const USER_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.differentfakesignature";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Supabase transport verification failed: ${message}`);
  console.log(`✓ ${message}`);
}

type Captured = { headers: Headers; method: string; redirect?: RequestRedirect };

/** Load a fresh copy of the transport module bound to the supplied server key. */
type TransportModule = {
  resilientFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  supabaseServer: {
    from: (table: string) => {
      select: (columns: string) => PromiseLike<{ error: unknown }>;
    };
  };
};

function loadTransport(secretKey: string): TransportModule {
  process.env.SUPABASE_SECRET_KEY = secretKey;
  const path = require.resolve("../src/lib/supabase/server");
  delete require.cache[path];
  return require(path) as TransportModule;
}

/** Run one request against a stubbed fetch and return what would have gone on the wire. */
async function capture(
  secretKey: string,
  init: RequestInit,
  respond: (attempt: number) => Response | Promise<Response>,
  /** Overrides the default URL input, so the Request-shaped dispatch can be exercised. */
  inputOverride?: RequestInfo | URL
): Promise<{ calls: Captured[]; response: Response | null; threw: unknown }> {
  const { resilientFetch } = loadTransport(secretKey);
  const calls: Captured[] = [];
  const originalFetch = globalThis.fetch;
  let attempt = 0;

  globalThis.fetch = (async (input: RequestInfo | URL, requestInit?: RequestInit) => {
    attempt += 1;
    // Captured from the EFFECTIVE dispatch, not from `init` alone: when the caller passes a
    // Request and no init, the headers live on the Request, and reading only `requestInit`
    // would make an absent-bearer assertion pass while the bearer was still on the wire.
    const dispatched =
      requestInit?.headers !== undefined
        ? new Headers(requestInit.headers as HeadersInit)
        : input instanceof Request
          ? new Headers(input.headers)
          : new Headers();
    calls.push({
      headers: dispatched,
      redirect: requestInit?.redirect ?? (input instanceof Request ? input.redirect : undefined),
      method: (requestInit?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase(),
    });
    return respond(attempt);
  }) as typeof globalThis.fetch;

  try {
    const response = await resilientFetch(
      inputOverride ?? "https://verifier.invalid/rest/v1/auth_attempts",
      init
    );
    return { calls, response, threw: null };
  } catch (error) {
    return { calls, response: null, threw: error };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const ok = () => new Response("[]", { status: 200 });

async function run(): Promise<void> {
  // Capture everything written to the console so no key can escape through a log line.
  const logged: string[] = [];
  const sinks = ["log", "error", "warn", "info", "debug"] as const;
  const originals = sinks.map((name) => [name, console[name]] as const);
  for (const name of sinks) {
    const original = console[name];
    console[name] = ((...args: unknown[]) => {
      // An Error is serialized by hand. JSON.stringify(new Error("...")) returns "{}" because
      // `message` and `stack` are non-enumerable, so `console.error(error)` contributed NOTHING to
      // the transcript and the no-key-in-logs assertion below passed even when the error text
      // carried a key value. Masked, not failing.
      logged.push(
        args
          .map((a) => {
            if (typeof a === "string") return a;
            if (a instanceof Error) return [a.name, a.message, a.stack ?? ""].join(" ");
            return String(JSON.stringify(a));
          })
          .join(" ")
      );
      original(...args);
    }) as typeof console.log;
  }

  try {
    // ── 1 & 2. Opaque key: apikey preserved, self-issued bearer removed ────────
    const read = await capture(
      OPAQUE_KEY,
      { method: "GET", headers: { apikey: OPAQUE_KEY, Authorization: `Bearer ${OPAQUE_KEY}` } },
      ok
    );
    assert(read.calls.length === 1, "an opaque-key read dispatches exactly one attempt");
    assert(
      read.calls[0].headers.get("apikey") === OPAQUE_KEY,
      "the opaque sb_secret_ key remains in the apikey header"
    );
    assert(
      read.calls[0].headers.get("Authorization") === null,
      "the opaque sb_secret_ key is absent from Authorization, so PostgREST never parses it as a JWT"
    );

    // Writes must be normalized identically - PGRST303 would otherwise hit every insert too.
    const write = await capture(
      OPAQUE_KEY,
      { method: "POST", headers: { apikey: OPAQUE_KEY, Authorization: `Bearer ${OPAQUE_KEY}` } },
      ok
    );
    assert(
      write.calls.length === 1 &&
        write.calls[0].headers.get("apikey") === OPAQUE_KEY &&
        write.calls[0].headers.get("Authorization") === null,
      "a write is normalized the same way and still dispatches exactly once"
    );

    // ── 3. A genuine user JWT is never stripped ───────────────────────────────
    const userToken = await capture(
      OPAQUE_KEY,
      { method: "GET", headers: { apikey: OPAQUE_KEY, Authorization: `Bearer ${USER_JWT}` } },
      ok
    );
    assert(
      userToken.calls[0].headers.get("Authorization") === `Bearer ${USER_JWT}` &&
        userToken.calls[0].headers.get("apikey") === OPAQUE_KEY,
      "a distinct genuine bearer JWT is preserved untouched alongside the apikey"
    );

    // ── 4. Legacy JWT-format key keeps the library's Bearer fallback ──────────
    const legacy = await capture(
      LEGACY_JWT_KEY,
      {
        method: "GET",
        headers: { apikey: LEGACY_JWT_KEY, Authorization: `Bearer ${LEGACY_JWT_KEY}` },
      },
      ok
    );
    assert(
      legacy.calls[0].headers.get("Authorization") === `Bearer ${LEGACY_JWT_KEY}` &&
        legacy.calls[0].headers.get("apikey") === LEGACY_JWT_KEY,
      "a legacy JWT-format key keeps its Bearer header; the correction narrows to opaque keys only"
    );

    // ── 4a. Rebinding control: a foreign opaque bearer survives ──────────────
    // Case 4 above is masked on its own: it only checks that the LEGACY_JWT_KEY bearer survives,
    // and a STALE module still bound to OPAQUE_KEY would leave that header alone too - so it
    // cannot prove `loadTransport` rebound anything. This is the POSITIVE control. Still under
    // LEGACY_JWT_KEY, an OPAQUE_KEY bearer is a FOREIGN token: `stripSelfIssuedBearer` deletes
    // Authorization only when it exactly equals the bearer form of the module's OWN currently
    // bound key, so a correctly rebound legacy-key module must leave it untouched. Had the
    // rebinding not happened the module would still be bound to OPAQUE_KEY, this header would be
    // its own self-issued bearer, and it would be stripped - failing the assertion below.
    const rebindControl = await capture(
      LEGACY_JWT_KEY,
      {
        method: "GET",
        headers: { apikey: LEGACY_JWT_KEY, Authorization: `Bearer ${OPAQUE_KEY}` },
      },
      ok
    );
    assert(
      rebindControl.calls[0].headers.get("Authorization") === `Bearer ${OPAQUE_KEY}` &&
        rebindControl.calls[0].headers.get("apikey") === LEGACY_JWT_KEY,
      "REBINDING CONTROL: under the legacy JWT-format key an OPAQUE_KEY bearer is a foreign token and is preserved, proving loadTransport really rebound the module - a stale module still bound to the opaque key would have stripped it"
    );

    // ── 4b. A Request-shaped dispatch is normalized too ──────────────────────
    // The headers can live on the input Request rather than on `init`; supabase-js is free to
    // call the injected fetch either way. Reading only `init` left this path carrying the
    // self-issued bearer - the one header this correction exists to remove.
    const viaRequest = await capture(
      OPAQUE_KEY,
      {},
      ok,
      new Request("https://verifier.invalid/rest/v1/auth_attempts", {
        headers: { apikey: OPAQUE_KEY, Authorization: `Bearer ${OPAQUE_KEY}` },
      })
    );
    assert(
      viaRequest.calls[0].headers.get("Authorization") === null &&
        viaRequest.calls[0].headers.get("apikey") === OPAQUE_KEY,
      "a Request-shaped dispatch is normalized as well: the opaque key still travels only in apikey"
    );

    // ── 4c. Redirects are refused on every credentialed dispatch ─────────────
    // `apikey` is a CUSTOM header, so nothing in the Fetch standard strips it on a cross-origin
    // hop. Following an https -> http redirect would therefore carry the server key in clear
    // text and defeat the https: requirement, which constrains only the URL this process dials.
    const writeDispatch = await capture(
      OPAQUE_KEY,
      { method: "POST", headers: { apikey: OPAQUE_KEY } },
      ok
    );
    assert(
      viaRequest.calls[0].redirect === "error" &&
        writeDispatch.calls[0].redirect === "error" &&
        legacy.calls[0].redirect === "error",
      "every credentialed dispatch refuses redirects - reads, writes and the Request-shaped path alike"
    );

    // ── 5. Read resilience and the no-retry-on-completed-response contract ────
    const transient = await capture(OPAQUE_KEY, { method: "GET" }, (attempt) => {
      if (attempt === 1) {
        const error = new Error("connect failure") as Error & { code?: string };
        error.code = "ECONNRESET";
        throw error;
      }
      return ok();
    });
    assert(
      transient.calls.length === 2 && transient.response?.status === 200,
      "a transient transport failure is still retried once, so read resilience is intact"
    );

    // ── 5a. QA-01R-R2: PGRST303 on an idempotent read is the ONE retryable completed response ─
    //
    // This REPLACES the previous assertion that a PGRST303 401 is never retried. That assertion
    // encoded the old contract, and it was correct until provider logs showed two concurrent
    // findAttempts SELECTs - identical key, identical headers, twelve milliseconds apart -
    // answered 401 and 200. Nothing this process controls could distinguish them, so the read
    // threw and a login failed with no attempt row written. The exemption is bounded below, and
    // every neighbouring no-retry guarantee is re-asserted rather than dropped.
    const jwtRejected = await capture(
      OPAQUE_KEY,
      { method: "GET", headers: { apikey: OPAQUE_KEY } },
      (attempt) =>
        attempt === 1 ? new Response('{"code":"PGRST303"}', { status: 401 }) : ok()
    );
    assert(
      jwtRejected.calls.length === 2 && jwtRejected.response?.status === 200,
      "a GET answered PGRST303 is retried exactly once and the second success is what the caller receives"
    );

    // A second PGRST303 STOPS. One extra attempt, never a third, and the 401 is handed back.
    const jwtRejectedTwice = await capture(
      OPAQUE_KEY,
      { method: "GET", headers: { apikey: OPAQUE_KEY } },
      () => new Response('{"code":"PGRST303"}', { status: 401 })
    );
    assert(
      jwtRejectedTwice.calls.length === 2 && jwtRejectedTwice.response?.status === 401,
      "a second PGRST303 ends the read: exactly two attempts, and the completed 401 is returned"
    );

    // A WRITE answered PGRST303 is never replayed - the ambiguous-write contract is untouched.
    const jwtRejectedWrite = await capture(
      OPAQUE_KEY,
      { method: "POST", headers: { apikey: OPAQUE_KEY } },
      () => new Response('{"code":"PGRST303"}', { status: 401 })
    );
    assert(
      jwtRejectedWrite.calls.length === 1 && jwtRejectedWrite.response?.status === 401,
      "a POST answered PGRST303 is never retried; the exemption is reads only"
    );

    // Every OTHER completed response keeps the original contract, including a different 401.
    for (const [status, body, label] of [
      [401, '{"code":"PGRST301"}', "a 401 that is not PGRST303"],
      [403, '{"code":"42501"}', "a 403 authorization denial"],
      [500, '{"code":"XX000"}', "a 500 server error"],
      [401, "not json at all", "a 401 whose body is not JSON"],
    ] as [number, string, string][]) {
      const completed = await capture(
        OPAQUE_KEY,
        { method: "GET", headers: { apikey: OPAQUE_KEY } },
        () => new Response(body, { status })
      );
      assert(
        completed.calls.length === 1 && completed.response?.status === status,
        `${label} is returned untouched after exactly one attempt`
      );
      // UNTOUCHED includes the body. The classifier inspects every 401 to decide whether it is
      // PGRST303, so reading the caller's stream rather than a clone would hand back a response
      // whose body is already consumed - surfacing as an empty result set rather than an error.
      assert(
        (await completed.response!.text()) === body,
        `${label} still carries its unconsumed body when it reaches the caller`
      );
    }

    // The retried response must still be READABLE: the classifier inspects a clone, never the
    // stream handed to the caller. A consumed body would surface as an empty result set rather
    // than an error, which is the quietest possible way to break a rate-limit read.
    const bodyIntact = await capture(
      OPAQUE_KEY,
      { method: "GET", headers: { apikey: OPAQUE_KEY } },
      (attempt) =>
        attempt === 1
          ? new Response('{"code":"PGRST303"}', { status: 401 })
          : new Response('[{"id":"row"}]', { status: 200 })
    );
    assert(
      (await bodyIntact.response!.text()) === '[{"id":"row"}]',
      "the response returned after a PGRST303 retry still has an unconsumed, readable body"
    );

    const writeFailure = await capture(OPAQUE_KEY, { method: "POST" }, () => {
      const error = new Error("connect failure") as Error & { code?: string };
      error.code = "ECONNRESET";
      throw error;
    });
    assert(
      writeFailure.calls.length === 1 && writeFailure.threw !== null,
      "a failed write is never retried; the ambiguous-write contract is unchanged"
    );

    // ── 6. INTEGRATION: drive the real exported client, not resilientFetch ────
    // resilientFetch alone proves the normalizer works; it does not prove the client is WIRED to
    // it. This drives supabaseServer.from().select() so the request travels the production path -
    // postgrest-js builds it, supabase-js fetchWithAuth attaches the bearer, and the client's
    // `global.fetch: resilientFetch` must be what finally dispatches it.
    {
      const { supabaseServer } = loadTransport(OPAQUE_KEY);
      const dispatched: Captured[] = [];
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (input: RequestInfo | URL, requestInit?: RequestInit) => {
        // EFFECTIVE headers, like the capture helper above. resilientFetch forwards the original
        // input, so the headers can live on a Request when init carries none - and
        // `new Headers(undefined)` is empty, which would let the Authorization assertion below
        // pass without ever inspecting what was dispatched.
        dispatched.push({
          headers:
            requestInit?.headers !== undefined
              ? new Headers(requestInit.headers as HeadersInit)
              : input instanceof Request
                ? new Headers(input.headers)
                : new Headers(),
          method: (requestInit?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase(),
        });
        return new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof globalThis.fetch;

      try {
        await supabaseServer.from("auth_attempts").select("id");
      } finally {
        globalThis.fetch = originalFetch;
      }

      assert(
        dispatched.length === 1,
        "a supabaseServer.from().select() dispatches exactly one request through the wired transport"
      );
      assert(
        dispatched[0].headers.get("apikey") === OPAQUE_KEY,
        "the client-dispatched PostgREST select carries the opaque key in apikey"
      );
      assert(
        dispatched[0].headers.get("Authorization") === null,
        "the client-dispatched PostgREST select carries NO Authorization bearer, so the wiring - not just the helper - is correct"
      );
    }

    // ── 7. No key value reaches any log sink ──────────────────────────────────
    const transcript = logged.join("\n");
    assert(
      !transcript.includes(OPAQUE_KEY) &&
        !transcript.includes(LEGACY_JWT_KEY) &&
        !transcript.includes(USER_JWT),
      "no key or token value is written to any console sink"
    );
  } finally {
    for (const [name, original] of originals) {
      console[name] = original as typeof console.log;
    }
  }

  console.log(
    "\nSupabase transport verification passed: the opaque server key travels only in apikey."
  );
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
