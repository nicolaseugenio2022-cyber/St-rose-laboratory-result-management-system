/**
 * Physician-to-examination assignment invariants (data layer).
 *
 * CHARTER. The migration that creates `physician_examination_assignments`, and nothing else.
 * Static source analysis only - nothing here connects to a database, and no assertion below
 * executes SQL. The migration is read as text.
 *
 * The four guarantees worth having durable, in order of consequence:
 *   1. The default-per-examination invariant is held by the DATABASE. A partial unique index over
 *      `template_code WHERE is_default` makes two defaults for one examination unrepresentable,
 *      and the flag lives on the assignment row so a default that is not an assignment has no
 *      row to exist in.
 *   2. The shape is normalized. One row per (physician, examination), both sides foreign-keyed,
 *      duplicates impossible. No array, no JSON, no delimited list - those cannot carry a foreign
 *      key and cannot carry the uniqueness constraint above.
 *   3. The security posture matches 20260815160000_accession_allocation.sql exactly: RLS on, no
 *      permissive policy, no auth.*, the table revoked from PUBLIC and from the browser roles,
 *      and granted only to service_role. No SECURITY DEFINER function is introduced.
 *   4. The seed reproduces the clinic's actual rules - Fecalysis restricted to two physicians,
 *      all six Clinical Chemistry examinations defaulting to Dr. Heinz Roland Asperas, every
 *      other default reproducing `requestedByPolicy.defaultPhysician` from the shipped report
 *      definitions - and is idempotent, so a re-run overwrites no Administrator's later change.
 *
 * No SHA-256 pin is minted here. Every assertion is structural, so this verifier stays meaningful
 * while the feature is still being built on top of the schema.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Physician assignment verification failed: ${message}`);
  console.log(`✓ ${message}`);
}

function getSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

/**
 * SQL `--` line comments and block comments, blanked rather than removed so line numbers survive.
 * Every negative assertion below runs against the stripped text: this migration's own prose
 * explains WHY it contains no DROP, why no SECURITY DEFINER function is created, and why a JSON
 * or array column was rejected - a raw-text negative would fail on the explanation instead of on
 * the code. Dollar-quoted bodies ($$ ... $$) are preserved verbatim: a statement hidden inside
 * one is executable and must still be caught.
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

const MIGRATION_PATH =
  "supabase/migrations/20260910120000_physician_examination_assignments.sql";
const TABLE = "physician_examination_assignments";

const migrationRaw = getSource(MIGRATION_PATH);
const migrationSql = stripSqlComments(migrationRaw);

// Fail closed if the comment stripper broke: an empty haystack satisfies every negative assertion
// below, so an emptied migration would certify as "contains no DROP" while proving nothing. The
// anchors are executable statements, not prose, so they survive stripping only if stripping was
// correct.
assert(
  migrationSql.includes("CREATE TABLE") &&
    migrationSql.includes("ENABLE ROW LEVEL SECURITY") &&
    migrationSql.includes("INSERT INTO") &&
    migrationSql.includes("GRANT ") &&
    migrationSql.length > 800,
  "the migration survives SQL comment stripping with its executable statements intact"
);
// Negative control on the stripper itself: prose-only markers must be gone from the stripped
// text. Deliberately anchored on phrases that could never be executable SQL - anchoring the
// control on a prohibited token such as SECURITY DEFINER would make this assertion fire FIRST
// whenever that token was genuinely introduced, masking the negative that is supposed to catch it.
for (const proseMarker of ["NORMALIZED BY CONSTRUCTION", "NON-DESTRUCTIVE BY CONSTRUCTION"]) {
  assert(
    migrationRaw.includes(proseMarker) && !migrationSql.includes(proseMarker),
    `comment stripping removes the migration's prose (control: "${proseMarker}")`
  );
}

/* ────────────────────── Shape: normalized, one row per (physician, examination) ─────────────── */

