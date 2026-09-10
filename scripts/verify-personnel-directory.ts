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

const personnelActionsSource = getSource("src/features/server-boundary/personnel-actions.ts");
const personnelGuardSource = getSource("src/lib/personnel-guard.ts");
const authGuardsSource = getSource("src/lib/auth-guards.ts");
const serverActionsSource = getSource("src/features/server-boundary/server-actions.ts");
const personnelFormSource = getSource("src/app/(app)/personnel/_components/PersonnelForm.tsx");

// ── Assertion 1: Every write action calls requirePersonnelAdmin() before any repository call ──
for (const actionName of [
  "createPersonnelAction",
  "updatePersonnelAction",
  "togglePersonnelStatusAction",
  "deletePersonnelAction",
]) {
  const actionBody = extractFunctionBody(personnelActionsSource, actionName);
  assert(actionBody.length > 0, `${actionName} body was extracted from personnel-actions.ts`);
  // Stripping removes commented-out code so it cannot satisfy an invocation-ordering check.
  const searchableActionBody = stripComments(actionBody);
  const adminGuardIndex = searchableActionBody.search(/await\s+requirePersonnelAdmin\s*\(\s*\)/);
  const repositoryIndex = searchableActionBody.indexOf("SupabasePersonnelRepository");
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

// ── Assertion 3: No direct delete; one audited database deletion (CLINIC-UI-UX-08R1) ──
// By explicit user decision a personnel record may now be permanently deleted - but never by a
// table delete. The actions own no query chain and issue no delete at all; exactly one action
// reaches the repository's deletion, only after the Administrator guard and the strict parse; and
// the repository holds no delete either - it calls `delete_inactive_personnel()`, which re-decides
// inactivity and every report reference and writes the deletion audit in the same transaction.
assert(
  !/\.from\(/.test(personnelActionsSource) && !/\.delete\(/.test(personnelActionsSource),
  "personnel actions own no query chain and issue no direct delete"
);
assert(
  !/\bremove\b/.test(personnelActionsSource),
  "personnel actions contain no remove call"
);
assert(
  !/\bDELETE\s+FROM\b/i.test(personnelActionsSource),
  "personnel actions contain no DELETE FROM statement"
);
const deletePersonnelBody = stripComments(
  extractFunctionBody(personnelActionsSource, "deletePersonnelAction")
);
// Any receiver, on comment-stripped source: a second call through a differently named variable or
// a fresh `new SupabasePersonnelRepository()` must count too.
assert(
  (stripComments(personnelActionsSource).match(/\.deleteInactive\(/g) ?? []).length === 1 &&
    /\brepository\.deleteInactive\(parsed\.id, \{/.test(deletePersonnelBody),
  "exactly one personnel action reaches the repository's deletion, and it is deletePersonnelAction"
);
const deletePersonnelSteps: ReadonlyArray<readonly [string, RegExp]> = [
  ["the Administrator guard", /await\s+requirePersonnelAdmin\s*\(\s*\)/],
  ["the strict id parse", /personnelDeleteSchema\.parse\s*\(\s*input\s*\)/],
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
for (const [step, pattern] of deletePersonnelSteps) {
  const index = deletePersonnelBody.search(pattern);
  assert(
    index > previousDeleteStep,
    `deletePersonnelAction reaches ${step} after every earlier step`
  );
  previousDeleteStep = index;
}
assert(
  !/findById|auditService|\.code === "23503"|catch\s*\(/.test(deletePersonnelBody),
  "deletePersonnelAction decides nothing from a pre-read, catches nothing and writes no audit of its own - the database function re-decides and audits in the deletion's transaction"
);
const personnelRepositoryCode = stripComments(
  getSource("src/repositories/supabase-personnel-repository.ts")
);
assert(
  (personnelRepositoryCode.match(/\.delete\(/g) ?? []).length === 0,
  "the personnel repository exposes no hard-delete path of its own"
);
assert(
  (personnelRepositoryCode.match(/\.rpc\(/g) ?? []).length === 1 &&
    /\.rpc\("delete_inactive_personnel", \{\s*p_personnel_id: id,\s*p_actor_user_id: actor\.userId,\s*p_actor_username: actor\.username,\s*p_actor_role: actor\.role,\s*\}\)/.test(
      personnelRepositoryCode
    ),
  "the personnel repository's one database call is delete_inactive_personnel, carrying only the id and the actor"
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
// Policy reversal: a Medical Technologist may now hold a signature image, so this action must
// no longer clear it for that role. The rule is now stronger, not merely different -
// `updatePersonnelAction` writes `signatureImageUrl` for NO role at all. The column is owned
// exclusively by the upload/remove signature actions, which is what keeps an ordinary profile
// edit incapable of destroying a stored signature or of installing a forged one.
assert(
  !/updates\.signatureImageUrl\s*=/.test(updateBody) &&
    !/signatureImageUrl\s*:/.test(updateBody),
  "updatePersonnelAction never writes signatureImageUrl for any role"
);
assert(
  !/parsed\.signatureImageUrl/.test(updateBody) &&
    !/rawUpdates\.signatureImageUrl/.test(updateBody),
  "updatePersonnelAction never reads signatureImageUrl from parsed client input"
);
assert(
  /key\s*===\s*"signatureImageUrl"\s*\)\s*continue/.test(updateBody),
  "updatePersonnelAction still excludes signatureImageUrl from the audited changedFields"
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
assert(
  !/requirePersonnelReader/.test(deletePersonnelBody),
  "deletePersonnelAction never reuses requirePersonnelReader, which would admit a Developer"
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

// ── Assertion 7: auth-guards.ts matches its committed baseline hash ──
// Pinned to the approved M6 P4 revision (request-scoped auth resolution), normalized CRLF→LF.
const EXPECTED_AUTH_GUARDS_HASH = "73cfc5b7d08c270887147ed021128787635c8b6f553bb5739b6e49a795662856";

const authGuardsHash = sha256(authGuardsSource);
assert(
  authGuardsHash === EXPECTED_AUTH_GUARDS_HASH,
  `auth-guards.ts must match its approved P4 revision (expected ${EXPECTED_AUTH_GUARDS_HASH}, got ${authGuardsHash})`
);

// The server-actions.ts whole-file pin was miscalibrated: unrelated session/workspace changes
// tripped it, and its fail-fast assertion masked later personnel checks. Pin only the personnel boundary.
function extractDeclaredFunction(source: string, declaration: string): string {
  const declarationIndex = source.indexOf(declaration);
  if (declarationIndex < 0) return "";

  const startBrace = source.indexOf("{", declarationIndex);
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
      if (depth === 0) {
        const functionEnd = i + 1;
        return source.slice(
          declarationIndex,
          source[functionEnd] === "\n" ? functionEnd + 1 : functionEnd
        );
      }
    }
  }
  return "";
}

const listActivePersonnelFunction = extractDeclaredFunction(
  serverActionsSource,
  "export async function listActivePersonnelAction"
);
assert(
  listActivePersonnelFunction.length > 0,
  "server-actions.ts exports listActivePersonnelAction"
);
assert(
  /export async function listActivePersonnelAction\(\s*\)/.test(serverActionsSource),
  "listActivePersonnelAction accepts no client-controlled input"
);

const operationalGuardIndex = listActivePersonnelFunction.search(
  /await\s+requireOperationalCaller\s*\(\s*\)/
);
const personnelRepositoryIndex = listActivePersonnelFunction.indexOf("SupabasePersonnelRepository");
assert(
  operationalGuardIndex >= 0 && personnelRepositoryIndex > operationalGuardIndex,
  "listActivePersonnelAction authorizes with requireOperationalCaller before repository access"
);
assert(
  /new\s+SupabasePersonnelRepository\s*\(\s*\)/.test(listActivePersonnelFunction) &&
    /repository\.findAllActive\s*\(\s*\)/.test(listActivePersonnelFunction),
  "listActivePersonnelAction uses SupabasePersonnelRepository.findAllActive()"
);

const listActivePersonnelMethodCalls = Array.from(
  listActivePersonnelFunction.matchAll(/\.([A-Za-z_$][\w$]*)\s*\(/g),
  (match) => match[1]
);
assert(
  listActivePersonnelMethodCalls.length === 1 && listActivePersonnelMethodCalls[0] === "findAllActive",
  "listActivePersonnelAction exposes no write path (its only method call is findAllActive())"
);

const EXPECTED_LIST_ACTIVE_PERSONNEL_HASH =
  "d8ca8901bc617d6737341b18fd60a022c6ea436ea42e994a2cae5de5a5c212a8";
const listActivePersonnelHash = sha256(listActivePersonnelFunction.replace(/\r\n/g, "\n"));
assert(
  listActivePersonnelHash === EXPECTED_LIST_ACTIVE_PERSONNEL_HASH,
  `listActivePersonnelAction must retain its exact body (expected ${EXPECTED_LIST_ACTIVE_PERSONNEL_HASH}, got ${listActivePersonnelHash})`
);

// SHADCN-07C1-R2 approved real-boundary remint: requireOperationalCaller now derives session and
// profile from ONE resolveAuthenticatedRequest() instead of a getSession()/getSessionUser() pair,
// because React cache() is not a dependable dedupe inside a Server Action. The diff was reviewed
// line by line before reminting: only the resolution mechanism moved. Every role check, denial
// reason, audit category/event/actor/target field, thrown error type and returned value is
// untouched, and the structural assertions below continue to prove that independently of the hash.
const EXPECTED_REQUIRE_OPERATIONAL_CALLER_HASH =
  "d0e146f6225daa08e9c26f83505a62fb1fd0be86a746c414b4c7370016e22d26";
const requireOperationalCallerFunction = extractDeclaredFunction(
  serverActionsSource,
  "async function requireOperationalCaller"
);
assert(
  /if\s*\(\s*profile\.role\s*!==\s*"Admin"\s*&&\s*profile\.role\s*!==\s*"User"\s*\)\s*\{/.test(
    requireOperationalCallerFunction
  ),
  "requireOperationalCaller gates callers to exactly Admin or User"
);

// SHADCN-07B2-R2 structural proof, alongside the re-minted hash above. The guard's four DELIBERATE
// refusals now raise the closed OperationalAccessDeniedError instead of a plain Error, so a caller
// can distinguish a refusal from a failed denial-audit write or a Supabase outage WITHOUT catching
// everything. Every condition, audit event, actor/target field and reasonCode is byte-identical -
// only the thrown type changed - so the exact-body pin is re-minted, never relaxed. These
// assertions additionally stop a future edit reintroducing a plain throw the hash alone would
// simply re-pin away.
const deliberateRefusalThrows =
  requireOperationalCallerFunction.match(/throw new [A-Za-z]+/g) ?? [];
assert(
  deliberateRefusalThrows.length === 4 &&
    deliberateRefusalThrows.every(
      (thrown) => thrown === "throw new OperationalAccessDeniedError"
    ),
  "every deliberate requireOperationalCaller refusal throws the closed OperationalAccessDeniedError"
);
for (const detailExpression of [
  'details: { reasonCode: "unauthenticated" },',
  'details: { reasonCode: "first_login_incomplete" },',
  'details: { reasonCode: profile ? "account_inactive" : "unauthenticated" },',
  'details: { reasonCode: "role_not_authorized" },',
]) {
  assert(
    requireOperationalCallerFunction.includes(detailExpression),
    `requireOperationalCaller still records the denial reason ${detailExpression}`
  );
}
const requireOperationalCallerHash = sha256(requireOperationalCallerFunction.replace(/\r\n/g, "\n"));
assert(
  requireOperationalCallerHash === EXPECTED_REQUIRE_OPERATIONAL_CALLER_HASH,
  `requireOperationalCaller must retain its exact operational-role body (expected ${EXPECTED_REQUIRE_OPERATIONAL_CALLER_HASH}, got ${requireOperationalCallerHash})`
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

// ── UX-10M6S1: the client-safe personnel projection ──────────────────────────
// AGENTS.md §7: "Never expose signatureImageUrl to a client schema. Derive a boolean
// server-side." Passing IPersonnel and letting the client compute !!signatureImageUrl
// satisfied the interface but not the rule - the URL still crossed the wire. These
// assertions pin the projection that replaced it.

const directoryEntrySource = getSource("src/features/personnel/personnel-directory-entry.ts");
const personnelDirectoryViewSource = getSource(
  "src/app/(app)/personnel/_components/PersonnelDirectoryView.tsx"
);
const personnelTableSource = getSource("src/app/(app)/personnel/_components/PersonnelTable.tsx");
const personnelFormModalSource = getSource(
  "src/app/(app)/personnel/_components/PersonnelFormModal.tsx"
);
const personnelSignatureFieldSource = getSource(
  "src/app/(app)/personnel/_components/PersonnelSignatureField.tsx"
);

// The interface body only - the file's own doc comment quotes the forbidden identifier while
// explaining why it is forbidden, and a whole-file negative would fail on the explanation.
const directoryEntryInterface =
  directoryEntrySource.match(/export interface PersonnelDirectoryEntry \{[\s\S]*?\n\}/)?.[0] || "";
assert(
  directoryEntryInterface.length > 0,
  "PersonnelDirectoryEntry interface is declared and locatable"
);
assert(
  /\bhasSignature\s*:\s*boolean\s*;/.test(directoryEntryInterface),
  "PersonnelDirectoryEntry carries the server-derived hasSignature boolean"
);
assert(
  !/signatureImageUrl/.test(directoryEntryInterface),
  "PersonnelDirectoryEntry declares no signatureImageUrl field"
);

// The projection must DERIVE the boolean, not receive one. Pinning Boolean(...) over the
// stored reference is what proves the derivation happens on the server side of the boundary.
const toDirectoryEntryBody =
  personnelActionsSource.match(/function toDirectoryEntry\([\s\S]*?\n\}/)?.[0] || "";
assert(
  toDirectoryEntryBody.length > 0,
  "personnel-actions.ts declares the toDirectoryEntry projection"
);
assert(
  /hasSignature:\s*Boolean\(\s*person\.signatureImageUrl\s*\)/.test(toDirectoryEntryBody),
  "toDirectoryEntry derives hasSignature from the stored signature reference server-side"
);
assert(
  !/\.\.\.\s*person/.test(toDirectoryEntryBody),
  "toDirectoryEntry projects field by field and never spreads the personnel record"
);

const listPersonnelBody = extractFunctionBody(personnelActionsSource, "listPersonnelAction");
assert(
  /requirePersonnelReader\(\)/.test(listPersonnelBody),
  "listPersonnelAction still authorizes through requirePersonnelReader"
);
assert(
  listPersonnelBody.indexOf("requirePersonnelReader()") <
    listPersonnelBody.indexOf("SupabasePersonnelRepository"),
  "listPersonnelAction authorizes before touching the repository"
);
assert(
  /\.map\(toDirectoryEntry\)/.test(listPersonnelBody),
  "listPersonnelAction returns projected entries, never raw personnel records"
);
assert(
  /export async function listPersonnelAction\(\): Promise<PersonnelDirectoryEntry\[\]>/.test(
    personnelActionsSource
  ),
  "listPersonnelAction is typed to the client-safe projection"
);

// A mutation result that carries a personnel record carries its signature reference with it.
assert(
  /export type PersonnelActionResult =\s*\|\s*\{ success: true \}/.test(personnelActionsSource),
  "PersonnelActionResult success carries no personnel record"
);
assert(
  !/success:\s*true,\s*data:/.test(personnelActionsSource),
  "no personnel action returns a personnel record on success"
);
assert(
  /export async function togglePersonnelStatusAction\(input: unknown\): Promise<void>/.test(
    personnelActionsSource
  ),
  "togglePersonnelStatusAction returns no personnel record to the client"
);

// The client half of the boundary. IPersonnel is the type that carries the URL, so a client
// component naming either identifier has re-opened the path this slice closed.
for (const [label, clientSource] of [
  ["PersonnelDirectoryView", personnelDirectoryViewSource],
  ["PersonnelTable", personnelTableSource],
  ["PersonnelFormModal", personnelFormModalSource],
  ["PersonnelForm", personnelFormSource],
  ["PersonnelSignatureField", personnelSignatureFieldSource],
] as const) {
  assert(
    !/signatureImageUrl/.test(clientSource),
    `${label} names no signatureImageUrl`
  );
  assert(
    !/\bIPersonnel\b/.test(clientSource),
    `${label} does not use the IPersonnel type, which carries the signature reference`
  );
}
assert(
  /hasSignature/.test(personnelSignatureFieldSource),
  "PersonnelSignatureField drives its state from the derived boolean"
);


// SHADCN-07C1-R2: both personnel guards resolve the authenticated request EXACTLY ONCE.
//
// React cache() gives reuse within a Server Component render; it is not a dependable dedupe inside
// a Server Action, so the earlier getSession()/getSessionUser() pair could genuinely read the user
// row twice per guard call. The resolution is COUNTED rather than merely detected - a presence test
// would pass just as happily on a guard that resolved twice, which is the defect being corrected.
// The role rules are re-asserted alongside it so a future edit cannot trade authorization for a
// saved query.
// Comment-stripped before any predicate below runs. These are raw-text `test()` calls, so a
// comment mentioning resolveAuthenticatedRequest(), a role rule or a denial event would satisfy
// them while the executable guard no longer did - the assertions would pass on prose.
const personnelGuardSourceForResolution = stripComments(getSource("src/lib/personnel-guard.ts"));
// Real RegExp values, not strings reconstructed at runtime. The previous form wrapped each rule in
// literal slashes and stripped them with slice(1, -1) before new RegExp() - fragile, and it left the
// dot in `profile.role` as a wildcard that would have matched `profileXrole`. These are escaped
// literals in genuine regex literals, so the rule they pin is the rule they read.
// Terminated at the closing `) {`, so each rule pins the WHOLE condition rather than a prefix of
// it. Unanchored, `requirePersonnelAdmin`'s rule was a substring of
// `profile.role !== "Admin" && profile.role !== "Developer"`, so widening that guard to admit
// another role would have satisfied the assertion that exists to forbid exactly that.
const guardContracts: Array<[string, RegExp]> = [
  [
    "requirePersonnelReader",
    /profile\.role\s*!==\s*"Admin"\s*&&\s*profile\.role\s*!==\s*"Developer"\s*\)\s*\{/,
  ],
  [
    "requirePersonnelAdmin",
    /profile\.role\s*!==\s*"Admin"\s*\)\s*\{/,
  ],
];
for (const [guardName, roleRule] of guardContracts) {
  const declaration = `export async function ${guardName}(`;
  const start = personnelGuardSourceForResolution.indexOf(declaration);
  assert(start >= 0, `${guardName} is declared in personnel-guard.ts`);
  // Bounded by the guard's OWN body, brace-matched. Ending the slice at the next
  // `\nexport async function` left the LAST exported guard unbounded - that search returns -1
  // there, so the slice ran to end of file and the positive role, status and denial-event
  // predicates below could be satisfied by code belonging to something else.
  const guardSource = extractDeclaredFunction(personnelGuardSourceForResolution, declaration);
  assert(guardSource.length > 0, `${guardName} body region is non-empty`);

  const resolutionCalls = (
    guardSource.match(/resolveAuthenticatedRequest\s*\(\s*\)/g) ?? []
  ).length;
  assert(
    resolutionCalls === 1,
    `${guardName} resolves the authenticated request exactly once per invocation`
  );
  assert(
    roleRule.test(guardSource),
    `${guardName} retains its role rule unchanged`
  );
  assert(
    /profile\.status !== "Active"/.test(guardSource) &&
      /session\.mustChangePassword \|\| session\.mustSetRecovery/.test(guardSource) &&
      /eventType: "PersonnelDirectoryAccessDenied"/.test(guardSource),
    `${guardName} retains its Active-status, first-login and denial-event behaviour`
  );
}
assert(
  !/getSessionUser\s*\(/.test(personnelGuardSourceForResolution) &&
    !/getSession\s*\(/.test(personnelGuardSourceForResolution) &&
    !/getUserById/.test(personnelGuardSourceForResolution),
  "the personnel guards perform no second session or user lookup"
);

process.stdout.write("\nPersonnel directory verification passed: every assertion above succeeded.\n");
