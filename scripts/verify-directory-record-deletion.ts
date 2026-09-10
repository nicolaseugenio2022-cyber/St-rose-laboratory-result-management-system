/**
 * CLINIC-UI-UX-08R1 - permanent deletion of personnel and physician records.
 *
 * CHARTER. Deletion is decided and performed by the database: `delete_inactive_personnel()` and
 * `delete_inactive_physician()` lock the row, re-decide every condition, delete it and write the
 * deletion audit in ONE transaction. This verifier proves the two halves that live in this
 * repository:
 *
 *   1. BY EXECUTION, the application boundary. It RUNS the real server actions -
 *      `deletePersonnelAction` and `deletePhysicianAction` - through the real personnel guard, the
 *      real validation schemas and the real repositories, against a stand-in Supabase client that
 *      answers `rpc()` and refuses every table access. It proves who may reach the functions, what
 *      is sent to them (the id, and an actor taken from the session and never from the payload),
 *      and that every answer - each refusal word, a success, an error, an unrecognised word - is
 *      reported truthfully and never as a success it was not.
 *   2. BY READING, the migration that defines the functions and the stable physician reference,
 *      and the absence of any direct table delete in the application.
 *
 * What the functions do against real rows - locking, the foreign keys, the audit row, rollback when
 * the audit cannot be written - is proved against the live database, not simulated here.
 *
 * Exactly three modules are replaced, through the CommonJS require cache before anything loads
 * them: the session resolver (so a caller of any role can be presented), the privileged Supabase
 * client (so no request leaves this process), and the audit service (so every event the
 * application emits is captured). Nothing else is stubbed.
 *
 * Run WITH --conditions=react-server: the actions import `server-only`.
 */