assert(
  new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${TABLE}\\s*\\(`, "i").test(migrationSql),
  `the migration creates ${TABLE} with IF NOT EXISTS`
);
assert(
  (migrationSql.match(/\bCREATE\s+TABLE\b/gi) ?? []).length === 1,
  "the migration creates exactly one table"
);

const tableBodyMatch = new RegExp(
  `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${TABLE}\\s*\\(([\\s\\S]*?)\\n\\);`,
  "i"
).exec(migrationSql);
assert(tableBodyMatch !== null, "the table definition body is parseable");
const tableBody = tableBodyMatch![1];

// THE NORMALIZATION ASSERTION. An array, a JSON document or a delimited string could hold the
// same information, and each would destroy every constraint this table exists to carry: no
// foreign key into report_templates, no duplicate impossibility, and no way to express "at most
// one default per examination" in the schema.
for (const [label, pattern] of [
  ["a JSON/JSONB column", /\bJSONB?\b/i],
  ["an array column", /\[\s*\]/],
  ["an ARRAY column", /\bARRAY\b/i],
  ["a delimited text list", /string_to_array|array_agg|split_part|\bTEXT\s*\[/i],
] as const) {
  assert(
    !pattern.test(tableBody),
    `the assignment table stores no examination list as ${label} - it is normalized to one row per pair`
  );
}

assert(
  /\bid\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\s*\(\s*\)/i.test(tableBody),
  "the assignment row mirrors the shared UUID primary key default"
);
assert(
  /\bcreated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i.test(tableBody) &&
    /\bupdated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i.test(tableBody),
  "the assignment row carries the shared created_at/updated_at timestamps"
);
// The default flag lives ON the assignment row. This is what makes "a default physician must also
// be an assigned physician" structural instead of a cross-table invariant nothing enforces.
assert(
  /\bis_default\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+FALSE\b/i.test(tableBody),
  "is_default is a NOT NULL column on the assignment row itself, defaulting FALSE"
);

/* ─────────────────────────────── Both foreign keys, history-preserving ──────────────────────── */

assert(
  /\bphysician_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+physicians\s*\(\s*id\s*\)/i.test(tableBody),
  "physician_id is a NOT NULL foreign key to physicians(id)"
);
assert(
  /\btemplate_code\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+report_templates\s*\(\s*template_code\s*\)/i.test(
    tableBody
  ),
  "template_code is a NOT NULL foreign key to report_templates(template_code)"
);
// RESTRICT, never CASCADE. The one physician delete path (`delete_inactive_physician()`,
// CLINIC-UI-UX-08R1) depends on this: a physician who still holds an assignment is refused, where a cascading delete
// would silently discard configuration and could strand no default where one was expected.
const onDeleteActions = tableBody.match(/ON\s+DELETE\s+(\w+)/gi) ?? [];
assert(
  onDeleteActions.length === 2 &&
    onDeleteActions.every((clause) => /RESTRICT/i.test(clause)),
  `both foreign keys use ON DELETE RESTRICT so no cascading delete can discard history (found: ${JSON.stringify(onDeleteActions)})`
);

/* ──────────────────────── Uniqueness: duplicates and double defaults impossible ─────────────── */

assert(
  /CONSTRAINT\s+uq_physician_examination_assignment\s+UNIQUE\s*\(\s*physician_id\s*,\s*template_code\s*\)/i.test(
    tableBody
  ),
  "a UNIQUE (physician_id, template_code) constraint makes a duplicate assignment impossible (23505)"
);

// THE DEFAULT INVARIANT. A partial unique index over template_code restricted to default rows:
// two physicians cannot both be default for one examination, while zero or many non-default
// assignments remain legal. Asserted as one statement so a non-partial index (which would forbid
// a second ASSIGNMENT, not a second default) cannot satisfy it.
const partialDefaultIndex =
  /CREATE\s+UNIQUE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\n?ON\s+physician_examination_assignments\s*\(\s*template_code\s*\)\s*\n?WHERE\s+is_default\s*;/i.exec(
    migrationSql
  );
assert(
  partialDefaultIndex !== null,
  "a PARTIAL UNIQUE INDEX on (template_code) WHERE is_default permits at most one default physician per examination"
);
assert(
  (migrationSql.match(/CREATE\s+UNIQUE\s+INDEX/gi) ?? []).length === 1,
  "the partial default index is the only unique index created"
);
// "Assignments for a template" must not table-scan: the composite unique constraint above cannot
// serve it because template_code is its trailing column.
assert(
  /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_physician_examination_assignments_template_code\s*\n?ON\s+physician_examination_assignments\s*\(\s*template_code\s*\)\s*;/i.test(
    migrationSql
  ),
  "an index on (template_code) makes 'every physician assigned to this examination' cheap"
);
// "Assignments for a physician" is served by the leading column of the composite unique index, so
// no second index is created for it. Asserted explicitly so the omission is deliberate, not lost.
assert(
  /UNIQUE\s*\(\s*physician_id\s*,/i.test(tableBody),
  "'every examination assigned to this physician' is served by the leading column of the composite unique index"
);

/* ──────────────────────────────── The shared updated_at trigger ─────────────────────────────── */

assert(
  /CREATE\s+TRIGGER\s+trg_physician_examination_assignments_updated_at\s+BEFORE\s+UPDATE\s+ON\s+physician_examination_assignments\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+update_updated_at_column\s*\(\s*\)\s*;/i.test(
    migrationSql
  ),
  "the trg_<table>_updated_at trigger is created in the shared trigger shape (03_indexes_and_triggers.sql)"
);

/* ───────────────── Security posture: matches 20260815160000_accession_allocation.sql ────────── */

const rlsStatements = migrationSql.match(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi) ?? [];
assert(rlsStatements.length === 1, "the migration enables row level security exactly once");
assert(
  new RegExp(`ALTER\\s+TABLE\\s+${TABLE}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY\\s*;`, "i").test(
    migrationSql
  ),
  `row level security is enabled on ${TABLE}`
);
assert(
  !/CREATE\s+POLICY/i.test(migrationSql),
  "the migration creates no permissive RLS policy; the server is the authorization boundary"
);
assert(
  !/\bauth\s*\./i.test(migrationSql),
  "the migration contains no auth.* reference"
);

// The three precedent lines, verbatim in shape. The browser roles are revoked explicitly rather
// than left to an inherited default privilege, exactly as in accession_allocation.sql.
assert(
  new RegExp(`REVOKE\\s+ALL\\s+ON\\s+${TABLE}\\s+FROM\\s+PUBLIC\\s*;`, "i").test(migrationSql),
  "REVOKE ALL ... FROM PUBLIC is present"
);
assert(
  new RegExp(`REVOKE\\s+ALL\\s+ON\\s+${TABLE}\\s+FROM\\s+anon\\s*,\\s*authenticated\\s*;`, "i").test(
    migrationSql
  ),
  "REVOKE ALL ... FROM anon, authenticated is present"
);

const grantStatements = migrationSql.match(/\bGRANT\b[^;]*;/gi) ?? [];
assert(
  grantStatements.length === 1,
  `the migration issues exactly one GRANT (found: ${JSON.stringify(grantStatements)})`
);
const grantStatement = grantStatements[0];
assert(
  new RegExp(
    `^GRANT\\s+SELECT\\s*,\\s*INSERT\\s*,\\s*UPDATE\\s*,\\s*DELETE\\s+ON\\s+${TABLE}\\s+TO\\s+service_role\\s*;$`,
    "i"
  ).test(grantStatement.trim()),
  "the sole GRANT is SELECT, INSERT, UPDATE, DELETE to service_role and to nothing else"
);
// Named negatively as well: no verb beyond the four the server actually issues, and no grantee
// beyond service_role anywhere in the file.
for (const forbiddenVerb of ["ALL", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
  assert(
    !new RegExp(`\\b${forbiddenVerb}\\b`, "i").test(grantStatement),
    `the GRANT does not include ${forbiddenVerb}`
  );
}
for (const forbiddenGrantee of ["anon", "authenticated", "PUBLIC", "postgres"]) {
  assert(
    !new RegExp(`\\b${forbiddenGrantee}\\b`, "i").test(grantStatement),
    `the GRANT names no grantee other than service_role (checked: ${forbiddenGrantee})`
  );
}

// This migration itself still creates no function - it is the table, its constraints and its
// seed, and nothing else. The negative that used to stand here ("the migration creates no
// function at all") has been REMOVED rather than relaxed, because it asserted a decision that has
// since been re-made: the complete physician form save is now one transaction, and it lives in
// `save_physician_configuration` in a later forward migration. That function is asserted
// positively at the end of this file - security mode, search path, grants, statement order and
// server wiring - so the protection the old negative was reaching for is stronger than it was,
// not weaker. What is NOT relaxed is the SECURITY DEFINER prohibition: it stands here, and it
// stands again against the new migration below.
assert(
  !/SECURITY\s+DEFINER/i.test(migrationSql),
  "the assignment migration creates no SECURITY DEFINER function"
);
// THE COVERAGE THE REMOVED NEGATIVE ACTUALLY HELD, restored without reinstating it. What made
// "no function at all" worth having was not the function count: it was that PostgreSQL grants
// EXECUTE on a new function to PUBLIC by default, so a function added to a migration WITHOUT an
// explicit revoke is executable by every role the moment it is applied - and being SECURITY
// INVOKER does not save it, because `authenticated` reaching a function that writes through the
// caller's own privileges is still a surface that was never argued for. This says the thing that
// matters instead: in EVERY physician migration, each function created is matched by a revoke of
// EXECUTE from PUBLIC and both browser roles. Zero functions and zero revokes satisfies it, as
// the applied migration does; one function with no revoke does not.
// Both later physician migrations are named here once, and reused by the sections below, so the
// path cannot diverge between the two places it is read.
const CONFIGURATION_MIGRATION_PATH =
  "supabase/migrations/20260911120000_atomic_physician_configuration.sql";
const DEACTIVATION_MIGRATION_PATH =
  "supabase/migrations/20260912120000_physician_deactivation_clears_defaults.sql";

for (const [label, sql] of [
  ["the assignment migration", migrationSql],
  ["the configuration migration", stripSqlComments(getSource(CONFIGURATION_MIGRATION_PATH))],
  ["the deactivation migration", stripSqlComments(getSource(DEACTIVATION_MIGRATION_PATH))],
] as const) {
  const createdFunctions = (sql.match(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/gi) ?? []).length;
  // Bounded by [^;]*? rather than [\s\S]*?: a revoke naming one function must not be able to
  // reach across a statement boundary and borrow the PUBLIC/anon/authenticated clause of a
  // later, unrelated revoke to satisfy this count.
  const publicRevokes = (
    sql.match(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+[^;]*?FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated\s*;/gi) ??
    []
  ).length;
  assert(
    createdFunctions === publicRevokes,
    `${label} revokes EXECUTE from PUBLIC, anon and authenticated for every function it creates (created ${createdFunctions}, revoked ${publicRevokes})`
  );
}

/* ─────────────────────────── Non-destructive: additive statements only ──────────────────────── */

// `ON DELETE RESTRICT` is a foreign-key action, not a statement, and the GRANT legitimately names
// the DELETE privilege. Both are blanked before the destructive-statement negatives so those
// negatives test executable statements only. The GRANT itself is separately pinned above.
const executableSql = migrationSql
  .replace(/ON\s+DELETE\s+\w+/gi, " ")
  .replace(/\bGRANT\b[^;]*;/gi, " ");
for (const [statement, pattern] of [
  ["DROP", /\bDROP\b/i],
  ["DELETE", /\bDELETE\b/i],
  ["TRUNCATE", /\bTRUNCATE\b/i],
] as const) {
  assert(
    !pattern.test(executableSql),
    `the migration contains no executable ${statement} statement`
  );
}
// ALTER ... ENABLE ROW LEVEL SECURITY is the one permitted ALTER, and it targets the new table
// only. Anything else altered would be a pre-existing object this migration must not touch.
const alterStatements = migrationSql.match(/\bALTER\s+\w+[^;]*;/gi) ?? [];
assert(
  alterStatements.length === 1 &&
    new RegExp(`^ALTER\\s+TABLE\\s+${TABLE}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY\\s*;$`, "i").test(
      alterStatements[0].trim()
    ),
  `the migration's only ALTER is the ${TABLE} RLS enablement (found: ${JSON.stringify(alterStatements)})`
);

/* ─────────────────────────────────── Seed: the assignment rows ──────────────────────────────── */

const ALL_TEMPLATE_CODES = [
  "BLOOD_TYPING", "CBC", "CHEM_10", "CHEM_8", "CT_BT", "DENGUE_DUO",
  "ESR", "FECALYSIS", "HBA1C", "HBSAG", "HDL_LDL", "HIV_RESULT",
  "OGTT", "PREG_TEST", "RBS", "RPR", "URINALYSIS",
] as const;

const RALPH = "Dr. Ralph Roland Asperas";
const HEINZ = "Dr. Heinz Roland Asperas";
const DEDACE = "Dr. Ma. Floricel Dedace-Lagrazon";

const assignmentSeedMatch =
  /INSERT\s+INTO\s+physician_examination_assignments[\s\S]*?ON\s+CONFLICT[^;]*;/i.exec(
    migrationSql
  );
assert(assignmentSeedMatch !== null, "the assignment seed statement is present and parseable");
const assignmentSeed = assignmentSeedMatch![0];

assert(
  (migrationSql.match(/INSERT\s+INTO/gi) ?? []).length === 1,
  "the migration performs exactly one INSERT"
);
// Natural keys only. The physician ids are generated by gen_random_uuid() and differ between the
// live database and any fresh one, so a hardcoded UUID would seed nothing where it matters.
assert(
  !/'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/i.test(migrationSql),
  "the seed hardcodes no UUID - physicians and templates are referenced by their natural keys"
);
for (const templateCode of ALL_TEMPLATE_CODES) {
  assert(
    new RegExp(`'${templateCode}'`).test(assignmentSeed),
    `the assignment seed names the examination ${templateCode} explicitly`
  );
}
for (const physicianName of [RALPH, HEINZ, DEDACE]) {
  assert(
    assignmentSeed.includes(`'${physicianName}'`),
    `the assignment seed references the rostered physician ${physicianName}`
  );
}
// FECALYSIS IS THE ONE RESTRICTION. Ralph and Heinz only; Dedace-Lagrazon must not be assigned.
// Asserted on the exclusion clause itself, because that is the single thing standing between the
// cross join and an unrestricted Fecalysis.
assert(
  /NOT\s*\(\s*[\w.]*template_code\s*=\s*'FECALYSIS'\s*\n?\s*AND\s+[\w.]*full_name\s*=\s*'Dr\. Ma\. Floricel Dedace-Lagrazon'\s*\n?\s*\)/i.test(
    assignmentSeed
  ),
  "the assignment seed excludes Dr. Ma. Floricel Dedace-Lagrazon from FECALYSIS, and only from FECALYSIS"
);
assert(
  (assignmentSeed.match(/'FECALYSIS'/g) ?? []).length === 2,
  "FECALYSIS appears exactly twice in the assignment seed: once in the examination list, once in the exclusion"
);
assert(
  (assignmentSeed.match(new RegExp(`'${DEDACE.replace(/[.\-]/g, "\\$&")}'`, "g")) ?? []).length === 2,
  "Dr. Ma. Floricel Dedace-Lagrazon appears exactly twice: once in the roster, once excluded from FECALYSIS"
);
// Idempotent, and never clobbering: DO NOTHING on the natural key, never DO UPDATE.
assert(
  /ON\s+CONFLICT\s*\(\s*physician_id\s*,\s*template_code\s*\)\s*DO\s+NOTHING\s*;/i.test(
    assignmentSeed
  ),
  "the assignment seed is idempotent: ON CONFLICT (physician_id, template_code) DO NOTHING"
);
assert(
  !/\bON\s+CONFLICT\b[\s\S]*?\bDO\s+UPDATE\b/i.test(migrationSql),
  "no seed statement overwrites an existing row with DO UPDATE"
);

/* ──────────────────────────────────── Seed: the default rows ────────────────────────────────── */

const defaultSeedMatch =
  /WITH\s+seeded_defaults\s*\([^)]*\)\s*AS\s*\(([\s\S]*?)\n\)\s*\nUPDATE\s+physician_examination_assignments[\s\S]*?;/i.exec(
    migrationSql
  );
