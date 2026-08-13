import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`M6A verification failed: ${message}`);
}

const root = process.cwd();
const migrationsDirectory = path.join(root, "supabase", "migrations");

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function extractCreateTable(sql: string, tableName: string): string {
  const opening = new RegExp(`CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+${tableName}\\s*\\(`, "i").exec(sql);
  assert(opening?.index !== undefined, `${tableName} CREATE TABLE must be present`);

  const openParenthesis = sql.indexOf("(", opening.index);
  let depth = 0;
  let inString = false;

  for (let index = openParenthesis; index < sql.length; index += 1) {
    const character = sql[index];
    if (character === "'") {
      if (inString && sql[index + 1] === "'") {
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) return sql.slice(openParenthesis + 1, index);
    }
  }

  throw new Error(`M6A verification failed: ${tableName} CREATE TABLE is unterminated`);
}

function quotedValues(valueList: string): string[] {
  return [...valueList.matchAll(/'([^']*)'/g)].map((match) => match[1]);
}

function normalizedSha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

const migrationNames = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const correctionMigrationName = "20260812110000_correct_initial_account_lifecycle.sql";
const correctionIndex = migrationNames.indexOf(correctionMigrationName);
assert(
  correctionIndex !== -1,
  "the initial-account-lifecycle correction migration must be present"
);
// The correction is the final authority on the corrected initial-account lifecycle. Unrelated
// later migrations are permitted; none may reopen must_change_password.
for (const name of migrationNames.slice(correctionIndex + 1)) {
  assert(
    !/\bmust_change_password\b/i.test(read(path.join("supabase", "migrations", name))),
    `${name} sorts after the initial-account-lifecycle correction and must not modify must_change_password`
  );
}
const migrationChain = migrationNames
  .map((name) => read(path.join("supabase", "migrations", name)))
  .join("\n");

assert(!/auth\s*\.\s*uid\s*\(/i.test(migrationChain), "migration chain must contain zero auth.uid() calls");
assert(!/\bis_active_user\b/i.test(migrationChain), "is_active_user must be absent from the migration chain");
assert(!/\bis_admin_user\b/i.test(migrationChain), "is_admin_user must be absent from the migration chain");

const tablesSql = read(path.join("supabase", "migrations", "02_tables.sql"));
const userProfiles = extractCreateTable(tablesSql, "user_profiles");
const roleCheck = /\brole\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(\s*role\s+IN\s*\(([^)]*)\)\s*\)/i.exec(userProfiles);
assert(roleCheck, "user_profiles role CHECK must be present");
assert(
  JSON.stringify(quotedValues(roleCheck[1])) === JSON.stringify(["Admin", "User", "Developer"]),
  "user_profiles role CHECK must admit exactly Admin, User, and Developer"
);

assert(/\bid\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i.test(userProfiles), "user_profiles id must generate UUIDs");
assert(/\bpassword_hash\s+TEXT\s+NOT\s+NULL/i.test(userProfiles), "password_hash must be present and required");
assert(/\bsecurity_question\s+TEXT\s+NOT\s+NULL/i.test(userProfiles), "security_question must be present and required");
assert(/\bsecurity_answer_hash\s+TEXT\s+NULL\b/i.test(userProfiles), "security_answer_hash must be explicitly nullable");
assert(!/\bsecurity_answer_hash\s+TEXT\s+NOT\s+NULL/i.test(userProfiles), "security_answer_hash must not be NOT NULL");
assert(/\bmust_change_password\s+BOOLEAN\s+NOT\s+NULL\b/i.test(userProfiles), "02_tables.sql must declare must_change_password BOOLEAN NOT NULL");
assert(/\bmust_set_recovery\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i.test(userProfiles), "must_set_recovery must independently default TRUE");
assert(/\btoken_version\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+1/i.test(userProfiles), "token_version must be present");
assert(/\bpassword_updated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i.test(userProfiles), "password_updated_at must be present");

const correctionSql = read(path.join("supabase", "migrations", correctionMigrationName));
const expectedCorrectionSql = `ALTER TABLE user_profiles ALTER COLUMN must_change_password SET DEFAULT FALSE;

UPDATE user_profiles
SET must_change_password = FALSE,
    updated_at = NOW()
WHERE must_change_password = TRUE
  AND security_answer_hash IS NULL;`;
assert(
  correctionSql.trim() === expectedCorrectionSql,
  "the correction migration must contain exactly the approved two statements"
);
assert(
  /ALTER\s+TABLE\s+user_profiles\s+ALTER\s+COLUMN\s+must_change_password\s+SET\s+DEFAULT\s+FALSE\s*;/i.test(
    correctionSql
  ),
  "the correction migration must set must_change_password DEFAULT FALSE"
);

