import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Personnel signature verification failed: ${message}`);
  console.log(`✓ ${message}`);
}

function getSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
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

function extractFunctionBody(source: string, functionName: string): string {
  const pattern = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${functionName}\\(`);
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

function collectAllSrcFiles(): string[] {
  const root = join(process.cwd(), "src");
  const results: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        results.push(relative(process.cwd(), fullPath).replace(/\\/g, "/"));
      }
    }
  }
  walk(root);
  return results;
}

const signatureActionsSource = getSource("src/features/server-boundary/personnel-signature-actions.ts");
const signatureStorageSource = getSource("src/lib/signature-storage.ts");
const proxyRouteSource = getSource("src/app/api/signatures/proxy/route.ts");
const validationsSource = getSource("src/lib/validations/personnelValidation.ts");
const authGuardsSource = getSource("src/lib/auth-guards.ts");
const serverActionsSource = getSource("src/features/server-boundary/server-actions.ts");
const nextConfigSource = getSource("next.config.ts");

// ── Assertion 1: Every signature write action calls requirePersonnelAdmin() before any storage or repository call ──
const uploadBody = extractFunctionBody(signatureActionsSource, "uploadPersonnelSignatureAction");
const removeBody = extractFunctionBody(signatureActionsSource, "removePersonnelSignatureAction");
assert(uploadBody.length > 0, "uploadPersonnelSignatureAction body was extracted from personnel-signature-actions.ts");
assert(removeBody.length > 0, "removePersonnelSignatureAction body was extracted from personnel-signature-actions.ts");
// Stripping removes commented-out code so it cannot satisfy an invocation-ordering check.
const searchableUploadBody = stripComments(uploadBody);
const searchableRemoveBody = stripComments(removeBody);

