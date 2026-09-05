/**
 * UX-10M6S3 - the Workspace signatory client boundary.
 *
 * The invariant under test has two halves, and they must be proven separately because a change
 * satisfying one can silently break the other:
 *
 *   1. INBOUND  - no signature reference reaches client code as selection authority. The
 *      Workspace receives `WorkspacePersonnelEntry`, not `IPersonnel`, and composes
 *      `WorkspaceSignatorySelection`, not a full `SignatorySnapshot`.
 *   2. OUTBOUND - the reference the browser still needs in order to *paint* a preview arrives on
 *      a separate render-only channel that nothing reads back into state, storage or mutation.
 *
 * The second half is why this is not simply "delete the field". A verifier that only asserted
 * absence would pass an implementation that had also silently stopped rendering draft signatures,
 * so the behavioural assertions below require a real image to still resolve - from the override
 * when supplied, and from the frozen snapshot when it is not.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import { suggestedSignatoryProvider } from "../src/services/suggested-signatory-provider";
import { toSessionTransport } from "../src/features/server-boundary/session-transport";
import {
  resolveDraftSessionRenderModel,
  resolveCompletedSessionRenderModel,
} from "../src/rendering/model/render-model-adapters";
import type { WorkspacePersonnelEntry } from "../src/features/workspace/signatory-contracts";
import type { ILaboratoryReport, IPatientReportSession } from "../src/domain/models/interfaces";
import type { CompletedSessionSnapshot } from "../src/domain/completion/completed-snapshot";
import type { PatientDemographics, SignatorySnapshot } from "../src/domain/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Workspace signatory boundary verification failed: ${message}`);
  process.stdout.write(`✓ ${message}\n`);
}

const root = join(__dirname, "..");
const getSource = (relativePath: string): string => readFileSync(join(root, relativePath), "utf-8");

/** Strip doc comments, so a file explaining why an identifier is banned does not fail on it. */
const withoutComments = (source: string): string => source.replace(/\/\*\*[\s\S]*?\*\//g, "");

/**
 * Strip EVERY comment form, for the assertions that COUNT occurrences rather than ban them.
 *
 * `withoutComments` above is deliberately narrow: a ban assertion only needs the explanatory doc
 * block removed. A count is different - a `//` comment naming the call is indistinguishable from
 * the call itself to a raw `match`, so removing the executable line and leaving the comment keeps
 * the count correct while the guard is gone.
 *
 * Scanned character by character rather than pattern-replaced: a line-comment regex would take the
 * whole line including any code before the `//`, and would also fire on the `//` inside a URL
 * literal - and this handler composes signature-proxy addresses.
 */
const withoutAnyComment = (source: string): string => {
  let result = "";
  let inString = false;
  let stringChar = "";
  let escaped = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (inString) {
      result += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === stringChar) inString = false;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      stringChar = char;
      result += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      result += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i++;
      continue;
    }
    result += char;
  }
  return result;
};

/* ------------------------------------------------------------------ sentinels */

// Distinct on purpose. "The frozen value survived" and "the override was applied" are different
// guarantees; one sentinel could not tell a correct override from a leaked snapshot value.
// A stored proxy URL, i.e. one embedding a storage object path. This is the exact shape that
// must never appear in a client payload - not under `signatureImageUrl`, and not renamed.
const STORED_URL_SENTINEL = "/api/signatures/proxy?path=RENDER-ONLY-OVERRIDE.png";
const FROZEN_SENTINEL = "/api/signatures/proxy?path=FROZEN-IN-SNAPSHOT.png";

/* ------------------------------------------------------------------ fixtures */

const directoryEntry = (
  id: string,
  role: WorkspacePersonnelEntry["role"],
  hasSignature: boolean
): WorkspacePersonnelEntry => ({
  id,
  firstName: "FIXTURE",
  lastName: role.toUpperCase(),
  middleInitial: null,
  credentials: role === "Pathologist" ? "MD" : "RMT",
  prcLicenseNumber: `PRC-${id}`,
  role,
  isActive: true,
  hasSignature,
});

const demographics = {
  patientFullName: "BOUNDARY, FIXTURE",
  age: "40",
  sex: "Female",
  dateRequested: "2026-08-30",
} as unknown as PatientDemographics;

