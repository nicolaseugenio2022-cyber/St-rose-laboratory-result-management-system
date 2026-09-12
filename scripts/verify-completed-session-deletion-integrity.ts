/**
 * HISTORY-DELETION-INTEGRITY-R1 - the completed-session deletion and its audit are ONE transaction.
 *
 * THE DEFECT THIS PINS CLOSED. `deleteCompletedSessionAction` used to issue a DELETE that committed
 * on its own and then a separate audit INSERT. A fault on the second write destroyed a clinical
 * record - the session, its reports, its results, its signatories and its frozen snapshot - and left
 * nothing saying who destroyed it, while telling the operator the operation had failed. Both writes
 * now live inside `delete_completed_session`, so they share one transaction.
 *
 * TWO HALVES, PROVED TWO WAYS.
 *
 *   1. BY EXECUTION, the application boundary. It RUNS the real `deleteCompletedSessionAction`
 *      through the real operational guard, the real input schema and the real repository, against a
 *      stand-in Supabase client that answers `rpc()` and refuses every table access. It proves who
 *      reaches the function, what is sent to it - the session id, and an actor taken from the
 *      resolved session and never from the payload - that every answer is reported truthfully, and
 *      that the action emits no success audit of its own.
 *   2. BY READING, the migration that defines the function, and the foreign keys that bound what
 *      its DELETE can reach.
 *
 * WHY THE ROLLBACK IS PROVED STRUCTURALLY. A plpgsql function body is one atomic unit: any error
 * inside it aborts the whole thing, including a DELETE that has already run. So the rollback is
 * real exactly when the audit INSERT is inside that body, after the delete, with no exception
 * handler catching it and no transaction-control statement splitting it. Those four facts are what
 * this file asserts. They are the rollback, not a proxy for it. Running the abort against real rows
 * belongs to live acceptance, and no migration is applied here.
 *
 * Exactly three modules are replaced, through the CommonJS require cache before anything loads
 * them: the session resolver, the privileged Supabase client, and the audit service. Nothing else.
 *
 * Run WITH --conditions=react-server: the action imports `server-only`.
 */

import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Completed session deletion integrity verification failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

const cwd = process.cwd();
const nodeRequire = createRequire(join(cwd, "package.json"));

function stubModule(relativePath: string, exports: Record<string, unknown>): void {
  const id = nodeRequire.resolve(join(cwd, relativePath));
  nodeRequire.cache[id] = {
    id,
    filename: id,
    loaded: true,
    children: [],
    paths: [],
    exports,
  } as never;
}