import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Directory record deletion verification failed: ${message}`);
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

/* ─────────────────────────────── The stand-in Supabase client ──────────────────────────────── */

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

type RpcAnswer = { data: unknown; error: unknown };

/** Every rpc() the application made, in order. */
const rpcCalls: RpcCall[] = [];
/** Every table the application tried to reach directly. Deletion must reach none. */
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
const SECOND_ADMIN = caller("00000000-0000-4000-8000-00000000a002", "Admin", "admin.two");
const DEVELOPER = caller("00000000-0000-4000-8000-00000000d001", "Developer", "dev.one");
const USER = caller("00000000-0000-4000-8000-00000000c001", "User", "user.one");

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

// Loaded only now, so every module in their graph binds the three stubs above.
const personnelActions = nodeRequire(
  join(cwd, "src/features/server-boundary/personnel-actions")
) as typeof import("../src/features/server-boundary/personnel-actions");
const physicianActions = nodeRequire(
  join(cwd, "src/features/server-boundary/physician-actions")
) as typeof import("../src/features/server-boundary/physician-actions");
const recordDeletion = nodeRequire(
  join(cwd, "src/features/personnel/record-deletion")
) as typeof import("../src/features/personnel/record-deletion");

const { deletePersonnelAction } = personnelActions;
const { deletePhysicianAction } = physicianActions;

/* ─────────────────────────────────────── Helpers ──────────────────────────────────────────── */

const RECORD_ID = "10000000-0000-4000-8000-000000000002";

function reset(answer: (call: RpcCall) => RpcAnswer = () => ({ data: "DELETED", error: null })): void {
  rpcCalls.length = 0;
  tableAccesses.length = 0;
  auditEvents.length = 0;
  currentCaller = ADMIN;
  rpcAnswer = answer;
}

/** Key-order-independent JSON, so an argument object is compared by content alone. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function captureError(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  return null;
}

function isForbidden(error: unknown, message: RegExp): boolean {
  return (
    error instanceof Error &&
    error.name === "ForbiddenError" &&
    (error as { code?: string }).code === "FORBIDDEN" &&
    message.test(error.message)
  );
}

// Read through a call, so TypeScript does not carry one assertion's narrowing into the next.
function rpcCount(): number {
  return rpcCalls.length;
}
function auditCount(): number {
  return auditEvents.length;
}
function tableCount(): number {
  return tableAccesses.length;
}
function firstAudit(): Record<string, unknown> {
  return auditEvents.at(0) ?? {};
}

function readSource(relativePath: string): string {
  return readFileSync(join(cwd, relativePath), "utf8").replace(/\r\n/g, "\n");
}

/** Comment-stripped, so prose describing a rule can never satisfy the check for it. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

/** The text of `export async function <name>(` up to its matching closing brace. */
function exportedFunctionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  if (start < 0) return "";
  const open = source.indexOf("{", source.indexOf(")", start));
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  return "";
}

interface RecordKind {
  label: "personnel" | "physician";
  action: (input: unknown) => Promise<unknown>;
  fn: string;
  idArg: string;
  refusals: readonly string[];
  foreignWords: readonly string[];
}

const KINDS: readonly RecordKind[] = [
  {
    label: "personnel",
    action: deletePersonnelAction,
    fn: "delete_inactive_personnel",
    idArg: "p_personnel_id",
    refusals: ["NOT_FOUND", "STILL_ACTIVE", "REFERENCED_BY_REPORTS"],
    // A personnel record holds no examination assignment, so this word is not a personnel answer.
    foreignWords: ["HAS_ASSIGNMENTS"],
  },
  {
    label: "physician",
    action: deletePhysicianAction,
    fn: "delete_inactive_physician",
    idArg: "p_physician_id",
    refusals: ["NOT_FOUND", "STILL_ACTIVE", "REFERENCED_BY_REPORTS", "HAS_ASSIGNMENTS"],
    foreignWords: [],
  },
];

/* ─────────────────────────────── The application boundary ────────────────────────────────── */

async function verifyBoundary(kind: RecordKind): Promise<void> {
  const { label, action, fn, idArg } = kind;

  // Success: exactly one call to the one function, carrying the id and the session's actor.
  reset();
  const success = await action({ id: RECORD_ID });
  assert(
    canonical(success) === canonical({ success: true, auditRecorded: true }),
    `an Administrator's ${label} deletion that the database answers DELETED is reported as deleted and audited`
  );
  assert(
    rpcCount() === 1 &&
      rpcCalls[0].fn === fn &&
      canonical(rpcCalls[0].args) ===
        canonical({
          [idArg]: RECORD_ID,
          p_actor_user_id: ADMIN.user.id,
          p_actor_username: ADMIN.user.username,
          p_actor_role: "Admin",
        }),
    `the ${label} deletion makes exactly one call, to ${fn}, with the id and the Administrator taken from the session - nothing else`
  );
  assert(
    tableCount() === 0,
    `the ${label} deletion reaches no table directly - no read, no delete (touched: ${JSON.stringify(tableAccesses)})`
  );
  assert(
    auditCount() === 0,
    `the application writes no ${label} deletion audit of its own - the database writes it in the deletion's transaction`
  );

  // The actor is whoever the session says, whatever else happens.
  reset();
  currentCaller = SECOND_ADMIN;
  await action({ id: RECORD_ID });
  assert(
    rpcCount() === 1 &&
      rpcCalls[0].args.p_actor_user_id === SECOND_ADMIN.user.id &&
      rpcCalls[0].args.p_actor_username === SECOND_ADMIN.user.username,
    `the ${label} deletion records the Administrator who is actually signed in`
  );

  // Every refusal word is reported as that refusal, and nothing is audited by the application.
  for (const word of kind.refusals) {
    reset(() => ({ data: word, error: null }));
    const result = await action({ id: RECORD_ID });
    assert(
      canonical(result) === canonical({ success: false, error: word }) &&
        rpcCount() === 1 &&
        auditCount() === 0 &&
        tableCount() === 0,
      `a ${label} deletion the database refuses as ${word} is reported as exactly that refusal`
    );
  }

  // Anything outside the closed set is not an answer: thrown, never a success or a refusal.
  const unrecognised: ReadonlyArray<readonly [string, unknown]> = [
    ...kind.foreignWords.map((word) => [`the foreign word ${word}`, word] as const),
    ["a lower-case deleted", "deleted"],
    ["an empty string", ""],
    ["null", null],
    ["a number", 1],
    ["an object", { outcome: "DELETED" }],
  ];
  for (const [description, data] of unrecognised) {
    reset(() => ({ data, error: null }));
    const error = await captureError(() => action({ id: RECORD_ID }));
    assert(
      error instanceof Error && /unrecognised outcome/.test(error.message),
      `a ${label} deletion answered with ${description} is thrown as unrecognised - never reported as deleted or refused`
    );
  }

  // A failed request is thrown as it came: the transaction rolled back (an audit insert that could
  // not be written, a foreign key the function did not map, an outage) and nothing may claim
  // otherwise.
  for (const [description, failure] of [
    ["an audit insert refused", { code: "42501", message: "permission denied for table audit_logs" }],
    ["an unmapped foreign-key violation", { code: "23503", message: "violates foreign key constraint" }],
    ["a network failure", { message: "fetch failed" }],
  ] as const) {
    reset(() => ({ data: null, error: failure }));
    const error = await captureError(() => action({ id: RECORD_ID }));
    assert(
      error === failure,
      `a ${label} deletion whose request fails with ${description} is thrown unchanged - never reported as deleted or refused`
    );
  }

  // Developer, User and unauthenticated callers are refused before anything is sent.
  for (const [role, denied, pattern, reason] of [
    ["Developer", DEVELOPER, /Only administrators may manage personnel records\./, "role_not_authorized"],
    ["User", USER, /Only administrators may manage personnel records\./, "role_not_authorized"],
    ["unauthenticated", null, /Authentication is required\./, "unauthenticated"],
  ] as const) {
    reset();
    currentCaller = denied;
    const error = await captureError(() => action({ id: RECORD_ID }));
    assert(
      isForbidden(error, pattern) && rpcCount() === 0 && tableCount() === 0,
      `a ${role} ${label} deletion is refused by the server-side Administrator guard before any request reaches the database`
    );
    assert(
      auditCount() === 1 &&
        firstAudit().category === "SecurityDenial" &&
        firstAudit().eventType === "PersonnelDirectoryAccessDenied" &&
        canonical(firstAudit().details) === canonical({ reasonCode: reason }),
      `the ${role} ${label} refusal is audited as the existing SecurityDenial / ${reason}, and nothing else is recorded`
    );
  }

  // Malformed input - including an attempt to name the actor - is refused by the strict schema.
  for (const [description, input] of [
    ["a non-uuid id", { id: "not-a-uuid" }],
    ["a missing id", {}],
    ["an unexpected key", { id: RECORD_ID, cascade: true }],
    ["a client-supplied actor", { id: RECORD_ID, p_actor_role: "Admin", p_actor_user_id: DEVELOPER.user.id }],
  ] as const) {
    reset();
    const error = await captureError(() => action(input));
    assert(
      error instanceof Error && error.name === "ZodError" && rpcCount() === 0,
      `a ${label} deletion with ${description} is rejected by the strict schema before any request is sent`
    );
  }
}