assert(defaultSeedMatch !== null, "the default seed statement is present and parseable");
const defaultSeed = defaultSeedMatch![0];

const seededDefaultPairs = new Map<string, string>();
for (const pair of defaultSeed.matchAll(/\(\s*'([A-Z0-9_]+)'\s*,\s*'([^']+)'\s*\)/g)) {
  assert(
    !seededDefaultPairs.has(pair[1]),
    `the default seed names ${pair[1]} at most once - a second row would attempt a second default`
  );
  seededDefaultPairs.set(pair[1], pair[2]);
}
assert(
  seededDefaultPairs.size > 0,
  "the default seed's VALUES pairs were extracted"
);

// ALL SIX Clinical Chemistry examinations default to Dr. Heinz Roland Asperas. CHEM_8 and RBS are
// deliberate corrections: their shipped definitions still declare Dr. Ralph Roland Asperas.
const CHEMISTRY_TEMPLATE_CODES = ["CHEM_8", "CHEM_10", "HDL_LDL", "OGTT", "RBS", "HBA1C"] as const;
for (const templateCode of CHEMISTRY_TEMPLATE_CODES) {
  assert(
    seededDefaultPairs.get(templateCode) === HEINZ,
    `Clinical Chemistry examination ${templateCode} defaults to ${HEINZ} (found: ${seededDefaultPairs.get(templateCode) ?? "no default"})`
  );
}

// Every non-chemistry default must reproduce the CURRENT declarative default shipped in the
// report definitions - not an invented one. The definitions are parsed here rather than restated,
// so a divergence between the schema and the definitions surfaces as a failure instead of drifting.
const definitionDefaults = new Map<string, string | null>();
for (const family of [
  "chemistry",
  "hematology",
  "microscopy",
  "other",
  "serology",
]) {
  const source = getSource(`src/domain/definitions/${family}-definitions.ts`);
  const segments = source.split(/templateCode:\s*"([A-Z0-9_]+)"/);
  // split() yields [preamble, code1, body1, code2, body2, ...]
  for (let i = 1; i < segments.length; i += 2) {
    const templateCode = segments[i];
    const body = segments[i + 1] ?? "";
    const declared = /defaultPhysician:\s*(null|"([^"]*)")/.exec(body);
    assert(
      declared !== null,
      `${family}-definitions.ts declares requestedByPolicy.defaultPhysician for ${templateCode}`
    );
    definitionDefaults.set(templateCode, declared![2] ?? null);
  }
}
assert(
  definitionDefaults.size === ALL_TEMPLATE_CODES.length,
  `the report definitions declare a default policy for all ${ALL_TEMPLATE_CODES.length} examinations (found ${definitionDefaults.size})`
);