function readSource(relativePath: string): string {
  return readFileSync(join(cwd, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function canonical(value: unknown): string {
  return JSON.stringify(value);
}

/** Live code only. The `[^:]` guard keeps a `https://` URL from being read as a line comment. */
function stripTsComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*/g, "$1 ");
}

/**
 * Split a SQL argument list on its TOP-LEVEL commas only. A comma inside parentheses belongs to a
 * nested call, and a comma inside a quoted literal is data; neither separates an argument. This is
 * what lets an alternating key/value list be read by position instead of by line shape.
 */
function splitTopLevelArguments(region: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (let index = 0; index < region.length; index += 1) {
    const character = region[index];
    if (quoted) {
      current += character;
      if (character === "'") {
        // A doubled '' is an escaped quote INSIDE the literal. Consume both and stay quoted;
        // re-reading the second one as an opening quote would desynchronise the rest of the region.
        if (region[index + 1] === "'") {
          current += "'";
          index += 1;
        } else {
          quoted = false;
        }
      }
      continue;
    }
    if (character === "'") {
      quoted = true;
      current += character;
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}

/* ─────────────────────────────── The stand-in Supabase client ──────────────────────────────── */

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

type RpcAnswer = { data: unknown; error: unknown };

/** Every rpc() the application made, in order. */
const rpcCalls: RpcCall[] = [];
/** Every table the application tried to reach directly. This deletion must reach none. */
const tableAccesses: string[] = [];
/** What the next rpc() answers. */
let rpcAnswer: (call: RpcCall) => RpcAnswer = () => ({ data: "DELETED", error: null });

const fakeSupabase = {
  from: (table: string) => {
    tableAccesses.push(table);
    throw new Error(`Unexpected direct table access: ${table}`);
  },
  rpc: async (fn: string, args: Record<string, unknown>): Promise<RpcAnswer> => {
    // Yield once, as a network round trip would.
    await Promise.resolve();
    const call = { fn, args: structuredClone(args) };
    rpcCalls.push(call);
    return rpcAnswer(call);
  },
};

/* ─────────────────────────────── Callers and the audit sink ──────────────────────────────── */

interface Caller {
  session: { userId: string; mustChangePassword: boolean; mustSetRecovery: boolean };
  user: { id: string; role: "Admin" | "User" | "Developer"; username: string; status: "Active" };
}

function caller(id: string, role: Caller["user"]["role"], username: string): Caller {
  return {
    session: { userId: id, mustChangePassword: false, mustSetRecovery: false },
    user: { id, role, username, status: "Active" },
  };
}

const ADMIN = caller("00000000-0000-4000-8000-00000000a001", "Admin", "admin.one");
const USER = caller("00000000-0000-4000-8000-00000000c001", "User", "user.one");
const DEVELOPER = caller("00000000-0000-4000-8000-00000000d001", "Developer", "dev.one");

const SESSION_ID = "11111111-2222-4333-8444-555555555555";

let currentCaller: Caller | null = ADMIN;
const auditEvents: Array<Record<string, unknown>> = [];

stubModule("src/lib/session", {
  resolveAuthenticatedRequest: async () => currentCaller,
});
stubModule("src/lib/supabase/server", { supabaseServer: fakeSupabase });
stubModule("src/services/audit-service-instance", {
  auditService: {
    emit: async (event: Record<string, unknown>) => {
      auditEvents.push(structuredClone(event));
    },
  },
});

// Loaded only now, so every module in its graph binds the three stubs above.
const serverActions = nodeRequire(
  join(cwd, "src/features/server-boundary/server-actions")
) as typeof import("../src/features/server-boundary/server-actions");

interface AttemptOutcome {
  result: { success: boolean; code?: string } | null;
  threw: unknown;
  rpcCalls: RpcCall[];
  auditEvents: Array<Record<string, unknown>>;
  tableAccesses: string[];
}

async function attemptDeletion(
  who: Caller | null,
  answer: (call: RpcCall) => RpcAnswer,
  input: unknown = { sessionId: SESSION_ID }
): Promise<AttemptOutcome> {
  currentCaller = who;
  rpcAnswer = answer;
  rpcCalls.length = 0;
  auditEvents.length = 0;
  tableAccesses.length = 0;
  let result: AttemptOutcome["result"] = null;
  let threw: unknown = null;
  try {
    result = (await serverActions.deleteCompletedSessionAction(input)) as AttemptOutcome["result"];
  } catch (error: unknown) {
    threw = error;
  }
  return {
    result,
    threw,
    rpcCalls: [...rpcCalls],
    auditEvents: [...auditEvents],
    tableAccesses: [...tableAccesses],
  };
}

const DELETED = (): RpcAnswer => ({ data: "DELETED", error: null });
const UNREACHABLE = (): RpcAnswer => {
  throw new Error("the deletion transaction must not be reached by a refused caller");
};

/* ───────────────────────── 1. Only an Administrator reaches the RPC ─────────────────────────── */

async function verifyOnlyAdministratorReachesTheFunction(): Promise<void> {
  console.log("\n-- Only an Administrator reaches the deletion transaction --");

  const admin = await attemptDeletion(ADMIN, DELETED);
  assert(
    admin.result?.success === true && admin.rpcCalls.length === 1,
    "an Administrator reaches the deletion transaction exactly once and is told it succeeded"
  );

  for (const [label, who] of [
    ["a laboratory User", USER],
    ["a Developer", DEVELOPER],
    ["an unauthenticated caller", null],
  ] as const) {
    const refused = await attemptDeletion(who, UNREACHABLE);
    assert(refused.rpcCalls.length === 0, `${label} never reaches the deletion transaction`);
    assert(
      refused.result?.success === false &&
        refused.result?.code === "OPERATIONAL_ACCESS_DENIED" &&
        refused.threw === null,
      `${label} is refused with OPERATIONAL_ACCESS_DENIED, returned and never thrown`
    );
  }

  // Denial auditing stays at the authorization boundary. Only the SUCCESS audit moved into SQL.
  const refusedUser = await attemptDeletion(USER, UNREACHABLE);
  const denial = refusedUser.auditEvents.at(-1) ?? {};
  assert(
    refusedUser.auditEvents.length === 1 &&
      denial.category === "SecurityDenial" &&
      denial.eventType === "CompletedSessionDeletionDenied" &&
      denial.actorRole === "User" &&
      canonical(denial.details) === canonical({ reasonCode: "role_not_authorized" }),
    "a laboratory User's refusal is audited at the boundary as CompletedSessionDeletionDenied"
  );

  const refusedDeveloper = await attemptDeletion(DEVELOPER, UNREACHABLE);
  const developerDenial = refusedDeveloper.auditEvents.at(-1) ?? {};
  assert(
    developerDenial.category === "SecurityDenial" &&
      developerDenial.eventType === "OperationalAccessDenied" &&
      developerDenial.actorRole === "Developer",
    "a Developer is refused by the operational guard before the Administrator gate, and audited as such"
  );

  // NEGATIVE CONTROL for the harness itself. If the fake client could not record a call, every
  // "never reaches the transaction" assertion above would pass for the wrong reason.
  const recorded = await attemptDeletion(ADMIN, DELETED);
  assert(
    recorded.rpcCalls.length === 1 && recorded.rpcCalls[0]?.fn === "delete_completed_session",
    "the stand-in client does record a reached transaction, so an empty record means it was not reached"
  );
}

/* ────────────── 2. Missing and non-completed targets return a typed refusal ────────────── */

async function verifyTypedRefusals(): Promise<void> {
  console.log("\n-- Missing and non-completed targets are typed refusals, never successes --");

  for (const word of ["NOT_FOUND", "NOT_COMPLETED"] as const) {
    const outcome = await attemptDeletion(ADMIN, () => ({ data: word, error: null }));
    assert(
      outcome.result?.success === false &&
        outcome.result?.code === "COMPLETED_SESSION_NOT_DELETABLE" &&
        outcome.threw === null,
      `${word} is reported as the typed COMPLETED_SESSION_NOT_DELETABLE refusal`
    );
    assert(
      outcome.auditEvents.length === 0,
      `${word} writes no audit event - nothing was deleted, so nothing is recorded as deleted`
    );
  }

  // The two refusals are INDISTINGUISHABLE to the caller, so no one can learn whether an accession
  // exists by asking to delete it.
  const missing = await attemptDeletion(ADMIN, () => ({ data: "NOT_FOUND", error: null }));
  const notCompleted = await attemptDeletion(ADMIN, () => ({ data: "NOT_COMPLETED", error: null }));
  assert(
    canonical(missing.result) === canonical(notCompleted.result),
    "a missing session and a non-completed session are indistinguishable to the caller"
  );

  // An answer the closed set does not contain is never reported as a success.
  const unrecognised = await attemptDeletion(ADMIN, () => ({ data: "SOMETHING_ELSE", error: null }));
  assert(
    unrecognised.result === null && unrecognised.threw instanceof Error,
    "an unrecognised answer from the deletion transaction is never reported as a success"
  );

  // A raised database exception is a transport-class failure, not a refusal word.
  const raised = await attemptDeletion(ADMIN, () => ({
    data: null,
    error: { code: "ST007", message: "INVALID_PAYLOAD" },
  }));
  assert(
    raised.result === null && raised.threw !== null,
    "an exception raised inside the deletion transaction is never reported as a success"
  );
}

/* ─────── 3. What the action sends, and that it writes no success audit of its own ─────── */

async function verifyActionSendsTheResolvedActorAndAuditsNothing(): Promise<void> {
  console.log("\n-- The action sends the resolved actor and writes no success audit --");

  const outcome = await attemptDeletion(ADMIN, DELETED);
  const call = outcome.rpcCalls[0];
  assert(call?.fn === "delete_completed_session", "the action invokes delete_completed_session");
  assert(
    canonical(call?.args) ===
      canonical({
        p_session_id: SESSION_ID,
        p_actor_user_id: ADMIN.user.id,
        p_actor_username: ADMIN.user.username,
        p_actor_role: "Admin",
      }),
    "the session id and the RESOLVED actor are sent, and nothing else"
  );
  assert(
    outcome.auditEvents.length === 0,
    "a successful deletion emits no audit event from the application - the transaction owns it"
  );
  assert(
    outcome.tableAccesses.length === 0,
    "a successful deletion touches no table directly - every write is inside the transaction"
  );

  // The actor cannot be supplied by the caller. An ownership field in the payload is rejected by
  // the input schema before anything is sent.
  const spoofed = await attemptDeletion(ADMIN, DELETED, {
    sessionId: SESSION_ID,
    createdByUserId: DEVELOPER.user.id,
  });
  assert(
    spoofed.rpcCalls.length === 0 && spoofed.result?.success !== true,
    "an actor or ownership field in the payload never reaches the deletion transaction"
  );
}

/* ─────────────────── 4. The migration: one transaction, one audit, no escape ─────────────────── */

const MIGRATION_FILE = "20260917120000_atomic_completed_session_deletion.sql";
const MIGRATION_PATH = `supabase/migrations/${MIGRATION_FILE}`;
const FUNCTION_NAME = "delete_completed_session";
const SIGNATURE = "uuid, uuid, text, text";

function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`);
  if (start < 0) return "";
  const end = sql.indexOf("$function$;", start);
  return end < 0 ? "" : sql.slice(start, end + "$function$;".length);
}

/**
 * The authoritative definition, across forward-only migrations. A later file may supersede this
 * one, and the guarantees below must then be read from THAT file - never from a stale definition
 * that is no longer what the database runs.
 */
function authoritativeMigration(): { sql: string; fileName: string } {
  const files = readdirSync(join(cwd, "supabase/migrations"))
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort((left, right) => left.localeCompare(right));
  let newest: string | null = null;
  for (const fileName of files) {
    const sql = readSource(`supabase/migrations/${fileName}`);
    if (new RegExp(`CREATE OR REPLACE FUNCTION\\s+(?:public\\.)?${FUNCTION_NAME}\\s*\\(`).test(sql)) {
      newest = fileName;
    }
  }
  assert(newest !== null, `a migration defines ${FUNCTION_NAME}`);
  return {
    sql: stripSqlComments(readSource(`supabase/migrations/${newest as string}`)),
    fileName: newest as string,
  };
}

function verifyMigration(): void {
  console.log("\n-- The deletion transaction --");

  assert(
    existsSync(join(cwd, MIGRATION_PATH)),
    "the atomic completed-session deletion migration is present"
  );
  const { sql, fileName } = authoritativeMigration();
  assert(
    fileName === MIGRATION_FILE,
    `the authoritative definition of ${FUNCTION_NAME} is the one this verifier reads (found: ${fileName})`
  );
  assert(sql.trim().length > 500, "the migration's executable SQL was read");

  const body = functionBody(sql, FUNCTION_NAME);
  assert(body.length > 0, `${FUNCTION_NAME} is declared with CREATE OR REPLACE FUNCTION`);

  /* --- Privileges and posture --- */

  assert(!/SECURITY\s+DEFINER/i.test(sql), "no function in the migration is SECURITY DEFINER");
  assert(
    /\bLANGUAGE plpgsql\s+SECURITY INVOKER\s+SET search_path = public, pg_temp\s+AS \$function\$/.test(
      body
    ),
    `${FUNCTION_NAME} is SECURITY INVOKER with its search_path pinned to public, pg_temp`
  );
  const searchPathSettings = sql.match(/SET\s+search_path\s*=[^\n;]*/gi) ?? [];
  assert(
    searchPathSettings.length === 1 &&
      searchPathSettings[0] === "SET search_path = public, pg_temp",
    `${FUNCTION_NAME} pins exactly one search_path and it is the safe one (found: ${canonical(
      searchPathSettings
    )})`
  );
  const revocation =
    sql.match(
      new RegExp(
        `REVOKE EXECUTE ON FUNCTION\\s+${FUNCTION_NAME}\\s*\\(${SIGNATURE}\\)\\s+FROM\\s+([^;]+);`,
        "i"
      )
    )?.[1] ?? "";
  assert(
    /\bPUBLIC\b/.test(revocation) &&
      /\banon\b/.test(revocation) &&
      /\bauthenticated\b/.test(revocation),
    `${FUNCTION_NAME} revokes EXECUTE from PUBLIC, anon and authenticated`
  );
  const grants = Array.from(
    sql.matchAll(
      /GRANT\s+(EXECUTE|ALL(?:\s+PRIVILEGES)?)\s+ON\s+FUNCTION\s+(?:public\.)?(\w+)\s*\([^)]*\)\s+TO\s+([^;]+);/gi
    )
  ).map((match) => `${match[2]} -> ${match[3].trim()}`);
  assert(
    canonical(grants) === canonical([`${FUNCTION_NAME} -> service_role`]) &&
      !/\bGRANT\b[^;]*\b(?:anon|authenticated|PUBLIC)\b/i.test(sql),
    `${FUNCTION_NAME} grants EXECUTE exactly once and only to service_role (found: ${canonical(
      grants
    )})`
  );

  /* --- One transaction: neither write can commit without the other --- */

  const validate = body.search(
    /p_actor_role IS DISTINCT FROM 'Admin'\s+THEN\s+RAISE EXCEPTION 'INVALID_PAYLOAD[^']*'\s+USING ERRCODE = 'ST007';/
  );
  const lock = body.search(
    /FROM patient_report_sessions\s+WHERE patient_report_sessions\.id = p_session_id\s+FOR UPDATE;/
  );
  const notFound = body.indexOf("RETURN 'NOT_FOUND';");
  const notCompleted = body.indexOf("RETURN 'NOT_COMPLETED';");
  const count = body.search(/SELECT count\(\*\)\s+INTO v_report_count\s+FROM laboratory_reports/);
  const del = body.search(
    /DELETE FROM patient_report_sessions\s+WHERE patient_report_sessions\.id = v_session\.id\s+AND patient_report_sessions\.status = 'Completed';/
  );
  const rowGuard = body.search(/IF v_deleted <> 1 THEN\s+RAISE EXCEPTION/);
  const audit = body.indexOf("INSERT INTO audit_logs");
  const deleted = body.indexOf("RETURN 'DELETED';");
  assert(
    validate >= 0 &&
      lock > validate &&
      notFound > lock &&
      notCompleted > notFound &&
      count > notCompleted &&
      del > count &&
      rowGuard > del &&
      audit > rowGuard &&
      deleted > audit,
    `${FUNCTION_NAME} validates the Administrator actor, locks the row, refuses a missing or non-completed session, counts the reports, deletes, requires exactly one deleted row, then audits, then answers DELETED - in that order`
  );

  // THE ROLLBACK ITSELF. The delete and the audit are in one body, the audit after the delete, with
  // nothing that could let either commit alone.
  assert(
    (body.match(/DELETE FROM/g) ?? []).length === 1 &&
      (body.match(/INSERT INTO audit_logs/g) ?? []).length === 1,
    `${FUNCTION_NAME} performs exactly one delete and writes exactly one audit row`
  );
  assert(
    !/\bEXCEPTION\s+WHEN\b/i.test(body),
    `${FUNCTION_NAME} catches nothing - a failed audit insert aborts the transaction and the delete rolls back with it`
  );
  assert(
    !/\b(COMMIT|ROLLBACK|SAVEPOINT|START\s+TRANSACTION|BEGIN\s+TRANSACTION)\b/i.test(body),
    `${FUNCTION_NAME} opens or closes no transaction of its own, so the delete and the audit cannot be split apart`
  );

  /* --- The audit row: exactly one, privacy-safe, attributed to the Administrator --- */

  assert(
    /'SessionReport',\s+'SessionCompletedDeleted',\s+p_actor_user_id,\s+p_actor_username,/.test(
      body
    ) && /p_actor_role,\s+NULL\s+\);/.test(body),
    `${FUNCTION_NAME} writes one SessionCompletedDeleted event as the Administrator, with no target role`
  );
  assert(
    /target_reference/.test(body) && /v_session\.accession_number/.test(body),
    `${FUNCTION_NAME} records the accession number as the target reference`
  );
  // `jsonb_build_object` takes alternating key, value, key, value, so the KEYS are the arguments at
  // even positions and nothing else. Splitting on top-level commas is what makes that true: a
  // quoted literal belonging to a VALUE - the 'UTC' inside `to_char(now() AT TIME ZONE 'UTC', ...)`
  // - sits within parentheses and is never mistaken for a key. Anchoring to the start of a line
  // would be weaker: it reads only the first key per line, so a second key appended to an existing
  // line would be invisible and this exact-equality check would still pass.
  const detailRegion =
    body.match(/jsonb_build_object\(([\s\S]*?)\n\s*\),\n\s*p_actor_role/)?.[1] ?? "";
  assert(detailRegion.length > 0, `${FUNCTION_NAME}'s audit details were located`);
  const detailArguments = splitTopLevelArguments(detailRegion);
  assert(
    detailArguments.length % 2 === 0,
    `${FUNCTION_NAME}'s audit details are whole key/value pairs (found ${detailArguments.length} arguments)`
  );
  const detailKeys = detailArguments
    .filter((_, index) => index % 2 === 0)
    .map((argument) => argument.replace(/^'(.*)'$/, "$1"));
  assert(
    canonical(detailKeys) === canonical(["sessionId", "reportCount", "deletedAt"]),
    `${FUNCTION_NAME} records exactly sessionId, reportCount and deletedAt in the audit details (found: ${canonical(
      detailKeys
    )})`
  );
  for (const prohibited of [
    "demographics",
    "patient_name",
    "completed_snapshot",
    "result_value",
    "signature_image_url",
    "password",
    "recovery",
  ]) {
    assert(!body.toLowerCase().includes(prohibited), `the deletion audit carries no ${prohibited}`);
  }

  /* --- Duplicate calls cannot produce a duplicate success --- */

  assert(
    lock >= 0 && del > lock && /AND patient_report_sessions\.status = 'Completed'/.test(body),
    `${FUNCTION_NAME} locks the row before it decides, and the delete is still predicated on Completed, so a second concurrent call answers NOT_FOUND rather than deleting twice`
  );
  const answers = Array.from(
    new Set(Array.from(body.matchAll(/RETURN '([A-Z_]+)';/g)).map((match) => match[1]))
  ).sort();
  assert(
    canonical(answers) === canonical(["DELETED", "NOT_COMPLETED", "NOT_FOUND"]),
    `${FUNCTION_NAME} answers only its closed set of words (found: ${canonical(answers)})`
  );

  /* --- Retention is deliberately not consulted --- */

  assert(
    !/assert_session_within_retention/.test(body),
    `${FUNCTION_NAME} does not consult the retention guard - an expired completed session is exactly what an Administrator may remove`
  );
}

/* ─────────────── 5. The cascade reaches the session's own tree and nothing shared ─────────────── */

function verifyCascadeCannotReachSharedRecords(): void {
  console.log("\n-- The cascade reaches only session-owned rows --");

  const allMigrations = readdirSync(join(cwd, "supabase/migrations"))
    .filter((name) => /\.sql$/.test(name))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => readSource(`supabase/migrations/${name}`))
    .join("\n");

  // Session-owned children cascade, so one DELETE removes the whole tree.
  for (const [child, column, parent] of [
    ["laboratory_reports", "session_id", "patient_report_sessions"],
    ["laboratory_results", "report_id", "laboratory_reports"],
    ["report_signatories", "report_id", "laboratory_reports"],
  ] as const) {
    assert(
      new RegExp(
        `${column}\\s+UUID\\s+NOT NULL\\s+REFERENCES\\s+${parent}\\(id\\)\\s+ON DELETE CASCADE`,
        "i"
      ).test(allMigrations),
      `${child}.${column} cascades from ${parent}, so the session's own tree goes with it`
    );
  }

  // THE CLOSURE, and the assertion that actually bounds the blast radius. A cascade runs from a
  // parent row to the CHILD rows that reference it, so the only way deleting a session could reach
  // a shared record is if a shared table declared a foreign key INTO the session tree. Enumerate
  // every reference into those four tables and require the set to be exactly the three known
  // session-owned children. A fourth one - a personnel, physician, template or user table pointing
  // at a report - is the failure this catches, and no per-table spot check would find it.
  const SESSION_TREE: readonly string[] = [
    "patient_report_sessions",
    "laboratory_reports",
    "laboratory_results",
    "report_signatories",
  ];
  // MATCH ON THE TARGET, NOT ON THE SYNTAX. A foreign key is written at least four ways in this
  // repository - an inline column, `ADD COLUMN ... REFERENCES`, a table-level `CONSTRAINT ...
  // FOREIGN KEY (col) REFERENCES`, and `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY (col)
  // REFERENCES` (20260914120000 uses the last one). Every one of them names the parent directly
  // after the REFERENCES keyword, so that is what is counted. An earlier version tried to capture
  // the referencing COLUMN and its character class excluded parentheses, which made it blind to
  // every `FOREIGN KEY (col)` form - the repository's own idiom.
  //
  // WHAT THE PATTERN DELIBERATELY TOLERATES: an optional schema qualifier of any name, optional
  // double-quoted identifiers, and the legal column-list-free form `REFERENCES parent ON DELETE
  // CASCADE`, which defaults to the primary key. The parenthesis requirement is gone because it
  // silently excused that last form. The cost is that `GRANT REFERENCES ON <table>` can also match;
  // it captures `ON`, which is not a session table and is filtered out, and any other over-match
  // adds an entry and fails CLOSED. Over-counting is a false alarm; under-counting is a blind spot.
  const sqlWithoutComments = stripSqlComments(allMigrations);
  const inbound = Array.from(
    sqlWithoutComments.matchAll(/\bREFERENCES\s+(?:"?[\w]+"?\.)?"?(\w+)"?/gi)
  )
    .map((match) => match[1].toLowerCase())
    .filter((target) => SESSION_TREE.includes(target))
    .sort();
  assert(
    canonical(inbound) ===
      canonical([
        "laboratory_reports",
        "laboratory_reports",
        "patient_report_sessions",
      ]),
    `exactly the three session-owned children reference the session tree, so a cascade can reach nothing shared (found: ${canonical(
      inbound
    )})`
  );

  // The session tree's own OUTWARD references are RESTRICT. This is not what bounds the deletion -
  // the closure above is - but a CASCADE here would mean removing a physician, a personnel identity
  // or a user silently destroyed completed sessions, so it is read rather than assumed.
  for (const [table, column, shared] of [
    ["patient_report_sessions", "created_by_user_id", "user_profiles"],
    ["laboratory_reports", "requesting_physician_id", "physicians"],
    ["report_signatories", "personnel_id", "personnel_identities"],
  ] as const) {
    const reference = allMigrations.match(
      new RegExp(`${column}[^,;]*REFERENCES\\s+${shared}\\s*\\(id\\)\\s+ON DELETE\\s+(\\w+)`, "i")
    );
    assert(
      reference !== null && /RESTRICT/i.test(reference[1]),
      `${table}.${column} references the shared ${shared} with RESTRICT, so that shared record is never removed by a cascade either (found: ${
        reference?.[1] ?? "no reference"
      })`
    );
  }
  // Scoped to the laboratory_reports declaration itself. `report_templates` HAS cascading children
  // of its own - `template_parameters` and `template_signatory_requirements` - which are registry
  // rows reached by deleting a TEMPLATE, never by deleting a session. A whole-file search would
  // match those and report a cascade that does not exist on this path.
  const reportsTableStart = allMigrations.indexOf("CREATE TABLE IF NOT EXISTS laboratory_reports");
  assert(reportsTableStart >= 0, "the laboratory_reports declaration was found");
  const reportsTable = allMigrations.slice(
    reportsTableStart,
    allMigrations.indexOf(");", reportsTableStart)
  );
  const templateReference =
    reportsTable.match(/template_code[^,\n]*REFERENCES\s+report_templates\s*\([^)]*\)([^,\n]*)/i)?.[1] ?? null;
  assert(
    templateReference !== null && !/CASCADE/i.test(templateReference),
    `laboratory_reports.template_code never cascades into the shared report template registry (found: ${canonical(
      templateReference
    )})`
  );

  // The audit row must outlive what it records, so it may hold no foreign key to any of them.
  const auditTableStart = allMigrations.indexOf("CREATE TABLE audit_logs");
  const auditTable =
    auditTableStart < 0 ? "" : allMigrations.slice(auditTableStart, auditTableStart + 800);
  assert(
    auditTable.length > 0 && !/REFERENCES/i.test(auditTable),
    "audit_logs holds no foreign key, so the deletion audit survives the deletion it records"
  );
}

/* ──────────────── 6. No second success audit is left anywhere in the application ──────────────── */

function verifyNoApplicationSideSuccessAudit(): void {
  console.log("\n-- The success audit exists in exactly one place --");

  const actionSource = readSource("src/features/server-boundary/server-actions.ts");
  const start = actionSource.indexOf("export async function deleteCompletedSessionAction(");
  assert(start >= 0, "deleteCompletedSessionAction is declared in server-actions.ts");
  const end = actionSource.indexOf("\nexport ", start + 1);
  const live = stripTsComments(actionSource.slice(start, end < 0 ? actionSource.length : end));
  assert(
    !live.includes("SessionCompletedDeleted"),
    "the action emits no SessionCompletedDeleted event of its own"
  );
  assert(
    (live.match(/auditService\.emit\(/g) ?? []).length === 1,
    "the action's only audit emit is the authorization denial, which records a refusal and never a deletion"
  );

  // Across the whole application, the success event is written by the transaction alone.
  const applicationFiles: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(cwd, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (/\.tsx?$/.test(entry.name)) applicationFiles.push(next);
    }
  };
  walk("src");
  // Over LIVE CODE only, for the same reason the action is scanned that way: a prose comment naming
  // the event - including the one that records why this action no longer emits it - is not an emit,
  // and a raw substring scan would fail on the very comment documenting the rule.
  const emitters = applicationFiles.filter((file) => stripTsComments(readSource(file)).includes("SessionCompletedDeleted"));
  assert(
    emitters.length === 0,
    `no application file writes the SessionCompletedDeleted event (found: ${canonical(emitters)})`
  );
  const migrationEmitters = readdirSync(join(cwd, "supabase/migrations"))
    .filter((name) => readSource(`supabase/migrations/${name}`).includes("SessionCompletedDeleted"))
    .sort();
  assert(
    canonical(migrationEmitters) === canonical([MIGRATION_FILE]),
    `the SessionCompletedDeleted event is written by the deletion transaction alone (found: ${canonical(
      migrationEmitters
    )})`
  );
}

/* ────────────────────────────────────────── Run ────────────────────────────────────────────── */

async function main(): Promise<void> {
  await verifyOnlyAdministratorReachesTheFunction();
  await verifyTypedRefusals();
  await verifyActionSendsTheResolvedActorAndAuditsNothing();
  verifyMigration();
  verifyCascadeCannotReachSharedRecords();
  verifyNoApplicationSideSuccessAudit();

  console.log("\nAll completed-session deletion integrity invariants verified.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