{
  const adminGuardIndex = searchableUploadBody.search(/await\s+requirePersonnelAdmin\s*\(\s*\)/);
  const repositoryIndex = searchableUploadBody.indexOf("SupabasePersonnelRepository");
  const storageIndex = searchableUploadBody.search(/await\s+uploadSignatureObject\s*\(/);
  assert(
    adminGuardIndex >= 0 && repositoryIndex > adminGuardIndex && storageIndex > adminGuardIndex,
    "uploadPersonnelSignatureAction authorizes Admin before any repository or storage call"
  );
}

{
  const adminGuardIndex = searchableRemoveBody.search(/await\s+requirePersonnelAdmin\s*\(\s*\)/);
  const repositoryIndex = searchableRemoveBody.indexOf("SupabasePersonnelRepository");
  assert(
    adminGuardIndex >= 0 && repositoryIndex > adminGuardIndex,
    "removePersonnelSignatureAction authorizes Admin before repository call"
  );
}

// ── Assertion 2: Upload rejects any role other than Pathologist ──
assert(
  /personnel\.role\s*!==\s*"Pathologist"/.test(uploadBody),
  "uploadPersonnelSignatureAction rejects non-Pathologist roles"
);

// ── Assertion 3: Object path is server-generated; no client-supplied path reaches storage ──
assert(
  /generateSignatureObjectPath\(/.test(uploadBody),
  "uploadPersonnelSignatureAction uses server-generated object path"
);
assert(
  !/parsed\.path\b/.test(uploadBody) && !/input\.path\b/.test(uploadBody),
  "uploadPersonnelSignatureAction never reads a client-supplied path"
);
assert(
  /generateSignatureObjectPath/.test(signatureStorageSource),
  "signature-storage.ts exports generateSignatureObjectPath"
);

// ── Assertion 4: Replacement immutability — the objectPath assignment in upload is unconditional fresh-path generation ──
const objectPathAssignLine = uploadBody.split("\n").find((l) => /objectPath\s*=/.test(l));
assert(
  !!objectPathAssignLine && /generateSignatureObjectPath\(personnel\.id\)/.test(objectPathAssignLine),
  "upload objectPath assignment calls generateSignatureObjectPath(personnel.id)"
);
assert(
  !!objectPathAssignLine && !/\?[^=]|\?\?|\|\||\:\s*`|extractObjectPathFromProxyUrl|previousObjectPath|personnel\.signatureImageUrl/.test(objectPathAssignLine),
  "upload objectPath assignment is unconditional (no ternary/nullish-coalescing/logical-OR/fallback/reuse of previousObjectPath or personnel.signatureImageUrl)"
);
const proxyUrlBuildLine = uploadBody.split("\n").find((l) => l.includes("buildSignatureProxyUrl"));
assert(
  !!proxyUrlBuildLine && /buildSignatureProxyUrl\(objectPath\)/.test(proxyUrlBuildLine),
  "upload action builds proxy URL from the newly generated objectPath, not from personnel.signatureImageUrl"
);
// V1: Pin the assignment line exactly — single clean assignment ending with semicolon
assert(
  !!objectPathAssignLine && /^\s*objectPath\s*=\s*generateSignatureObjectPath\(personnel\.id\)\s*;?\s*$/.test(objectPathAssignLine),
  "upload objectPath assignment is a clean single-statement assignment (no fallback, no conditionals)"
);

// ── Assertion 5: No storage .remove( or .delete( call exists in signature modules ──
assert(
  !/\.remove\(/.test(signatureActionsSource),
  "personnel-signature-actions.ts contains no storage .remove() call"
);
assert(
  !/\.delete\(/.test(signatureActionsSource),
  "personnel-signature-actions.ts contains no .delete() call"
);
assert(
  !/\.remove\(/.test(signatureStorageSource),
  "signature-storage.ts contains no storage .remove() call"
);

// ── Assertion 6: Proxy authenticates session and restricts to Admin or User before storage access ──
{
  // UX-10M6S3-R1 corrected this from a file-position check to a handler-reachability check.
  //
  // It previously compared byte offsets in the whole file: `.from(` had to appear after
  // `getSession()`. That held only while the storage call was written inline inside GET. The
  // route now shares one download helper between its two address modes, and a helper is declared
  // above the handler - so the old check failed on a route whose authorization had, if anything,
  // become stricter. Position in a file was never the property worth pinning.
  //
  // What matters is that no storage access is REACHABLE before the auth chain. Both modes now
  // reach storage only through `streamSignatureObject`, so the check is that every call to it
  // inside GET occurs after the session and role gates.
  const getHandler = /export async function GET\([\s\S]*$/.exec(proxyRouteSource)?.[0] ?? "";
  assert(getHandler.length > 0, "the proxy GET handler is locatable");

  // SHADCN-07C1-R2: the proxy resolves through resolveAuthenticatedRequest() now - one resolution
  // per request instead of a getSession()/getSessionUser() pair, since React cache() is not a
  // dependable dedupe in a Route Handler. Only the spelling of the gate moved; the property pinned
  // below is unchanged and is the one that matters: no storage access is reachable before it.
  // Every index below is taken from ONE comment-free copy, so they share a coordinate space and
  // a commented-out gate cannot set them. Mixing a stripped index with a raw one would compare
  // positions in two different strings, which is worse than not stripping at all.
  const liveGetHandler = stripComments(getHandler);
  const sessionCheckIndex = liveGetHandler.indexOf("resolveAuthenticatedRequest()");
  const roleCheckIndex = liveGetHandler.indexOf('"Admin"') !== -1
    ? liveGetHandler.indexOf('"User"') !== -1
      ? Math.min(liveGetHandler.indexOf('"Admin"'), liveGetHandler.indexOf('"User"'))
      : liveGetHandler.indexOf('"Admin"')
    : -1;
  assert(
    sessionCheckIndex >= 0 && roleCheckIndex >= 0,
    "proxy GET resolves the session and checks the role"
  );

  // Every storage entry point, not just the first: a second mode that reached storage before the
  // gates would be exactly the regression this assertion exists to catch.
  const storageCallIndexes = [
    ...liveGetHandler.matchAll(/streamSignatureObject\(|\.from\(/g),
  ].map((match) => match.index ?? -1);
  assert(storageCallIndexes.length > 0, "proxy GET reaches storage somewhere");
  assert(
    storageCallIndexes.every(
      (index) => index > sessionCheckIndex && index > roleCheckIndex
    ),
    "proxy authenticates session and checks role before storage access"
  );
  // And the shared helper must not be an alternative entry point that skips the gates.
  assert(
    !/export\s+(async\s+)?function\s+streamSignatureObject/.test(proxyRouteSource),
    "the proxy storage helper is module-private and cannot be called around the auth chain"
  );
}

// ── Assertion 7a: Proxy validates path shape via isValidSignatureObjectPath ──
assert(
  /isValidSignatureObjectPath/.test(proxyRouteSource),
  "proxy validates path shape via isValidSignatureObjectPath"
);
assert(
  /SIGNATURE_OBJECT_PATH_PATTERN/.test(signatureStorageSource),
  "signature-storage.ts defines the strict UUID path pattern"
);
assert(
  /\^personnel\\\/\[0-9a-f\]/.test(signatureStorageSource),
  "path pattern enforces lowercase hex UUID format"
);
assert(
  /path_not_referenced/.test(proxyRouteSource),
  "proxy emits path_not_referenced denial for unreferenced paths"
);

// ── Assertion 7b (B6 split): Personnel reference check — proxy queries personnel signature_image_url ──
assert(
  /personnelRepo\.findAll|p\.signatureImageUrl/.test(proxyRouteSource),
  "proxy performs personnel signature reference lookup via SupabasePersonnelRepository"
);

// ── Assertion 7c (B6 split): report_signatories reference check — proxy queries report_signatories.signature_image_url directly ──
assert(
  /\.from\(\s*"report_signatories"\s*\)/.test(proxyRouteSource),
  "proxy queries report_signatories table directly for reference check"
);
assert(
  /\.eq\(\s*"signature_image_url"/.test(proxyRouteSource),
  "proxy performs exact-equality check on report_signatories.signature_image_url"
);
assert(
  !/JSON\.stringify/.test(proxyRouteSource),
  "proxy does not use JSON.stringify substring search for reference checking"
);

// ── Assertion 8: generateSignatureAccessToken no longer exists anywhere in src/ ──
{
  const srcFiles = collectAllSrcFiles();
  let foundIn: string | null = null;
  for (const file of srcFiles) {
    const content = getSource(file);
    if (content.includes("generateSignatureAccessToken")) {
      foundIn = file;
      break;
    }
  }
  assert(
    foundIn === null,
    `generateSignatureAccessToken must not exist in any src/ file${foundIn ? ` (found in ${foundIn})` : ""}`
  );
}

// ── Assertion 9: signatureImageUrl is absent from createPersonnelSchema and updatePersonnelSchema ──
assert(
  !/signatureImageUrl/.test(validationsSource),
  "signatureImageUrl does not appear in any validation schema"
);

// ── Assertion 10: auth-guards.ts still matches its baseline hash ──
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

// ── Assertion 11 (SHOULD-FIX): PNG magic bytes are validated inside validatePngMagicBytes, not just declared as a constant ──
assert(
  /PNG_MAGIC_BYTES/.test(signatureStorageSource),
  "signature-storage.ts defines PNG_MAGIC_BYTES constant"
);
assert(
  /0x89.*0x50.*0x4e.*0x47/.test(signatureStorageSource),
  "PNG magic bytes include the standard PNG header (\\x89PNG)"
);
const validatePngBody = extractFunctionBody(signatureStorageSource, "validatePngMagicBytes");
assert(
  validatePngBody.length > 50,
  "validatePngMagicBytes has a substantive function body (not a no-op)"
);
assert(
  /PNG_MAGIC_BYTES/.test(validatePngBody),
  "validatePngMagicBytes references PNG_MAGIC_BYTES inside its body"
);
assert(
  /\.subarray\(|\.slice\(/.test(validatePngBody) && /\.equals\(|!==|===|\.compare\(/.test(validatePngBody),
  "validatePngMagicBytes reads buffer bytes and performs an equality comparison"
);
assert(
  /throw.*SignatureValidationError/.test(validatePngBody),
  "validatePngMagicBytes throws SignatureValidationError on invalid input"
);

// ── Assertion 12 (SHOULD-FIX): 2 MB size cap is enforced inside validateMaxSize, not just declared as a constant ──
assert(
  /MAX_SIGNATURE_SIZE_BYTES/.test(signatureStorageSource),
  "signature-storage.ts defines MAX_SIGNATURE_SIZE_BYTES constant"
);
assert(
  /2\s*\*\s*1024\s*\*\s*1024/.test(signatureStorageSource),
  "MAX_SIGNATURE_SIZE_BYTES equals 2 MiB"
);
const validateMaxBody = extractFunctionBody(signatureStorageSource, "validateMaxSize");
assert(
  validateMaxBody.length > 50,
  "validateMaxSize has a substantive function body (not a no-op)"
);
assert(
  /MAX_SIGNATURE_SIZE_BYTES/.test(validateMaxBody),
  "validateMaxSize references MAX_SIGNATURE_SIZE_BYTES inside its body"
);
assert(
  /buffer\.length\s*>|\.length\s*>/.test(validateMaxBody),
  "validateMaxSize compares uploaded byte length against the cap"
);
assert(
  /throw.*SignatureValidationError/.test(validateMaxBody),
  "validateMaxSize throws SignatureValidationError for oversize input"
);

// ── Assertion 13 (SHOULD-FIX): No anon client in supabase-server.ts ──
{
  const serverSource = getSource("src/lib/supabase/server.ts");
  assert(
    !/SUPABASE_ANON_KEY|anon_key|createClient.*key.*anon/.test(serverSource),
    "supabase-server.ts does not use an anon/public key for server operations"
  );
  assert(
    /SUPABASE_SECRET_KEY/.test(serverSource),
    "supabase-server.ts uses SUPABASE_SECRET_KEY for server-side operations"
  );
}

// ── Assertion 14 (B3): Server action body size limit configured to accommodate 2 MB PNG base64 ──
assert(
  /serverActions/.test(nextConfigSource),
  "next.config.ts configures serverActions"
);
assert(
  /bodySizeLimit/.test(nextConfigSource),
  "next.config.ts sets serverActions.bodySizeLimit"
);
assert(
  /[\"']3mb[\"']/.test(nextConfigSource),
  "serverActions.bodySizeLimit is set to 3mb (sufficient for 2 MB PNG base64 encoding)"
);

// ── Assertion 15 (SHOULD-FIX): Signature path endpoint uses proxy pattern ──
assert(
  /\/api\/signatures\/proxy\?path=/.test(signatureStorageSource),
  "buildSignatureProxyUrl constructs proxy URL with path parameter"
);

// ── Assertion 16 (V2): uploadSignatureObject invokes validation before storage ──
const uploadSigObjBody = extractFunctionBody(signatureStorageSource, "uploadSignatureObject");
assert(
  uploadSigObjBody.length > 50,
  "uploadSignatureObject has a substantive function body"
);
assert(
  /validatePngMagicBytes\(/.test(uploadSigObjBody),
  "uploadSignatureObject calls validatePngMagicBytes"
);
assert(
  /validateMaxSize\(/.test(uploadSigObjBody),
  "uploadSignatureObject calls validateMaxSize"
);
const valPngIdx = uploadSigObjBody.indexOf("validatePngMagicBytes(");
const valMaxIdx = uploadSigObjBody.indexOf("validateMaxSize(");
const storageUploadIdx = uploadSigObjBody.indexOf(".upload(");
assert(
  valPngIdx > 0 && valMaxIdx > 0 && storageUploadIdx > 0
  && valPngIdx < storageUploadIdx && valMaxIdx < storageUploadIdx,
  "uploadSignatureObject runs validation (PNG + size) before storage .upload()"
);

// ── Assertion 17 (V2): Storage-before-DB ordering — upload, role recheck, then DB update ──
const actionUploadIndex = searchableUploadBody.search(/await\s+uploadSignatureObject\s*\(/);
const roleRecheckIndex = searchableUploadBody.search(
  /const\s+currentPersonnel\s*=\s*await\s+repository\.findById\s*\(/
);
const dbUpdateIndex = searchableUploadBody.search(/await\s+repository\.update\s*\(/);
assert(
  actionUploadIndex > 0 && roleRecheckIndex > 0 && dbUpdateIndex > 0
  && roleRecheckIndex > actionUploadIndex && dbUpdateIndex > roleRecheckIndex,
  "upload action ordering: storage upload → final role recheck → DB pointer update"
);

// ── Assertion 18 (S2): report_signatories lookup errors are handled, not swallowed ──
assert(
  /signatoryError/.test(proxyRouteSource),
  "proxy checks Supabase signatory query error result explicitly"
);
assert(
  /console\.error.*signatories/.test(proxyRouteSource),
  "proxy logs report_signatories lookup errors server-side"
);
assert(
  /500/.test(proxyRouteSource) && /Failed to verify signature reference/.test(proxyRouteSource),
  "proxy returns generic 500 on signatories lookup failure (does not treat as path_not_referenced)"
);

// ── UX-10M6S1: signature action results carry state, not a reference ─────────
// The proxy URL is still generated, still persisted and still the render-time source. What
// changed is that it is no longer handed back to the browser through the action result.

const successUnionMember =
  signatureActionsSource.match(/\|\s*\{\s*success:\s*true;[^}]*\}/)?.[0] || "";
assert(
  successUnionMember.length > 0,
  "SignatureActionResult declares a success member"
);
assert(
  /hasSignature:\s*boolean/.test(successUnionMember),
  "SignatureActionResult success carries the derived hasSignature boolean"
);
assert(
  !/signatureImageUrl/.test(successUnionMember),
  "SignatureActionResult success declares no signatureImageUrl field"
);

const uploadReturn = uploadBody.match(/return \{\s*success:\s*true[^}]*\}/)?.[0] || "";
assert(
  /hasSignature:\s*true/.test(uploadReturn) && !/signatureImageUrl/.test(uploadReturn),
  "upload success returns hasSignature: true and no signature reference"
);

const removeReturn = removeBody.match(/return \{\s*success:\s*true[^}]*\}/)?.[0] || "";
assert(
  /hasSignature:\s*false/.test(removeReturn) && !/signatureImageUrl/.test(removeReturn),
  "removal success returns hasSignature: false and no signature reference"
);

// The server side must be unchanged: the URL is still built, still stored, still read.
assert(
  /repository\.update\(\s*personnel\.id,\s*\{\s*signatureImageUrl:\s*proxyUrl\s*\}\)/.test(
    signatureActionsSource
  ),
  "upload still persists the proxy URL server-side"
);
assert(
  /repository\.update\(\s*personnel\.id,\s*\{\s*signatureImageUrl:\s*null\s*\}\)/.test(
    signatureActionsSource
  ),
  "removal still clears the stored reference server-side"
);


// SHADCN-07C1-R2: both personnel guards resolve the authenticated request EXACTLY ONCE.
//
// React cache() gives reuse within a Server Component render; it is not a dependable dedupe inside
// a Server Action, so the earlier getSession()/getSessionUser() pair could genuinely read the user
// row twice per guard call. The resolution is COUNTED rather than merely detected - a presence test
// would pass just as happily on a guard that resolved twice, which is the defect being corrected.
// The role rules are re-asserted alongside it so a future edit cannot trade authorization for a
// saved query.
// Comment-stripped before any predicate below runs, for the same reason as the directory
// verifier: these are raw-text `test()` calls, and a comment must not be able to satisfy one.
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

process.stdout.write("\nPersonnel signature verification passed: every assertion above succeeded.\n");