for (const templateCode of ALL_TEMPLATE_CODES) {
  if ((CHEMISTRY_TEMPLATE_CODES as readonly string[]).includes(templateCode)) continue;
  const declared = definitionDefaults.get(templateCode) ?? null;
  if (declared === null) {
    // defaultPhysician: null means staff entry is required. No default row exists, and the
    // partial unique index is satisfied by the examination having zero default assignments.
    assert(
      !seededDefaultPairs.has(templateCode),
      `${templateCode} declares defaultPhysician: null, so the seed creates no default row for it`
    );
  } else {
    assert(
      seededDefaultPairs.get(templateCode) === declared,
      `${templateCode} keeps its declarative default ${declared} (found: ${seededDefaultPairs.get(templateCode) ?? "no default"})`
    );
  }
}
assert(
  [...seededDefaultPairs.keys()].every((code) =>
    (ALL_TEMPLATE_CODES as readonly string[]).includes(code)
  ),
  "the default seed names no examination outside the seventeen-code registry"
);

// Non-clobbering by construction: the flag is set only where the examination currently has no
// default at all, so a re-run is a no-op and an Administrator's later choice survives.
assert(
  /NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+physician_examination_assignments\s+\w+\s+WHERE\s+\w+\.template_code\s*=\s*[\w.]+\.template_code\s+AND\s+\w+\.is_default\s*\)/i.test(
    defaultSeed.replace(/\s+/g, " ")
  ),
  "the default seed sets is_default only where the examination has no default yet - a re-run is a no-op"
);
// The default is set on the assignment row, never inserted independently. This is the structural
// half of "a default physician is always an assigned physician".
assert(
  /UPDATE\s+physician_examination_assignments\s+\w+\s*\n?SET\s+is_default\s*=\s*TRUE/i.test(
    defaultSeed
  ),
  "the default seed UPDATEs an existing assignment row rather than inserting a standalone default"
);
assert(
  (migrationSql.match(/\bUPDATE\s+physician_examination_assignments\b/gi) ?? []).length === 1,
  "the default seed is the migration's only UPDATE statement"
);

console.log("\nAll physician-to-examination assignment invariants verified.");

/* ══════════════════ The atomic physician configuration transaction ══════════════════════════ */
/*
 * WHAT THIS SECTION EXISTS FOR. The four statements that make up one physician form save used to
 * commit independently: the physician record, the deletion of its previous pairs, the clearing of
 * the incumbent default on the templates it was taking over, and the insertion of the replacement
 * set. Every intermediate state is individually legal, so no constraint could reject one; a
 * failure part-way left a physician created but unassigned, an assignment set half replaced, or
 * ANOTHER physician's examination stripped of its default while the operator was shown a failure.
 *
 * The correction is one transaction, and these assertions are what stop it from quietly becoming
 * four statements again. They are POSITIVE - the function exists, with this security mode, this
 * search path, these grants, these statements in this order, called from this repository method,
 * by this action, wired to this page - because a negative ("no function") cannot express any of
 * it. The security posture is asserted as strictly as the table's own: SECURITY INVOKER and never
 * DEFINER, a fixed search_path, EXECUTE revoked from PUBLIC and both browser roles and granted to
 * service_role alone.
 */

const CONFIGURATION_FUNCTION = "save_physician_configuration";

const configurationMigrationRaw = getSource(CONFIGURATION_MIGRATION_PATH);
const configurationMigrationSql = stripSqlComments(configurationMigrationRaw);

// Fail closed on the stripper, exactly as above: an emptied haystack satisfies every negative and
// would certify nothing. Anchored on executable statements only.
assert(
  configurationMigrationSql.includes("CREATE OR REPLACE FUNCTION") &&
    configurationMigrationSql.includes("GRANT EXECUTE") &&
    configurationMigrationSql.length > 800,
  "the configuration migration survives SQL comment stripping with its executable statements intact"
);
for (const proseMarker of ["WHY THIS EXISTS", "FORWARD-ONLY AND NON-DESTRUCTIVE"]) {
  assert(
    configurationMigrationRaw.includes(proseMarker) &&
      !configurationMigrationSql.includes(proseMarker),
    `comment stripping removes the configuration migration's prose (control: "${proseMarker}")`
  );
}

/* ── The function, its signature and its security posture ──────────────────────────────────── */