assert(/CONSTRAINT\s+chk_user_profiles_canonical_username\s+CHECK/i.test(userProfiles), "canonical username CHECK must be named and present");
assert(/char_length\s*\(\s*username\s*\)\s+BETWEEN\s+3\s+AND\s+50/i.test(userProfiles), "canonical username length must be 3-50");
assert(userProfiles.includes("username ~ '^[a-z0-9][a-z0-9._-]*[a-z0-9]$'"), "canonical username must use only lowercase ASCII letters, digits, and approved separators, with alphanumeric ends");
assert(userProfiles.includes("username !~ '[._-]{2}'"), "canonical username must reject consecutive separators");

const sessions = extractCreateTable(tablesSql, "patient_report_sessions");
assert(/\bcreated_by_user_id\s+UUID\s+NULL\s+REFERENCES\s+user_profiles\s*\(\s*id\s*\)\s+ON\s+DELETE\s+RESTRICT/i.test(sessions), "patient_report_sessions.created_by_user_id must be nullable with the restricted user_profiles FK");
assert(/\bupdated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i.test(sessions), "patient_report_sessions.updated_at must be present");
assert(/\blast_replaced_at\s+TIMESTAMPTZ\s+NULL\b/i.test(sessions), "patient_report_sessions.last_replaced_at must be nullable");
assert(/\bdemographics\s+JSONB\s+NOT\s+NULL/i.test(sessions), "patient_report_sessions.demographics must remain JSONB");
const sessionStatusCheck = /\bstatus\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(\s*status\s+IN\s*\(([^)]*)\)\s*\)/i.exec(sessions);
assert(sessionStatusCheck, "patient_report_sessions status CHECK must be present");
assert(
  JSON.stringify(quotedValues(sessionStatusCheck[1])) === JSON.stringify(["Draft", "Completed"]),
  "patient_report_sessions status CHECK must remain exactly Draft and Completed"
);

const triggersSql = read(path.join("supabase", "migrations", "03_indexes_and_triggers.sql"));
assert(
  /CREATE\s+TRIGGER\s+trg_patient_report_sessions_updated_at\s+BEFORE\s+UPDATE\s+ON\s+patient_report_sessions\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+update_updated_at_column\s*\(\s*\)\s*;/i.test(triggersSql),
  "patient_report_sessions updated_at trigger must match the shared trigger shape"
);

const rlsSql = read(path.join("supabase", "migrations", "05_rls_policies.sql"));
assert(!/\bauth\s*\./i.test(rlsSql), "RLS migration must contain no auth.* references");
assert(!/CREATE\s+POLICY/i.test(rlsSql), "RLS migration must create no permissive policies");
assert(/application server is the authoritative authorization boundary/i.test(rlsSql), "RLS migration must record the authoritative server boundary");
assert(/RLS is defense-in-depth only/i.test(rlsSql), "RLS migration must record its defense-in-depth role");
assert(/server-only secret credential[^\n]*bypasses RLS/i.test(rlsSql), "RLS migration must record privileged RLS bypass");

const applicationTables = [
  "user_profiles",
  "personnel",
  "auto_suggestions",
  "report_templates",
  "template_parameters",
  "template_signatory_requirements",
  "patient_report_sessions",
  "laboratory_reports",
  "laboratory_results",
  "report_signatories",
  "auth_attempts",
  "audit_logs",
];
for (const tableName of applicationTables) {
  assert(
    new RegExp(`ALTER\\s+TABLE\\s+${tableName}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY\\s*;`, "i").test(migrationChain),
    `${tableName} must have RLS enabled`
  );
}

const securitySchemaSql = read(path.join("supabase", "migrations", "20260812100000_security_foundation_schema.sql"));
const authAttempts = extractCreateTable(securitySchemaSql, "auth_attempts");
assert(/\battempt_kind\s+TEXT\s+NOT\s+NULL\s+CHECK/i.test(authAttempts), "auth_attempts must include its constrained attempt kind");
assert(/\battempted_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i.test(authAttempts), "auth_attempts must timestamp attempts");
assert(/CREATE\s+INDEX\s+idx_auth_attempts_username_time\s+ON\s+auth_attempts\s*\(\s*username\s*,\s*attempted_at\s+DESC\s*\)\s*;/i.test(securitySchemaSql), "auth_attempts must have the username/time index");