/* ─────────────────────────────── No direct delete anywhere ───────────────────────────────── */

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(join(cwd, directory))) {
    const relative = `${directory}/${entry}`;
    if (statSync(join(cwd, relative)).isDirectory()) files.push(...sourceFiles(relative));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(relative);
  }
  return files;
}

function verifyNoDirectDelete(): void {
  const files = sourceFiles("src");
  assert(files.length > 50, `the application source was scanned (${files.length} files)`);

  // RAW source, deliberately not comment-stripped: a regex stripper cannot tell a `//` inside a
  // string from a comment and would hide the rest of that line. Scanning everything can only fail
  // closed - prose that looked like a delete would be reported, never excused.
  const DIRECTORY_TABLES = new Set(["personnel", "physicians"]);
  const offenders: string[] = [];
  for (const file of files) {
    const raw = readSource(file);
    // Every query chain that reaches .delete(, whatever its target, up to the end of its statement.
    // A chained `.schema(...)` before `.from(` is matched too.
    for (const match of raw.matchAll(/\.from\(\s*([^)]*?)\s*\)[^;]*/g)) {
      if (!/\.delete\s*\(/.test(match[0])) continue;
      const target = match[1];
      const literal = /^(["'`])([^"'`]*)\1$/.exec(target)?.[2];
      const constant = /^[A-Za-z_$][\w$]*$/.test(target)
        ? new RegExp(`\\bconst\\s+${target}\\s*(?::[^=]+)?=\\s*(["'\`])([^"'\`]*)\\1`).exec(raw)?.[2]
        : undefined;
      const table = literal ?? constant;
      // A table named by anything this scan cannot resolve is reported: it could be either table.
      if (table === undefined || DIRECTORY_TABLES.has(table)) offenders.push(`${file}: .from(${target})`);
    }
    if (/\bDELETE\s+FROM\s+(?:public\.)?"?(personnel|physicians)\b/i.test(raw)) {
      offenders.push(`${file}: DELETE FROM`);
    }
  }
  assert(
    offenders.length === 0,
    `no application source issues a direct delete against personnel or physicians - by a literal table name, a named constant, or any table expression this scan cannot resolve (found: ${JSON.stringify(offenders)})`
  );

  for (const [label, path, fn, idArg] of [
    ["personnel", "src/repositories/supabase-personnel-repository.ts", "delete_inactive_personnel", "p_personnel_id"],
    ["physician", "src/repositories/supabase-physician-repository.ts", "delete_inactive_physician", "p_physician_id"],
  ] as const) {
    const code = stripComments(readSource(path));
    assert(
      (code.match(/\.delete\s*\(/g) ?? []).length === 0,
      `the ${label} repository issues no delete of its own`
    );
    assert(
      (code.match(/\.rpc\(/g) ?? []).filter(Boolean).length >= 1 &&
        (code.match(new RegExp(`\\.rpc\\("${fn}"`, "g")) ?? []).length === 1 &&
        new RegExp(
          `\\.rpc\\("${fn}", \\{\\s*${idArg}: id,\\s*p_actor_user_id: actor\\.userId,\\s*p_actor_username: actor\\.username,\\s*p_actor_role: actor\\.role,\\s*\\}\\)`
        ).test(code),
      `the ${label} repository reaches ${fn} once, passing only the id and the actor it was given`
    );
    assert(
      /if \(error\) throw error;\s*if \(typeof data !== "string" \|\| !\w+_DELETION_OUTCOMES\.has\(data\)\) \{\s*throw new Error\(/.test(
        code
      ),
      `the ${label} repository throws a failed request and an unrecognised answer rather than returning either`
    );
  }

  assert(
    !existsSync(join(cwd, "src/repositories/supabase-directory-reference-repository.ts")),
    "the application-side reference counts are gone - references are decided inside the deletion's transaction"
  );

  for (const [label, path, actionName, eventType] of [
    ["personnel", "src/features/server-boundary/personnel-actions.ts", "deletePersonnelAction", "PersonnelRecordDeleted"],
    ["physician", "src/features/server-boundary/physician-actions.ts", "deletePhysicianAction", "PhysicianRecordDeleted"],
  ] as const) {
    const code = stripComments(readSource(path));
    const body = exportedFunctionBody(code, actionName);
    const guard = body.search(/await\s+requirePersonnelAdmin\s*\(\s*\)/);
    const parse = body.search(/\w+DeleteSchema\.parse\s*\(\s*input\s*\)/);
    const call = body.search(
      /repository\.deleteInactive\(parsed\.id, \{\s*userId: caller\.userId,\s*username: caller\.username,\s*role: caller\.role,\s*\}\)/
    );
    assert(
      body.length > 0 && guard >= 0 && parse > guard && call > parse,
      `${actionName} runs the Administrator guard, then the strict parse, then the one database call with the session's actor`
    );
    assert(
      !/auditService/.test(body) && !/findById|\.from\(|\.delete\(/.test(body) && !/requirePersonnelReader/.test(body),
      `${actionName} reads nothing beforehand, deletes nothing directly and emits no audit of its own`
    );
    assert(
      !code.includes(`"${eventType}"`),
      `${eventType} is written by the database function alone, never by ${path}`
    );
  }
}

/* ─────────────────────────────── The migration, by reading ───────────────────────────────── */

const MIGRATION_PATH =
  "supabase/migrations/20260913120000_stable_physician_references_and_atomic_directory_deletion.sql";

function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`);
  if (start < 0) return "";
  const end = sql.indexOf("$function$;", start);
  return end < 0 ? "" : sql.slice(start, end + "$function$;".length);
}

function verifyMigration(): void {
  assert(existsSync(join(cwd, MIGRATION_PATH)), "the stable-reference and atomic-deletion migration is present");
  const sql = stripSqlComments(readSource(MIGRATION_PATH));
  assert(sql.trim().length > 1000, "the migration's executable SQL was read");

  // The reference.
  assert(
    /ALTER TABLE laboratory_reports\s+ADD COLUMN IF NOT EXISTS requesting_physician_id uuid NULL\s+CONSTRAINT laboratory_reports_requesting_physician_id_fkey\s+REFERENCES physicians \(id\) ON DELETE RESTRICT;/.test(
      sql
    ),
    "laboratory_reports.requesting_physician_id is a nullable uuid foreign key to physicians(id) ON DELETE RESTRICT"
  );
  assert(
    /CREATE INDEX IF NOT EXISTS idx_laboratory_reports_requesting_physician_id\s+ON laboratory_reports \(requesting_physician_id\);/.test(
      sql
    ),
    "the physician reference is indexed, so a physician delete's foreign-key check does not scan every report"
  );
  assert(
    !/\bCASCADE\b/i.test(sql) && !/\bSET\s+NULL\b/i.test(sql) && !/\b(?:DROP|TRUNCATE)\b/i.test(sql),
    "nothing in the migration cascades, detaches, drops or truncates"
  );

  // Rename guard, then backfill, then the trigger - in that order.
  const guard = sql.search(/event_type = 'PhysicianRecordUpdated'[\s\S]*?\(details -> 'changedFields'\) \? 'fullName'[\s\S]*?RAISE EXCEPTION/);
  const backfill = sql.indexOf("UPDATE laboratory_reports AS report");
  const trigger = sql.indexOf("CREATE TRIGGER trg_laboratory_reports_resolve_requesting_physician");
  assert(
    guard >= 0 && backfill > guard && trigger > backfill,
    "the migration refuses to run if a physician was ever renamed, backfills only after that check, and adds the trigger only after the backfill"
  );
  const backfillStatement = sql.slice(backfill, sql.indexOf(";", backfill) + 1);
  assert(
    /SET requesting_physician_id = physician\.id\s+FROM/.test(backfillStatement) &&
      (backfillStatement.match(/\bSET\b/g) ?? []).length === 1 &&
      /physician\.full_name = report\.encoding_data ->> 'requestedBy'/.test(backfillStatement) &&
      /jsonb_typeof\(report\.encoding_data -> 'requestedBy'\) = 'string'/.test(backfillStatement) &&
      !/\b(?:lower|upper|btrim|trim|ilike|like|similar)\b/i.test(backfillStatement),
    "the backfill writes only the new column, and only on an exact, case- and space-sensitive name match"
  );
  assert(
    /session\.completed_snapshot IS NULL[\s\S]*?\) = 1[\s\S]*?frozen\.report_element -> 'requestedBy' = report\.encoding_data -> 'requestedBy'/.test(
      backfillStatement
    ),
    "a completed report is linked only when exactly one frozen report for its examination prints the same Requested By"
  );
  assert(
    !/\b(?:UPDATE|INSERT INTO)\s+patient_report_sessions\b/i.test(sql) &&
      !/SET\s+(?:encoding_data|demographics|completed_snapshot)\b/i.test(sql) &&
      !/\b(?:UPDATE|DELETE FROM)\s+audit_logs\b/i.test(sql) &&
      !/\b(?:UPDATE|DELETE FROM|INSERT INTO)\s+(?:report_signatories|physician_examination_assignments|laboratory_results)\b/i.test(sql),
    "the migration never writes printed Requested By text, sessions, snapshots, signatories, assignments, results or existing audit rows"
  );

  // The trigger function.
  const resolver = functionBody(sql, "resolve_laboratory_report_requesting_physician");
  assert(
    /IF TG_OP = 'UPDATE'\s+AND \(NEW\.encoding_data -> 'requestedBy'\) IS NOT DISTINCT FROM \(OLD\.encoding_data -> 'requestedBy'\)\s+THEN\s+NEW\.requesting_physician_id := OLD\.requesting_physician_id;\s+RETURN NEW;/.test(
      resolver
    ),
    "while a report's Requested By text is unchanged its physician reference is kept - a rename releases nothing"
  );
  assert(
    /WHERE physicians\.full_name = v_requested_by\s+FOR KEY SHARE;/.test(resolver) &&
      /NEW\.requesting_physician_id := v_physician_id;\s+RETURN NEW;/.test(resolver) &&
      !/NEW\.requesting_physician_id := NEW\./.test(resolver),
    "new or changed text is linked by exact current name under a key-share lock, and a caller-supplied reference is never kept"
  );
  assert(
    /CREATE TRIGGER trg_laboratory_reports_resolve_requesting_physician\s+BEFORE INSERT OR UPDATE ON laboratory_reports\s+FOR EACH ROW\s+EXECUTE FUNCTION resolve_laboratory_report_requesting_physician\(\);/.test(
      sql
    ),
    "the reference is decided before every report insert and update"
  );

  // Posture of every function in the file.
  assert(!/SECURITY\s+DEFINER/i.test(sql), "no function in the migration is SECURITY DEFINER");
  for (const name of [
    "resolve_laboratory_report_requesting_physician",
    "delete_inactive_personnel",
    "delete_inactive_physician",
  ]) {
    const body = functionBody(sql, name);
    assert(
      body.length > 0 &&
        /\bLANGUAGE plpgsql\s+SECURITY INVOKER\s+SET search_path = public, pg_temp\s+AS \$function\$/.test(body),
      `${name} is SECURITY INVOKER with its search_path pinned to public, pg_temp`
    );
    assert(
      new RegExp(`REVOKE EXECUTE ON FUNCTION ${name}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`).test(sql),
      `${name} cannot be executed by PUBLIC, anon or authenticated`
    );
  }
  const grants = Array.from(sql.matchAll(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+(\w+)\([^)]*\)\s+TO\s+([^;]+);/gi)).map(
    (match) => `${match[1]} -> ${match[2].trim()}`
  );
  assert(
    canonical(grants.sort()) ===
      canonical(["delete_inactive_personnel -> service_role", "delete_inactive_physician -> service_role"]) &&
      !/\bGRANT\b[^;]*\b(?:anon|authenticated|PUBLIC)\b/i.test(sql),
    `only the two deletion functions are executable, and only by service_role (found: ${JSON.stringify(grants)})`
  );

  // The two deletion functions: one transaction, fixed order, closed answers.
  for (const [name, table, eventType, constraint, words] of [
    [
      "delete_inactive_personnel",
      "personnel",
      "PersonnelRecordDeleted",
      "report_signatories_personnel_id_fkey",
      ["DELETED", "NOT_FOUND", "REFERENCED_BY_REPORTS", "STILL_ACTIVE"],
    ],
    [
      "delete_inactive_physician",
      "physicians",
      "PhysicianRecordDeleted",
      "laboratory_reports_requesting_physician_id_fkey",
      ["DELETED", "HAS_ASSIGNMENTS", "NOT_FOUND", "REFERENCED_BY_REPORTS", "STILL_ACTIVE"],
    ],
  ] as const) {
    const body = functionBody(sql, name);
    const validate = body.search(/p_actor_role IS DISTINCT FROM 'Admin'\s+THEN\s+RAISE EXCEPTION 'INVALID_PAYLOAD[^']*'\s+USING ERRCODE = 'ST007';/);
    const lock = body.search(new RegExp(`FROM ${table}\\s+WHERE ${table}\\.id = p_\\w+_id\\s+FOR UPDATE;`));
    const notFound = body.indexOf("RETURN 'NOT_FOUND';");
    const stillActive = body.indexOf("RETURN 'STILL_ACTIVE';");
    const del = body.search(new RegExp(`DELETE FROM ${table}\\s+WHERE ${table}\\.id = v_\\w+\\.id\\s+AND NOT ${table}\\.is_active;`));
    const handler = body.search(
      new RegExp(
        `EXCEPTION WHEN foreign_key_violation THEN\\s+GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;\\s+IF v_constraint = '${constraint}' THEN\\s+RETURN 'REFERENCED_BY_REPORTS';\\s+END IF;\\s+RAISE;\\s+END;`
      )
    );
    const rowGuard = body.search(/IF v_deleted <> 1 THEN\s+RAISE EXCEPTION/);
    const audit = body.indexOf("INSERT INTO audit_logs");
    const deleted = body.indexOf("RETURN 'DELETED';");
    assert(
      validate >= 0 &&
        lock > validate &&
        notFound > lock &&
        stillActive > notFound &&
        del > stillActive &&
        handler > del &&
        rowGuard > handler &&
        audit > rowGuard &&
        deleted > audit,
      `${name} validates, locks the row, refuses a missing or active record, deletes, maps only its own foreign key, requires exactly one deleted row, then audits, then answers DELETED - in that order`
    );
    assert(
      (body.match(/INSERT INTO audit_logs/g) ?? []).length === 1 &&
        (body.match(/DELETE FROM/g) ?? []).length === 1 &&
        new RegExp(`'PersonnelCredential',\\s+'${eventType}',\\s+p_actor_user_id,\\s+p_actor_username,`).test(body) &&
        /p_actor_role,\s+NULL\s+\);/.test(body),
      `${name} deletes one row and writes one ${eventType} audit record as the Administrator, with no target role`
    );
    const answers = Array.from(new Set(Array.from(body.matchAll(/RETURN '([A-Z_]+)';/g)).map((m) => m[1]))).sort();
    assert(
      canonical(answers) === canonical([...words].sort()),
      `${name} answers only its closed set of words (found: ${JSON.stringify(answers)})`
    );
  }

  const physician = functionBody(sql, "delete_inactive_physician");
  assert(
    physician.indexOf("RETURN 'HAS_ASSIGNMENTS';") < physician.indexOf("RETURN 'REFERENCED_BY_REPORTS';") &&
      physician.indexOf("RETURN 'HAS_ASSIGNMENTS';") < physician.indexOf("DELETE FROM physicians") &&
      !/\b(?:DELETE FROM|UPDATE)\s+physician_examination_assignments\b/.test(physician),
    "a physician holding assignments is refused before anything else is decided, and its assignments are never cleared or cascaded"
  );
  assert(
    /encoding_data @> jsonb_build_object\('requestedBy', v_physician\.full_name\)/.test(physician) &&
      /demographics @> jsonb_build_object\('requestingPhysician', v_physician\.full_name\)/.test(physician) &&
      /completed_snapshot @> jsonb_build_object\(\s*'reports',\s*jsonb_build_array\(jsonb_build_object\('requestedBy', v_physician\.full_name\)\)\s*\)/.test(
        physician
      ),
    "a physician named by printed text alone - a report, a legacy session or a completed snapshot - is refused as referenced"
  );
  const personnel = functionBody(sql, "delete_inactive_personnel");
  assert(
    /completed_snapshot @> jsonb_build_object\([\s\S]*?'signatories',\s*jsonb_build_array\(jsonb_build_object\('personnelId', v_personnel\.id::text\)\)/.test(
      personnel
    ),
    "a personnel record named only by a signatory frozen into a completed snapshot is refused as referenced"
  );
  assert(
    /v_personnel\.signature_image_url ~ '\^\/api\/signatures\/proxy\\\?path=personnel%2F\[0-9a-f\]\{8\}-/.test(personnel) &&
      /'objectPath',\s+replace\(substr\(v_personnel\.signature_image_url, char_length\('\/api\/signatures\/proxy\?path='\) \+ 1\), '%2F', '\/'\)/.test(
        personnel
      ) &&
      !/storage\./i.test(sql),
    "the retained signature's path is recorded under objectPath only for the canonical stored form, and no storage object is touched"
  );
}

/* ─────────────────────────────── The screen (unchanged UI) ───────────────────────────────── */

/** The JSX expression `{ <guard> ... }`, brace-matched, skipping string and template literals. */
function guardedRegions(source: string, guard: RegExp): string[] {
  const regions: string[] = [];
  const pattern = new RegExp(guard.source, "g");
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    let depth = 0;
    let quote = "";
    for (let i = match.index; i < source.length; i++) {
      const ch = source[i];
      if (quote) {
        if (ch === "\\") i++;
        else if (ch === quote) quote = "";
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        continue;
      }
      if (ch === "{") depth++;
      if (ch === "}" && --depth === 0) {
        regions.push(source.slice(match.index, i + 1));
        break;
      }
    }
  }
  return regions;
}

function verifyScreen(): void {
  const screens = [
    {
      label: "PersonnelTable",
      table: stripComments(readSource("src/app/(app)/personnel/_components/PersonnelTable.tsx")),
      view: stripComments(
        readSource("src/app/(app)/personnel/_components/PersonnelDirectoryView.tsx")
      ),
      viewLabel: "PersonnelDirectoryView",
      guard: /\{\s*!\s*person\.isActive\s*&&/,
      subject: "person",
      busyRef: "busyPersonnelIdRef",
      refresh: "refreshPersonnel",
    },
    {
      label: "PhysicianTable",
      table: stripComments(readSource("src/app/(app)/personnel/_components/PhysicianTable.tsx")),
      view: stripComments(
        readSource("src/app/(app)/personnel/_components/PhysicianDirectoryView.tsx")
      ),
      viewLabel: "PhysicianDirectoryView",
      guard: /\{\s*!\s*physician\.isActive\s*&&/,
      subject: "physician",
      busyRef: "busyPhysicianIdRef",
      refresh: "refreshPhysicians",
    },
  ] as const;

  for (const screen of screens) {
    const inactiveRegions = guardedRegions(screen.table, screen.guard);
    assert(
      (screen.table.match(/variant="danger"/g) ?? []).length === 1 &&
        inactiveRegions.length === 1 &&
        /variant="danger"/.test(inactiveRegions[0]) &&
        new RegExp(`onClick=\\{\\(\\) => onDelete\\(${screen.subject}\\)\\}`).test(inactiveRegions[0]),
      `${screen.label} offers Delete only inside the !${screen.subject}.isActive guard - an active record must be deactivated first`
    );
    assert(
      /aria-label=\{`Delete \$\{name\}`\}/.test(inactiveRegions[0]) &&
        /disabled=\{isDisabled\}/.test(inactiveRegions[0]) &&
        /isLoading=\{isDeleting\}/.test(inactiveRegions[0]) &&
        /className=\{touch\}/.test(inactiveRegions[0]),
      `${screen.label}'s Delete names its record, stands down while any row is written, shows its own pending state and keeps the 44px touch target`
    );
    assert(
      /role="alert"/.test(screen.table) && /errorMessage &&/.test(screen.table),
      `${screen.label} shows a refusal on the record it belongs to, announced as an alert`
    );

    const confirmHandler =
      /const handleConfirmDelete = async \(\) => \{[\s\S]*?\n {2}\};/.exec(screen.view)?.[0] ?? "";
    const guardIndex = confirmHandler.indexOf(`if (${screen.busyRef}.current !== null) return;`);
    const claimIndex = confirmHandler.indexOf(`${screen.busyRef}.current = ${screen.subject}.id;`);
    const callIndex = confirmHandler.indexOf(`await onDelete(${screen.subject})`);
    assert(
      guardIndex >= 0 && claimIndex > guardIndex && callIndex > claimIndex,
      `${screen.viewLabel} claims the single-flight guard before the request, so a duplicate press is dropped before anything is sent`
    );
    assert(
      /RECORD_DELETION_REFUSAL_MESSAGES\[result\.error\]/.test(confirmHandler) &&
        /RECORD_DELETION_FAILURE_MESSAGE/.test(confirmHandler) &&
        /finally \{[\s\S]*current = null;[\s\S]*setIsDeleteDialogOpen\(false\);/.test(confirmHandler),
      `${screen.viewLabel} turns every refusal into its typed message and always releases the guard and closes the dialog`
    );
    assert(
      new RegExp(
        `\\} catch \\{\\s*setNotice\\(RECORD_DELETION_FAILURE_MESSAGE\\);\\s*await ${screen.refresh}\\(\\);`
      ).test(confirmHandler),
      `${screen.viewLabel} reports a request that failed without an answer as unconfirmed, at page level, and re-reads the directory - it never claims the record was not deleted`
    );
    assert(
      /result\.auditRecorded/.test(confirmHandler) &&
        /RECORD_DELETION_UNAUDITED_NOTICE/.test(confirmHandler) &&
        /tone: "warning"/.test(confirmHandler) &&
        /variant=\{deletionNotice\.tone\}/.test(screen.view),
      `${screen.viewLabel} tells the operator when a deletion committed but its audit record did not - as a warning, never as a failure`
    );
    const dialogs = guardedRegions(screen.view, /\{\s*canManage\s*&&/).filter((region) =>
      /<ConfirmDialog\b/.test(region)
    );
    assert(
      (screen.view.match(/<ConfirmDialog\b/g) ?? []).length === 1 &&
        dialogs.length === 1 &&
        /variant="destructive"/.test(dialogs[0]) &&
        /isPending=\{busyAction === "delete"\}/.test(dialogs[0]) &&
        /onCancel=\{handleCancelDelete\}/.test(dialogs[0]) &&
        /permanently/.test(dialogs[0]),
      `${screen.viewLabel} confirms through the one shared destructive ConfirmDialog, locked while pending, mounted only for a manager`
    );
  }

  const page = stripComments(readSource("src/app/(app)/personnel/page.tsx"));
  assert(
    /return deletePersonnelAction\(\{ id: person\.id \}\);/.test(page) &&
      /return deletePhysicianAction\(\{ id: physician\.id \}\);/.test(page) &&
      !/new\s+Supabase[A-Za-z]*Repository/.test(page) &&
      !/\.from\(/.test(page),
    "the page reaches deletion only through the two server actions, passing the id alone - no browser-side Supabase delete exists"
  );
}

/* ─────────────────────────────────────────── Run ──────────────────────────────────────────── */

async function main(): Promise<void> {
  for (const kind of KINDS) {
    await verifyBoundary(kind);
  }

  verifyNoDirectDelete();
  verifyMigration();

  const messages = recordDeletion.RECORD_DELETION_REFUSAL_MESSAGES;
  const codes = ["NOT_FOUND", "STILL_ACTIVE", "REFERENCED_BY_REPORTS", "HAS_ASSIGNMENTS"] as const;
  assert(
    JSON.stringify(Object.keys(messages).sort()) === JSON.stringify([...codes].sort()) &&
      codes.every((code) => messages[code].trim().length >= 30) &&
      new Set(codes.map((code) => messages[code])).size === codes.length,
    "every refusal code has its own distinct, full-sentence message"
  );
  assert(
    messages.REFERENCED_BY_REPORTS ===
      "This record is used by laboratory reports and cannot be deleted. Keep it inactive instead.",
    "a report-referenced refusal says the record is used by laboratory reports and to keep it inactive"
  );
  assert(
    /Deactivate/.test(messages.STILL_ACTIVE) && /assign/i.test(messages.HAS_ASSIGNMENTS),
    "the active and assignment refusals each say what the Administrator must do first"
  );

  verifyScreen();

  console.log("\nAll directory record deletion invariants verified.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
