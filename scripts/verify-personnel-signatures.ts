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
  const sessionCheckIndex = proxyRouteSource.indexOf("getSession()");
  const roleCheckIndex = proxyRouteSource.indexOf('"Admin"') !== -1
    ? proxyRouteSource.indexOf('"User"') !== -1
      ? Math.min(proxyRouteSource.indexOf('"Admin"'), proxyRouteSource.indexOf('"User"'))
      : proxyRouteSource.indexOf('"Admin"')
    : -1;
  const storageIndex = proxyRouteSource.indexOf(".from(");
  assert(
    sessionCheckIndex >= 0 && roleCheckIndex >= 0 && storageIndex > sessionCheckIndex && storageIndex > roleCheckIndex,
    "proxy authenticates session and checks role before storage access"
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

const EXPECTED_REQUIRE_OPERATIONAL_CALLER_HASH =
  "76edad60505111ba64c51f6de79a9c9656920f9310c070af27192de9f40cb2bc";
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

process.stdout.write("\nPersonnel signature verification passed: all 47 assertions verified.\n");
