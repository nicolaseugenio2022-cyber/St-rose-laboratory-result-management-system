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
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://verifier.invalid";

const OPAQUE_KEY = "sb_secret_VERIFIER_FAKE_NOT_A_REAL_KEY";
const LEGACY_JWT_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.verifierfake";
const USER_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.differentfakesignature";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Supabase transport verification failed: ${message}`);
  console.log(`✓ ${message}`);
}

type Captured = { headers: Headers; method: string };

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
  respond: (attempt: number) => Response | Promise<Response>
): Promise<{ calls: Captured[]; response: Response | null; threw: unknown }> {
  const { resilientFetch } = loadTransport(secretKey);
  const calls: Captured[] = [];
  const originalFetch = globalThis.fetch;
  let attempt = 0;

  globalThis.fetch = (async (input: RequestInfo | URL, requestInit?: RequestInit) => {
    attempt += 1;
    calls.push({
      headers: new Headers(requestInit?.headers as HeadersInit),
      method: (requestInit?.method ?? "GET").toUpperCase(),
    });
    return respond(attempt);
  }) as typeof globalThis.fetch;

  try {
    const response = await resilientFetch("http://verifier.invalid/rest/v1/auth_attempts", init);
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
      logged.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
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

    const unauthorized = await capture(
      OPAQUE_KEY,
      { method: "GET", headers: { apikey: OPAQUE_KEY } },
      () => new Response('{"code":"PGRST303"}', { status: 401 })
    );
    assert(
      unauthorized.calls.length === 1 && unauthorized.response?.status === 401,
      "a completed 401 is returned untouched and never retried; PGRST303 is not papered over by a retry"
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
      globalThis.fetch = (async (_input: RequestInfo | URL, requestInit?: RequestInit) => {
        dispatched.push({
          headers: new Headers(requestInit?.headers as HeadersInit),
          method: (requestInit?.method ?? "GET").toUpperCase(),
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
