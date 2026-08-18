import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Personnel directory verification failed: ${message}`);
  console.log(`✓ ${message}`);
}

function getSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function extractFunctionBody(source: string, functionName: string): string {
  const pattern = new RegExp(`export async function ${functionName}\\(`);
  const match = pattern.exec(source);
  if (!match) return "";

  const startBrace = source.indexOf("{", match.index);
  if (startBrace < 0) return "";

  let depth = 0;
  let inString = false;
  let stringChar = "";
  let escaped = false;
  for (let i = startBrace; i < source.length; i++) {
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
      if (depth === 0) return source.substring(startBrace + 1, i);
    }
  }
  return source.substring(startBrace + 1);
}

const personnelActionsSource = getSource("src/features/server-boundary/personnel-actions.ts");
const personnelGuardSource = getSource("src/lib/personnel-guard.ts");
const authGuardsSource = getSource("src/lib/auth-guards.ts");
const serverActionsSource = getSource("src/features/server-boundary/server-actions.ts");
const personnelFormSource = getSource("src/features/personnel/components/PersonnelForm.tsx");

// ── Assertion 1: Every write action calls requirePersonnelAdmin() before any repository call ──
for (const actionName of ["createPersonnelAction", "updatePersonnelAction", "togglePersonnelStatusAction"]) {
  const actionBody = extractFunctionBody(personnelActionsSource, actionName);
  const adminGuardIndex = actionBody.indexOf("requirePersonnelAdmin()");
  const repositoryIndex = actionBody.indexOf("SupabasePersonnelRepository");
  assert(
    adminGuardIndex >= 0 && repositoryIndex > adminGuardIndex,
    `${actionName} authorizes an Admin caller (requirePersonnelAdmin) before mutating`
  );
}

// ── Assertion 2: requirePersonnelAdmin accepts "Admin" only ──
assert(
  /profile\.role\s*!==\s*"Admin"/.test(personnelGuardSource),
  "requirePersonnelAdmin checks role === 'Admin' exactly"
);

// ── Assertion 3: No hard-delete path in personnel-actions.ts ──
assert(
  !/\.delete\(/.test(personnelActionsSource),
  "personnel actions expose no hard-delete path"
);
assert(
  !/\bremove\b/.test(personnelActionsSource),
  "personnel actions contain no remove call"
);
assert(
  !/\bDELETE\s+FROM\b/i.test(personnelActionsSource),
  "personnel actions contain no DELETE FROM statement"
);

// ── Assertion 4: signatureImageUrl never read from parsed client input; MedTech write always sends null ──
const createBody = extractFunctionBody(personnelActionsSource, "createPersonnelAction");
assert(
  !/parsed\.signatureImageUrl/.test(createBody),
  "createPersonnelAction never reads signatureImageUrl from parsed client input"
);
assert(
  /signatureImageUrl:\s*null/.test(createBody),
  "createPersonnelAction explicitly sets signatureImageUrl to null"
);

const updateBody = extractFunctionBody(personnelActionsSource, "updatePersonnelAction");
assert(
  /resolvedRole\s*===\s*"MedicalTechnologist"[\s\S]*?signatureImageUrl\s*=\s*null/.test(updateBody),
  "updatePersonnelAction clears signatureImageUrl for MedicalTechnologist role"
);

// ── Assertion 5: listPersonnelAction uses requirePersonnelReader; no write action reuses it ──
const listBody = extractFunctionBody(personnelActionsSource, "listPersonnelAction");
assert(
  /requirePersonnelReader\(\)/.test(listBody),
  "listPersonnelAction uses requirePersonnelReader"
);

const toggleBody = extractFunctionBody(personnelActionsSource, "togglePersonnelStatusAction");
assert(
  !/requirePersonnelReader/.test(createBody) &&
    !/requirePersonnelReader/.test(updateBody) &&
    !/requirePersonnelReader/.test(toggleBody),
  "no write action reuses requirePersonnelReader"
);

// ── Assertion 6: personnel-actions.ts imports server-only and introduces no concrete Supabase type ──
assert(
  /import\s+"server-only"/.test(personnelActionsSource),
  "personnel-actions.ts imports server-only"
);
assert(
  !/\bSupabaseClient\b/.test(personnelActionsSource) && !/\bsupabaseClient\b/.test(personnelActionsSource),
  "personnel-actions.ts introduces no concrete Supabase type"
);

// ── Assertion 7: auth-guards.ts and server-actions.ts match their committed baseline hashes ──
// Hashes derived from the published baseline 5eac3f7 via git show, normalized CRLF→LF.
const EXPECTED_AUTH_GUARDS_HASH = "972a7614ade21c72f7ed96953c32a3b6b2ccb61192e1ca95166d1b0b18417181";
const EXPECTED_SERVER_ACTIONS_HASH = "caa0868c57712efd365b479e57d5beb28cb204e53c54f200aa398572702833fb";

const authGuardsHash = sha256(authGuardsSource);
const serverActionsHash = sha256(serverActionsSource);
assert(
  authGuardsHash === EXPECTED_AUTH_GUARDS_HASH,
  `auth-guards.ts must match baseline 5eac3f7 (expected ${EXPECTED_AUTH_GUARDS_HASH}, got ${authGuardsHash})`
);
assert(
  serverActionsHash === EXPECTED_SERVER_ACTIONS_HASH,
  `server-actions.ts must match baseline 5eac3f7 (expected ${EXPECTED_SERVER_ACTIONS_HASH}, got ${serverActionsHash})`
);

// ── Assertion 8: Server actions expose the stable DUPLICATE_PRC result code ──
assert(
  /"DUPLICATE_PRC"/.test(personnelActionsSource),
  "personnel-actions.ts exposes the stable DUPLICATE_PRC error code"
);

// ── Assertion 9: createPersonnelAction returns PersonnelActionResult on duplicate PRC, never throws that code ──
assert(
  /return\s*\{\s*success:\s*false\s*,\s*error:\s*"DUPLICATE_PRC"\s*\}/.test(createBody),
  "createPersonnelAction returns { success: false, error: 'DUPLICATE_PRC' } on unique-violation"
);
assert(
  !/throw\s+new\s+Error\s*\(\s*"DUPLICATE_PRC"\s*\)/.test(createBody),
  "createPersonnelAction never throws DUPLICATE_PRC as an Error"
);

// ── Assertion 10: updatePersonnelAction returns PersonnelActionResult on duplicate PRC, never throws that code ──
assert(
  /return\s*\{\s*success:\s*false\s*,\s*error:\s*"DUPLICATE_PRC"\s*\}/.test(updateBody),
  "updatePersonnelAction returns { success: false, error: 'DUPLICATE_PRC' } on unique-violation"
);
assert(
  !/throw\s+new\s+Error\s*\(\s*"DUPLICATE_PRC"\s*\)/.test(updateBody),
  "updatePersonnelAction never throws DUPLICATE_PRC as an Error"
);

// ── Assertion 11: PersonnelForm maps DUPLICATE_PRC to the prcLicenseNumber field error ──
assert(
  /"DUPLICATE_PRC"/.test(personnelFormSource),
  "PersonnelForm checks for the DUPLICATE_PRC result code"
);
assert(
  /setError\s*\(\s*"prcLicenseNumber"\s*,\s*\{[^}]*type:\s*"manual"/.test(personnelFormSource),
  "PersonnelForm maps DUPLICATE_PRC to setError('prcLicenseNumber', { type: 'manual', ... })"
);
assert(
  /That PRC licence number is already registered/.test(personnelFormSource),
  "PersonnelForm displays the user-facing PRC duplicate message"
);

process.stdout.write("\nPersonnel directory verification passed: all 11 assertions verified.\n");