assert(
  new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${CONFIGURATION_FUNCTION}\\s*\\(\\s*payload\\s+jsonb\\s*\\)`,
    "i"
  ).test(configurationMigrationSql),
  `the migration creates ${CONFIGURATION_FUNCTION}(payload jsonb)`
);
assert(
  (configurationMigrationSql.match(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/gi) ?? []).length === 1,
  "the configuration migration creates exactly one function"
);
// The identifier is produced INSIDE the transaction and handed back. This is what removes the
// post-create lookup that used to resolve a newly created physician by name on a second trip.
assert(
  /RETURNS\s+uuid/i.test(configurationMigrationSql),
  `${CONFIGURATION_FUNCTION} returns the physician identifier server-side`
);
assert(
  /SECURITY\s+INVOKER/i.test(configurationMigrationSql),
  `${CONFIGURATION_FUNCTION} is SECURITY INVOKER`
);
assert(
  !/SECURITY\s+DEFINER/i.test(configurationMigrationSql),
  `${CONFIGURATION_FUNCTION} is never SECURITY DEFINER`
);
// A fixed search_path, so no schema injected onto a caller's path can shadow `physicians`,
// `physician_examination_assignments` or `report_templates` inside the body.
assert(
  /SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i.test(configurationMigrationSql),
  `${CONFIGURATION_FUNCTION} pins search_path to public, pg_temp`
);
const searchPathSettings = (
  configurationMigrationSql.match(/SET\s+search_path\s*=[^\n;]*/gi) ?? []
).map((setting) => setting.replace(/\s+/g, " ").trim());
assert(
  searchPathSettings.length === 1 && searchPathSettings[0] === "SET search_path = public, pg_temp",
  `${CONFIGURATION_FUNCTION} pins exactly one search_path and it is the safe one (found: ${JSON.stringify(searchPathSettings)})`
);

/* ── EXECUTE grants: service_role only ─────────────────────────────────────────────────────── */

assert(
  new RegExp(
    `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+${CONFIGURATION_FUNCTION}\\s*\\(\\s*jsonb\\s*\\)\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated\\s*;`,
    "i"
  ).test(configurationMigrationSql),
  "EXECUTE is revoked from PUBLIC, anon and authenticated"
);
const configurationGrants = configurationMigrationSql.match(/\bGRANT\b[^;]*;/gi) ?? [];
assert(
  configurationGrants.length === 1,
  `the configuration migration issues exactly one GRANT (found: ${JSON.stringify(configurationGrants)})`
);
assert(
  new RegExp(
    `^GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+${CONFIGURATION_FUNCTION}\\s*\\(\\s*jsonb\\s*\\)\\s+TO\\s+service_role\\s*;$`,
    "i"
  ).test(configurationGrants[0].trim()),
  "the sole GRANT is EXECUTE to service_role and to nothing else"
);
for (const forbiddenGrantee of ["anon", "authenticated", "PUBLIC", "postgres"]) {
  assert(
    !new RegExp(`\\b${forbiddenGrantee}\\b`, "i").test(configurationGrants[0]),
    `the EXECUTE grant names no grantee other than service_role (checked: ${forbiddenGrantee})`
  );
}

/* ── Forward-only: no pre-existing object is touched ───────────────────────────────────────── */

// The two migrations already applied to the live database are not edited, and this one adds a
// function and its privileges only. It creates no table and no index, so it cannot redefine the
// UNIQUE (physician_id, template_code) constraint or the partial unique default index that the
// transaction below relies on - both stay exactly as the applied migration left them.
for (const [statement, pattern] of [
  ["DROP", /\bDROP\b/i],
  ["TRUNCATE", /\bTRUNCATE\b/i],
  ["ALTER", /\bALTER\b/i],
  ["CREATE TABLE", /\bCREATE\s+TABLE\b/i],
  ["CREATE INDEX", /\bCREATE\s+(UNIQUE\s+)?INDEX\b/i],
] as const) {
  assert(
    !pattern.test(configurationMigrationSql),
    `the configuration migration contains no ${statement} statement`
  );
}

const functionBodyMatch = /AS\s*\$function\$([\s\S]*?)\$function\$/i.exec(
  configurationMigrationSql
);
assert(functionBodyMatch !== null, "the function body is parseable");
const functionBody = functionBodyMatch![1];

// The one DELETE in the file is inside the body, and it is bounded to the physician being saved.
// An unbounded delete would empty the join table for every physician.
const deleteStatements = functionBody.match(/DELETE\s+FROM\s+\w+[^;]*;/gi) ?? [];
assert(
  deleteStatements.length === 1 &&
    /DELETE\s+FROM\s+physician_examination_assignments\s+WHERE\s+physician_id\s*=\s*v_physician_id\s*;/i.test(
      deleteStatements[0].replace(/\s+/g, " ")
    ),
  `the transaction's only DELETE removes just the saved physician's own pairs (found: ${JSON.stringify(deleteStatements)})`
);
assert(
  !/DELETE\s+FROM\s+physicians\b/i.test(configurationMigrationSql),
  "save_physician_configuration deletes no physician record - the configuration save is never a removal path"
);

/* ── The transaction does the whole save, in the order the constraints require ─────────────── */

const bodyOneLine = functionBody.replace(/\s+/g, " ");
const stepIndex = {
  insertPhysician: bodyOneLine.search(/INSERT INTO physicians \(/i),
  updatePhysician: bodyOneLine.search(/UPDATE physicians SET/i),
  clearPairs: bodyOneLine.search(/DELETE FROM physician_examination_assignments/i),
  transferDefault: bodyOneLine.search(
    /UPDATE physician_examination_assignments SET is_default = FALSE/i
  ),
  insertAssignments: bodyOneLine.search(
    /INSERT INTO physician_examination_assignments \(/i
  ),
  returnId: bodyOneLine.search(/RETURN v_physician_id;/i),
};
for (const [step, index] of Object.entries(stepIndex)) {
  assert(index >= 0, `the transaction performs the ${step} step`);
}
// The record is written before the assignment set, because a physician being CREATED has no id
// until it exists.
assert(
  stepIndex.clearPairs > stepIndex.insertPhysician &&
    stepIndex.clearPairs > stepIndex.updatePhysician,
  "the physician record is written before its assignment set is replaced"
);
// THE ORDER THAT IS A CORRECTNESS REQUIREMENT. The partial unique index is checked per statement,
// so the incumbent default must be cleared BEFORE any default row of this physician exists -
// being inside one transaction does not relax it.
assert(
  stepIndex.transferDefault > stepIndex.clearPairs &&
    stepIndex.insertAssignments > stepIndex.transferDefault,
  "the incumbent default is cleared after the physician's own pairs and before the replacement set is inserted"
);
assert(
  stepIndex.returnId > stepIndex.insertAssignments,
  "the identifier is returned only after the complete set is written"
);
// Serialized, so two concurrent saves competing for the same examination's default cannot turn
// into a duplicate-assignment refusal the operator did nothing to deserve.
assert(
  /pg_advisory_xact_lock\s*\(/i.test(functionBody),
  "concurrent physician configuration saves serialize on a transaction-scoped advisory lock"
);

/* ── Every rule is re-decided inside the transaction ───────────────────────────────────────── */

// SQLSTATEs in the ST class, which PostgreSQL does not use, so a typed refusal can never be
// confused with a condition the database raised on its own. The server action maps these by code,
// never by message text.
for (const [refusal, sqlstate] of [
  ["PHYSICIAN_DUPLICATE_NAME", "ST001"],
  ["PHYSICIAN_DUPLICATE_ASSIGNMENT", "ST002"],
  ["PHYSICIAN_NOT_FOUND", "ST003"],
  ["PHYSICIAN_INACTIVE", "ST004"],
  ["DEFAULT_NOT_ASSIGNED", "ST005"],
  ["UNKNOWN_TEMPLATE", "ST006"],
] as const) {
  assert(
    new RegExp(
      `RAISE\\s+EXCEPTION\\s+'${refusal}'\\s+USING\\s+ERRCODE\\s*=\\s*'${sqlstate}'`,
      "i"
    ).test(functionBody),
    `the transaction raises ${refusal} as ${sqlstate}`
  );
}
assert(
  /ERRCODE\s*=\s*'ST007'/i.test(functionBody),
  "the transaction raises INVALID_PAYLOAD as ST007 for a payload that never went through the schema"
);
// Strict shape, decided again where the caller cannot skip it.
assert(
  /jsonb_object_keys\s*\(\s*payload\s*\)[\s\S]*?NOT\s+IN\s*\(/i.test(functionBody),
  "the transaction rejects an unexpected payload key rather than ignoring it"
);
assert(
  /jsonb_typeof\s*\(\s*payload\s*->\s*'template_codes'\s*\)\s*IS\s+DISTINCT\s+FROM\s+'array'/i.test(
    functionBody
  ),
  "the transaction type-checks the examination lists rather than coercing them"
);
// The template codes are checked against the maintained registry, so an examination that does not
// exist cannot be written even though the column is a plain TEXT foreign key.
assert(
  /FROM\s+report_templates\s+WHERE\s+report_templates\.template_code\s*=\s*code/i.test(
    functionBody
  ),
  "the transaction checks every examination code against report_templates"
);
assert(
  /defaulted\.code\s*<>\s*ALL\s*\(\s*v_template_codes\s*\)/i.test(functionBody),
  "the transaction refuses a default that is not also an assignment"
);
assert(
  /NOT\s+v_is_active\s+AND\s+COALESCE\s*\(\s*array_length\s*\(\s*v_default_codes/i.test(
    functionBody
  ),
  "the transaction refuses a default held by an inactive physician"
);

/* ── Server wiring: the repository, the action and the page all go through the transaction ─── */

const configurationRepositorySource = getSource(
  "src/repositories/supabase-physician-repository.ts"
);
const configurationActionsSource = getSource("src/features/server-boundary/physician-actions.ts");
const configurationPageSource = getSource("src/app/(app)/personnel/page.tsx");
const configurationInterfaceSource = getSource("src/repositories/interfaces/index.ts");

assert(
  new RegExp(`supabaseServer\\.rpc\\(\\s*"${CONFIGURATION_FUNCTION}"`).test(
    configurationRepositorySource
  ),
  `the repository saves a physician configuration through the ${CONFIGURATION_FUNCTION} RPC`
);
assert(
  /async\s+savePhysicianConfiguration\s*\(/.test(configurationRepositorySource),
  "the repository exposes savePhysicianConfiguration as the single write for one form save"
);
// THE OLD IMPLEMENTATION MUST BE GONE, NOT MERELY UNUSED. Three independent PostgREST statements
// against the join table are exactly the partial-failure the transaction exists to remove, and
// leaving them reachable would leave a second, non-atomic way in.
assert(
  !/replaceAssignmentsForPhysician/.test(configurationRepositorySource) &&
    !/replaceAssignmentsForPhysician/.test(configurationInterfaceSource),
  "the three-independent-statement assignment replacement is gone from the repository and its interface"
);
const assignmentTableWrites =
  configurationRepositorySource.match(
    /\.from\(ASSIGNMENT_TABLE\)\s*\r?\n?\s*\.(delete|insert|update|upsert)\(/g
  ) ?? [];
assert(
  assignmentTableWrites.length === 0,
  `the repository issues no direct write against the assignment table - every write goes through the transaction (found: ${JSON.stringify(assignmentTableWrites)})`
);
assert(
  !/setPhysicianAssignmentsAction/.test(configurationActionsSource) &&
    !/setPhysicianAssignmentsAction/.test(configurationPageSource),
  "the standalone assignment-replacement action is gone; one save is one action"
);

const configurationActionBody = /export async function savePhysicianConfigurationAction\(([\s\S]*?)\n}\n/.exec(
  configurationActionsSource
);
assert(
  configurationActionBody !== null,
  "savePhysicianConfigurationAction is declared and locatable"
);
const configurationAction = configurationActionBody![0];
// Authorization first, before the payload is parsed and long before the repository is reached.
const guardIndex = configurationAction.search(/await\s+requirePersonnelAdmin\s*\(\s*\)/);
const parseIndex = configurationAction.search(/physicianConfigurationSchema\.parse\s*\(/);
const repositoryIndex = configurationAction.indexOf("SupabasePhysicianRepository");
assert(
  guardIndex >= 0 && parseIndex > guardIndex && repositoryIndex > parseIndex,
  "savePhysicianConfigurationAction authorizes an Admin caller before parsing, and parses before reaching the repository"
);
assert(
  !/requirePersonnelReader/.test(configurationAction),
  "savePhysicianConfigurationAction does not downgrade to the read-only guard"
);
// Typed refusals are recognised by SQLSTATE, never by message text.
assert(
  /CONFIGURATION_REFUSAL_BY_SQLSTATE/.test(configurationActionsSource) &&
    /ST001:\s*"DUPLICATE_NAME"/.test(configurationActionsSource),
  "the action maps the transaction's refusals by their PostgreSQL SQLSTATE"
);
assert(
  /throw error;/.test(configurationAction),
  "the action rethrows every failure that is not one of the transaction's own refusals"
);

// THE AUDIT ASSERTION. A rolled-back attempt is not a successful assignment update. The catch
// block must reach no auditService.emit at all, and every emit must sit after the write.
const configurationCatch =
  /catch \(error: unknown\) \{([\s\S]*?)\n  \}/.exec(configurationAction)?.[1] ?? "";
assert(
  configurationCatch.length > 0,
  "the action's failure path was extracted; an empty extraction would certify nothing"
);
assert(
  !/auditService\.emit/.test(configurationCatch),
  "a rolled-back save emits no audit event - the failure path records nothing"
);
const writeIndex = configurationAction.indexOf("repository.savePhysicianConfiguration(");
assert(writeIndex >= 0, "the action reaches the transaction through the repository");
for (const eventType of [
  "PhysicianRecordCreated",
  "PhysicianRecordUpdated",
  "PhysicianExaminationAssignmentsUpdated",
]) {
  const eventIndex = configurationAction.indexOf(eventType);
  assert(
    eventIndex > writeIndex,
    `the ${eventType} audit event is emitted only after the transaction has committed`
  );
}
// No new event type and no new details key: the audit presentation list is closed.
//
// CLINIC-UI-UX-08R1: scoped to the save's own body, which is what this message claims, and allowed
// only the three types the save emits. The whole-file letter this used to read is kept as its own
// assertion below - an exact, closed set, unchanged - and the one approved new member,
// PhysicianRecordDeleted, is written by the database function `delete_inactive_physician()` in the
// deletion's own transaction, never by this file.
assert(
  !/eventType:\s*"Physician(?!RecordCreated|RecordUpdated|ExaminationAssignmentsUpdated)/.test(
    configurationAction
  ),
  "the atomic save invents no new physician audit event type"
);
const physicianEventTypes = Array.from(
  new Set(
    // `[^"]*`, not a letter class: a type such as "Physician_Purged" must be caught too.
    (configurationActionsSource.match(/eventType:\s*"Physician[^"]*"/g) ?? []).map((entry) =>
      entry.replace(/^eventType:\s*"|"$/g, "")
    )
  )
).sort();
assert(
  JSON.stringify(physicianEventTypes) ===
    JSON.stringify([
      "PhysicianExaminationAssignmentsUpdated",
      "PhysicianRecordCreated",
      "PhysicianRecordUpdated",
      "PhysicianStatusToggled",
    ]),
  `physician-actions.ts emits exactly the four pre-existing physician audit event types (found: ${JSON.stringify(physicianEventTypes)})`
);
const deletionMigrationSql = getSource(
  "supabase/migrations/20260913120000_stable_physician_references_and_atomic_directory_deletion.sql"
);
const databasePhysicianEventTypes = Array.from(
  deletionMigrationSql.matchAll(/'PersonnelCredential',\s*'(Physician[^']*)'/g),
  (match) => match[1]
);
assert(
  JSON.stringify(databasePhysicianEventTypes) === JSON.stringify(["PhysicianRecordDeleted"]),
  `the deletion function writes exactly one physician audit event type, the approved PhysicianRecordDeleted (found: ${JSON.stringify(databasePhysicianEventTypes)})`
);

