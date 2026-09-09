import { resolveExaminationPhysicianAssignment } from "../src/app/(dashboard)/workspace/_lib/encoding/physician-suggestions";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ReportDefinitionRegistry } from "@/domain/definitions/report-definition-registry";
import { mergePhysicianSuggestions } from "@/app/(dashboard)/workspace/_lib/encoding/physician-suggestions";

/**
 * Requested By is sourced from the managed physician directory.
 *
 * The control used to offer whatever operators had already typed (`listAutoSuggestionsAction`)
 * padded out with the `defaultPhysician` of every report definition. Both are gone: the roster is
 * now the active directory, read through the Workspace's own server-action boundary, narrowed per
 * report by `requestedByPolicy.allowedPhysicians`.
 *
 * Two properties have to survive that change and are what this verifier exists to hold:
 *
 *   1. The read is guarded, and guarded by the ONE guard that admits an ordinary operator. The
 *      Workspace action must delegate to `listActivePhysiciansAction` and must not open a second,
 *      unguarded path by instantiating a repository of its own.
 *   2. The field remains FREE TEXT and OPTIONAL. A directory is a suggestion source; it must never
 *      become a closed select, and a blank Requested By must never be blocked or auto-filled.
 *
 * No sha256 pin here. The modules this covers are expected to keep evolving, and a byte pin would
 * convert every comment edit into a failed gate without protecting anything the assertions below
 * do not already state behaviourally.
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Requested By directory verification failed: ${message}`);
  console.log(`✓ ${message}`);
}

function getSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

/**
 * Assertions below are made against code, not prose. Every one of these modules documents the
 * thing it deliberately does NOT do - the learned suggestion source it dropped, the guard it
 * delegates rather than restates, the administration action it must not call - and a naive
 * substring search would fire on the explanation instead of on a real caller.
 */
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

const SECTION_PATH = "src/app/(dashboard)/workspace/_components/RequestedBySection.tsx";
const ACTION_PATH = "src/app/(dashboard)/workspace/_actions/workspace-physician-actions.ts";
const SUGGESTIONS_PATH = "src/app/(dashboard)/workspace/_lib/encoding/physician-suggestions.ts";

const sectionSource = stripComments(getSource(SECTION_PATH));
const actionSource = stripComments(getSource(ACTION_PATH));
const suggestionsSource = stripComments(getSource(SUGGESTIONS_PATH));

