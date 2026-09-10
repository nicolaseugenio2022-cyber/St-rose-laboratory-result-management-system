/**
 * Managed physician directory invariants (data layer).
 *
 * CHARTER. The schema, the repository, the validation schemas and the server-action boundary for
 * the `physicians` table. Static source analysis only - nothing here connects to a database, and
 * no assertion below executes SQL.
 *
 * The three guarantees worth having durable, in order of consequence:
 *   1. Every write action authorizes BEFORE it reaches the repository. Proved by index comparison
 *      on a comment-stripped function body, so commented-out code cannot satisfy an ordering check.
 *   2. Nothing in this feature can issue a table delete against `physicians`. CLINIC-UI-UX-08R1
 *      added a permanent deletion by explicit user decision, but only as `delete_inactive_physician()`,
 *      which re-decides inactivity, assignments and every report reference and audits in the same
 *      transaction; it is reached only through the Administrator-guarded `deletePhysicianAction`,
 *      and the UI offers it only on an inactive record. Deactivation remains the reversible
 *      withdrawal.
 *   3. The migration is non-destructive and applies identically to a clean and to a populated
 *      database - it must add, and only add.
 *
 * No SHA-256 pin is minted here. Every assertion is structural, so this verifier stays meaningful
 * while the feature is still being built on top of it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// The examination catalogue is a dependency-free, I/O-free presentation module, so it can be
// EXECUTED here rather than only read. A textual assertion about `defaultsWithinAssignments`
// would prove that a filter is written; running it proves that the filter does what the screen
// depends on. Nothing else in this file is imported, and this module imports nothing at all.
import {
  MAINTAINED_EXAMINATION_CODES,
  defaultsWithinAssignments,
  groupAssignmentsByPhysician,
  tallyByFamily,
} from "../src/app/(app)/personnel/_components/physician-examinations";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Physician directory verification failed: ${message}`);
  console.log(`✓ ${message}`);
}

function getSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

/**
 * One exported async function's body, brace-matched by an actual lexical scan.
 *
 * WHY THIS IS A SCANNER AND NOT A BRACE COUNTER. The previous implementation treated any quote as
 * a string delimiter and skipped no comments at all, so a single apostrophe in a comment inside a
 * body - "the record's status" - put it in a string state that swallowed every brace until the
 * next apostrophe, and the counter ran on into the following function. That is not a cosmetic
 * failure. The assertions built on this extraction are mostly POSITIVES - an admin guard is
 * present, the parse follows it, the repository follows both, an audit event is emitted - and
 * every one of them is satisfiable by the swallowed neighbour. An action that had lost its own
 * `requirePersonnelAdmin()` could therefore pass the whole loop by borrowing the next function's.
 * The overrun was only ever noticed because one NEGATIVE assertion happened to trip on text the
 * neighbour contained; it was never guaranteed to be noticed.
 *
 * The scan below tracks, properly: `//` line comments, block comments, single and double quoted
 * strings with backslash escapes, template literals, and `${ ... }` substitutions - which nest,
 * because a substitution contains real code whose braces must balance before the template
 * resumes. Braces are counted in code context only, so no brace inside a comment, a string, or a
 * template's literal text can move the depth.
 *
 * FAIL-CLOSED IN ALL THREE DIRECTIONS. "" is returned when the body is unterminated; when the
 * matched closing brace lies beyond the next top-level `export` declaration, which is the
 * boundary an overrun must cross; and when the matched closing brace is not the first character
 * on its line. That last rule is what closes TRUNCATION, the direction a boundary check cannot
 * see: the one construct this scanner does not lex is a regex literal, and a `}` inside one - as
 * in `/[}]/` - would otherwise decrement the depth and end the body early, producing a short but
 * non-empty span that no boundary assertion can distinguish from a real one. Every top-level
 * function in this codebase closes with `}` in column 0, so requiring that turns an early
 * termination into "" as well. No regex literal appears in the extracted sources today; the rule
 * is here so that adding one cannot silently shorten what these assertions read.
 *
 * Every call site either guards on `length > 0` or leads with a positive assertion that "" cannot
 * satisfy, so a scan that goes wrong certifies nothing instead of certifying a neighbour.
 */
function extractFunctionBody(source: string, functionName: string): string {
  const pattern = new RegExp(`export async function ${functionName}\\(`);
  const match = pattern.exec(source);
  if (!match) return "";

  const startBrace = source.indexOf("{", match.index);
  if (startBrace < 0) return "";

  // A stack, because `${ ... }` puts code inside a template which is itself inside code. Each
  // "code" frame carries its own brace depth; the frame is popped when that depth returns to zero.
  const contexts: Array<"code" | "template"> = ["code"];
  const braceDepths: number[] = [0];
  let index = startBrace;
  let closingBrace = -1;

  while (index < source.length) {
    const ch = source[index];
    const next = source[index + 1];

    if (contexts[contexts.length - 1] === "template") {
      if (ch === "\\") { index += 2; continue; }
      if (ch === "`") { contexts.pop(); index++; continue; }
      if (ch === "$" && next === "{") {
        contexts.push("code");
        braceDepths.push(1);
        index += 2;
        continue;
      }
      index++;
      continue;
    }

    if (ch === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index++;
      continue;
    }
    if (ch === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index++;
      index += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      index++;
      while (index < source.length) {
        if (source[index] === "\\") { index += 2; continue; }
        if (source[index] === quote) { index++; break; }
        // An unterminated quote cannot span a line in valid source. Stopping here keeps a stray
        // apostrophe that reached this scanner from consuming the rest of the file.
        if (source[index] === "\n") break;
        index++;
      }
      continue;
    }
    if (ch === "`") { contexts.push("template"); index++; continue; }
    if (ch === "{") { braceDepths[braceDepths.length - 1]++; index++; continue; }
    if (ch === "}") {
      braceDepths[braceDepths.length - 1]--;
      if (braceDepths[braceDepths.length - 1] === 0) {
        if (contexts.length === 1) { closingBrace = index; break; }
        contexts.pop();
        braceDepths.pop();
      }
      index++;
      continue;
    }
    index++;
  }

  if (closingBrace < 0) return "";

  // THE BOUNDARY. A body that closes after the next top-level export has not been extracted, it
  // has been run through - so nothing is returned rather than a span covering two functions.
  const nextExport = source.indexOf("\nexport ", startBrace);
  if (nextExport >= 0 && closingBrace > nextExport) return "";

  // THE TERMINAL RULE, which closes truncation. A top-level function closes in column 0; a brace
  // that ends the scan anywhere else was reached early - by an unlexed regex literal, say - and
  // the span it produced is short rather than wrong-looking. Refusing it is the only way to tell
  // the two apart from outside.
  if (closingBrace > 0 && source[closingBrace - 1] !== "\n") return "";

  return source.substring(startBrace + 1, closingBrace);
}

function stripComments(source: string): string {
  let result = "";
  let inString = false;
  let stringChar = "";
  let escaped = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (inString) {
      result += ch;
      if (ch === "\\") escaped = true;
      else if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      result += ch;
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      result += "  ";
      i += 2;
      while (i < source.length && source[i] !== "\n") {
        result += " ";
        i++;
      }
      if (i < source.length) result += source[i];
      continue;
    }
    if (ch === "/" && next === "*") {
      result += "  ";
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        result += source[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < source.length) {
        result += "  ";
        i++;
      }
      continue;
    }
    result += ch;
  }

  return result;
}

/**
 * SQL `--` line comments and `/* *\/` block comments, blanked rather than removed so byte offsets
 * and line numbers survive. Every destructive-statement negative below runs against the stripped
 * text: the migration's own comments explain WHY it contains no DROP and no data migration out of
 * `auto_suggestions`, and a raw-text negative would fail on the explanation instead of the code.
 * Dollar-quoted bodies ($$ ... $$) are preserved verbatim - a DROP hidden inside one is executable
 * and must still be caught.
 */
function stripSqlComments(sql: string): string {
  let result = "";
  let inSingleQuote = false;
  let inDollarQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inSingleQuote) {
      result += ch;
      if (ch === "'") inSingleQuote = false;
      continue;
    }
    if (ch === "$" && next === "$") {
      result += "$$";
      i++;
      inDollarQuote = !inDollarQuote;
      continue;
    }
    if (inDollarQuote) {
      result += ch;
      continue;
    }
    if (ch === "'") {
      result += ch;
      inSingleQuote = true;
      continue;
    }
    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") {
        result += " ";
        i++;
      }
      if (i < sql.length) result += sql[i];
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      result += "  ";
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) {
        result += sql[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < sql.length) {
        result += "  ";
        i++;
      }
      continue;
    }
    result += ch;
  }

  return result;
}

const MIGRATION_PATH = "supabase/migrations/20260909120000_physician_directory.sql";

const migrationRaw = getSource(MIGRATION_PATH);
const migrationSql = stripSqlComments(migrationRaw);
const physicianActionsSource = getSource("src/features/server-boundary/physician-actions.ts");
const physicianRepositorySource = getSource("src/repositories/supabase-physician-repository.ts");
const physicianValidationSource = getSource("src/lib/validations/physicianValidation.ts");
const physicianEntrySource = getSource("src/features/physicians/physician-directory-entry.ts");
const domainInterfacesSource = getSource("src/domain/models/interfaces.ts");
const repositoryInterfacesSource = getSource("src/repositories/interfaces/index.ts");

// Fail closed if the comment stripper broke: an empty haystack satisfies every negative assertion
// below, so an emptied migration would certify as "contains no DROP" while proving nothing.
assert(
  migrationSql.includes("CREATE TABLE") && migrationSql.length > 200,
  "the migration survives SQL comment stripping with its executable statements intact"
);

/* ─────────────────── Migration: additive shape, mirroring the personnel table ─────────────── */