function draftSessionWith(signatories: SignatorySnapshot[]): IPatientReportSession {
  const definition = ReportDefinitionRegistry.getDefinition("CBC")!;
  const report = {
    id: "report-1",
    sessionId: "session-1",
    templateCode: definition.templateCode,
    templateTitle: definition.reportTitle ?? "CBC",
    rendererFamily: definition.rendererFamily,
    reagentKitInfo: null,
    remarks: null,
    results: [],
    signatories,
  } as unknown as ILaboratoryReport;

  return {
    id: "session-1",
    accessionNumber: null,
    status: "Draft",
    demographics,
    reports: [report],
    createdAt: "2026-08-30T00:00:00.000Z",
    completedAt: null,
    expiresAt: null,
    completedSnapshot: null,
  } as unknown as IPatientReportSession;
}

const pathologistSlot = (model: ReturnType<typeof resolveDraftSessionRenderModel>) =>
  model.reports[0].signatories.find((slot) => slot.personnelRole === "Pathologist");

async function main(): Promise<void> {
  /* ============================================================ 1. inbound: the contracts */

  const contractsSource = getSource("src/features/workspace/signatory-contracts.ts");

  // The interface bodies only. The file's doc comments name the forbidden identifier while
  // explaining why it is forbidden, and a whole-file negative would fail on the explanation.
  const entryInterface =
    contractsSource.match(/export interface WorkspacePersonnelEntry \{[\s\S]*?\n\}/)?.[0] || "";
  const selectionInterface =
    contractsSource.match(/export interface WorkspaceSignatorySelection \{[\s\S]*?\n\}/)?.[0] || "";

  assert(entryInterface.length > 0, "WorkspacePersonnelEntry is declared and locatable");
  assert(selectionInterface.length > 0, "WorkspaceSignatorySelection is declared and locatable");
  assert(
    !/signatureImageUrl/.test(entryInterface),
    "WorkspacePersonnelEntry declares no signatureImageUrl field"
  );
  assert(
    /\bhasSignature\s*:\s*boolean\s*;/.test(entryInterface),
    "WorkspacePersonnelEntry carries the server-derived hasSignature boolean instead"
  );
  assert(
    !/signatureImageUrl/.test(selectionInterface),
    "WorkspaceSignatorySelection declares no signatureImageUrl field"
  );
  assert(
    /personnelId\s*:\s*string\s*;/.test(selectionInterface),
    "WorkspaceSignatorySelection carries the personnelId the server resolves from"
  );

  /* ============================================================ 2. inbound: the projection */

  const actionSource = getSource("src/app/(dashboard)/workspace/_actions/workspace-personnel-actions.ts");
  const toWorkspaceEntryBody = actionSource.match(/function toWorkspaceEntry\([\s\S]*?\n\}/)?.[0] || "";

  assert(
    toWorkspaceEntryBody.length > 0,
    "workspace-personnel-actions.ts declares the toWorkspaceEntry projection"
  );
  assert(
    /hasSignature:\s*Boolean\(\s*person\.signatureImageUrl\s*\)/.test(toWorkspaceEntryBody),
    "toWorkspaceEntry derives hasSignature from the stored reference server-side"
  );
  assert(
    !/\.\.\.\s*person/.test(toWorkspaceEntryBody),
    "toWorkspaceEntry projects field by field and never spreads the personnel record"
  );
  assert(
    /^"use server";/.test(actionSource) && /import "server-only";/.test(actionSource),
    "the workspace personnel action is server-only"
  );

  // Authorization must be DELEGATED, not restated: a second copy of the guard is a second thing
  // to drift. These two assert the delegation is real rather than decorative.
  assert(
    /const personnel = await listActivePersonnelAction\(\);/.test(actionSource),
    "listWorkspacePersonnelAction delegates authorization to the pinned listActivePersonnelAction"
  );
  assert(
    !/getSession|requireOperationalCaller|requirePersonnelReader/.test(withoutComments(actionSource)),
    "listWorkspacePersonnelAction reimplements no caller guard of its own"
  );

  // UX-10M6S3-R1. The action used to return a `signatureAssets` map whose values were each
  // record's stored `signatureImageUrl` - `/api/signatures/proxy?path=<storage object path>`.
  // Withholding the field from the DTO while shipping the same string under another name only
  // renamed the leak, so the map is gone from the server contract entirely.
  const actionCode = withoutComments(actionSource);
  assert(
    !/signatureAssets/.test(actionCode),
    "the workspace personnel action returns no signature asset map"
  );
  assert(
    !/signatureImageUrl/.test(
      actionCode.replace(/hasSignature:\s*Boolean\([^)]*\)/g, "")
    ),
    "the workspace personnel action reads the stored reference only to derive hasSignature"
  );
  assert(
    /return \{ personnel: personnel\.map\(toWorkspaceEntry\) \};/.test(actionCode),
    "the workspace personnel action returns the projected roster and nothing else"
  );

  // The contract itself must not re-admit an asset map on the server response.
  const directoryInterface =
    contractsSource.match(/export interface WorkspacePersonnelDirectory \{[\s\S]*?\n\}/)?.[0] || "";
  assert(directoryInterface.length > 0, "WorkspacePersonnelDirectory is declared and locatable");
  assert(
    !/signatureAssets|signatureImageUrl|proxy\?path/.test(directoryInterface),
    "WorkspacePersonnelDirectory carries no signature asset channel"
  );

  // A renamed property is the failure mode this whole slice exists to close, so the check is on
  // the VALUE shape - a stored proxy URL embedding an object path - not on any field name.
  assert(
    !/proxy\?path=|signatures\/proxy\?path/.test(actionCode),
    "no stored proxy path is emitted by the workspace personnel action under any name"
  );

  /* ============================================================ 3. inbound: client code */

  for (const [label, relativePath] of [
    ["GuidedWorkspace", "src/app/(dashboard)/workspace/_components/GuidedWorkspace.tsx"],
    ["SignatorySelectionSection", "src/app/(dashboard)/workspace/_components/SignatorySelectionSection.tsx"],
    ["EncodingReportFooter", "src/app/(dashboard)/workspace/_components/EncodingReportFooter.tsx"],
    ["SuggestedSignatoryProvider", "src/services/suggested-signatory-provider.ts"],
  ] as const) {
    const clientSource = withoutComments(getSource(relativePath));
    assert(
      !/signatureImageUrl/.test(clientSource),
      `${label} names no signatureImageUrl outside its own explanation`
    );
    assert(
      !/\bIPersonnel\b/.test(clientSource),
      `${label} does not use IPersonnel, the type that carries the reference`
    );
  }

  /* ============================================================ 3b. draft render address */

  // The Workspace composes its own render addresses. `personnelId` names WHO; the stored URL
  // names WHERE, and only the server may hold that.
  const workspaceCode = withoutComments(getSource("src/app/(dashboard)/workspace/_components/GuidedWorkspace.tsx"));
  assert(
    /\/api\/signatures\/proxy\?personnelId=\$\{encodeURIComponent\(person\.id\)\}/.test(
      workspaceCode
    ),
    "the Workspace derives each draft signature address from a personnel id"
  );
  assert(
    !/proxy\?path=/.test(workspaceCode),
    "the Workspace composes no path-bearing signature address"
  );
  assert(
    !/signatureAssets\s*=\s*directory|directory\.signatureAssets|initialSignatureAssets/.test(
      workspaceCode
    ),
    "the Workspace receives no signature asset map from the server"
  );
  // Only an active Pathologist who actually holds a signature earns an address.
  assert(
    /person\.role === "Pathologist" && person\.isActive && person\.hasSignature/.test(
      workspaceCode
    ),
    "a draft signature address is derived only for an active Pathologist with a signature on file"
  );

  // And the endpoint must genuinely resolve the path server-side rather than echo one back.
  const proxyRoute = getSource("src/app/api/signatures/proxy/route.ts");
  assert(
    /searchParams\.get\("personnelId"\)/.test(proxyRoute),
    "the signature proxy accepts a personnelId address"
  );
  assert(
    /personnelRepo\.findById\(\s*\w+\s*\)/.test(proxyRoute) &&
      /searchParams\.get\("personnelId"\)/.test(proxyRoute),
    "the signature proxy resolves the personnel record server-side from the requested id"
  );
  assert(
    /person\.role !== "Pathologist"[\s\S]{0,120}?!person\.isActive[\s\S]{0,120}?!person\.signatureImageUrl/.test(
      proxyRoute
    ),
    "the personnelId mode requires an active Pathologist holding a signature"
  );
  assert(
    /path && !personnelId && !reportId/.test(proxyRoute) &&
      /personnelId && reportId && !path/.test(proxyRoute) &&
      /personnelId && !reportId && !path/.test(proxyRoute),
    "each signature proxy mode requires the other address identifiers to be absent"
  );
  assert(
    /if \(!mode\)[\s\S]{0,500}?status: 400/.test(proxyRoute),
    "the signature proxy refuses any mixed or unrecognised address with 400"
  );
  // The bytes are the response. No branch may hand back the resolved path or the stored URL.
  assert(
    !/NextResponse\.json\([^)]*(resolvedPath|signatureImageUrl)/.test(proxyRoute),
    "the signature proxy never returns the resolved object path or the stored reference"
  );

  /* ============================================================ 4. inbound: behaviour */

  const roster = [
    directoryEntry("path-1", "Pathologist", true),
    directoryEntry("mt-1", "MedicalTechnologist", false),
  ];
  const suggestions = suggestedSignatoryProvider.getSuggestedSignatories("CBC", 1, 1, roster);

  assert(suggestions.length === 2, "the provider still suggests one signatory per required slot");
  assert(
    suggestions.every((item) => !("signatureImageUrl" in item)),
    "no suggested signatory carries a signatureImageUrl key at runtime"
  );
  assert(
    suggestions[0].personnelId === "path-1" && suggestions[0].printedCredentials === "MD",
    "the provider still projects the identity and printed facts a report needs"
  );

  /* ============================================================ 5. inbound: mutation input */

  const { parseSessionMutationInput } = await import("../src/features/server-boundary/action-inputs");
  const forged = {
    session: {
      id: "session-1",
      accessionNumber: null,
      status: "Draft",
      demographics: { patientFullName: "X" },
      createdAt: "2026-08-30T00:00:00.000Z",
      reports: [
        {
          id: "r1",
          sessionId: "session-1",
          templateCode: "CBC",
          templateTitle: "CBC",
          rendererFamily: "Standard",
          results: [],
          signatories: [
            {
              personnelId: "path-1",
              role: "Pathologist",
              printedFullName: "F P",
              printedCredentials: "MD",
              printedPrcLicenseNumber: "PRC-1",
              displayOrder: 1,
              signatureImageUrl: STORED_URL_SENTINEL,
            },
          ],
        },
      ],
    },
  };
  const parsed = parseSessionMutationInput(forged);
  const parsedSignatory = parsed.reports[0].signatories[0] as unknown as Record<string, unknown>;

  assert(
    !("signatureImageUrl" in parsedSignatory),
    "a client-supplied signatureImageUrl is dropped by the mutation input schema"
  );
  assert(
    parsedSignatory.personnelId === "path-1" && parsedSignatory.displayOrder === 1,
    "the identity fields the server resolves from survive parsing intact"
  );

  /* ============================================================ 6. outbound: recovery */

  const recoverySource = getSource("src/features/workspace/workspace-recovery.ts");
  assert(
    /delete \(signatory as \{ signatureImageUrl\?: unknown \}\)\.signatureImageUrl;/.test(recoverySource),
    "recovery strips any signature reference before writing to sessionStorage"
  );
  assert(
    /session: withoutSignatureReferences\(payload\.session\)/.test(recoverySource),
    "the recovery write path actually applies the strip"
  );

  /* ============================================================ 7. outbound: draft rendering */

  // A draft whose signatories carry no reference at all - the shape the Workspace now produces.
  const withoutReference = draftSessionWith([
    {
      personnelId: "path-1",
      role: "Pathologist",
      printedFullName: "FIXTURE PATHOLOGIST",
      printedCredentials: "MD",
      printedPrcLicenseNumber: "PRC-1",
      displayOrder: 1,
    } as unknown as SignatorySnapshot,
  ]);

  const withoutOverride = pathologistSlot(resolveDraftSessionRenderModel(withoutReference));
  assert(
    withoutOverride?.signatureAsset === null,
    "a draft with no reference and no override resolves to no image"
  );

  const withOverride = pathologistSlot(
    resolveDraftSessionRenderModel(withoutReference, undefined, { "path-1": STORED_URL_SENTINEL })
  );
  assert(
    withOverride?.signatureAsset?.source === STORED_URL_SENTINEL,
    "the render-only override supplies the draft signature the client no longer carries"
  );
  assert(
    withOverride?.signatureAsset?.failurePolicy === "OmitImage",
    "an overridden signature keeps the OmitImage degradation contract"
  );
  assert(
    withOverride?.printedFullName === "FIXTURE PATHOLOGIST",
    "the override changes only the image, never the printed facts"
  );

  // Keyed by personnel id, so a non-matching key must never leak onto a slot.
  const wrongKey = pathologistSlot(
    resolveDraftSessionRenderModel(withoutReference, undefined, { "someone-else": STORED_URL_SENTINEL })
  );
  assert(wrongKey?.signatureAsset === null, "an override keyed to a different person is never applied");

  // The override is sanitized exactly like a transported value; it is not a trusted channel.
  const hostile = pathologistSlot(
    resolveDraftSessionRenderModel(withoutReference, undefined, { "path-1": "javascript:alert(1)" })
  );
  assert(
    hostile?.signatureAsset === null,
    "a hostile override protocol is sanitized to no image, exactly like a transported value"
  );

  /* ============================================================ 8. history stays frozen */

  // The whole reason the override is scoped to the draft path. A completed report must render the
  // signature frozen at ITS completion, never today's personnel.
  const definition = ReportDefinitionRegistry.getDefinition("CBC")!;
  const snapshot = {
    snapshotVersion: 2,
    completedAt: "2026-08-30T01:00:00.000Z",
    demographics,
    reports: [
      {
        templateCode: "CBC",
        templateTitle: definition.reportTitle ?? "CBC",
        rendererFamily: definition.rendererFamily,
        renderContractVersion: definition.renderContract?.renderContractVersion,
        printedTitle: definition.reportTitle ?? null,
        staticContentVersion: definition.renderContract?.staticContentVersion,
        results: [],
        remarks: null,
        reagentKitInfo: null,
        encodingData: null,
        signatories: [
          {
            personnelId: "path-1",
            role: "Pathologist",
            printedFullName: "FIXTURE PATHOLOGIST",
            printedCredentials: "MD",
            printedPrcLicenseNumber: "PRC-1",
            displayOrder: 1,
            signatureImageUrl: FROZEN_SENTINEL,
          },
        ],
      },
    ],
  } as unknown as CompletedSessionSnapshot;

  const completedSlot = resolveCompletedSessionRenderModel(snapshot).reports[0].signatories.find(
    (slot) => slot.personnelRole === "Pathologist"
  );
  assert(
    completedSlot?.signatureAsset?.source === FROZEN_SENTINEL,
    "a completed report still renders the signature frozen in its own snapshot"
  );

  // And structurally cannot be handed an override in the first place.
  const adaptersSource = getSource("src/rendering/model/render-model-adapters.ts");
  const completedResolver =
    adaptersSource.match(/export function resolveCompletedSessionRenderModel\([\s\S]*?\n\}/)?.[0] || "";
  assert(completedResolver.length > 0, "the completed resolver is locatable");
  assert(
    !/signatureAssets/.test(completedResolver),
    "the completed resolver accepts no signature override, so history cannot be redrawn"
  );


  /* ============================================================ 8b. session transport */

  // UX-10 correction round. The personnel directory was only one of the two ways a stored
  // reference reached the Workspace. The other was the SESSION transport, which aliased the full
  // aggregate: every save, completion, replacement and reopen handed back `reports[].signatories`
  // and `completedSnapshot.reports[].signatories`, each carrying the stored
  // `/api/signatures/proxy?path=<storage object path>`.
  //
  // These assertions work on the SERIALIZED transport, not on type declarations, because a
  // TypeScript type erases at runtime and the wire format is what actually crosses.

  const STORED_PATH = "personnel/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.png";
  const STORED_URL = `/api/signatures/proxy?path=${encodeURIComponent(STORED_PATH)}`;

  const frozenSignatory = {
    personnelId: "path-1",
    role: "Pathologist",
    printedFullName: "FIXTURE PATHOLOGIST",
    printedCredentials: "MD",
    printedPrcLicenseNumber: "PRC-1",
    displayOrder: 1,
    signatureImageUrl: STORED_URL,
  } as unknown as SignatorySnapshot;

  const completedSession = {
    id: "session-9",
    accessionNumber: "A-0001",
    status: "Completed",
    demographics,
    createdAt: "2026-08-30T00:00:00.000Z",
    completedAt: "2026-08-30T01:00:00.000Z",
    expiresAt: null,
    reports: [
      {
        id: "report-9",
        sessionId: "session-9",
        templateCode: "CBC",
        templateTitle: "CBC",
        rendererFamily: definition.rendererFamily,
        reagentKitInfo: null,
        remarks: null,
        results: [],
        signatories: [frozenSignatory],
      },
    ],
    completedSnapshot: {
      snapshotVersion: 2,
      completedAt: "2026-08-30T01:00:00.000Z",
      demographics,
      reports: [
        {
          templateCode: "CBC",
          templateTitle: definition.reportTitle ?? "CBC",
          rendererFamily: definition.rendererFamily,
          renderContractVersion: definition.renderContract?.renderContractVersion,
          printedTitle: definition.reportTitle ?? null,
          staticContentVersion: definition.renderContract?.staticContentVersion,
          requestedBy: "",
          additionalFields: {},
          results: [],
          remarks: "",
          reagentKitInfo: null,
          repeatableFindings: {},
          signatories: [frozenSignatory],
        },
      ],
    },
  } as unknown as Parameters<typeof toSessionTransport>[0];

  const transport = toSessionTransport(completedSession);
  const wire = JSON.stringify(transport);

  assert(
    !wire.includes("signatureImageUrl"),
    "case 92 the session transport must not serialize signatureImageUrl anywhere"
  );
  assert(
    !wire.includes("proxy?path=") && !wire.includes(STORED_PATH),
    "case 92 the session transport must not serialize a storage object path under any name"
  );
  // A renamed field is the failure this closes, so the check is on the VALUE, not the key.
  assert(
    !wire.includes(encodeURIComponent(STORED_PATH)),
    "case 92 the session transport must not serialize an encoded storage path either"
  );

  // ...while the frozen signature is still addressable.
  const wireSnapshotSignatory = (
    transport.completedSnapshot as unknown as {
      reports: { signatories: { signatureAddress?: string | null }[] }[];
    }
  ).reports[0].signatories[0];
  assert(
    wireSnapshotSignatory.signatureAddress ===
      "/api/signatures/proxy?reportId=report-9&personnelId=path-1",
    `case 92 a completed snapshot signatory must carry the frozen opaque address (got ${wireSnapshotSignatory.signatureAddress})`
  );
  const wireLiveSignatory = (
    transport.reports as unknown as { signatories: { signatureAddress?: string | null }[] }[]
  )[0].signatories[0];
  assert(
    wireLiveSignatory.signatureAddress ===
      "/api/signatures/proxy?reportId=report-9&personnelId=path-1",
    "case 92 a persisted live signatory must carry the same frozen opaque address"
  );

  // And the renderer resolves it, so a completed report still prints its signature.
  const clientSnapshot = transport.completedSnapshot as unknown as CompletedSessionSnapshot;
  const frozenSlot = resolveCompletedSessionRenderModel(clientSnapshot).reports[0].signatories.find(
    (slot) => slot.personnelRole === "Pathologist"
  );
  assert(
    frozenSlot?.signatureAsset?.source === "/api/signatures/proxy?reportId=report-9&personnelId=path-1",
    "case 92 a completed report still resolves a signature image from the frozen address"
  );

  // A DRAFT gets no address at all: the Workspace derives its own `?personnelId=` address, and a
  // draft signatory has nothing frozen to point at.
  // The draft fixture deliberately still carries a LEGACY stored reference on its signatory -
  // a pre-M6S2 row. Draft report rows have ids, so gating on the id alone would have stamped this
  // with a frozen address and misrepresented live authoring as historical.
  const draftTransport = toSessionTransport({
    ...(completedSession as unknown as Record<string, unknown>),
    status: "Draft",
    accessionNumber: null,
    completedAt: null,
    completedSnapshot: null,
  } as unknown as Parameters<typeof toSessionTransport>[0]);
  const draftWire = JSON.stringify(draftTransport);
  assert(
    !draftWire.includes("signatureImageUrl") && !draftWire.includes("proxy?path="),
    "case 92 a draft transport carries no stored reference either"
  );
  assert(
    !draftWire.includes("signatureAddress") && !draftWire.includes("reportId="),
    "case 92 a draft transport carries no frozen signature address, even from a legacy reference"
  );
  const draftSignatory = (
    draftTransport.reports as unknown as {
      signatories: { signatureAddress?: string | null }[];
    }[]
  )[0].signatories[0];
  assert(
    draftSignatory.signatureAddress === undefined,
    "case 92 a draft signatory has no signatureAddress at all"
  );

  // The proxy must actually implement the frozen address, resolving it from the report's own
  // frozen row rather than from current personnel.
  const proxySource = getSource("src/app/api/signatures/proxy/route.ts");
  assert(
    /searchParams\.get\("reportId"\)/.test(proxySource),
    "case 92 the signature proxy accepts a frozen reportId address"
  );
  assert(
    /from\("report_signatories"\)[\s\S]{0,200}?\.eq\("report_id"/.test(proxySource),
    "case 92 the frozen address resolves from the report's own signatory row"
  );
  // SHADCN-07C1-R1: the proxy resolves the request EXACTLY ONCE and threads that profile onward.
  // It previously re-read the user once per request and once more per denial. React cache() is a
  // per-render memo and is not a dependable dedupe inside a Route Handler, so those were real
  // extra reads. The guard is unchanged - status, role and denial reasons all still derive from a
  // server-resolved profile - so this pins only that one resolution happens and no lookup returns.
  //
  // Counted, not merely detected: a presence test would pass on a handler that resolved twice.
  const proxyHandler =
    /export async function GET\([\s\S]*$/.exec(proxySource)?.[0] ?? "";
  // LIVE calls only. `withoutComments` strips `/** … */` doc blocks alone, so a `//` comment naming
  // the call still counted: removing the executable resolution and leaving such a comment behind
  // kept this at exactly 1. `withoutAnyComment` removes both forms before counting.
  const proxyResolutionCalls = (
    withoutAnyComment(proxyHandler).match(/resolveAuthenticatedRequest\s*\(\s*\)/g) ?? []
  ).length;
  assert(
    proxyHandler.length > 0 && proxyResolutionCalls === 1,
    "case 92 the signature proxy resolves the authenticated request exactly once per operation"
  );
  assert(
    !/getSessionUser\s*\(/.test(proxySource) &&
      !/getSession\s*\(/.test(proxySource) &&
      !/getUserById/.test(proxySource),
    "case 92 the signature proxy performs no second session or user lookup"
  );
  // The denial helper must be handed the profile, never resolve one itself: a lookup there cost an
  // extra read on every denial and could disagree with the row the checks used.
  const emitDenialSource =
    /async function emitDenial\([\s\S]*?\n\}/.exec(proxySource)?.[0] ?? "";
  assert(
    emitDenialSource.length > 0 &&
      /profile\?:/.test(emitDenialSource) &&
      !/resolveAuthenticatedRequest|getSessionUser|getSession\s*\(|getUserById/.test(emitDenialSource),
    "case 92 emitDenial receives the resolved profile and performs no authentication lookup"
  );
  // The declaration above proves the parameter EXISTS; it does not prove any caller passes it. The
  // property that matters is at the call sites: every denial raised after the caller is resolved
  // hands over that same profile, and only the pre-resolution `unauthenticated` denial may omit it
  // - there is no profile to pass at that point.
  // Anchored on `await` so this reads the CALL sites only: the declaration's own parameter list
  // would otherwise match and pass neither branch below.
  const emitDenialCalls = proxySource.match(/await emitDenial\((?:[^()]|\([^()]*\))*\)/g) ?? [];
  assert(
    emitDenialCalls.length === 4 &&
      emitDenialCalls.every(
        (call) => call.endsWith(", session, profile)") || call === 'await emitDenial("unauthenticated")'
      ),
    "case 92 every post-resolution denial is handed the resolved profile, and only the pre-resolution unauthenticated denial omits it"
  );
  assert(
    /profile\.status\s*!==\s*"Active"/.test(proxySource) &&
      /profile\.role\s*!==\s*"Admin"/.test(proxySource) &&
      /profile\.role\s*!==\s*"User"/.test(proxySource),
    "case 92 the signature proxy retains its Active-status and Admin/User role checks"
  );
  assert(
    /identifierAddress:\s*"private, no-store"/.test(proxySource),
    "case 92 an identifier-addressed signature response is never cached"
  );
  assert(
    /objectAddress:\s*"private, max-age=300"/.test(proxySource),
    "case 92 the object-addressed mode keeps its private cache window"
  );

  // Scoped to the branch, not the file. A `no-store` constant declared at the top proves nothing
  // about whether the mutable mode actually applies it, and the mode's error exits were the ones
  // that previously carried no cache directive at all.
  const currentModeBranch =
    /if \(mode === "current"\)[\s\S]*?\n  \}/.exec(proxySource)?.[0] ?? "";
  assert(currentModeBranch.length > 0, "case 92 the current-signature branch is locatable");
  // Every JSON exit routes through the helper, and every one of them names the mutable policy.
  assert(
    !/NextResponse\.json\(/.test(currentModeBranch),
    "case 92 the current-signature branch returns no uncached raw JSON response"
  );
  const branchJsonExits = currentModeBranch.match(/signatureJson\([\s\S]*?\);/g) ?? [];
  assert(
    branchJsonExits.length >= 5,
    `case 92 the current-signature branch must shape every failure exit (found ${branchJsonExits.length})`
  );
  assert(
    branchJsonExits.every((exit) => /"identifierAddress"/.test(exit)),
    "case 92 every failure exit from the current-signature branch is marked no-store"
  );
  assert(
    /CACHE_CONTROL\.identifierAddress/.test(currentModeBranch),
    "case 92 the successful current-signature image response is marked no-store"
  );

  // UX-10SEC-R1. Both identifier modes address `uuid` columns. A non-UUID identifier previously
  // reached Postgres and threw out of the handler as a framework 500 - no no-store, no denial
  // event, and distinguishable from the uniform 404. The shape must be rejected BEFORE any
  // repository or database call.
  const uuidGuardIndex = currentModeBranch.indexOf("UUID_PATTERN.test(subjectPersonnelId)");
  const repositoryCallIndex = currentModeBranch.indexOf("personnelRepo.findById(");
  assert(
    uuidGuardIndex >= 0 && repositoryCallIndex > uuidGuardIndex,
    "case 92 a malformed personnelId is rejected before the repository is queried"
  );
  assert(
    /UUID_PATTERN\s*=\s*\/\^\[0-9a-f\]\{8\}-/.test(proxySource),
    "case 92 the identifier shape is validated against a UUID pattern"
  );

  // UX-10SEC-R1 / R2. `report_signatories` rows are NOT immutable - Replacement Mode deletes and
  // re-inserts them while report ids survive - so the reportId address must not be cached either,
  // and its own identifiers must be shape-checked before the query.
  const frozenModeBranch =
    /if \(mode === "frozen"\)[\s\S]*?\n  \}/.exec(proxySource)?.[0] ?? "";
  assert(frozenModeBranch.length > 0, "case 92 the frozen-signature branch is locatable");
  assert(
    !/max-age/.test(frozenModeBranch) && !/"objectAddress"/.test(frozenModeBranch),
    "case 92 the reportId address is never cached, because replacement rewrites its row"
  );
  const frozenJsonExits = frozenModeBranch.match(/signatureJson\([\s\S]*?\);/g) ?? [];
  assert(
    frozenJsonExits.length >= 4 &&
      frozenJsonExits.every((exit) => /"identifierAddress"/.test(exit)),
    `case 92 every failure exit from the frozen branch is marked no-store (found ${frozenJsonExits.length})`
  );
  assert(
    !/NextResponse\.json\(/.test(frozenModeBranch),
    "case 92 the frozen branch returns no uncached raw JSON response"
  );
  const frozenGuardIndex = frozenModeBranch.indexOf("UUID_PATTERN.test(frozenReportId)");
  const frozenQueryIndex = frozenModeBranch.indexOf('from("report_signatories")');
  assert(
    frozenGuardIndex >= 0 && frozenQueryIndex > frozenGuardIndex,
    "case 92 malformed frozen identifiers are rejected before the database is queried"
  );
  assert(
    /streamSignatureObject\(frozenPath, "identifierAddress"\)/.test(frozenModeBranch),
    "case 92 the successful frozen image response is marked no-store"
  );
  assert(
    !/max-age/.test(currentModeBranch),
    "case 92 the current-signature branch never emits a cacheable response"
  );

  // The storage miss is the case that previously returned a bare 404 with no audit trail.
  const storageMissIndex = currentModeBranch.indexOf('reason === "missing"');
  const missAuditIndex = currentModeBranch.indexOf(
    'emitAssetDenial(profile, "path_not_referenced")',
    storageMissIndex
  );
  const missReturnIndex = currentModeBranch.indexOf("Signature asset not found.", missAuditIndex);
  assert(
    storageMissIndex >= 0 && missAuditIndex > storageMissIndex,
    "case 92 a current-signature storage miss emits the existing denial audit"
  );
  assert(
    missReturnIndex > missAuditIndex,
    "case 92 the storage-miss denial is emitted before the uniform 404 is returned"
  );

  process.stdout.write(
    "\nWorkspace signatory boundary verification passed: all 80 assertions verified.\n"
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