extractCreateTable(securitySchemaSql, "audit_logs");
assert(/REVOKE\s+UPDATE\s*,\s*DELETE\s+ON\s+audit_logs\s+FROM\s+PUBLIC\s*;/i.test(securitySchemaSql), "audit_logs UPDATE and DELETE must be revoked from PUBLIC");
assert(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+audit_logs_append_only\s*\(\s*\)/i.test(securitySchemaSql), "audit_logs append-only function must be present");
assert(/RAISE\s+EXCEPTION\s+'audit_logs is append-only:/i.test(securitySchemaSql), "audit_logs append-only function must raise an exception");
assert(/CREATE\s+TRIGGER\s+trg_audit_logs_append_only\s+BEFORE\s+UPDATE\s+OR\s+DELETE\s+ON\s+audit_logs\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+audit_logs_append_only\s*\(\s*\)\s*;/i.test(securitySchemaSql), "audit_logs append-only trigger must reject updates and deletes");

const grantsSql = read(path.join("supabase", "migrations", "20260812100100_authorization_grants.sql"));
assert(/REVOKE\s+ALL\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+FROM\s+anon\s*,\s*authenticated\s*;/i.test(grantsSql), "grants migration must revoke all table access");
assert(/REVOKE\s+ALL\s+ON\s+ALL\s+SEQUENCES\s+IN\s+SCHEMA\s+public\s+FROM\s+anon\s*,\s*authenticated\s*;/i.test(grantsSql), "grants migration must revoke all sequence access");
assert(/REVOKE\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+public\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated\s*;/i.test(grantsSql), "grants migration must revoke function execution from PUBLIC, anon, and authenticated");
assert(/ALTER\s+DEFAULT\s+PRIVILEGES\s+IN\s+SCHEMA\s+public\s+REVOKE\s+ALL\s+ON\s+TABLES\s+FROM\s+anon\s*,\s*authenticated\s*;/i.test(grantsSql), "default table privileges must be revoked");
assert(/ALTER\s+DEFAULT\s+PRIVILEGES\s+IN\s+SCHEMA\s+public\s+REVOKE\s+ALL\s+ON\s+SEQUENCES\s+FROM\s+anon\s*,\s*authenticated\s*;/i.test(grantsSql), "default sequence privileges must be revoked");
assert(/ALTER\s+DEFAULT\s+PRIVILEGES\s+IN\s+SCHEMA\s+public\s+REVOKE\s+EXECUTE\s+ON\s+FUNCTIONS\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated\s*;/i.test(grantsSql), "default function execution must be revoked from PUBLIC, anon, and authenticated");
assert(!/^\s*GRANT\b/im.test(grantsSql), "grants migration must contain no compensating GRANT");

const extensionsSql = read(path.join("supabase", "migrations", "01_extensions_and_functions.sql"));
assert(extensionsSql.includes('CREATE EXTENSION IF NOT EXISTS "pgcrypto";'), "01 must retain pgcrypto");
assert(extensionsSql.includes('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'), "01 must retain uuid-ossp");
assert(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+update_updated_at_column\s*\(\s*\)[\s\S]*NEW\.updated_at\s*=\s*NOW\(\)/i.test(extensionsSql), "01 must retain the shared updated_at function");
assert(normalizedSha256(extensionsSql) === "e74b6b13144e37604664bce25a94502877fcc0f3c27ff72526ec4e93eac2bb37", "01_extensions_and_functions.sql must remain byte-for-byte unchanged apart from line endings");

const registrySeedSql = read(path.join("supabase", "migrations", "04_report_registry_seed.sql"));
assert(/Authoritative Report Registry Metadata Seed \(17 Templates\)/.test(registrySeedSql), "04 must retain the authoritative 17-template seed");
assert((registrySeedSql.match(/INSERT\s+INTO\s+/gi) ?? []).length === 3, "04 must retain its three registry seed inserts");
assert(registrySeedSql.includes("('CBC', 'Complete Blood Count'") && registrySeedSql.includes("('HIV_RESULT', 'AIDS Free Certificate (Anti-HIV 1/2)'"), "04 must retain the first and final authoritative templates");
assert(normalizedSha256(registrySeedSql) === "d3217e0a288b1ee6e33281b9d52ce74c0521e503939fb2a065c69f1b21d9598e", "04_report_registry_seed.sql must remain byte-for-byte unchanged apart from line endings");

process.stdout.write("M6A verification passed: application-owned authentication schema, 12-table RLS defense, append-only audit logging, and browser privilege denial verified.\n");