assert(
  /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+physicians\s*\(/i.test(migrationSql),
  "the migration creates physicians with IF NOT EXISTS"
);
assert(
  /\bid\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\s*\(\s*\)/i.test(migrationSql),
  "physicians.id mirrors the shared UUID primary key default"
);
assert(
  /\bfull_name\s+TEXT\s+NOT\s+NULL\s+UNIQUE\b/i.test(migrationSql),
  "physicians.full_name is the NOT NULL natural key, UNIQUE so a duplicate raises 23505"
);
assert(
  /\bis_active\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+TRUE\b/i.test(migrationSql),
  "physicians.is_active defaults TRUE, mirroring the soft-deactivate column on personnel"
);
assert(
  /\bcreated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i.test(migrationSql) &&
    /\bupdated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i.test(migrationSql),
  "physicians carries the shared created_at/updated_at timestamps"
);
// A PG enum type would be a new database object that later has to be ALTERed to change; the
// codebase encodes every closed set as a CHECK for exactly that reason.
assert(
  !/\bCREATE\s+TYPE\b/i.test(migrationSql),
  "the migration creates no PostgreSQL enum type"
);
assert(
  /CREATE\s+TRIGGER\s+trg_physicians_updated_at\s+BEFORE\s+UPDATE\s+ON\s+physicians\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+update_updated_at_column\s*\(\s*\)\s*;/i.test(
    migrationSql
  ),
  "physicians has the updated_at trigger in the shared trigger shape"
);

/* ─────────────────── Migration: non-destructive, and destructive-proof ────────────────────── */

for (const [statement, pattern] of [
  ["DROP", /\bDROP\b/i],
  ["DELETE", /\bDELETE\b/i],
  ["TRUNCATE", /\bTRUNCATE\b/i],
] as const) {
  assert(
    !pattern.test(migrationSql),
    `the migration contains no ${statement} statement`
  );
}
// ALTER ... ENABLE ROW LEVEL SECURITY is the one permitted ALTER, and it targets the new table
// only. Anything else altered would be a pre-existing object this migration must not touch.
const alterStatements = migrationSql.match(/\bALTER\s+TABLE\s+\w+[^;]*;/gi) ?? [];
assert(
  alterStatements.length === 1 &&
    /^ALTER\s+TABLE\s+physicians\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\s*;$/i.test(
      alterStatements[0].trim()
    ),
  `the migration's only ALTER is the physicians RLS enablement (found: ${JSON.stringify(alterStatements)})`
);
assert(
  !/\bauto_suggestions\b/i.test(migrationSql),
  "the migration leaves auto_suggestions completely alone - no read, no write, no data migration"
);
const createdTables = (migrationSql.match(/\bCREATE\s+TABLE\b[^(]*/gi) ?? []).length;
assert(
  createdTables === 1,
  "the migration creates exactly one table"
);

/* ─────────────────── Migration: RLS posture matches 05_rls_policies.sql ───────────────────── */

const rlsStatements = migrationSql.match(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi) ?? [];
assert(
  rlsStatements.length === 1,
  "the migration enables row level security exactly once"
);
assert(
  !/CREATE\s+POLICY/i.test(migrationSql),
  "the migration creates no permissive RLS policy; the server is the authorization boundary"
);
assert(
  !/\bauth\s*\./i.test(migrationSql),
  "the migration contains no auth.* reference"
);

/* ─────────────────── Migration: the existing roster is preserved, idempotently ────────────── */

for (const physicianName of [
  "Dr. Ralph Roland Asperas",
  "Dr. Heinz Roland Asperas",
  "Dr. Ma. Floricel Dedace-Lagrazon",
]) {
  assert(
    migrationSql.includes(`'${physicianName}'`),
    `the migration seeds the existing physician ${physicianName}`
  );
}
const seededNames = migrationSql.match(/'Dr\.[^']*'/g) ?? [];
assert(
  seededNames.length === 3,
  `the migration seeds exactly the three-physician roster (found ${seededNames.length})`
);
assert(
  /INSERT\s+INTO\s+physicians[\s\S]*?ON\s+CONFLICT\s*\(\s*full_name\s*\)\s*DO\s+NOTHING\s*;/i.test(
    migrationSql
  ),
  "the roster seed is idempotent: ON CONFLICT (full_name) DO NOTHING"
);
assert(
  !/\bON\s+CONFLICT\b[\s\S]*?\bDO\s+UPDATE\b/i.test(migrationSql),
  "the roster seed never overwrites an operator's later edit with DO UPDATE"
);

/* ─────────────────── Repository: server-only, explicit columns, no delete path ────────────── */

assert(
  /import\s+"server-only"/.test(physicianRepositorySource),
  "supabase-physician-repository.ts imports server-only"
);
assert(
  /const\s+PHYSICIAN_COLUMNS\s*=/.test(physicianRepositorySource),
  "the repository declares an explicit PHYSICIAN_COLUMNS projection"
);
assert(
  !/select\s*\(\s*["'`]\s*\*/.test(physicianRepositorySource),
  "the repository never selects * - every column crossing the boundary is named"
);
/**
 * NARROWED, ON PURPOSE, AND RECORDED AS SUCH.
 *
 * This assertion used to read `!/\.delete\(/.test(physicianRepositorySource)` - "the repository
 * exposes no hard-delete path" - as a substring scan over the WHOLE repository file. That letter
 * became wrong when the same repository took on `physician_examination_assignments`:
 * un-assigning a physician from an examination IS a row deletion, there is no soft-assignment
 * column and none should be added, because an assignment row is CURRENT CONFIGURATION rather
 * than history. A completed report stores the physician's printed name in its own session
 * snapshot, so withdrawing an assignment changes what may be chosen next and destroys nothing
 * already issued.
 *
 * The INVARIANT the old letter existed to hold is unchanged, and is what is asserted below
 * instead: a `physicians` row is never hard-deleted, because a historical report must keep
 * resolving the physician it was issued with. Three things hold it now:
 *   - no PostgREST chain that targets `physicians` reaches `.delete()` (here);
 *   - `toggleActiveStatus` remains the only physician-withdrawal path, and it is an UPDATE of
 *     `is_active` (here);
 *   - `IPhysicianRepository` declares no delete, remove or purge method at all (below), and the
 *     assignment table's foreign key is ON DELETE RESTRICT, so a physician cannot be erased from
 *     that side either.
 *
 * The scan is deliberately not relaxed into "ignore .delete() anywhere".
 *
 * CLINIC-UI-UX-08R1, by explicit user decision: an inactive physician that no report references
 * may now be permanently deleted - but only by `delete_inactive_physician()`, which locks the row,
 * re-decides every condition and audits in one transaction. So the letter below is unchanged: no
 * PostgREST chain against `physicians` reaches `.delete()`, and the repository holds no delete at
 * all. The assignment foreign key stays ON DELETE RESTRICT, so no assignment or default can be
 * orphaned from that side either.
 */
const strippedRepository = stripComments(physicianRepositorySource);
// Fail closed: an emptied haystack satisfies every negative below while proving nothing.
assert(
  strippedRepository.includes("class SupabasePhysicianRepository") &&
    strippedRepository.length > 1000,
  "the physician repository survives comment stripping with its executable source intact"
);
assert(
  /const ASSIGNMENT_TABLE = "physician_examination_assignments";/.test(strippedRepository),
  "ASSIGNMENT_TABLE resolves to the assignment join table, so a chain that targets it is provably not a chain that targets physicians"
);

interface PostgrestChain {
  /** The literal or identifier passed to `.from(...)`. */
  readonly target: string;
  /** Everything from that call up to the statement terminator. */
  readonly chain: string;
}

/**
 * Every `.from(x)...;` query chain in the repository, split by its target table.
 *
 * Statement-scoped rather than file-scoped, because "this file contains a delete" and "the
 * physicians table is deleted from" are different claims and only the second one matters.
 */
function postgrestChains(source: string): PostgrestChain[] {
  const chains: PostgrestChain[] = [];
  const pattern = /\.from\(\s*([^)]*?)\s*\)/g;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    const rest = source.slice(match.index + match[0].length);
    const end = rest.indexOf(";");
    chains.push({ target: match[1].trim(), chain: end >= 0 ? rest.slice(0, end) : rest });
  }
  return chains;
}

const repositoryChains = postgrestChains(strippedRepository);
assert(
  repositoryChains.length >= 8,
  `the query-chain scan found the repository's chains (found ${repositoryChains.length}); an empty scan would certify nothing`
);
const chainTargets = new Set(repositoryChains.map((entry) => entry.target));
assert(
  Array.from(chainTargets).every(
    (target) => target === '"physicians"' || target === "ASSIGNMENT_TABLE"
  ),
  `every repository query targets either physicians or the assignment table (found: ${JSON.stringify(Array.from(chainTargets))})`
);

const physicianTableChains = repositoryChains.filter((entry) => entry.target === '"physicians"');
assert(
  physicianTableChains.length >= 6,
  `the physicians table is queried through the chains this assertion inspects (found ${physicianTableChains.length})`
);
for (const entry of physicianTableChains) {
  assert(
    !/\.delete\(/.test(entry.chain),
    "no query against the physicians table reaches .delete() - the one permanent deletion is the audited database function"
  );
}
const deleteInactiveBody =
  /async deleteInactive\([\s\S]*?\n {2}\}/.exec(strippedRepository)?.[0] ?? "";
assert(
  /\.rpc\("delete_inactive_physician", \{/.test(deleteInactiveBody) &&
    !/\.from\(/.test(deleteInactiveBody) &&
    !/ASSIGNMENT_TABLE/.test(deleteInactiveBody),
  "deleteInactive reaches only delete_inactive_physician - no table chain, and never the assignment table: assignments are refused, never cascaded"
);

// The positive half, so the invariant is not left resting on a negative alone.
const toggleActiveStatusBody =
  /async toggleActiveStatus\([\s\S]*?\n {2}\}/.exec(strippedRepository)?.[0] ?? "";
assert(
  toggleActiveStatusBody.length > 0,
  "toggleActiveStatus is declared and locatable in the physician repository"
);
assert(
  /\.from\("physicians"\)/.test(toggleActiveStatusBody) &&
    /\.update\(\{ is_active: isActive \}\)/.test(toggleActiveStatusBody) &&
    !/\.delete\(/.test(toggleActiveStatusBody),
  "toggleActiveStatus withdraws a physician by updating is_active on the physicians row, which is the reversible physician-withdrawal path"
);

// THE REPOSITORY HOLDS NO DELETE AT ALL. Un-assignment is still a real row deletion, but it
// happens inside the `save_physician_configuration` transaction, where it is one statement among
// the four that commit or roll back together. verify-physician-assignments.ts asserts it there,
// bounded to the saved physician's own rows by `WHERE physician_id = v_physician_id`, and asserts
// that the function deletes no `physicians` row at all. The permanent physician deletion is
// `delete_inactive_physician()`, reached through rpc() and pinned above.
const deleteChains = repositoryChains.filter((entry) => /\.delete\(/.test(entry.chain));
assert(
  deleteChains.length === 0,
  `the repository issues no delete of its own; every assignment removal is inside the transaction (found: ${JSON.stringify(deleteChains.map((entry) => entry.target))})`
);
assert(
  !/\.delete\(/.test(strippedRepository),
  "no chain anywhere in the physician repository reaches .delete()"
);
// Field-by-field mapping, never a spread: a spread would carry a column added to the table later
// straight through to the domain record without anyone deciding it should.
assert(
  !/\.\.\.\s*row\b/.test(physicianRepositorySource) &&
    !/\.\.\.\s*physician\b/.test(physicianRepositorySource) &&
    !/\.\.\.\s*updates\b/.test(physicianRepositorySource),
  "the repository maps field by field and spreads neither the row nor the record"
);
for (const methodName of [
  "findById",
  "findAllActive",
  "findAll",
  "create",
  "update",
  "toggleActiveStatus",
]) {
  assert(
    new RegExp(`async\\s+${methodName}\\s*\\(`).test(physicianRepositorySource),
    `the repository implements ${methodName}`
  );
}
assert(
  /\.maybeSingle\(\)/.test(physicianRepositorySource),
  "findById resolves through maybeSingle(), so a missing row is null rather than an error"
);
// The duplicate-name contract depends on this: a repository that wrapped or swallowed the
// PostgrestError would destroy error.code, and the action layer could no longer tell 23505 from
// any other failure - it would have to return DUPLICATE_NAME for an outage.
assert(
  /if\s*\(error\)\s*throw\s+error\s*;/.test(physicianRepositorySource),
  "the repository rethrows the raw Supabase error so callers can read error.code"
);
const updateBodyMatch = /async\s+update\([\s\S]*?\n {2}\}/.exec(physicianRepositorySource);
assert(
  updateBodyMatch !== null && /toPhysicianUpdateRow\(updates\)/.test(updateBodyMatch[0]),
  "update() builds its row through the explicit per-field mapper"
);
const updateRowMapper =
  /function toPhysicianUpdateRow\([\s\S]*?\n\}/.exec(physicianRepositorySource)?.[0] ?? "";
assert(
  /if\s*\(updates\.fullName\s*!==\s*undefined\)/.test(updateRowMapper) &&
    /if\s*\(updates\.isActive\s*!==\s*undefined\)/.test(updateRowMapper),
  "the update mapper assigns one field per explicit !== undefined guard"
);

/* ─────────────────── Contracts: the domain record and the repository interface ────────────── */

const physicianInterface =
  /export interface IPhysician \{[\s\S]*?\n\}/.exec(domainInterfacesSource)?.[0] ?? "";
assert(physicianInterface.length > 0, "IPhysician is declared in the domain interfaces");
assert(
  /\bfullName\s*:\s*string\s*;/.test(physicianInterface) &&
    /\bisActive\s*:\s*boolean\s*;/.test(physicianInterface),
  "IPhysician carries the printable name and the active flag"
);

const physicianRepositoryInterface =
  /export interface IPhysicianRepository \{[\s\S]*?\n\}/.exec(repositoryInterfacesSource)?.[0] ?? "";
assert(
  physicianRepositoryInterface.length > 0,
  "IPhysicianRepository is declared in the repository interfaces"
);
// CLINIC-UI-UX-08R1, by explicit user decision: "declares no delete" became "declares exactly one
// deletion method, deleteInactive(id, actor)", which answers with the database function's closed
// outcome rather than a deleted row. Judged on comment-stripped text, so the interface's own prose
// about deletion can neither satisfy nor trip it.
const physicianRepositoryInterfaceCode = stripComments(physicianRepositoryInterface);
const declaredErasers =
  physicianRepositoryInterfaceCode.match(/\b(?:delete|remove|purge|destroy)\w*\s*\(/gi) ?? [];
assert(
  declaredErasers.length === 1 &&
    /\bdeleteInactive\(id: string, actor: DirectoryDeletionActor\): Promise<PhysicianDeletionOutcome>;/.test(
      physicianRepositoryInterfaceCode
    ),
  `IPhysicianRepository declares exactly one deletion method, deleteInactive(id, actor), and no remove, purge or destroy method (found: ${JSON.stringify(declaredErasers)})`
);
assert(
  /toggleActiveStatus\(id: string, isActive: boolean\): Promise<IPhysician>;/.test(
    physicianRepositoryInterface
  ),
  "IPhysicianRepository keeps deactivation as the reversible withdrawal"
);
assert(
  /class\s+SupabasePhysicianRepository\s+implements\s+IPhysicianRepository/.test(
    physicianRepositorySource
  ),
  "SupabasePhysicianRepository is checked against IPhysicianRepository at compile time"
);

/* ─────────────────── Validation: strict, trimmed, bounded, uuid-keyed ────────────────────── */

for (const schemaName of [
  "createPhysicianSchema",
  "updatePhysicianSchema",
  "physicianStatusSchema",
]) {
  const schemaBlock =
    new RegExp(`export const ${schemaName}[\\s\\S]*?\\n  \\.strict\\(\\);`).exec(
      physicianValidationSource
    )?.[0] ?? "";
  assert(
    schemaBlock.length > 0,
    `${schemaName} is declared and closed with .strict(), so an unexpected client key is rejected`
  );
}
assert(
  /\.trim\(\)[\s\S]*?\.min\(1, "Physician name is required"\)[\s\S]*?\.max\(150, "Physician name cannot exceed 150 characters"\)/.test(
    physicianValidationSource
  ),
  "the physician name is trimmed, required and length-bounded"
);
for (const schemaName of ["updatePhysicianSchema", "physicianStatusSchema"]) {
  const schemaBlock =
    new RegExp(`export const ${schemaName}[\\s\\S]*?\\n  \\.strict\\(\\);`).exec(
      physicianValidationSource
    )?.[0] ?? "";
  assert(
    /id:\s*z\.string\(\)\.uuid\(/.test(schemaBlock),
    `${schemaName} requires a uuid identifier`
  );
}

// `physicianConfigurationSchema` is pinned separately because it closes with `.superRefine(...)`
// rather than `.strict();`, so the extraction above cannot reach it - and because it is now the
// ONLY parse gate on the complete physician form save. Its `id` is nullable by design: a
// physician being created has no identifier until the transaction produces one.
const configurationSchemaBlock =
  /export const physicianConfigurationSchema[\s\S]*?\n  \}\);/.exec(physicianValidationSource)?.[0] ??
  "";
assert(
  configurationSchemaBlock.length > 0,
  "physicianConfigurationSchema is declared and locatable; an empty extraction would certify nothing"
);
assert(
  /\.strict\(\)/.test(configurationSchemaBlock),
  "physicianConfigurationSchema is strict, so an unexpected client key is rejected rather than carried"
);
assert(
  /id:\s*z\.string\(\)\.uuid\([^)]*\)\.nullable\(\)/.test(configurationSchemaBlock),
  "physicianConfigurationSchema keys on a nullable uuid - null is a create, a value is an update"
);
assert(
  /templateCodes:\s*z\.array\(templateCodeSchema\)\.max\(64\)/.test(configurationSchemaBlock) &&
    /defaultTemplateCodes:\s*z\.array\(templateCodeSchema\)\.max\(64\)/.test(
      configurationSchemaBlock
    ),
  "physicianConfigurationSchema bounds both examination lists and validates each code's shape"
);
assert(
  /fullName:\s*physicianFullNameSchema/.test(configurationSchemaBlock),
  "physicianConfigurationSchema takes the trimmed, bounded name rule rather than restating it"
);
for (const [rule, message] of [
  ["an examination cannot be assigned twice", "An examination cannot be assigned twice."],
  ["an examination cannot be defaulted twice", "An examination cannot be defaulted twice."],
  [
    "a default must also be assigned",
    "A default examination must also be an assigned examination.",
  ],
] as const) {
  assert(
    configurationSchemaBlock.includes(message),
    `physicianConfigurationSchema refuses ${rule} before the payload reaches the server action`
  );
}

/* ─────────────────── Server actions: authorize first, then parse, then persist ────────────── */

assert(
  /^"use server";/.test(physicianActionsSource),
  "physician-actions.ts is a server-action module"
);
assert(
  /import\s+"server-only"/.test(physicianActionsSource),
  "physician-actions.ts imports server-only"
);
assert(
  !/\bSupabaseClient\b/.test(physicianActionsSource) &&
    !/\bsupabaseClient\b/.test(physicianActionsSource),
  "physician-actions.ts introduces no concrete Supabase type"
);

const WRITE_ACTIONS = [
  "createPhysicianAction",
  "updatePhysicianAction",
  "togglePhysicianStatusAction",
  "savePhysicianConfigurationAction",
] as const;

/* ── The extraction the assertions below rest on cannot span two functions ──────────────────── */

// EVERY assertion in this file that reads a function body inherits its meaning from this. The
// extractor's positives - admin guard present, parse after it, repository after both, an audit
// event emitted - are all satisfiable by a NEIGHBOURING function if the brace scan runs past the
// end of its own, so an action that had lost its guard could pass by borrowing the next one's.
// This states the boundary directly rather than trusting the scanner: no extracted body may
// contain a top-level `export` declaration, because reaching one means the scan crossed into the
// following function.
const EXTRACTED_ACTIONS = [
  "createPhysicianAction",
  "updatePhysicianAction",
  "togglePhysicianStatusAction",
  "savePhysicianConfigurationAction",
  "listPhysiciansAction",
  "listPhysicianAssignmentsAction",
] as const;

for (const actionName of EXTRACTED_ACTIONS) {
  const extracted = extractFunctionBody(physicianActionsSource, actionName);
  assert(
    extracted.length > 0,
    `${actionName} extracts to a non-empty body; the extractor returns "" rather than a span it could not terminate`
  );
  assert(
    !/\nexport\s/.test(extracted),
    `${actionName}'s extracted body terminates before the next export declaration - the scan did not run into the following function`
  );
  // The declaration this body belongs to is the only one inside it. A body that swallowed a
  // neighbour would carry that neighbour's `async function` header.
  assert(
    !/\basync function\s/.test(extracted),
    `${actionName}'s extracted body contains no other function declaration`
  );
  // TRUNCATION, which the two assertions above cannot see: a body cut short is non-empty, carries
  // no export and carries no second declaration. A complete body ends where its closing brace
  // begins a line, so the span stops on a newline. This restates the extractor's terminal rule as
  // an assertion, so removing that rule fails here rather than silently shortening what every
  // assertion below reads.
  assert(
    extracted.endsWith("\n"),
    `${actionName}'s extracted body runs to its closing brace in column 0 - it was not cut short mid-line`
  );
}

for (const actionName of WRITE_ACTIONS) {
  const actionBody = extractFunctionBody(physicianActionsSource, actionName);
  assert(actionBody.length > 0, `${actionName} body was extracted from physician-actions.ts`);
  // Stripped first: commented-out code must not be able to satisfy an invocation-ordering check.
  const searchableActionBody = stripComments(actionBody);

  const adminGuardIndex = searchableActionBody.search(/await\s+requirePersonnelAdmin\s*\(\s*\)/);
  const parseIndex = searchableActionBody.search(/Schema\.parse\s*\(/);
  const repositoryIndex = searchableActionBody.indexOf("SupabasePhysicianRepository");

  assert(
    adminGuardIndex >= 0 && parseIndex > adminGuardIndex,
    `${actionName} authorizes an Admin caller (requirePersonnelAdmin) before parsing client input`
  );
  assert(
    repositoryIndex > adminGuardIndex && repositoryIndex > parseIndex,
    `${actionName} reaches the repository only after authorizing and validating`
  );
  assert(
    !/requirePersonnelReader/.test(searchableActionBody),
    `${actionName} does not downgrade to the read-only guard`
  );
  assert(
    /auditService\.emit\(\{/.test(searchableActionBody),
    `${actionName} records an audit event`
  );
  assert(
    /category:\s*"PersonnelCredential"/.test(searchableActionBody),
    `${actionName} audits under the existing PersonnelCredential category`
  );
}

const listBody = stripComments(extractFunctionBody(physicianActionsSource, "listPhysiciansAction"));
assert(listBody.length > 0, "listPhysiciansAction body was extracted");
const readerGuardIndex = listBody.search(/await\s+requirePersonnelReader\s*\(\s*\)/);
assert(
  readerGuardIndex >= 0 && listBody.indexOf("SupabasePhysicianRepository") > readerGuardIndex,
  "listPhysiciansAction authorizes with requirePersonnelReader before touching the repository"
);
assert(
  /export async function listPhysiciansAction\(\): Promise<PhysicianDirectoryEntry\[\]>/.test(
    physicianActionsSource
  ),
  "listPhysiciansAction accepts no client input and is typed to the client-safe projection"
);
assert(
  /\.map\(toDirectoryEntry\)/.test(listBody),
  "listPhysiciansAction returns projected entries, never raw physician records"
);

// The projection exists to stop a field added to IPhysician later crossing the boundary by
// accident; a spread would defeat it silently.
const toDirectoryEntryBody =
  /function toDirectoryEntry\([\s\S]*?\n\}/.exec(physicianActionsSource)?.[0] ?? "";
assert(toDirectoryEntryBody.length > 0, "physician-actions.ts declares the toDirectoryEntry projection");
assert(
  !/\.\.\.\s*physician\b/.test(toDirectoryEntryBody),
  "toDirectoryEntry projects field by field and never spreads the physician record"
);
const directoryEntryInterface =
  /export interface PhysicianDirectoryEntry \{[\s\S]*?\n\}/.exec(physicianEntrySource)?.[0] ?? "";
assert(
  directoryEntryInterface.length > 0,
  "PhysicianDirectoryEntry interface is declared and locatable"
);
assert(
  !/\[\s*key\s*:\s*string\s*\]/.test(directoryEntryInterface),
  "PhysicianDirectoryEntry declares no index signature escape hatch"
);

/* ────────── No direct delete; one audited database deletion (CLINIC-UI-UX-08R1) ──────────── */

// By explicit user decision a physician may now be permanently deleted - but never by a table
// delete. The actions layer owns no query chain and issues no delete at all; the one permanent
// deletion is a repository call from ONE action, reached only after the Administrator guard and the
// strict parse, and the repository hands it to `delete_inactive_physician()`, which re-decides
// inactivity, assignments and every report reference and audits in the same transaction.
assert(
  !/\.from\(/.test(physicianActionsSource) && !/\.delete\(/.test(physicianActionsSource),
  "physician actions own no query chain and issue no direct delete"
);
for (const [label, source] of [
  ["physician actions", physicianActionsSource],
  ["physician repository", physicianRepositorySource],
] as const) {
  assert(!/\bDELETE\s+FROM\b/i.test(source), `${label} contain no DELETE FROM statement`);
}
// The repository keeps the whole-file letter it held before this package: zero deletes. The
// assignment-set replacement is inside the `save_physician_configuration` transaction, where
// verify-physician-assignments.ts pins it as the function's only DELETE, bounded to the saved
// physician's own rows; the permanent deletion is the database function.
assert(
  (physicianRepositorySource.match(/\.delete\(/g) ?? []).length === 0,
  "the physician repository holds no delete of its own; the assignment-set replacement is inside the transaction, pinned by verify-physician-assignments.ts"
);
assert(
  !/\bremove\b/.test(physicianActionsSource),
  "physician actions contain no remove call"
);

const deletePhysicianBody = stripComments(
  extractFunctionBody(physicianActionsSource, "deletePhysicianAction")
);
// Any receiver, on comment-stripped source: a second call through a differently named variable or
// a fresh `new SupabasePhysicianRepository()` must count too.
assert(
  (stripComments(physicianActionsSource).match(/\.deleteInactive\(/g) ?? []).length === 1 &&
    /\brepository\.deleteInactive\(parsed\.id, \{/.test(deletePhysicianBody),
  "exactly one physician action reaches the repository's deletion, and it is deletePhysicianAction"
);
// Index comparison on a comment-stripped body: the guard and the parse come before the one call,
// and only DELETED is reported as a success.
const deletePhysicianSteps: ReadonlyArray<readonly [string, RegExp]> = [
  ["the Administrator guard", /await\s+requirePersonnelAdmin\s*\(\s*\)/],
  ["the strict id parse", /physicianDeleteSchema\.parse\s*\(\s*input\s*\)/],
  [
    "the one database deletion, recorded against the session's Administrator",
    /repository\.deleteInactive\(parsed\.id, \{\s*userId: caller\.userId,\s*username: caller\.username,\s*role: caller\.role,\s*\}\)/,
  ],
  [
    "the success, reported only for DELETED",
    /if \(outcome === "DELETED"\) \{\s*return \{ success: true, auditRecorded: true \};\s*\}/,
  ],
  ["the refusal, passed through as the database decided it", /return \{ success: false, error: outcome \};/],
];
let previousDeleteStep = -1;
for (const [step, pattern] of deletePhysicianSteps) {
  const index = deletePhysicianBody.search(pattern);
  assert(
    index > previousDeleteStep,
    `deletePhysicianAction reaches ${step} after every earlier step`
  );
  previousDeleteStep = index;
}
assert(
  !/findById|findAssignmentsByPhysician|auditService|\.code === "23503"|catch\s*\(/.test(deletePhysicianBody),
  "deletePhysicianAction decides nothing from a pre-read, catches nothing and writes no audit of its own - the database function re-decides and audits in the deletion's transaction"
);
const physicianRepositoryCode = stripComments(physicianRepositorySource);
assert(
  (physicianRepositoryCode.match(/\.rpc\("delete_inactive_physician"/g) ?? []).length === 1 &&
    /\.rpc\("delete_inactive_physician", \{\s*p_physician_id: id,\s*p_actor_user_id: actor\.userId,\s*p_actor_username: actor\.username,\s*p_actor_role: actor\.role,\s*\}\)/.test(
      physicianRepositoryCode
    ),
  "the physician repository reaches delete_inactive_physician once, carrying only the id and the actor"
);
assert(
  !/requirePersonnelReader/.test(deletePhysicianBody),
  "deletePhysicianAction never reuses the reader guard, which would admit a Developer"
);
assert(
  /togglePhysicianStatusAction/.test(physicianActionsSource),
  "deactivation is exposed as the removal path"
);

/* ─────────────────── Duplicate name is returned as a result, never thrown ─────────────────── */

assert(
  /export type PhysicianActionResult =\s*\|\s*\{ success: true \}\s*\|\s*\{ success: false; error: "DUPLICATE_NAME" \};/.test(
    physicianActionsSource
  ),
  "PhysicianActionResult is the closed success/DUPLICATE_NAME union"
);
assert(
  !/success:\s*true,\s*data:/.test(physicianActionsSource),
  "no physician action returns a physician record on success"
);

for (const actionName of ["createPhysicianAction", "updatePhysicianAction"]) {
  const body = extractFunctionBody(physicianActionsSource, actionName);
  assert(
    /\(error as \{ code: string \}\)\.code === "23505"/.test(body),
    `${actionName} recognises the unique-violation by its PostgreSQL SQLSTATE, not by message text`
  );
  assert(
    /return\s*\{\s*success:\s*false\s*,\s*error:\s*"DUPLICATE_NAME"\s*\}/.test(body),
    `${actionName} returns { success: false, error: 'DUPLICATE_NAME' } on unique-violation`
  );
  assert(
    !/throw\s+new\s+Error\s*\(\s*"DUPLICATE_NAME"\s*\)/.test(body),
    `${actionName} never throws DUPLICATE_NAME as an Error`
  );
  // A bare `catch { return DUPLICATE_NAME }` would report a database outage as a duplicate name.
  assert(
    /throw error;/.test(body),
    `${actionName} rethrows every non-duplicate failure instead of reporting it as a duplicate`
  );
}

/* ─────────────────── Audit details reuse curated keys only ────────────────────────────────── */

// verify-audit-presentation.ts owns the completeness rule (every emitted details key must have a
// curated label in AuditLogView's DETAIL_LABELS). This asserts the narrower thing that rule
// depends on here: this feature introduced NO new details key, so it added no unlabelled row to
// the audit detail panel and needed no edit to a closed presentation list.
const CURATED_DETAIL_KEYS = new Set(["isActive", "changedFields"]);
const emittedDetailKeys = new Set<string>();
const detailsLiteral = /details:\s*\{([^}]*)\}/g;
for (let match = detailsLiteral.exec(physicianActionsSource); match; match = detailsLiteral.exec(physicianActionsSource)) {
  for (const part of match[1].split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = /^([A-Za-z_$][\w$]*)\s*(?::|$)/.exec(trimmed)?.[1];
    assert(key !== undefined, `every emitted audit details property is a plain key (found: ${trimmed})`);
    emittedDetailKeys.add(key);
  }
}
assert(
  emittedDetailKeys.size > 0,
  "the audit details enumeration found at least one emitted key; an empty set would certify nothing"
);
for (const key of emittedDetailKeys) {
  assert(
    CURATED_DETAIL_KEYS.has(key),
    `emitted audit details key "${key}" must already be curated in AuditLogView's DETAIL_LABELS`
  );
}

// The event types are new, but the CATEGORY is not: introducing a new AuditCategory would require
// editing four closed lists (the union, the read service, the action input schema and the filter).
assert(
  !/category:\s*"Physician/.test(physicianActionsSource),
  "no physician action introduces a new audit category"
);
for (const eventType of [
  "PhysicianRecordCreated",
  "PhysicianRecordUpdated",
  "PhysicianStatusToggled",
]) {
  assert(
    physicianActionsSource.includes(`eventType: "${eventType}"`),
    `the physician write path records the ${eventType} event`
  );
}
// The deletion is recorded by the database, in the same transaction as the delete itself, under
// the same category and the one curated details key this feature already uses.
const deletionMigrationSql = getSource(
  "supabase/migrations/20260913120000_stable_physician_references_and_atomic_directory_deletion.sql"
);
assert(
  !physicianActionsSource.includes('"PhysicianRecordDeleted"') &&
    /'PersonnelCredential',\s*'PhysicianRecordDeleted',[\s\S]*?jsonb_build_object\('isActive', v_physician\.is_active\)/.test(
      deletionMigrationSql
    ),
  "the physician deletion records PhysicianRecordDeleted from inside delete_inactive_physician(), with only the curated isActive key"
);

/* ═══════════════════════ UI: the physician directory's client components ═══════════════════
 *
 * Everything above this line proves the SERVER contract. Nothing above it says anything about
 * the screen, so three properties of the admin UI rested on human reading alone. They are
 * asserted here.
 *
 * On the first of them, plainly: the UI gating below is PRESENTATION, and it is never the
 * security control. `requirePersonnelAdmin()` inside every write action is - and it is already
 * proved above, independently of anything here. The reason to pin the presentation anyway is
 * that a screen offering a control the server will refuse is a defect in its own right: the
 * operator is invited to do something, and the invitation is a lie.
 *
 * Every predicate below runs against COMMENT-STRIPPED source. These components explain
 * themselves at length, and prose describing a rule must never be able to satisfy the check for
 * that rule - PhysicianTable's own doc comment states that a physician row is never deleted, so
 * a raw-text delete scan would pass on the sentence while a real delete control sat beside it.
 */

const personnelPageSource = getSource("src/app/(app)/personnel/page.tsx");
const physicianDirectoryViewSource = getSource(
  "src/app/(app)/personnel/_components/PhysicianDirectoryView.tsx"
);
const physicianTableSource = getSource("src/app/(app)/personnel/_components/PhysicianTable.tsx");
const physicianFormSource = getSource("src/app/(app)/personnel/_components/PhysicianForm.tsx");
const physicianFormModalSource = getSource(
  "src/app/(app)/personnel/_components/PhysicianFormModal.tsx"
);

const personnelPage = stripComments(personnelPageSource);
const physicianView = stripComments(physicianDirectoryViewSource);
const physicianTable = stripComments(physicianTableSource);
const physicianForm = stripComments(physicianFormSource);
const physicianFormModal = stripComments(physicianFormModalSource);

// Fail closed. A stripper that swallowed a file would leave an empty haystack, and an empty
// haystack satisfies every negative assertion below while proving nothing at all.
for (const [label, stripped, anchor] of [
  ["personnel/page.tsx", personnelPage, "export default async function PersonnelPage"],
  ["PhysicianDirectoryView", physicianView, "export function PhysicianDirectoryView"],
  ["PhysicianTable", physicianTable, "export function PhysicianTable"],
  ["PhysicianForm", physicianForm, "export function PhysicianForm"],
  ["PhysicianFormModal", physicianFormModal, "export function PhysicianFormModal"],
] as const) {
  assert(
    stripped.includes(anchor) && stripped.length > 500,
    `${label} survives comment stripping with its executable source intact`
  );
}

const PHYSICIAN_COMPONENTS = [
  ["PhysicianDirectoryView", physicianView],
  ["PhysicianTable", physicianTable],
  ["PhysicianForm", physicianForm],
  ["PhysicianFormModal", physicianFormModal],
] as const;

function countMatches(source: string, pattern: RegExp): number {
  return (source.match(new RegExp(pattern.source, "g")) ?? []).length;
}

/**
 * The JSX expression container `{ <guard> && ... }`, brace-matched from its opening brace.
 *
 * Braces are matched rather than parentheses because a conditional render may be written either
 * as `{canManage && (<X />)}` or as `{canManage && <X />}`, and only the brace form is common to
 * both. String literals are skipped so a brace inside a className or a message cannot unbalance
 * the scan.
 */
function guardedExpressions(source: string, guard: RegExp): string[] {
  const regions: string[] = [];
  const pattern = new RegExp(guard.source, "g");
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    let depth = 0;
    let inString = false;
    let stringChar = "";
    let escaped = false;
    let region = "";
    for (let i = match.index; i < source.length; i++) {
      const ch = source[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (inString) {
        if (ch === stringChar) inString = false;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inString = true;
        stringChar = ch;
        continue;
      }
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          region = source.slice(match.index, i + 1);
          break;
        }
      }
    }
    if (!region) continue;
    regions.push(region);
    pattern.lastIndex = match.index + region.length;
  }
  return regions;
}

// `{canManage &&` only - the negated form starts `{!canManage`, so the two never collide.
const CAN_MANAGE_GUARD = /\{\s*canManage\s*&&/;
const CANNOT_MANAGE_GUARD = /\{\s*!\s*canManage\s*&&/;

/* ─────────────── UI property 1: management affordances are offered to Admin only ──────────── */

assert(
  /const canManage = currentUserProfile\?\.role === "Admin";/.test(personnelPage),
  "the physician directory's management affordances are offered only to a caller whose role is exactly Admin"
);
assert(
  /<PhysicianDirectoryView[^>]*\scanManage=\{canManage\}/.test(personnelPage),
  "the physician section is gated by the same computed permission as the personnel section, never by its own weaker rule"
);
assert(
  !/canManage=\{true\}/.test(personnelPage),
  "the physician section is never handed a hard-coded management permission"
);

const readOnlyRegions = guardedExpressions(physicianView, CANNOT_MANAGE_GUARD);
assert(
  readOnlyRegions.length === 1,
  "a caller who may not manage physicians is told the directory is read-only, exactly once"
);
// Tags removed so only the rendered prose is counted: the notice must actually SAY something.
// An emptied container would otherwise satisfy a presence check while the operator saw nothing
// but a screen quietly missing its controls.
const readOnlyProse = (readOnlyRegions[0].replace(/<[^>]*>/g, " ").match(/[A-Za-z]/g) ?? []).length;
assert(
  readOnlyProse >= 30,
  "the read-only notice explains the missing controls rather than rendering an empty container"
);

const manageRegions = guardedExpressions(physicianView, CAN_MANAGE_GUARD);
const createControlSites = countMatches(physicianView, /onClick=\{handleOpenCreate\}/);
const guardedCreateControlSites = manageRegions.reduce(
  (total, region) => total + countMatches(region, /onClick=\{handleOpenCreate\}/),
  0
);
assert(
  createControlSites >= 1 && guardedCreateControlSites === createControlSites,
  "the control that opens the create-physician form is offered only to a caller who may manage physicians"
);

const modalSites = countMatches(physicianView, /<PhysicianFormModal\b/);
const guardedModalSites = manageRegions.reduce(
  (total, region) => total + countMatches(region, /<PhysicianFormModal\b/),
  0
);
assert(
  modalSites >= 1 && guardedModalSites === modalSites,
  "the physician form is not mounted at all for a caller who may not manage physicians"
);

const tableManageRegions = guardedExpressions(physicianTable, CAN_MANAGE_GUARD);
const guardedHeadCells = tableManageRegions.reduce(
  (total, region) => total + countMatches(region, /<TableHead\b/),
  0
);
const guardedBodyCells = tableManageRegions.reduce(
  (total, region) => total + countMatches(region, /<TableCell\b/),
  0
);
assert(
  guardedHeadCells === 1 && guardedBodyCells === 1,
  "the physician Actions column withholds its header and its cells together, so a read-only table is never left with a column heading for controls it does not render"
);

const rowActionSites = countMatches(physicianTable, /<RowActions\b/);
const guardedRowActionSites = tableManageRegions.reduce(
  (total, region) => total + countMatches(region, /<RowActions\b/),
  0
);
assert(
  rowActionSites >= 2 && guardedRowActionSites === rowActionSites,
  "every physician row-action group is withheld from a caller who may not manage physicians, in the table and in the narrow-width record list alike"
);

/* ────────── UI property 2: the one destructive control is Delete, on inactive records only ─────────
 *
 * CLINIC-UI-UX-08R1 replaced "the UI offers no destructive control at all" by explicit user
 * decision. What replaces it is bounded, not relaxed: the editor and its modal still offer no
 * destructive word or call of any kind; the table offers exactly one destructive control, rendered
 * only inside the `!physician.isActive` guard and wired to `onDelete`; the view reaches `onDelete`
 * from one place only, the confirmation's confirm handler, behind the single-flight guard; and the
 * page wires that to the one server action, which re-decides everything. No component holds a
 * direct delete path. Presentation still grants nothing - the action's own guard is proved above.
 */

// Two shapes, because a delete arrives as either. The word scan catches a control labelled or
// named for destruction; the call scan catches the invocation behind it. Member calls are
// excluded from the call scan so a DOM cleanup such as `window.removeEventListener(...)` is not
// mistaken for a record deletion - the word scan still refuses a `Remove` control.
const DESTRUCTIVE_WORD =
  /\b(?:delete|deletes|deleted|deleting|remove|removes|removed|removing|destroy|destroys|destroyed|purge|purges|purged)\b/i;
const DESTRUCTIVE_CALL = /(?<![\w$.])[A-Za-z_$][\w$]*(?:[Dd]elete|[Dd]estroy|[Pp]urge|[Rr]emove)[\w$]*\s*\(/;

for (const [label, component] of PHYSICIAN_COMPONENTS) {
  assert(
    !/\.delete\s*\(/.test(component) && !/\bDELETE\s+FROM\b/i.test(component),
    `${label} contains no direct delete path`
  );
}
for (const [label, component] of [
  ["PhysicianForm", physicianForm],
  ["PhysicianFormModal", physicianFormModal],
] as const) {
  assert(
    !DESTRUCTIVE_WORD.test(component),
    `${label} offers no delete, remove, destroy or purge control - the editor never erases a physician record`
  );
  assert(
    !DESTRUCTIVE_CALL.test(component),
    `${label} calls nothing that erases a physician record`
  );
}

function destructiveCalls(source: string): string[] {
  return (source.match(new RegExp(DESTRUCTIVE_CALL.source, "g")) ?? []).map((call) =>
    call.replace(/\s*\($/, "")
  );
}

const INACTIVE_PHYSICIAN_GUARD = /\{\s*!\s*physician\.isActive\s*&&/;
const inactiveRegions = guardedExpressions(physicianTable, INACTIVE_PHYSICIAN_GUARD);
assert(
  countMatches(physicianTable, /variant="danger"/) === 1 &&
    inactiveRegions.length === 1 &&
    countMatches(inactiveRegions[0], /variant="danger"/) === 1,
  "PhysicianTable renders exactly one destructive control, and only inside the !physician.isActive guard - an active physician is never offered Delete"
);
assert(
  /onClick=\{\(\) => onDelete\(physician\)\}/.test(inactiveRegions[0]) &&
    /aria-label=\{`Delete \$\{name\}`\}/.test(inactiveRegions[0]),
  "the Delete control names the physician it acts on and only opens the confirmation through onDelete"
);
const tableErasingCalls = destructiveCalls(physicianTable);
assert(
  tableErasingCalls.length === 1 &&
    tableErasingCalls[0] === "onDelete" &&
    countMatches(inactiveRegions[0], /onDelete\(/) === 1,
  `PhysicianTable's only erasing call is onDelete, inside the inactive guard (found: ${JSON.stringify(tableErasingCalls)})`
);

const ALLOWED_VIEW_ERASING_CALLS = new Set(["onDelete", "setDeleteTarget", "setIsDeleteDialogOpen"]);
const viewErasingCalls = destructiveCalls(physicianView);
assert(
  viewErasingCalls.every((call) => ALLOWED_VIEW_ERASING_CALLS.has(call)) &&
    viewErasingCalls.filter((call) => call === "onDelete").length === 1,
  `PhysicianDirectoryView reaches onDelete exactly once and calls nothing else that erases (found: ${JSON.stringify(viewErasingCalls)})`
);
const confirmDeleteHandler =
  /const handleConfirmDelete = async \(\) => \{[\s\S]*?\n {2}\};/.exec(physicianView)?.[0] ?? "";
const singleFlightIndex = confirmDeleteHandler.search(
  /if \(busyPhysicianIdRef\.current !== null\) return;/
);
assert(
  singleFlightIndex >= 0 &&
    singleFlightIndex < confirmDeleteHandler.indexOf("await onDelete(physician)"),
  "the one onDelete call sits in the confirm handler, behind the single-flight guard, so a second press is dropped before any request is sent"
);
const confirmDialogRegions = manageRegions.filter((region) => /<ConfirmDialog\b/.test(region));
assert(
  countMatches(physicianView, /<ConfirmDialog\b/) === 1 &&
    confirmDialogRegions.length === 1 &&
    /onConfirm=\{handleConfirmDelete\}/.test(confirmDialogRegions[0]) &&
    /variant="destructive"/.test(confirmDialogRegions[0]) &&
    /isPending=\{busyAction === "delete"\}/.test(confirmDialogRegions[0]),
  "the deletion is confirmed through one destructive ConfirmDialog, mounted only for a caller who may manage physicians and locked while the request is in flight"
);
assert(
  /onDelete=\{async \(physician\) => \{\s*"use server";[\s\S]*?return deletePhysicianAction\(\{ id: physician\.id \}\);/.test(
    personnelPage
  ),
  "the physician Delete confirmation is wired to deletePhysicianAction, passing the id alone"
);
// The positive half: the ordinary withdrawal is still the reversible status toggle.
assert(
  /onToggleStatus/.test(physicianTable) && /onToggleStatus/.test(physicianView),
  "the physician directory withdraws a record through the reversible status toggle"
);
assert(
  /togglePhysicianStatusAction/.test(personnelPage),
  "the physician directory's status control is wired to the soft status toggle action"
);

/* ─────────────── UI property 3: a duplicate name lands on the name field ──────────────────── */

assert(
  /result\.error\s*===\s*"DUPLICATE_NAME"\s*\)\s*\{[\s\S]{0,400}?setError\(\s*"fullName"\s*,/.test(
    physicianForm
  ),
  "a duplicate physician name is reported on the name field that caused it, not left for the user to locate"
);
assert(
  /setError\(\s*"fullName"\s*,\s*\{[\s\S]{0,200}?message:\s*["'`][^"'`]+["'`]/.test(physicianForm),
  "the duplicate-name field error carries a message the user can read"
);
assert(
  /errors\.fullName\?\.message/.test(physicianForm) &&
    /register\(\s*"fullName"\s*\)/.test(physicianForm),
  "the name field renders the error set on it, so the duplicate message is actually seen"
);
assert(
  !/throw\s+new\s+Error\s*\(\s*["'`]?DUPLICATE_NAME/.test(physicianForm),
  "a duplicate physician name is never re-thrown as an error by the form"
);
// A duplicate handled inside the catch would be the swallowing case: the same generic banner for
// "this name already exists" and "the database is unreachable" tells the operator nothing about
// what to change.
assert(
  physicianForm.indexOf('"DUPLICATE_NAME"') > 0 &&
    physicianForm.indexOf('"DUPLICATE_NAME"') < physicianForm.indexOf("} catch"),
  "the duplicate-name result is handled as a returned result, before any generic failure handler can absorb it"
);

/* ─────────────── Client boundary: the same rules the personnel components keep ────────────── */

for (const [label, component] of PHYSICIAN_COMPONENTS) {
  assert(
    !/signatureImageUrl/.test(component),
    `${label} names no signatureImageUrl`
  );
  assert(
    !/\bIPersonnel\b/.test(component) && !/\bIPhysician\b/.test(component),
    `${label} uses the client-safe PhysicianDirectoryEntry projection, never a domain record type`
  );
  assert(
    /\bPhysicianDirectoryEntry\b/.test(component),
    `${label} types its physician data as PhysicianDirectoryEntry`
  );
  assert(
    !/from\s+["']@\/repositories/.test(component) && !/from\s+["']@\/domain/.test(component),
    `${label} imports no repository or domain module; the server-action boundary is the only way in`
  );
  assert(
    !/new\s+Supabase[A-Za-z]*Repository/.test(component),
    `${label} calls no repository directly`
  );
  assert(
    !/from\s+["']@\/components\/shadcn/.test(component),
    `${label} takes its primitives from the @/components/ui wrappers, never from @/components/shadcn directly`
  );
  assert(
    /from\s+["']@\/components\/ui\//.test(component),
    `${label} builds on the shared @/components/ui primitives`
  );
}
assert(
  /from\s+["']@\/features\/server-boundary\/physician-actions["']/.test(physicianView),
  "the physician directory reaches its data through the server-action boundary"
);

/* ─────────────── An inactive physician stays visible in the directory ─────────────────────── */

const listPhysiciansBody = extractFunctionBody(physicianActionsSource, "listPhysiciansAction");
assert(
  /repository\.findAll\(\s*\)/.test(listPhysiciansBody) && !/findAllActive/.test(listPhysiciansBody),
  "the directory read returns the whole roster, so a deactivated physician is still listed"
);
assert(
  /useState\(\s*"ALL"\s*\)/.test(physicianView),
  "the physician directory opens on every status, so an inactive record is visible without changing a filter"
);
assert(
  /value:\s*"INACTIVE"/.test(physicianView),
  "a deactivated physician remains reachable through an explicit Inactive filter"
);

// Scoped to the render filter alone. The summary strip legitimately counts actives with the same
// expression, and a whole-file negative would fail on the count instead of the list.
const renderFilterBlock =
  /const filteredPhysicians = useMemo\(\(\) => \{[\s\S]*?\n {2}\}, \[/.exec(physicianView)?.[0] ?? "";
assert(
  renderFilterBlock.length > 0,
  "the physician directory's render filter is declared and locatable"
);
const unconditionalActiveExclusions = renderFilterBlock
  .split("\n")
  .filter((line) => /isActive/.test(line) && !/statusFilter/.test(line));
assert(
  unconditionalActiveExclusions.length === 0,
  `the directory drops an inactive physician only when the operator asks for Actives (offending lines: ${JSON.stringify(unconditionalActiveExclusions)})`
);

const physicianRenderLoops = countMatches(physicianTable, /physicians\.map\(/);
const statusBadgeSites = countMatches(
  physicianTable,
  /status=\{\s*physician\.isActive\s*\?\s*"Active"\s*:\s*"Inactive"\s*\}/
);
assert(
  physicianRenderLoops >= 1 && statusBadgeSites === physicianRenderLoops,
  "every rendered physician carries its own status badge, so an inactive record is shown as inactive rather than hidden"
);
// Scoped to the physician collection: the className helpers legitimately call .filter(Boolean),
// and a bare .filter negative would fail on presentation rather than on a dropped record.
assert(
  !/physicians\.filter\(/.test(physicianTable) &&
    !/\.filter\([^)]*isActive/.test(physicianTable),
  "the physician table renders the rows it is given and drops none of them, active or not"
);

/* ═════════ UI: examination assignments on the physician administration screen ══════════════
 *
 * The physician directory now carries a second decision: which examinations a physician may be
 * selected for, and which examination pre-selects them. That decision is made on this screen and
 * enforced by `savePhysicianConfigurationAction`, and the screen's own obligations are asserted here.
 *
 * Once more, plainly: everything below is PRESENTATION. `requirePersonnelAdmin()` inside the
 * assignment action is the authorization boundary, the schema's refinement and the action's own
 * restatement are what refuse a default that is not assigned, and the partial unique index is what
 * makes two defaults for one examination unrepresentable. None of those depend on a single
 * assertion in this section. What this section refuses to let happen is a screen that OFFERS a
 * control the server will refuse - an invitation that is a lie - and a screen that shows an
 * assignment set the operator cannot actually read.
 */

const assignmentFieldSource = getSource(
  "src/app/(app)/personnel/_components/PhysicianExaminationAssignmentField.tsx"
);
const examinationCatalogueSource = getSource(
  "src/app/(app)/personnel/_components/physician-examinations.ts"
);
const assignmentField = stripComments(assignmentFieldSource);
const examinationCatalogue = stripComments(examinationCatalogueSource);

// Fail closed, exactly as the components above do: an emptied haystack satisfies every negative.
for (const [label, stripped, anchor] of [
  [
    "PhysicianExaminationAssignmentField",
    assignmentField,
    "export function PhysicianExaminationAssignmentField",
  ],
  ["physician-examinations", examinationCatalogue, "export const EXAMINATION_FAMILIES"],
] as const) {
  assert(
    stripped.includes(anchor) && stripped.length > 500,
    `${label} survives comment stripping with its executable source intact`
  );
}

/* ─────────────── The directory row states the assignment facts, at every width ────────────── */

const physicianHeaderRow = /<TableHeader>[\s\S]*?<\/TableHeader>/.exec(physicianTable)?.[0] ?? "";
assert(physicianHeaderRow.length > 0, "the physician table's header row is declared and locatable");

const PHYSICIAN_TABLE_COLUMNS = [
  "Physician",
  "Assigned examinations",
  "Default for",
  "Status",
  "Actions",
] as const;

let previousColumnIndex = -1;
for (const column of PHYSICIAN_TABLE_COLUMNS) {
  const columnIndex = physicianHeaderRow.indexOf(`>${column}</TableHead>`);
  assert(columnIndex >= 0, `the physician table renders the ${column} column header`);
  assert(columnIndex > previousColumnIndex, `the ${column} column keeps its place in the declared order`);
  previousColumnIndex = columnIndex;
}
assert(
  countMatches(physicianHeaderRow, /<TableHead\b/) === PHYSICIAN_TABLE_COLUMNS.length,
  "the physician table declares exactly those five columns and no sixth"
);

// Both layouts carry both facts. The narrow-width record is not allowed to be the layout where
// the assignment set quietly disappears, because that is the width most of this is read at.
assert(
  countMatches(physicianTable, /<ExaminationSummary\b/) === 4,
  "the desktop row and the narrow-width record each render an assigned summary and a default summary"
);
assert(
  countMatches(physicianTable, /codes=\{assignments\.assignedCodes\}/) === 2 &&
    countMatches(physicianTable, /codes=\{assignments\.defaultCodes\}/) === 2,
  "each layout takes its two summaries from the assignment set of the physician on that row"
);

/* ─────────────── Unassigned is a state that is SHOWN, not a blank cell ────────────────────── */

assert(
  countMatches(physicianTable, /emptyLabel="Unassigned"/) === 2,
  "a physician with no assignments is labelled Unassigned in both layouts"
);
assert(
  countMatches(physicianTable, /emptyLabel="No default"/) === 2,
  "a physician who is nobody's default says so, rather than leaving the column empty"
);
assert(
  /codes\.length === 0/.test(physicianTable) &&
    /<Badge variant="neutral" size="sm">[\s\S]{0,60}\{emptyLabel\}/.test(physicianTable),
  "an empty assignment set renders its explicit label in a badge, never a blank cell that would read as 'not loaded'"
);
assert(
  /assignmentsByPhysicianId\?\.\[physicianId\] \?\? NO_EXAMINATION_ASSIGNMENTS/.test(physicianTable),
  "a physician with no assignment row at all falls back to the empty set, so an absent key is shown as unassigned rather than as missing data"
);

/* ─────────────── Readable at any width, and the abbreviation is never the only form ───────── */

assert(
  /tallyByFamily\(codes\)/.test(physicianTable),
  "a large assignment set is summarised as family tallies rather than listed as codes inline, so the cell cannot force the table into a horizontal scroll"
);
assert(
  /aria-hidden="true"[\s\S]{0,200}?listInFull/.test(physicianTable),
  "the abbreviated chip row is hidden from assistive technology, because the abbreviation is not the text equivalent"
);
assert(
  /<span className="sr-only">[\s\S]{0,200}?summarizeByFamily\(codes\)/.test(physicianTable),
  "the chips are backed by a full-word tally a screen reader reaches, so the abbreviation is never the only form of the word"
);
assert(
  /<details/.test(physicianTable) &&
    /<summary/.test(physicianTable) &&
    /listExaminationTitles\(codes\)/.test(physicianTable),
  "the full assignment detail is reachable through a native disclosure that lists every examination by title - keyboard reachable, and not a hover-only tooltip"
);
assert(
  !/\btitle=\{/.test(physicianTable),
  "no assignment fact is carried by a title-attribute tooltip alone"
);

/* ─────────────── The editor is on the SAME gate as every other write control ──────────────── */

const assignmentEditorInForm = countMatches(
  physicianForm,
  /<PhysicianExaminationAssignmentField\b/
);
const assignmentEditorElsewhere =
  countMatches(physicianView, /<PhysicianExaminationAssignmentField\b/) +
  countMatches(physicianTable, /<PhysicianExaminationAssignmentField\b/) +
  countMatches(personnelPage, /<PhysicianExaminationAssignmentField\b/);
const physicianFormSites = countMatches(physicianFormModal, /<PhysicianForm\b/);

assert(
  assignmentEditorInForm === 1 && assignmentEditorElsewhere === 0,
  "the assignment editor is rendered by the physician form and by nothing else - it has no second, ungated mounting point"
);
assert(
  physicianFormSites === 1,
  "the physician form reaches the screen only through its dialog"
);
// The chain, stated as one fact: editor -> form -> modal -> `{canManage && ...}`. The last link
// is the same `guardedModalSites === modalSites` proved for the create control further up, so
// the assignment editor is gated by exactly the rule the other write controls are gated by, and
// a caller who may not manage physicians does not mount it at all.
assert(
  modalSites >= 1 &&
    guardedModalSites === modalSites &&
    physicianFormSites === 1 &&
    assignmentEditorInForm === 1 &&
    assignmentEditorElsewhere === 0,
  "the examination assignment editor reaches the screen only through the canManage-gated form modal, on exactly the gate the other physician write controls use"
);

/* ─────────────── Default cannot be offered for an unassigned examination ──────────────────── */

assert(
  /disabled=\{disabled \|\| !isAssigned\}/.test(assignmentField),
  "the Default control of an unassigned examination is rendered disabled, so it cannot be set"
);
assert(
  /if \(!assigned\.has\(code\)\) return;/.test(assignmentField),
  "a default toggle against an unassigned examination changes nothing even if the disabled attribute is bypassed - the state change does not rest on an attribute holding"
);

const commitFunnel = /const commit = useCallback\([\s\S]*?\n {2}\);/.exec(assignmentField)?.[0] ?? "";
assert(commitFunnel.length > 0, "the editor's single state-commit funnel is declared and locatable");
assert(
  /defaultsWithinAssignments\(/.test(commitFunnel),
  "every state transition narrows the defaults to the assignments that survive it, so unassigning an examination withdraws its default with it"
);
const changeCallSites = countMatches(assignmentField, /onAssignmentsChange\(/);
assert(
  changeCallSites === 1 && countMatches(commitFunnel, /onAssignmentsChange\(/) === 1,
  `the editor raises its change from exactly one call site, inside the narrowing funnel, so no transition can route around it (found ${changeCallSites})`
);
assert(
  /defaultsWithinAssignments\(defaultCodes, assignedCodes\)/.test(assignmentField),
  "the editor also narrows the defaults it was HANDED, so a stored default whose assignment has gone is not displayed as one"
);
assert(
  /defaultsWithinAssignments\(/.test(physicianForm),
  "the form narrows the same way when it loads a record, so the editor never opens holding a default it could not explain"
);

// Behavioural, not textual. The catalogue module is pure and imports nothing, so the rule the
// screen depends on is EXECUTED here rather than merely matched - a filter that is written and a
// filter that works are different claims.
assert(
  defaultsWithinAssignments(["CBC", "FECALYSIS"], ["CBC"]).join(",") === "CBC",
  "defaultsWithinAssignments keeps a default whose examination is still assigned, and drops one whose examination is not"
);
assert(
  defaultsWithinAssignments(["FECALYSIS"], []).length === 0,
  "an unassigned examination cannot carry a default: withdrawing the assignment withdraws the default with it"
);
assert(
  defaultsWithinAssignments(["NOT_A_MAINTAINED_CODE"], ["NOT_A_MAINTAINED_CODE"]).length === 0,
  "a code this laboratory does not maintain is never treated as an assignment or as a default"
);

/* ─────────────── The catalogue is the seventeen maintained examinations, exactly ──────────── */

const MAINTAINED_CODES_PIN = [
  "BLOOD_TYPING", "CBC", "CHEM_10", "CHEM_8", "CT_BT", "DENGUE_DUO", "ESR", "FECALYSIS",
  "HBA1C", "HBSAG", "HDL_LDL", "HIV_RESULT", "OGTT", "PREG_TEST", "RBS", "RPR", "URINALYSIS",
];
assert(
  MAINTAINED_EXAMINATION_CODES.length === 17,
  `the editor offers seventeen examinations (found ${MAINTAINED_EXAMINATION_CODES.length})`
);
assert(
  [...MAINTAINED_EXAMINATION_CODES].sort().join(",") === [...MAINTAINED_CODES_PIN].sort().join(","),
  "the editor offers exactly the seventeen maintained examination codes - none missing, and none the assignment table could not hold"
);
const chemistryAndMicroscopy = tallyByFamily([
  "CHEM_8", "CHEM_10", "HDL_LDL", "OGTT", "RBS", "HBA1C", "FECALYSIS", "URINALYSIS",
]);
assert(
  chemistryAndMicroscopy.length === 2 &&
    chemistryAndMicroscopy[0].count === 6 &&
    chemistryAndMicroscopy[1].count === 2,
  "an eight-examination set summarises to two family tallies rather than eight inline codes"
);
assert(
  tallyByFamily([]).length === 0,
  "an empty set produces no tally at all, so the row falls through to its explicit empty label"
);

const groupedAssignments = groupAssignmentsByPhysician([
  { physicianId: "physician-1", templateCode: "CBC", isDefault: true },
  { physicianId: "physician-1", templateCode: "ESR", isDefault: false },
  { physicianId: "physician-2", templateCode: "NOT_A_MAINTAINED_CODE", isDefault: true },
]);
assert(
  groupedAssignments["physician-1"].assignedCodes.length === 2 &&
    groupedAssignments["physician-1"].defaultCodes.join(",") === "CBC",
  "assignment rows fold into one entry per physician, with the defaults kept as a subset of the assignments"
);
assert(
  groupedAssignments["physician-2"] === undefined,
  "a row naming an examination this screen does not maintain contributes nothing, rather than a code with no title beside it"
);

/* ─────────────── The editor is usable: filter, bulk controls, and a stated consequence ────── */

assert(
  /type="search"/.test(assignmentField) && /Filter examinations/.test(assignmentField),
  "the assignment editor offers a labelled filter across the examination catalogue"
);
assert(
  />\s*Select all\s*</.test(assignmentField) && />\s*Clear\s*</.test(assignmentField),
  "each family offers a bulk assign and a bulk unassign control"
);

const defaultNotice = /<p id=\{noticeId\}[\s\S]*?<\/p>/.exec(assignmentField)?.[0] ?? "";
assert(defaultNotice.length > 0, "the editor's default-behaviour notice is declared and locatable");
const defaultNoticeProse = defaultNotice.replace(/<[^>]*>/g, " ").replace(/\{[^}]*\}/g, " ");
assert(
  /replaces/i.test(defaultNoticeProse) &&
    /default/i.test(defaultNoticeProse) &&
    (defaultNoticeProse.match(/[A-Za-z]/g) ?? []).length >= 80,
  "the editor states in words that setting a default replaces the previous default for that examination, rather than leaving the operator to discover it"
);

/* ─────────────── Accessibility: real labels, real groups, a named reason for disabled ─────── */

assert(
  countMatches(assignmentField, /type="checkbox"/) === 2,
  "the editor has exactly two checkbox kinds - assign, and default"
);
assert(
  /htmlFor=\{assignInputId\}/.test(assignmentField) &&
    /htmlFor=\{defaultInputId\}/.test(assignmentField),
  "each checkbox is bound to a real label element by id, so it is nameable and clickable rather than a bare box"
);
assert(
  /aria-label=\{[\s\S]{0,500}?unavailable until the examination is assigned/.test(assignmentField),
  "the disabled Default control names WHY it is unavailable, so the reason is not conveyed by the disabled state alone"
);
assert(
  /<fieldset/.test(assignmentField) &&
    /<legend/.test(assignmentField) &&
    /disabled=\{disabled\}/.test(assignmentField),
  "each family is a real fieldset with a legend, and the whole group stands down together while a write is in flight"
);
assert(
  /<PhysicianExaminationAssignmentField[\s\S]{0,400}?disabled=\{isSubmitting\}/.test(physicianForm),
  "the assignment editor stands down while the form's save is in flight"
);

// The dialog's existing busy / dirty / discard dance is not weakened by the larger form.
assert(
  /dismissible=\{!isSaving && !isDiscardOpen\}/.test(physicianFormModal),
  "the physician dialog still refuses Escape, backdrop and close-button dismissal while a write is in flight"
);
assert(
  /onSubmittingChange=\{setIsSaving\}/.test(physicianFormModal) &&
    /onDirtyChange=\{setHasUnsavedChanges\}/.test(physicianFormModal),
  "the busy and dirty flags the dismissal lock and the discard confirmation depend on are still raised by the form"
);
assert(
  /initialAssignments=\{initialAssignments\}/.test(physicianFormModal),
  "the dialog hands the form the physician's current assignment set, so an edit starts from what is stored"
);

/* ─────────────── Every typed server refusal lands on the control that caused it ───────────── */

const assignmentResultUnion =
  /export type PhysicianAssignmentActionResult =[\s\S]*?;\n\n/.exec(physicianActionsSource)?.[0] ?? "";
assert(
  assignmentResultUnion.length > 0,
  "PhysicianAssignmentActionResult is declared and locatable in the physician actions"
);
const assignmentErrorCodes = Array.from(
  new Set((assignmentResultUnion.match(/"[A-Z_]+"/g) ?? []).map((code) => code.slice(1, -1)))
);
assert(
  assignmentErrorCodes.length >= 5,
  `the assignment result's error codes were enumerated (found ${JSON.stringify(assignmentErrorCodes)}); an empty enumeration would certify nothing`
);
// Exhaustive by construction: every member of the server's union has to be answered by name, so
// a code added to the union later fails here rather than reaching the operator as a shrug.
for (const code of assignmentErrorCodes) {
  assert(
    physicianForm.includes(`"${code}"`),
    `the form answers the ${code} refusal by name rather than folding it into a generic banner`
  );
}

for (const [code, field] of [
  ["PHYSICIAN_INACTIVE", "status"],
  ["DEFAULT_NOT_ASSIGNED", "defaultExaminations"],
  ["UNKNOWN_TEMPLATE", "assignedExaminations"],
  ["DUPLICATE_ASSIGNMENT", "assignedExaminations"],
] as const) {
  assert(
    new RegExp(
      `result\\.error === "${code}"\\)\\s*\\{[\\s\\S]{0,400}?setError\\(\\s*"${field}"`
    ).test(physicianForm),
    `the ${code} refusal is reported on the ${field} control that caused it, not in a banner the user has to map back to a field`
  );
}
assert(
  /result\.error === "PHYSICIAN_NOT_FOUND"\)\s*\{[\s\S]{0,400}?setServerError\(/.test(physicianForm),
  "the one refusal that is a fact about the record rather than about any field is the only one given the banner"
);
assert(
  /errors\.defaultExaminations\?\.message \?\? errors\.assignedExaminations\?\.message/.test(
    physicianForm
  ),
  "the assignment editor renders the error set on it, so a typed refusal is actually seen"
);

/* ─────────────── The page wires the read and the write through the action boundary ────────── */

assert(
  /listPhysicianAssignmentsAction\(\)/.test(personnelPage),
  "the directory's assignment rows are read through the server-action boundary"
);
assert(
  /<PhysicianDirectoryView[\s\S]{0,400}?assignments=\{physicianAssignments\}/.test(personnelPage),
  "the physician section is handed the assignment rows it renders"
);
// ONE ACTION FOR ONE SAVE. The record and its assignment set are written by a single action over
// a single transaction, so a refused save leaves the directory exactly as it was. The composition
// this replaced wrote the record first, resolved a newly created physician by name on a second
// trip, and then replaced the assignments - three independently committing steps.
assert(
  /savePhysicianConfigurationAction\(/.test(personnelPage),
  "the editor's save is wired to the one server action that re-decides every rule the editor applied"
);
assert(
  !/setPhysicianAssignmentsAction\(/.test(personnelPage) &&
    !/createPhysicianAction\(/.test(personnelPage) &&
    !/updatePhysicianAction\(/.test(personnelPage),
  "the page composes no multi-action physician save - one save is one action"
);
assert(
  !/roster\.find\(/.test(personnelPage),
  "the page resolves no newly created physician by name; the identifier comes back from the transaction"
);
assert(
  !/new\s+Supabase[A-Za-z]*Repository/.test(personnelPage),
  "the personnel page reaches no repository directly; the server-action boundary is the only way in"
);

/* ─────────────── The new modules keep the client boundary the old ones keep ───────────────── */

const PHYSICIAN_ASSIGNMENT_MODULES = [
  ["PhysicianExaminationAssignmentField", assignmentField],
  ["physician-examinations", examinationCatalogue],
] as const;

for (const [label, component] of PHYSICIAN_ASSIGNMENT_MODULES) {
  assert(
    !DESTRUCTIVE_WORD.test(component),
    `${label} offers no delete, remove, destroy or purge control - an assignment is withdrawn by unassigning it, and a physician record is withdrawn by deactivation`
  );
  assert(
    !DESTRUCTIVE_CALL.test(component),
    `${label} calls nothing that erases a physician record`
  );
  assert(
    !/\.delete\s*\(/.test(component) && !/\bDELETE\s+FROM\b/i.test(component),
    `${label} contains no direct delete path`
  );
  assert(!/signatureImageUrl/.test(component), `${label} names no signatureImageUrl`);
  assert(
    !/\bIPersonnel\b/.test(component) && !/\bIPhysician\b/.test(component),
    `${label} names no domain record type`
  );
  assert(
    !/from\s+["']@\/repositories/.test(component) && !/from\s+["']@\/domain/.test(component),
    `${label} imports no repository or domain module; the server-action boundary is the only way in`
  );
  assert(
    !/new\s+Supabase[A-Za-z]*Repository/.test(component),
    `${label} calls no repository directly`
  );
  assert(
    !/from\s+["']@\/components\/shadcn/.test(component),
    `${label} takes its primitives from the @/components/ui wrappers, never from @/components/shadcn directly`
  );
}
assert(
  /from\s+["']@\/components\/ui\//.test(assignmentField),
  "PhysicianExaminationAssignmentField builds on the shared @/components/ui primitives"
);
// The catalogue is presentation DATA, so it is held to a stricter rule than the components: it
// imports nothing at all, which is what makes it safe to execute in this verifier.
assert(
  !/^import\s/m.test(examinationCatalogue),
  "physician-examinations imports nothing, so the catalogue cannot pull a server module into the browser"
);

process.stdout.write(
  "\nPhysician directory verification passed: every assertion above succeeded.\n"
);