assert(
  /savePhysicianConfigurationAction\(/.test(configurationPageSource),
  "the personnel page saves a physician through the one atomic action"
);
// The post-create name lookup is gone: the identifier comes back from the transaction.
assert(
  !/listPhysiciansAction\(\)[\s\S]{0,400}?roster\.find/.test(configurationPageSource),
  "the page no longer resolves a newly created physician by looking its name up again"
);

console.log("\nAll atomic physician configuration invariants verified.");

/* ═══════════ Deactivating a physician clears that physician's default examinations ══════════ */
/*
 * WHAT THIS SECTION EXISTS FOR. `save_physician_configuration` refuses to WRITE a default held by
 * an inactive physician (PHYSICIAN_INACTIVE / ST004), but refusing to write a state is not the
 * same as preventing it from arising. It could still arise from the other direction: take a
 * physician who legitimately holds defaults and deactivate them. Three server-side paths can set
 * `physicians.is_active` - `togglePhysicianStatusAction`, `updatePhysicianAction` and
 * `save_physician_configuration` itself - so a check written in any one of them leaves the other
 * two, and every path added later, free to produce the state again.
 *
 * The rule is therefore enforced on the ROW TRANSITION, and these assertions pin the four things
 * that make that enforcement mean what it claims:
 *   1. it is a trigger on `physicians`, so every caller gets it and none can forget it;
 *   2. its WHEN clause fires on active -> inactive and on nothing else, so reactivation restores
 *      no default automatically;
 *   3. its body clears the FLAG and removes no row, so ordinary assignments are preserved;
 *   4. it carries the same security posture as every other function in this feature.
 */

const deactivationMigrationRaw = getSource(DEACTIVATION_MIGRATION_PATH);
const deactivationMigrationSql = stripSqlComments(deactivationMigrationRaw);
const DEACTIVATION_FUNCTION = "clear_physician_defaults_on_deactivation";
const DEACTIVATION_TRIGGER = "trg_physicians_clear_defaults_on_deactivation";

// Fail closed on the stripper, as in every section above: an emptied haystack satisfies every
// negative below and would certify nothing.
assert(
  deactivationMigrationSql.includes("CREATE OR REPLACE FUNCTION") &&
    deactivationMigrationSql.includes("CREATE TRIGGER") &&
    deactivationMigrationSql.includes("REVOKE EXECUTE") &&
    deactivationMigrationSql.length > 800,
  "the deactivation migration survives SQL comment stripping with its executable statements intact"
);
for (const proseMarker of ["THE INVARIANT", "WHAT IS DELIBERATELY NOT DONE"]) {
  assert(
    deactivationMigrationRaw.includes(proseMarker) &&
      !deactivationMigrationSql.includes(proseMarker),
    `comment stripping removes the deactivation migration's prose (control: "${proseMarker}")`
  );
}

/* ── The function, its signature and its security posture ──────────────────────────────────── */

assert(
  new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${DEACTIVATION_FUNCTION}\\s*\\(\\s*\\)\\s*\\n?RETURNS\\s+trigger`,
    "i"
  ).test(deactivationMigrationSql),
  `the migration creates ${DEACTIVATION_FUNCTION}() RETURNS trigger`
);
assert(
  (deactivationMigrationSql.match(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/gi) ?? []).length === 1,
  "the deactivation migration creates exactly one function"
);
assert(
  /SECURITY\s+INVOKER/i.test(deactivationMigrationSql),
  `${DEACTIVATION_FUNCTION} is SECURITY INVOKER`
);
assert(
  !/SECURITY\s+DEFINER/i.test(deactivationMigrationSql),
  `${DEACTIVATION_FUNCTION} is never SECURITY DEFINER`
);
const deactivationSearchPaths = (
  deactivationMigrationSql.match(/SET\s+search_path\s*=[^\n;]*/gi) ?? []
).map((setting) => setting.replace(/\s+/g, " ").trim());
assert(
  deactivationSearchPaths.length === 1 &&
    deactivationSearchPaths[0] === "SET search_path = public, pg_temp",
  `${DEACTIVATION_FUNCTION} pins exactly one search_path and it is the safe one (found: ${JSON.stringify(deactivationSearchPaths)})`
);
// A trigger fires regardless of EXECUTE privilege, so this revoke is not what makes the trigger
// work - it is what stops the function being CALLED directly by a role that should not have it.
// The created-vs-revoked parity loop earlier in this file counts it; this pins the exact
// signature, which a count cannot.
assert(
  new RegExp(
    `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+${DEACTIVATION_FUNCTION}\\s*\\(\\s*\\)\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated\\s*;`,
    "i"
  ).test(deactivationMigrationSql),
  "EXECUTE on the deactivation function is revoked from PUBLIC, anon and authenticated"
);
// No GRANT at all. A trigger function needs none, and granting one would hand a role a callable
// surface for no reason.
assert(
  (deactivationMigrationSql.match(/\bGRANT\b/gi) ?? []).length === 0,
  "the deactivation migration grants nothing to anybody - a trigger function needs no EXECUTE grant"
);

/* ── The trigger: on the transition itself, and only in one direction ──────────────────────── */

const triggerStatements = deactivationMigrationSql.match(/CREATE\s+TRIGGER[\s\S]*?;/gi) ?? [];
assert(
  triggerStatements.length === 1,
  `the deactivation migration creates exactly one trigger (found: ${triggerStatements.length})`
);
const triggerStatement = triggerStatements[0].replace(/\s+/g, " ");
assert(
  new RegExp(
    `^CREATE TRIGGER ${DEACTIVATION_TRIGGER} AFTER UPDATE OF is_active ON physicians FOR EACH ROW WHEN \\(OLD\\.is_active AND NOT NEW\\.is_active\\) EXECUTE FUNCTION ${DEACTIVATION_FUNCTION}\\(\\);$`,
    "i"
  ).test(triggerStatement),
  `the trigger fires AFTER UPDATE OF is_active on physicians, per row, only on active -> inactive (found: ${triggerStatement})`
);
// THE DIRECTIONALITY ASSERTION, stated as its own negative so it cannot be lost by a rewrite of
// the statement above. Nothing anywhere in this migration fires on the inactive -> active
// transition: a reactivation must restore no default, because restoring one silently would
// re-establish a pre-selection that may since have been given to another physician.
assert(
  !/NOT\s+OLD\.is_active/i.test(deactivationMigrationSql) &&
    !/OLD\.is_active\s+IS\s+(NOT\s+)?FALSE/i.test(deactivationMigrationSql),
  "no statement in the deactivation migration fires on reactivation - a restored physician gets no default back"
);
// Idempotent creation through the catalogue, the same idiom as the two applied migrations. A DROP
// TRIGGER would put a destructive statement into a migration that must contain none.
assert(
  new RegExp(
    `IF\\s+NOT\\s+EXISTS\\s*\\(\\s*SELECT\\s+1\\s+FROM\\s+pg_trigger\\s+WHERE\\s+tgname\\s*=\\s*'${DEACTIVATION_TRIGGER}'\\s+AND\\s+tgrelid\\s*=\\s*'physicians'::regclass\\s*\\)`,
    "i"
  ).test(deactivationMigrationSql.replace(/\s+/g, " ")),
  "the trigger is created only if it does not already exist, consulting the catalogue rather than dropping"
);

/* ── The body: clears the flag, preserves the assignment, chooses no substitute ─────────────── */

const deactivationBodyMatch = /AS\s*\$function\$([\s\S]*?)\$function\$/i.exec(
  deactivationMigrationSql
);
assert(deactivationBodyMatch !== null, "the deactivation function body is parseable");
const deactivationBody = deactivationBodyMatch![1];

const deactivationWrites = deactivationBody.match(/\b(UPDATE|INSERT|DELETE|TRUNCATE)\b[^;]*;/gi) ?? [];
assert(
  deactivationWrites.length === 1,
  `the deactivation function performs exactly one write (found: ${JSON.stringify(deactivationWrites)})`
);
assert(
  /UPDATE physician_examination_assignments SET is_default = FALSE WHERE physician_id = NEW\.id AND is_default\s*;/i.test(
    deactivationWrites[0].replace(/\s+/g, " ")
  ),
  "the only write clears is_default on the deactivated physician's own rows, filtered to the rows that actually hold the flag"
);
// ORDINARY ASSIGNMENTS ARE PRESERVED. This is the difference between deactivating a physician and
// erasing an Administrator's configuration: the flag goes, the row stays, so reactivating restores
// a working assignment set rather than an empty one.
assert(
  !/\bDELETE\b/i.test(deactivationBody) && !/\bTRUNCATE\b/i.test(deactivationBody),
  "the deactivation function deletes no assignment row - only the default flag is cleared"
);
// NO SUBSTITUTE DEFAULT IS CHOSEN. The examination is left with zero defaults, never with a
// replacement the database picked.
assert(
  !/\bINSERT\b/i.test(deactivationBody) && !/is_default\s*=\s*TRUE/i.test(deactivationBody),
  "the deactivation function sets no default TRUE - the examination is left with none, not with a substitute"
);
assert(
  !/\bphysicians\b/i.test(deactivationWrites[0]),
  "the deactivation function writes only to the assignment table; it never writes back to physicians"
);

/* ── Forward-only: no pre-existing object is touched ───────────────────────────────────────── */

for (const [statement, pattern] of [
  ["DROP", /\bDROP\b/i],
  ["TRUNCATE", /\bTRUNCATE\b/i],
  ["ALTER", /\bALTER\b/i],
  ["CREATE TABLE", /\bCREATE\s+TABLE\b/i],
  ["CREATE INDEX", /\bCREATE\s+(UNIQUE\s+)?INDEX\b/i],
] as const) {
  assert(
    !pattern.test(deactivationMigrationSql),
    `the deactivation migration contains no ${statement} statement`
  );
}

// APPLYING THIS MIGRATION MUST TOUCH NO ROW, and the assertions above cannot say so: the write
// negatives earlier in this section are scoped to the FUNCTION BODY, where one UPDATE legitimately
// lives, so a top-level `DELETE FROM physician_examination_assignments;` or a seed
// `UPDATE ... SET is_default = TRUE` would satisfy every one of them while contradicting the
// migration's own prose. The body is blanked out and the negatives run on what is left, which is
// exactly the statements that execute at apply time. The assignment migration's section states the
// same rule for its own file; this brings the two to the same standard.
const deactivationTopLevelSql = deactivationMigrationSql.replace(
  /AS\s*\$function\$[\s\S]*?\$function\$/i,
  " "
);
assert(
  deactivationTopLevelSql.length < deactivationMigrationSql.length &&
    deactivationTopLevelSql.includes("CREATE TRIGGER"),
  "the function body was blanked and the migration's top-level statements survive; an empty remainder would certify nothing"
);
for (const [statement, pattern] of [
  ["DELETE", /\bDELETE\b/i],
  ["INSERT", /\bINSERT\b/i],
  ["UPDATE", /\bUPDATE\s+(ONLY\s+)?[a-z_][\w.]*\s+SET\b/i],
] as const) {
  assert(
    !pattern.test(deactivationTopLevelSql),
    `applying the deactivation migration executes no ${statement} - it writes no row, and the only write it installs lives inside the trigger function`
  );
}

/* ── The server actions take the invariant from the trigger, not from a per-caller check ────── */

const statusActionsSource = getSource("src/features/server-boundary/physician-actions.ts");
const STATUS_CHANGING_ACTIONS = ["togglePhysicianStatusAction", "updatePhysicianAction"] as const;

/**
 * One exported action's source region, bounded by the NEXT top-level export.
 *
 * Deliberately not brace matching. Nothing below needs the closing brace - the assertions count
 * what an action emits and check what it reads - and a boundary that no comment, string, template
 * literal or stray apostrophe can move is worth more here than a scan that they can. The
 * companion extractor in verify-physician-directory.ts does need real brace matching, and it does
 * a full lexical scan for exactly this reason.
 */
function extractExportedFunctionBody(source: string, actionName: string): string {
  const start = source.indexOf(`export async function ${actionName}(`);
  if (start < 0) return "";
  const next = source.indexOf("\nexport ", start + 1);
  return next < 0 ? source.slice(start) : source.slice(start, next);
}

/**
 * TypeScript `//` and block comments, blanked so offsets and line numbers survive.
 *
 * The assertions below run on the stripped text for the same reason the companion loop in
 * verify-physician-directory.ts strips first: commented-out code must not be able to satisfy
 * them. A deleted `auditService.emit` block left behind as `// eventType: "PhysicianRecordUpdated"`
 * would otherwise count as the one event this action emits. Quotes are tracked so a `//` inside a
 * string literal is not mistaken for the start of a comment.
 */
function stripTsComments(source: string): string {
  let result = "";
  let quote = "";
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      result += ch;
      if (ch === "\\") { result += next ?? ""; i++; continue; }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; result += ch; continue; }
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") { result += " "; i++; }
      if (i < source.length) result += "\n";
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      result += "  ";
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        result += source[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < source.length) { result += "  "; i++; }
      continue;
    }
    result += ch;
  }
  return result;
}