// The comment stripper is a probe, so it is shown to still see code before anything is asserted
// on its output. A stripper that returned nothing would make every negative assertion below pass
// vacuously.
assert(
  /export function mergePhysicianSuggestions\(/.test(suggestionsSource) &&
    /export async function listWorkspacePhysiciansAction\(/.test(actionSource) &&
    /export function RequestedBySection\(/.test(sectionSource),
  "the comment stripper preserves executable source - negative assertions are not vacuous"
);

// --- 1. The learned-suggestion source is gone from the control -------------------------------

assert(
  !/listAutoSuggestionsAction/.test(sectionSource),
  "RequestedBySection no longer reads learned auto-suggestions"
);
assert(
  !/@\/features\/server-boundary\/server-actions/.test(sectionSource),
  "RequestedBySection no longer imports the privileged server-action module directly"
);
assert(
  !/listAutoSuggestionsAction|autoSuggestion|suggestionText/.test(suggestionsSource),
  "the suggestion resolver no longer consults learned operator entries"
);
assert(
  !/defaultPhysician/.test(suggestionsSource),
  "defaultPhysician is no longer harvested as a roster source"
);

// --- 2. The control reads the directory through the Workspace boundary ------------------------

assert(
  /import\s*\{\s*listWorkspacePhysiciansAction\s*\}\s*from\s*"\.\.\/_actions\/workspace-physician-actions"/.test(sectionSource),
  "RequestedBySection imports listWorkspacePhysiciansAction from the Workspace physician boundary"
);
assert(
  /listWorkspacePhysiciansAction\(\)\s*\n?\s*\.then\(/.test(sectionSource),
  "RequestedBySection fetches the directory through listWorkspacePhysiciansAction"
);
assert(
  /\.catch\(\(\)\s*=>\s*\{[\s\S]{0,120}setDirectory\(\[\]\)/.test(sectionSource),
  "a directory outage falls back to an empty roster rather than breaking encoding"
);

// --- 3. The Workspace action delegates its guard and owns no data access ----------------------

assert(
  /^"use server";/m.test(actionSource) && /^import "server-only";/m.test(actionSource),
  "the Workspace physician action is a server action marked server-only"
);
assert(
  /import\s*\{\s*listActivePhysiciansAction\s*\}\s*from\s*"@\/features\/server-boundary\/server-actions"/.test(actionSource) &&
    /await listActivePhysiciansAction\(\)/.test(actionSource),
  "the Workspace physician action delegates to the operational-guarded listActivePhysiciansAction"
);
assert(
  !/listPhysiciansAction|physician-actions/.test(actionSource),
  "the Workspace physician action does not call the Admin/Developer-only physician administration read"
);
assert(
  !/Repository|createClient|supabase/i.test(actionSource),
  "the Workspace physician action instantiates no repository and opens no second data path"
);
assert(
  !/requireOperationalCaller|requirePersonnel|getSessionUser|requireAuth/.test(actionSource),
  "the Workspace physician action restates no guard of its own - authorization is delegated, never copied"
);
assert(
  !/\.\.\.physician|\.\.\.person\b/.test(actionSource) && /physician\.fullName/.test(actionSource),
  "the projection reads fields explicitly and never spreads the authoritative record"
);
const projectedFields = actionSource.match(/physician\.[A-Za-z]+/g) ?? [];
assert(
  projectedFields.length > 0 && projectedFields.every((field) => field === "physician.fullName"),
  "only the display name crosses the boundary - no id, no audit timestamps"
);

// --- 3b. The REGISTERED OPERATIONAL ACTION is itself narrow ----------------------------------
//
// Section 3 proves the wrapper narrows. That is necessary and it is NOT sufficient, and this
// section exists because reading it as sufficient was the actual defect.
//
// Every exported function in `server-actions.ts` is separately registered in the production
// server-action manifest. `listActivePhysiciansAction` is therefore reachable from client code on
// its own - the wrapper is one caller of it, not a gate in front of it. While that action returned
// `IPhysician[]`, complete physician records including the row `id` and the administration
// timestamps were obtainable by any operational caller, and every assertion in section 3 still
// passed, because section 3 only ever looked at the wrapper.
//
// So the assertions below are made against the underlying action's own exported signature and its
// own projection. None of them can be satisfied by anything the wrapper does.

const SERVER_ACTIONS_PATH = "src/features/server-boundary/server-actions.ts";
const PHYSICIAN_ENTRY_PATH = "src/features/physicians/physician-directory-entry.ts";

const serverActionsSource = stripComments(getSource(SERVER_ACTIONS_PATH));
const physicianEntrySource = stripComments(getSource(PHYSICIAN_ENTRY_PATH));

/** Brace-matched body of a declaration, from its first `{`. String literals are skipped. */
function balancedBlock(source: string, header: RegExp): string {
  const match = header.exec(source);
  if (!match) return "";
  const start = source.indexOf("{", match.index);
  if (start < 0) return "";

  let depth = 0;
  let inString = false;
  let stringChar = "";
  let escaped = false;
  for (let i = start; i < source.length; i++) {
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
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  return "";
}

/** Top-level keys of the first object literal returned by `block`, brace-matched, depth 1 only. */
function returnedLiteralKeys(block: string): string[] {
  const literal = balancedBlock(block, /return\s*\{/);
  if (!literal) return [];
  const keys: string[] = [];
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let escaped = false;
  let pending = "";
  for (let i = 0; i < literal.length; i++) {
    const ch = literal[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (inString) {
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inString = true; stringChar = ch; continue; }
    if (ch === "{" || ch === "[" || ch === "(") { depth++; continue; }
    if (ch === "}" || ch === "]" || ch === ")") { depth--; continue; }
    if (depth !== 0) continue;
    if (ch === ":") {
      const key = /([A-Za-z_$][\w$]*)\s*$/.exec(pending)?.[1];
      if (key) keys.push(key);
      pending = "";
      continue;
    }
    if (ch === ",") { pending = ""; continue; }
    pending += ch;
  }
  return keys;
}

// The stripper and both extractors are probes, so each is shown to still see code before any
// negative assertion is made against its output. This is the same fail-closed discipline the
// section above applies to the comment stripper.
assert(
  /export async function listActivePhysiciansAction\(/.test(serverActionsSource) &&
    /export interface WorkspacePhysicianOption \{/.test(physicianEntrySource),
  "the comment stripper preserves the operational action and the Workspace projection type"
);

const operationalPhysicianBody = balancedBlock(
  serverActionsSource,
  /export async function listActivePhysiciansAction\(/
);
assert(
  operationalPhysicianBody.length > 0 &&
    /requireOperationalCaller/.test(operationalPhysicianBody),
  "the body extractor really extracted listActivePhysiciansAction - an empty body would satisfy every negative assertion below"
);

const workspaceOptionProjection = balancedBlock(
  serverActionsSource,
  /function toWorkspacePhysicianOption\(/
);
assert(
  workspaceOptionProjection.length > 0,
  "server-actions.ts declares the toWorkspacePhysicianOption projection"
);
const projectedKeys = returnedLiteralKeys(workspaceOptionProjection);
assert(
  projectedKeys.length > 0,
  "the projected-key extractor really read the projection's returned literal - an empty key list would certify nothing"
);

// The signature itself. This is the assertion a narrowing wrapper cannot satisfy on the action's
// behalf: it is the declared return type of the registered action.
assert(
  /export async function listActivePhysiciansAction\(\): Promise<WorkspacePhysicianOption\[\]>/.test(
    serverActionsSource
  ),
  "the registered operational action is typed to the narrow Workspace projection, not to a domain record"
);
assert(
  !/listActivePhysiciansAction\(\):\s*Promise<IPhysician\[\]>/.test(serverActionsSource),
  "the registered operational action does not return IPhysician[]"
);
assert(
  !/return\s+repository\.findAllActive\(\)/.test(operationalPhysicianBody),
  "the registered operational action never returns the repository result unprojected"
);
assert(
  /toWorkspacePhysicianOption\(/.test(operationalPhysicianBody),
  "the registered operational action projects every record it returns"
);

// Guard, unchanged and unsubstituted. requireOperationalCaller is the only guard admitting an
// ordinary laboratory User; requirePersonnelReader is Admin/Developer only and would silently
// empty the roster for every operator.
const operationalGuardIndex = operationalPhysicianBody.search(
  /await\s+requireOperationalCaller\s*\(\s*\)/
);
assert(
  operationalGuardIndex >= 0 &&
    operationalPhysicianBody.indexOf("SupabasePhysicianRepository") > operationalGuardIndex,
  "the registered operational action authorizes with requireOperationalCaller before touching the repository"
);
assert(
  !/requirePersonnelReader|requirePersonnelAdmin/.test(operationalPhysicianBody),
  "the registered operational action is not downgraded to an Admin/Developer-only guard"
);

// What actually crosses. Exactly the three projected fields, and no identifier or timestamp among
// them - asserted on the returned object literal, so a field added to the projection later fails
// here instead of shipping.
assert(
  JSON.stringify([...projectedKeys].sort()) ===
    JSON.stringify(["assignedTemplateCodes", "defaultTemplateCodes", "fullName"]),
  "the operational projection emits exactly fullName, assignedTemplateCodes and defaultTemplateCodes"
);
assert(
  !/\.\.\.\s*physician\b/.test(workspaceOptionProjection),
  "the operational projection reads fields explicitly and never spreads the authoritative record"
);
for (const forbidden of ["id", "createdAt", "updatedAt"]) {
  assert(
    !projectedKeys.includes(forbidden),
    `the operational projection never emits ${forbidden}`
  );
}

// The projection TYPE is the boundary, so it is pinned too: a field cannot be reintroduced by
// widening the interface either.
const workspaceOptionInterface =
  /export interface WorkspacePhysicianOption \{[\s\S]*?\n\}/.exec(physicianEntrySource)?.[0] ?? "";
assert(
  workspaceOptionInterface.length > 0,
  "WorkspacePhysicianOption is declared and locatable"
);
assert(
  !/\[\s*key\s*:\s*string\s*\]/.test(workspaceOptionInterface),
  "WorkspacePhysicianOption declares no index signature escape hatch"
);
for (const forbidden of ["id", "createdAt", "updatedAt", "isActive"]) {
  assert(
    !new RegExp(`(^|[^A-Za-z])${forbidden}\\s*[?]?\\s*:`).test(workspaceOptionInterface),
    `WorkspacePhysicianOption declares no ${forbidden} field`
  );
}
assert(
  /\bfullName\s*:\s*string\s*;/.test(workspaceOptionInterface) &&
    /\bassignedTemplateCodes\s*:\s*readonly string\[\]\s*;/.test(workspaceOptionInterface) &&
    /\bdefaultTemplateCodes\s*:\s*readonly string\[\]\s*;/.test(workspaceOptionInterface),
  "WorkspacePhysicianOption answers both per-examination questions: which names to suggest, and which is the default"
);

// The wrapper still delegates rather than re-deriving, and adds no second unguarded path for the
// assignment-aware read either.
assert(
  /export async function listWorkspacePhysicianOptionsAction\(\): Promise<WorkspacePhysicianOption\[\]>/.test(
    actionSource
  ) && /return listActivePhysiciansAction\(\)/.test(actionSource),
  "the assignment-aware Workspace read delegates to the same operational-guarded action and re-derives nothing"
);

// --- 4. The control is still free text and still optional -------------------------------------

assert(
  /data-requested-by-section/.test(sectionSource),
  "the section keeps data-requested-by-section"
);
assert(
  /data-requested-by-input/.test(sectionSource),
  "the input keeps data-requested-by-input"
);
assert(
  /data-encoding-input/.test(sectionSource),
  "the input keeps data-encoding-input, which the Tab-navigation collector depends on"
);
assert(
  /type="text"/.test(sectionSource) && /list=\{`\$\{listId\}-options`\}/.test(sectionSource),
  "the control is a free-text input bound to a datalist, which type-filters the roster as the operator types"
);
assert(
  !/<select/.test(sectionSource) && !/<Select/.test(sectionSource),
  "the roster never becomes a closed select"
);
assert(
  /required=\{policy\.isRequired\}/.test(sectionSource) && !/required=\{true\}/.test(sectionSource) && !/\brequired\s*\n/.test(sectionSource),
  "requiredness still comes from the report policy - the directory never makes the field mandatory"
);
assert(
  !/onBlur/.test(sectionSource) && !/value=\{value \|\|/.test(sectionSource) && !/suggestions\[0\]/.test(sectionSource),
  "a blank Requested By is never auto-filled from the roster"
);
assert(
  /fieldSurfaceClassName/.test(sectionSource) && /fieldLabelClassName/.test(sectionSource),
  "the control keeps the shared field surface and label styling"
);

// --- 5. The resolver is pure ------------------------------------------------------------------

assert(
  !/\basync\b|\bawait\b|\bfetch\(|readFileSync|import\s*\(/.test(suggestionsSource),
  "the suggestion merge is pure and I/O-free"
);
assert(
  !/from "@\/features\//.test(suggestionsSource) && !/server-only/.test(suggestionsSource),
  "the suggestion merge reaches no server boundary - the directory arrives as an argument"
);

// --- 6. Behaviour: both restriction branches ---------------------------------------------------

const RALPH = "Dr. Ralph Roland Asperas";
const HEINZ = "Dr. Heinz Roland Asperas";
const FLORICEL = "Dr. Ma. Floricel Dedace-Lagrazon";
const directory = [RALPH, FLORICEL, HEINZ];

const fecalysisPolicy = ReportDefinitionRegistry.getDefinition("FECALYSIS")!.requestedByPolicy;
assert(
  JSON.stringify(fecalysisPolicy.allowedPhysicians) === JSON.stringify([RALPH, HEINZ]),
  "FECALYSIS declares exactly the two Asperas doctors as its allowed physicians"
);
assert(
  fecalysisPolicy.isRequired === false && fecalysisPolicy.isEditable === true,
  "FECALYSIS Requested By remains optional and editable"
);

const restricted = mergePhysicianSuggestions(directory, fecalysisPolicy);
assert(
  JSON.stringify(restricted) === JSON.stringify([RALPH, HEINZ]),
  "a restricted report offers exactly its declared physicians, in declared order"
);
assert(
  !restricted.includes(FLORICEL),
  "a restricted report never offers a directory physician it did not declare"
);
assert(
  directory.includes(FLORICEL),
  "the excluded physician remains in the managed directory for other examinations"
);

const unrestrictedPolicy = ReportDefinitionRegistry.getDefinition("URINALYSIS")!.requestedByPolicy;
assert(
  unrestrictedPolicy.allowedPhysicians === undefined,
  "URINALYSIS declares no physician restriction"
);
assert(
  JSON.stringify(mergePhysicianSuggestions(directory, unrestrictedPolicy)) === JSON.stringify(directory),
  "an unrestricted report offers the full active directory, in directory order"
);
assert(
  JSON.stringify(mergePhysicianSuggestions(directory)) === JSON.stringify(directory) &&
    JSON.stringify(mergePhysicianSuggestions(directory, null)) === JSON.stringify(directory),
  "an absent policy is unrestricted, not empty"
);

// The restriction is matched against the directory, not asserted over it.
assert(
  JSON.stringify(mergePhysicianSuggestions(directory, { allowedPhysicians: ["dr. RALPH roland ASPERAS"] })) ===
    JSON.stringify([RALPH]),
  "a declared physician matches the directory case-insensitively and the directory's spelling wins"
);
assert(
  JSON.stringify(mergePhysicianSuggestions(directory, { allowedPhysicians: ["Dr. Not In Directory", HEINZ] })) ===
    JSON.stringify([HEINZ]),
  "a declared physician absent from the active directory is simply not offered"
);
assert(
  JSON.stringify(mergePhysicianSuggestions([], fecalysisPolicy)) === JSON.stringify([]),
  "an empty directory yields an empty roster - the field still accepts free text"
);
assert(
  JSON.stringify(mergePhysicianSuggestions([RALPH, "  ", "dr. ralph roland asperas", "", HEINZ])) ===
    JSON.stringify([RALPH, HEINZ]),
  "the roster de-duplicates case-insensitively, drops blanks, and keeps stable order"
);


// ── An unassigned physician is offered for NOTHING ──
// The resolver once treated an empty `assignedTemplateCodes` as "suggest everywhere", which
// silently defeated the Administrator's restriction: un-assigning a physician from every
// examination - the natural way to stop offering a doctor without deactivating them - put them
// back on all seventeen, Fecalysis included. The DTO and the directory's "Unassigned" label both
// say the opposite, so the resolver is pinned to agree with them, behaviourally.
{
  const unassigned = { fullName: "Dr. Unassigned", assignedTemplateCodes: [], defaultTemplateCodes: [] };
  const fecalysisOnly = { fullName: "Dr. Fecalysis Only", assignedTemplateCodes: ["FECALYSIS"], defaultTemplateCodes: ["FECALYSIS"] };

  for (const templateCode of ["FECALYSIS", "CBC", "CHEM_8", "URINALYSIS"]) {
    const resolved = resolveExaminationPhysicianAssignment([unassigned, fecalysisOnly], templateCode);
    assert(resolved !== null, `an assignment resolves for ${templateCode} when the roster is read`);
    assert(
      !resolved!.suggestions.includes("Dr. Unassigned"),
      `a physician assigned to no examination is not suggested for ${templateCode} - empty means assigned to nothing, never to everything`
    );
  }

  const fecalysis = resolveExaminationPhysicianAssignment([unassigned, fecalysisOnly], "FECALYSIS")!;
  assert(
    JSON.stringify(fecalysis.suggestions) === JSON.stringify(["Dr. Fecalysis Only"]),
    "only the physicians actually assigned to an examination are offered for it"
  );
  assert(
    fecalysis.initialRequestedBy === "Dr. Fecalysis Only",
    "the default is taken from a physician who is assigned to that examination"
  );
  const cbc = resolveExaminationPhysicianAssignment([unassigned, fecalysisOnly], "CBC")!;
  assert(cbc.suggestions.length === 0, "an examination nobody is assigned to offers nobody");
  assert(cbc.initialRequestedBy === null, "an examination with no assigned default initialises Requested By as blank");
}

process.stdout.write("\nRequested By directory verification passed: every assertion above succeeded.\n");