// EACH action's OWN documentation names the trigger, so a reader of either one is told where the
// rule lives instead of concluding there is no rule. Anchored on the text immediately PRECEDING
// each declaration - a whole-file search would let one action's comment satisfy the assertion for
// both, which is exactly what this used to do: the trigger name appears once in the file, and the
// same comment happens to contain the other action's name, so deleting that action's own comment
// left the assertion passing while reporting the opposite.
for (const actionName of STATUS_CHANGING_ACTIONS) {
  const declarationIndex = statusActionsSource.indexOf(`export async function ${actionName}(`);
  assert(
    declarationIndex > 0,
    `${actionName} is declared in physician-actions.ts; an unfound declaration would certify nothing`
  );
  const precedingDocumentation = statusActionsSource.slice(
    Math.max(0, declarationIndex - 1400),
    declarationIndex
  );
  assert(
    precedingDocumentation.includes(DEACTIVATION_TRIGGER),
    `${actionName}'s own documentation records that the deactivation invariant is held by ${DEACTIVATION_TRIGGER}`
  );
}
// THE CONSEQUENCE IS NOT SEPARATELY AUDITED, AND THAT IS THE DECISION. Recording the cleared
// defaults from an action would mean reading the flags BEFORE the status write, and that read sits
// outside the transaction the trigger runs in: a concurrent status change or assignment save
// between the read and the write makes the record wrong in either direction - an event for a
// clearing this caller did not cause, or silence for one it did. A wrong audit entry is worse than
// a missing one. The events both actions already emit are true, and this pins that they are still
// the ONLY ones either emits, so the unsafe pre-read cannot come back.
for (const [actionName, eventType] of [
  ['togglePhysicianStatusAction', 'PhysicianStatusToggled'],
  ['updatePhysicianAction', 'PhysicianRecordUpdated'],
] as const) {
  // Stripped before anything is counted: a commented-out emit must not be able to stand in for a
  // real one, and this region deliberately reaches into the following declaration's doc comment.
  const actionBody = stripTsComments(
    extractExportedFunctionBody(statusActionsSource, actionName)
  );
  assert(
    actionBody.length > 0 &&
      (actionBody.match(/\basync function\s/g) ?? []).length === 1,
    `${actionName}'s region was extracted and holds exactly one function declaration; an empty or overrunning extraction would certify nothing`
  );
  // Normalized before comparison, so `eventType:"X"` - which the pattern matches - is judged on
  // what it says rather than on its spacing.
  const emitted = (actionBody.match(/eventType:\s*"([A-Za-z]+)"/g) ?? []).map((entry) =>
    entry.replace(/\s+/g, "")
  );
  assert(
    emitted.length === 1 && emitted[0] === `eventType:"${eventType}"`,
    `${actionName} emits exactly one audit event and it is ${eventType} (found: ${JSON.stringify(emitted)})`
  );
  assert(
    !/findAssignmentsByPhysician\(/.test(actionBody),
    `${actionName} takes no default-count pre-read - a read outside the trigger transaction cannot be audited truthfully`
  );
}

// The physicians row is still only ever updated, never deleted, by either status path. Both
// patterns are executable-shaped rather than a bare word, so this cannot be tripped by prose:
// this file's own comments legitimately discuss deletion, and a raw \bDELETE\b negative would
// fail on the explanation instead of on the code.
//
// CLINIC-UI-UX-08R1: the file now also holds deletePhysicianAction, the one permanent deletion,
// which is not a status change. The whole-file letter still holds - it reaches the repository
// method, which calls the audited database function, never `.delete(` or SQL - and each status
// action is also proved to reach no deletion at all.
assert(
  !/\.delete\(/.test(statusActionsSource) && !/\bDELETE\s+FROM\b/i.test(statusActionsSource),
  "physician-actions.ts issues no direct delete anywhere - its one permanent deletion goes through the repository to the audited database function"
);
for (const actionName of STATUS_CHANGING_ACTIONS) {
  const actionBody = stripTsComments(extractExportedFunctionBody(statusActionsSource, actionName));
  assert(
    actionBody.length > 0 &&
      !/\.delete\(/.test(actionBody) &&
      !/deleteInactive\(/.test(actionBody) &&
      !/\bDELETE\s+FROM\b/i.test(actionBody),
    `${actionName} deletes nothing - deactivation remains a status change, never a removal`
  );
}

console.log("\nAll physician deactivation invariants verified.");
