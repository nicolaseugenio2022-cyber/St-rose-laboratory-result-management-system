/**
 * Medical Technologist signature support — end-to-end lifecycle verification.
 *
 * THE RULE THIS FILE ENCODES
 * --------------------------
 * The laboratory previously required that a Medical Technologist be textual only: no MedTech
 * signature image was ever created, by rule. That policy is REVERSED. A Medical Technologist may
 * now hold a signature image, and where one is on file it must print in the report's signature
 * block, on exactly the same terms as a Pathologist's.
 *
 * A reversal like this is dangerous in one specific way: the easiest way to make a MedTech
 * signature appear is to loosen the rails that kept a signature reference trustworthy. So this
 * file proves BOTH halves. The new capability works, and none of the following gave way:
 *
 *   - the authoritative reference is read server-side from the personnel record, never from the
 *     client transport, for a MedTech exactly as for a Pathologist;
 *   - every signature source is sanitized identically regardless of role;
 *   - a completed report renders from its OWN frozen snapshot and is never redrawn from today's
 *     personnel, so yesterday's textual MedTech column stays textual forever;
 *   - a stored signature reference still never reaches a client-facing shape.
 *
 * Assertions are behavioural: real resolution, a real domain completion, a real render model and
 * the real page composition. The few source-text assertions are individually justified in place,
 * each where behaviour genuinely cannot express the rule from a headless script.
 *
 * No SHA-256 pin. This file asserts behaviour, not bytes.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import { PatientReportSessionAggregate } from "../src/domain/models/patient-report-session-aggregate";
import { LaboratoryReportDomain } from "../src/domain/models/laboratory-report-domain";
import {
  applyEncodingResultValue,
  buildEncodingReport,
} from "../src/app/(dashboard)/workspace/_lib/encoding/report-encoding";
import type {
  ILaboratoryReport,
  IPatientReportSession,
  IPersonnel,
} from "../src/domain/models/interfaces";
import type {
  PatientDemographics,
  RendererFamily,
  SignatorySnapshot,
} from "../src/domain/types";
import type {
  ClinicalReportDefinition,
  ParameterSpec,
} from "../src/domain/types/report-definition";
import { ValidationError } from "../src/lib/errors";
import {
  applyResolvedSignatories,
  resolveSignatoriesForPersistence,
  type PersonnelLookup,
} from "../src/features/server-boundary/signatory-resolution";
import { toSessionTransport, type ClientSignatory } from "../src/features/server-boundary/session-transport";
import type { PersonnelDirectoryEntry } from "../src/features/personnel/personnel-directory-entry";
import type {
  WorkspacePersonnelEntry,
  WorkspaceSignatorySelection,
} from "../src/features/workspace/signatory-contracts";
import {
  resolveDraftSessionRenderModel,
  resolveSessionRenderModel,
  type ResolvedReportRenderModel,
  type ResolvedSignatorySlot,
} from "../src/rendering/model";
import { composeNativeLivePreviewReportPage } from "../src/rendering/native/live-preview-composer";
import type {
  NativeComposedPage,
  NativeImagePrimitive,
  NativeTextPrimitive,
} from "../src/rendering/native/types";

/**
 * `true` when a type can express a stored signature reference at all.
 *
 * Used only at compile time. The absence of a field from a contract is not observable at runtime -
 * a shape that can never carry the reference and a shape that merely happens not to today
 * serialize identically - so this is one of the two rules in this file that behaviour genuinely
 * cannot express, and it is checked by `tsc` instead.
 */
type CanExpressSignatureReference<T> = "signatureImageUrl" extends keyof T ? true : false;

/* ------------------------------------------------------------------ house assert */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    process.stderr.write(`\nMedTech signature lifecycle verification FAILED: ${message}\n`);
    process.exit(1);
  }
  process.stdout.write(`✓ ${message}\n`);
}

/**
 * A fixture precondition, not an assertion about the laboratory's rules. It fails just as hard,
 * but it is not logged as a `✓` - a missing fixture primitive proves nothing about the system.
 */
function required<T>(value: T | undefined | null, message: string): T {
  if (value === undefined || value === null) {
    process.stderr.write(`\nMedTech signature lifecycle verification FAILED: ${message}\n`);
    process.exit(1);
  }
  return value;
}

/* ------------------------------------------------------------------ sentinels
 *
 * Four mutually distinct values. Distinctness is the whole point: an assertion that only checked
 * "a reference arrived" would pass a resolver that let the client value through, and an assertion
 * that only checked "not null" would pass a resolver that copied the Pathologist's reference onto
 * every signatory. Each sentinel names exactly one origin, so every outcome is attributable.
 */

/** What a compromised or stale browser sends for the Pathologist. Must never survive. */
const CLIENT_FORGERY_PATHOLOGIST: string = "/api/signatures/proxy?path=CLIENT-FORGED-PATHOLOGIST.png";
/** What a compromised or stale browser sends for the MedTech. Must never survive either. */
const CLIENT_FORGERY_MEDTECH: string = "/api/signatures/proxy?path=CLIENT-FORGED-MEDTECH.png";
/** The Pathologist's real, stored reference. */
const AUTHORITATIVE_PATHOLOGIST: string = "/api/signatures/proxy?path=AUTHORITATIVE-PATHOLOGIST.png";
/** The MedTech's real, stored reference — the value the policy reversal makes legitimate. */
const AUTHORITATIVE_MEDTECH: string = "/api/signatures/proxy?path=AUTHORITATIVE-MEDTECH.png";
/** A signature uploaded TODAY, offered to an already-completed report. Must never be drawn. */
const MEDTECH_SIGNATURE_UPLOADED_TODAY: string = "/api/signatures/proxy?personnelId=mt-signed";

const PATHOLOGIST_ID = "path-signed";
const MEDTECH_SIGNED_ID = "mt-signed";
const MEDTECH_UNSIGNED_ID = "mt-unsigned";

/** The printed identity the operator saw and approved. Every character must survive completion. */
const MEDTECH_PRINTED_NAME = "JUANA C. DELA CRUZ";
const MEDTECH_PRINTED_CREDENTIALS = "RMT";
const MEDTECH_PRINTED_LICENSE = "0123456";

/* ------------------------------------------------------------------ fixtures */

function personnelRecord(
  id: string,
  role: IPersonnel["role"],
  signatureImageUrl: string | null
): IPersonnel {
  return {
    id,
    firstName: "FIXTURE",
    lastName: role.toUpperCase(),
    middleInitial: null,
    credentials: role === "Pathologist" ? "MD, FPSP" : "RMT",
    prcLicenseNumber: `PRC-${id}`,
    role,
    signatureImageUrl,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function lookupOf(records: readonly IPersonnel[]): PersonnelLookup {
  return {
    async findById(id: string) {
      return records.find((record) => record.id === id) ?? null;
    },
  };
}

/** The world AFTER the policy reversal: the MedTech `mt-signed` holds a signature of their own. */
const PERSONNEL_TODAY: readonly IPersonnel[] = [
  personnelRecord(PATHOLOGIST_ID, "Pathologist", AUTHORITATIVE_PATHOLOGIST),
  personnelRecord(MEDTECH_SIGNED_ID, "MedicalTechnologist", AUTHORITATIVE_MEDTECH),
  personnelRecord(MEDTECH_UNSIGNED_ID, "MedicalTechnologist", null),
];

/**
 * The world BEFORE the policy reversal: no Medical Technologist held a signature at all.
 * Reports completed against this world are the ones §5 proves must never be redrawn.
 */
const PERSONNEL_BEFORE_THE_REVERSAL: readonly IPersonnel[] = [
  personnelRecord(PATHOLOGIST_ID, "Pathologist", AUTHORITATIVE_PATHOLOGIST),
  personnelRecord(MEDTECH_SIGNED_ID, "MedicalTechnologist", null),
];

/** The client always transports a forgery — that is what makes the discard provable. */
function clientPathologist(): SignatorySnapshot {
  return {
    personnelId: PATHOLOGIST_ID,
    role: "Pathologist",
    printedFullName: "DR. RAMON L. SANTOS",
    printedCredentials: "MD, FPSP",
    printedPrcLicenseNumber: "0098765",
    signatureImageUrl: CLIENT_FORGERY_PATHOLOGIST,
    displayOrder: 1,
  };
}

function clientMedtech(personnelId: string): SignatorySnapshot {
  return {
    personnelId,
    role: "MedicalTechnologist",
    printedFullName: MEDTECH_PRINTED_NAME,
    printedCredentials: MEDTECH_PRINTED_CREDENTIALS,
    printedPrcLicenseNumber: MEDTECH_PRINTED_LICENSE,
    signatureImageUrl: CLIENT_FORGERY_MEDTECH,
    displayOrder: 2,
  };
}

const CBC: ClinicalReportDefinition = ReportDefinitionRegistry.getDefinition("CBC")!;

const DEMOGRAPHICS: PatientDemographics = {
  fullName: "MARIA ROSARIO DELA CRUZ",
  age: 34,
  ageUnit: "years",
  sex: "Female",
  address: "Sta. Rosa, Nueva Ecija",
  patientStatus: "" as PatientDemographics["patientStatus"],
  examinationDate: "2026-08-10",
  requestingPhysician: "",
};

/* ---------- render-only fixtures (no completion), mirroring verify-checkpoint-c4-2 ---------- */

function inputValue(parameter: ParameterSpec): string {
  if (parameter.inputType === "Computed") return "";
  if (parameter.inputType === "NumericText") return "100";
  return parameter.defaultValue ?? parameter.options?.[0] ?? "ENTERED VALUE";
}

/** One CBC report whose two signatories carry exactly the references the caller names. */
function renderFixtureReport(
  pathologistSignature: string | null,
  medtechSignature: string | null
): ILaboratoryReport {
  return {
    id: "mtsig-report",
    sessionId: "mtsig-session",
    templateCode: CBC.templateCode,
    templateTitle: CBC.templateTitle,
    rendererFamily: CBC.rendererFamily as RendererFamily,
    remarks: "Exact resolved remarks.",
    reagentKitInfo: CBC.requiresKitInfo
      ? { kitBrand: "", lotNumber: "LOT-MTSIG", expirationDate: "2032-08-10" }
      : null,
    encodingData: {
      requestedBy: "REQUESTED PHYSICIAN",
      additionalFields: {},
      repeatableFindings: {},
    },
    results: CBC.parameters.map((parameter) => ({
      id: `mtsig-${parameter.parameterCode}`,
      reportId: "mtsig-report",
      parameterCode: parameter.parameterCode,
      parameterName: parameter.parameterName,
      resultValue: inputValue(parameter),
      evaluationOutcome: "NoEvaluation",
      displayOrder: parameter.displayOrder,
    })),
    signatories: [
      { ...clientPathologist(), signatureImageUrl: pathologistSignature },
      { ...clientMedtech(MEDTECH_SIGNED_ID), signatureImageUrl: medtechSignature },
    ],
  };
}

function draftSessionOf(reports: ILaboratoryReport[]): IPatientReportSession {
  return {
    id: "mtsig-session",
    accessionNumber: "SR-20260810-0001",
    status: "Draft",
    demographics: { ...DEMOGRAPHICS },
    reports,
    createdAt: "2026-08-10T00:00:00.000Z",
    completedAt: null,
  };
}

/* ---------- completion fixtures, mirroring verify-checkpoint-b5 / verify-signatory-resolution -- */

function encodedValueFor(parameter: ParameterSpec): string {
  if (parameter.defaultValue) return parameter.defaultValue;
  if (parameter.inputType === "SingleSelect") return parameter.options?.[0] || "";
  if (parameter.inputType === "Combobox") return parameter.options?.[0] || "Encoded Value";
  if (parameter.inputType === "NumericText") return "1";
  if (parameter.inputType === "FreeText") return "Encoded Value";
  return "";
}

/** A genuinely completable CBC report, signed by the named MedTech. */
function completableReport(medtechPersonnelId: string): LaboratoryReportDomain {
  const requirement =
    CBC.signatoryRequirements || { requiredPathologistsCount: 1, requiredMedtechsCount: 1 };
  let report = buildEncodingReport({
    definition: CBC,
    sessionId: "mtsig-completion-session",
    reportId: "mtsig-completion-report",
    rendererFamily: CBC.rendererFamily as RendererFamily,
    signatories: [
      clientPathologist(),
      ...Array.from({ length: requirement.requiredMedtechsCount }, () =>
        clientMedtech(medtechPersonnelId)
      ),
    ],
  });
  for (const parameter of CBC.parameters) {
    if (parameter.inputType !== "Computed") {
      report = applyEncodingResultValue(
        report,
        CBC,
        parameter.parameterCode,
        encodedValueFor(parameter),
        "NoEvaluation"
      );
    }
  }
  return new LaboratoryReportDomain({
    ...report,
    encodingData: {
      ...(report.encodingData || {}),
      requestedBy:
        report.encodingData?.requestedBy ||
        (CBC.requestedByPolicy.isRequired ? "Dr. Required Physician" : ""),
      additionalFields: Object.fromEntries(
        (CBC.additionalEncodingFields || []).map((field) => [
          field.fieldCode,
          field.isRequired ? "2026-08-10 10:30" : "",
        ])
      ),
      repeatableFindings: report.encodingData?.repeatableFindings || {},
    },
    reagentKitInfo: CBC.requiresKitInfo
      ? { kitBrand: "", lotNumber: "LOT-MTSIG", expirationDate: "2032-08-10" }
      : undefined,
  });
}

function completionSession(
  status: "Draft" | "Completed",
  medtechPersonnelId: string
): PatientReportSessionAggregate {
  return new PatientReportSessionAggregate({
    id: "mtsig-completion-session",
    accessionNumber: "SR-20260810-0002",
    status,
    demographics: { ...DEMOGRAPHICS },
    reports: [completableReport(medtechPersonnelId)],
    completedAt: status === "Completed" ? "2026-08-10T00:00:00.000Z" : null,
    expiresAt: status === "Completed" ? "2099-01-01T00:00:00.000Z" : null,
  });
}

/* ------------------------------------------------------------------ page helpers */

function imagesOf(page: NativeComposedPage): NativeImagePrimitive[] {
  return page.primitives.filter(
    (primitive): primitive is NativeImagePrimitive => primitive.kind === "image"
  );
}

function imageById(page: NativeComposedPage, id: string): NativeImagePrimitive | undefined {
  return imagesOf(page).find((primitive) => primitive.id === id);
}

function textById(page: NativeComposedPage, id: string): NativeTextPrimitive | undefined {
  return page.primitives.find(
    (primitive): primitive is NativeTextPrimitive => primitive.kind === "text" && primitive.id === id
  );
}

function textBox(page: NativeComposedPage, id: string): string {
  const primitive = required(
    textById(page, id),
    `fixture: the composed page must carry the '${id}' text before its geometry can be judged`
  );
  return JSON.stringify({
    x: primitive.x,
    y: primitive.y,
    width: primitive.width,
    height: primitive.height,
  });
}

function slotFor(
  report: ResolvedReportRenderModel,
  role: "Pathologist" | "MedicalTechnologist"
): ResolvedSignatorySlot {
  return required(
    report.signatories.find((candidate) => candidate.personnelRole === role),
    `fixture: the render model must expose a ${role} signatory slot`
  );
}

function composeFrom(session: IPatientReportSession, assets: Record<string, string> = {}) {
  const resolved = resolveSessionRenderModel(session, ReportDefinitionRegistry, assets);
  return {
    resolved,
    page: composeNativeLivePreviewReportPage(resolved, resolved.reports[0]),
    report: resolved.reports[0],
  };
}

/* ================================================================== main */

async function main(): Promise<void> {
  process.stdout.write("=== MEDTECH SIGNATURE LIFECYCLE VERIFICATION STARTED ===\n\n");

  const sentinels = [
    CLIENT_FORGERY_PATHOLOGIST,
    CLIENT_FORGERY_MEDTECH,
    AUTHORITATIVE_PATHOLOGIST,
    AUTHORITATIVE_MEDTECH,
    MEDTECH_SIGNATURE_UPLOADED_TODAY,
  ];
  assert(
    new Set(sentinels).size === sentinels.length,
    "every signature origin in this file is separately identifiable, so no outcome can be attributed to the wrong source"
  );

  /* ============================================================ 1. RESOLUTION */

  process.stdout.write("\n-- 1. Server-side resolution --\n");

  const resolved = await resolveSignatoriesForPersistence(
    [clientPathologist(), clientMedtech(MEDTECH_SIGNED_ID)],
    lookupOf(PERSONNEL_TODAY)
  );
  const resolvedPathologist = resolved[0];
  const resolvedMedtech = resolved[1];

  assert(
    resolvedMedtech.signatureImageUrl === AUTHORITATIVE_MEDTECH,
    "a Medical Technologist's signature is taken from that person's own authoritative personnel record, exactly as a Pathologist's is"
  );
  assert(
    resolvedPathologist.signatureImageUrl === AUTHORITATIVE_PATHOLOGIST,
    "a Pathologist's signature is still taken from the authoritative personnel record"
  );
  assert(
    resolvedMedtech.signatureImageUrl !== CLIENT_FORGERY_MEDTECH,
    "a signature reference supplied by the browser is discarded for a Medical Technologist, never trusted"
  );
  assert(
    resolvedPathologist.signatureImageUrl !== CLIENT_FORGERY_PATHOLOGIST,
    "a signature reference supplied by the browser is discarded for a Pathologist, never trusted"
  );
  assert(
    resolvedMedtech.signatureImageUrl !== resolvedPathologist.signatureImageUrl,
    "each signatory receives their OWN signature; one person's signature is never attributed to another"
  );
  assert(
    resolvedMedtech.printedFullName === MEDTECH_PRINTED_NAME &&
      resolvedMedtech.printedCredentials === MEDTECH_PRINTED_CREDENTIALS &&
      resolvedMedtech.printedPrcLicenseNumber === MEDTECH_PRINTED_LICENSE &&
      resolvedMedtech.displayOrder === 2 &&
      resolvedMedtech.role === "MedicalTechnologist",
    "resolving a Medical Technologist's signature changes nothing the operator approved: printed name, credentials, licence, role and order are untouched"
  );

  // The discard is proven a second way, where a pass-through resolver could not hide. The record
  // holds nothing, so anything other than null must have come from the client.
  const unsignedMedtech = await resolveSignatoriesForPersistence(
    [clientMedtech(MEDTECH_UNSIGNED_ID)],
    lookupOf(PERSONNEL_TODAY)
  );
  assert(
    unsignedMedtech[0].signatureImageUrl === null,
    "a Medical Technologist with no signature on file signs textually only; the browser's reference is not used as a fallback"
  );

  const unsignedPathologist = await resolveSignatoriesForPersistence(
    [clientPathologist()],
    lookupOf([personnelRecord(PATHOLOGIST_ID, "Pathologist", null)])
  );
  assert(
    unsignedPathologist[0].signatureImageUrl === null,
    "a Pathologist with no signature on file signs textually only, on the same terms as a Medical Technologist"
  );

  async function expectRejection(
    action: () => Promise<unknown>,
    message: string
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      assert(
        error instanceof ValidationError &&
          Object.keys(error.fieldErrors || {}).some((key) => key.includes("signatories")),
        message
      );
      return;
    }
    assert(false, `${message} — but the operation was allowed to proceed`);
  }

  await expectRejection(
    () => resolveSignatoriesForPersistence([clientMedtech(MEDTECH_SIGNED_ID)], lookupOf([])),
    "a Medical Technologist naming a personnel record that does not exist is refused before anything is written"
  );
  await expectRejection(
    () =>
      resolveSignatoriesForPersistence(
        [clientMedtech(MEDTECH_SIGNED_ID)],
        lookupOf([personnelRecord(MEDTECH_SIGNED_ID, "Pathologist", AUTHORITATIVE_PATHOLOGIST)])
      ),
    "a signatory selected as a Medical Technologist whose personnel record says otherwise is refused; a signature is never attributed to the wrong role"
  );

  /* ============================================================ 2. RENDER MODEL */

  process.stdout.write("\n-- 2. Render model --\n");

  const modelSigned = resolveDraftSessionRenderModel(
    draftSessionOf([renderFixtureReport(AUTHORITATIVE_PATHOLOGIST, AUTHORITATIVE_MEDTECH)])
  ).reports[0];
  const modelUnsigned = resolveDraftSessionRenderModel(
    draftSessionOf([renderFixtureReport(AUTHORITATIVE_PATHOLOGIST, null)])
  ).reports[0];

  assert(
    slotFor(modelSigned, "MedicalTechnologist").signatureAsset?.source === AUTHORITATIVE_MEDTECH,
    "a Medical Technologist slot holding a stored reference resolves to a drawable signature asset"
  );
  assert(
    slotFor(modelSigned, "MedicalTechnologist").signatureAsset?.failurePolicy === "OmitImage",
    "a Medical Technologist signature that cannot be fetched is omitted rather than failing the report"
  );
  assert(
    slotFor(modelUnsigned, "MedicalTechnologist").signatureAsset === null,
    "a Medical Technologist slot with no stored reference resolves to no signature asset at all"
  );
  assert(
    slotFor(modelSigned, "MedicalTechnologist").printedFullName === MEDTECH_PRINTED_NAME &&
      slotFor(modelSigned, "MedicalTechnologist").printedPrcLicenseNumber === MEDTECH_PRINTED_LICENSE,
    "a resolved Medical Technologist slot still carries the printed identity; the signature is added to it, never in place of it"
  );

  // Role symmetry. Each candidate is placed on BOTH roles and the two outcomes are required to be
  // identical — that is what proves sanitization is a property of the value, not of who signed.
  const sanitizationCases: readonly { source: string; expected: string | null; why: string }[] = [
    { source: AUTHORITATIVE_MEDTECH, expected: AUTHORITATIVE_MEDTECH, why: "a stored proxy reference is drawable" },
    { source: "https://cdn.example.org/sig.png", expected: "https://cdn.example.org/sig.png", why: "an https source is drawable" },
    { source: "http://cdn.example.org/sig.png", expected: "http://cdn.example.org/sig.png", why: "an http source is drawable" },
    { source: "javascript:alert(1)", expected: null, why: "a script URL is never drawn" },
    { source: "data:image/png;base64,AAAA", expected: null, why: "an inline data URL is never drawn" },
    { source: "ftp://cdn.example.org/sig.png", expected: null, why: "a non-web protocol is never drawn" },
    { source: "//cdn.example.org/sig.png", expected: null, why: "a protocol-relative source is never drawn" },
    { source: "not a url at all", expected: null, why: "a malformed source is never drawn" },
    { source: "   ", expected: null, why: "a blank source is never drawn" },
    { source: "/signatures/ok.png", expected: null, why: "a source carrying control characters is never drawn" },
  ];

  for (const testCase of sanitizationCases) {
    const model = resolveDraftSessionRenderModel(
      draftSessionOf([renderFixtureReport(testCase.source, testCase.source)])
    ).reports[0];
    const pathologistSource = slotFor(model, "Pathologist").signatureAsset?.source ?? null;
    const medtechSource = slotFor(model, "MedicalTechnologist").signatureAsset?.source ?? null;
    assert(
      medtechSource === testCase.expected,
      `for a Medical Technologist, ${testCase.why}`
    );
    assert(
      medtechSource === pathologistSource,
      `a signature source is judged by what it is, never by who signed it: '${testCase.source}' resolves identically for both roles`
    );
  }

  /* ============================================================ 3. COMPOSITION */

  process.stdout.write("\n-- 3. Composition: Preview, Print and PDF --\n");

  /**
   * Source-text assertion, and the only kind available here.
   *
   * Preview and Print are one React tree rendered in a browser (`window.print()` prints the very
   * DOM the preview shows), and the PDF exporter needs `jspdf` and a canvas. A headless script
   * cannot execute any of the three. What it CAN establish is the fact those three outputs rest
   * on: that each is drawn from the single primitive list `composeNativeLivePreviewReportPage`
   * returns, so composing that list — which every assertion below does for real — is what proves
   * all three. If a future output stops going through this composer, this assertion fails and the
   * behavioural proofs below must be re-scoped rather than silently narrowed.
   */
  const previewSource = readFileSync(
    join(process.cwd(), "src/rendering/native/NativeLivePreviewPage.tsx"),
    "utf8"
  ).replace(/\r\n/g, "\n");
  const pdfSource = readFileSync(
    join(process.cwd(), "src/rendering/native/session-pdf-exporter.ts"),
    "utf8"
  ).replace(/\r\n/g, "\n");
  const engineSource = readFileSync(
    join(process.cwd(), "src/rendering/SharedRenderingEngine.tsx"),
    "utf8"
  ).replace(/\r\n/g, "\n");

  assert(
    /composeNativeLivePreviewReportPage\(/.test(previewSource) &&
      /composeNativeLivePreviewReportPage\(/.test(pdfSource),
    "the on-screen page and the exported PDF are drawn from one composed primitive list, so a signature cannot appear in one output and not another"
  );
  assert(
    /NativeLivePreviewPage/.test(engineSource) && /createNativeSessionPdf/.test(engineSource),
    "Preview, Print and PDF are the same rendering engine's three targets, not three renderers"
  );

  const bothSigned = composeFrom(
    draftSessionOf([renderFixtureReport(AUTHORITATIVE_PATHOLOGIST, AUTHORITATIVE_MEDTECH)])
  ).page;
  const pathologistOnly = composeFrom(
    draftSessionOf([renderFixtureReport(AUTHORITATIVE_PATHOLOGIST, null)])
  ).page;
  const medtechOnly = composeFrom(
    draftSessionOf([renderFixtureReport(null, AUTHORITATIVE_MEDTECH)])
  ).page;
  const neitherSigned = composeFrom(draftSessionOf([renderFixtureReport(null, null)])).page;

  const medtechImage = imageById(bothSigned, "medical-technologist-signature");
  assert(
    medtechImage !== undefined && medtechImage.source === AUTHORITATIVE_MEDTECH,
    "a Medical Technologist with a signature on file has that signature printed in the report's signature block"
  );
  assert(
    imageById(medtechOnly, "medical-technologist-signature") !== undefined,
    "a Medical Technologist signature prints on its own merits, whether or not the Pathologist has one"
  );
  assert(
    imageById(pathologistOnly, "medical-technologist-signature") === undefined,
    "a Medical Technologist with no signature on file prints no signature image"
  );
  assert(
    imagesOf(neitherSigned).every((primitive) => !primitive.id.includes("signature")),
    "a report where neither signatory has a signature prints no signature image at all"
  );
  assert(
    (textById(neitherSigned, "medical-technologist-name")?.text || "").includes(
      MEDTECH_PRINTED_NAME
    ) && (textById(neitherSigned, "pathologist-name")?.text || "").length > 0,
    "a report where neither signatory has a signature still issues normally, with both printed names in place"
  );

  assert(
    textBox(bothSigned, "medical-technologist-name") ===
      textBox(pathologistOnly, "medical-technologist-name") &&
      (textById(bothSigned, "medical-technologist-name")?.text || "").includes(
        MEDTECH_PRINTED_NAME
      ),
    "a Medical Technologist's printed name keeps its exact place and wording whether or not a signature is printed above it"
  );
  assert(
    textBox(bothSigned, "pathologist-name") === textBox(pathologistOnly, "pathologist-name") &&
      textBox(bothSigned, "pathologist-license") === textBox(pathologistOnly, "pathologist-license") &&
      textBox(bothSigned, "pathologist-role") === textBox(pathologistOnly, "pathologist-role"),
    "adding a Medical Technologist signature moves nothing in the Pathologist's column"
  );
  assert(
    Math.abs(bothSigned.contentBottomMm - pathologistOnly.contentBottomMm) < 0.001 &&
      Math.abs(bothSigned.contentBottomMm - neitherSigned.contentBottomMm) < 0.001,
    "adding a Medical Technologist signature does not move the bottom of the report"
  );
  assert(
    imageById(bothSigned, "pathologist-signature")?.width ===
      imageById(bothSigned, "medical-technologist-signature")?.width &&
      imageById(bothSigned, "pathologist-signature")?.height ===
        imageById(bothSigned, "medical-technologist-signature")?.height,
    "a Medical Technologist signature is printed in the same approved frame as a Pathologist's, not a variant of it"
  );

  /* ============================================================ 4. COMPLETION AND REPLACEMENT */

  process.stdout.write("\n-- 4. Completion and replacement --\n");

  const draftForCompletion = completionSession("Draft", MEDTECH_SIGNED_ID);
  await applyResolvedSignatories(draftForCompletion.reports, lookupOf(PERSONNEL_TODAY));
  draftForCompletion.completeSession();

  const frozen = draftForCompletion.completedSnapshot;
  assert(frozen !== null, "completing a session freezes a snapshot of the issued report");
  const frozenMedtechs = frozen!.reports
    .flatMap((report) => report.signatories)
    .filter((signatory) => signatory.role === "MedicalTechnologist");
  assert(
    frozenMedtechs.length >= 1,
    "the completed report carries at least one Medical Technologist signatory"
  );
  assert(
    frozenMedtechs.every((signatory) => signatory.signatureImageUrl === AUTHORITATIVE_MEDTECH),
    "a completed report freezes the Medical Technologist's authoritative signature"
  );
  assert(
    frozenMedtechs.every(
      (signatory) =>
        signatory.printedFullName === MEDTECH_PRINTED_NAME &&
        signatory.printedCredentials === MEDTECH_PRINTED_CREDENTIALS &&
        signatory.printedPrcLicenseNumber === MEDTECH_PRINTED_LICENSE
    ),
    "a completed report keeps the Medical Technologist's printed name, credentials and PRC licence verbatim; the signature is printed alongside the identity, never in place of it"
  );
  assert(
    !JSON.stringify(frozen).includes("CLIENT-FORGED"),
    "no signature reference supplied by the browser survives anywhere in the frozen clinical record"
  );

  const completedRender = composeFrom(draftForCompletion);
  assert(
    imageById(completedRender.page, "medical-technologist-signature")?.source ===
      AUTHORITATIVE_MEDTECH,
    "an issued report prints the Medical Technologist signature that was frozen with it"
  );
  assert(
    (textById(completedRender.page, "medical-technologist-name")?.text || "").includes(
      MEDTECH_PRINTED_NAME
    ) &&
      (textById(completedRender.page, "medical-technologist-license")?.text || "").includes(
        MEDTECH_PRINTED_LICENSE
      ),
    "an issued report prints the Medical Technologist's name and PRC licence alongside the signature"
  );

  // Replacement. Reachable from the domain layer with no database: `recompleteSession()` composes
  // a whole replacement record in memory and returns a new aggregate.
  const completedForReplacement = completionSession("Completed", MEDTECH_SIGNED_ID);
  await applyResolvedSignatories(completedForReplacement.reports, lookupOf(PERSONNEL_TODAY));
  const replacement = completedForReplacement.recompleteSession();
  const replacementMedtechs = (replacement.completedSnapshot?.reports || [])
    .flatMap((report) => report.signatories)
    .filter((signatory) => signatory.role === "MedicalTechnologist");

  assert(
    replacementMedtechs.length >= 1 &&
      replacementMedtechs.every(
        (signatory) => signatory.signatureImageUrl === AUTHORITATIVE_MEDTECH
      ),
    "a replacement record freezes the Medical Technologist's authoritative signature on the same terms as the original issue"
  );
  assert(
    replacementMedtechs.every(
      (signatory) =>
        signatory.printedFullName === MEDTECH_PRINTED_NAME &&
        signatory.printedCredentials === MEDTECH_PRINTED_CREDENTIALS &&
        signatory.printedPrcLicenseNumber === MEDTECH_PRINTED_LICENSE
    ),
    "a replacement record keeps the Medical Technologist's printed name, credentials and PRC licence verbatim"
  );
  assert(
    imageById(composeFrom(replacement).page, "medical-technologist-signature")?.source ===
      AUTHORITATIVE_MEDTECH,
    "a replacement record prints the Medical Technologist signature frozen with it"
  );

  /**
   * NOT PROVEN HERE, and deliberately not faked: the persistence half of replacement. Writing
   * `report_signatories` rows and the single-record replacement RPC live in
   * `supabase-session-repository.ts` and require a live database and an authenticated session.
   * Everything above is the domain layer, which is reachable without one. That the RPC payload
   * reads the SAME resolved live signatories the snapshot was composed from is already proven
   * deterministically in `verify-signatory-resolution.ts`; only the round trip through Postgres
   * needs live acceptance.
   */
  process.stdout.write(
    "  note: relational persistence of replacement (report_signatories rows, replacement RPC) needs a live database and is NOT asserted here\n"
  );

  /* ============================================================ 5. FROZEN PRESERVATION */

  process.stdout.write("\n-- 5. A report already issued is never redrawn --\n");

  // A report completed BEFORE the policy reversal: its MedTech held no signature at the time.
  const legacyDraft = completionSession("Draft", MEDTECH_SIGNED_ID);
  await applyResolvedSignatories(legacyDraft.reports, lookupOf(PERSONNEL_BEFORE_THE_REVERSAL));
  legacyDraft.completeSession();

  const legacyFrozenMedtechs = (legacyDraft.completedSnapshot?.reports || [])
    .flatMap((report) => report.signatories)
    .filter((signatory) => signatory.role === "MedicalTechnologist");
  assert(
    legacyFrozenMedtechs.length >= 1 &&
      legacyFrozenMedtechs.every((signatory) => !signatory.signatureImageUrl),
    "a report issued before Medical Technologists could sign carries no Medical Technologist signature in its frozen record"
  );

  // Negative control FIRST. The override channel is the strongest way today's personnel could
  // reach a render, so it must be shown capable of producing a MedTech signature at all — an
  // absent-case probe that cannot report presence proves nothing by reporting absence.
  const todaysSignature = { [MEDTECH_SIGNED_ID]: MEDTECH_SIGNATURE_UPLOADED_TODAY };
  const liveAuthoring = composeFrom(
    draftSessionOf([renderFixtureReport(AUTHORITATIVE_PATHOLOGIST, null)]),
    todaysSignature
  );
  assert(
    imageById(liveAuthoring.page, "medical-technologist-signature")?.source ===
      MEDTECH_SIGNATURE_UPLOADED_TODAY,
    "control: a signature uploaded today does reach a report still being authored, so its absence from an issued report below is a real result"
  );

  const legacyRender = composeFrom(legacyDraft, todaysSignature);
  assert(
    slotFor(legacyRender.report, "MedicalTechnologist").signatureAsset === null,
    "a signature uploaded today never appears on a report that was already issued without one"
  );
  assert(
    imageById(legacyRender.page, "medical-technologist-signature") === undefined,
    "an already-issued report keeps its Medical Technologist column exactly as it was issued: textual"
  );
  assert(
    imageById(legacyRender.page, "pathologist-signature")?.source === AUTHORITATIVE_PATHOLOGIST,
    "an already-issued report still prints the signature it was issued with, so the absence above is preservation and not a broken render"
  );

  // The frozen record is the ONLY source. Editing the live report rows after issue must change
  // nothing, which is what distinguishes "renders from its own snapshot" from "happens to agree".
  legacyDraft.reports[0].signatories = legacyDraft.reports[0].signatories.map((signatory) => ({
    ...signatory,
    printedFullName: "TAMPERED NAME",
    signatureImageUrl: MEDTECH_SIGNATURE_UPLOADED_TODAY,
  }));
  const afterTampering = composeFrom(legacyDraft, todaysSignature);
  assert(
    imageById(afterTampering.page, "medical-technologist-signature") === undefined &&
      (textById(afterTampering.page, "medical-technologist-name")?.text || "").includes(
        MEDTECH_PRINTED_NAME
      ),
    "an issued report is drawn from its own frozen record; changing the working rows afterwards alters neither the printed identity nor the signature"
  );

  /* ============================================================ 6. GUARD RAILS */

  process.stdout.write("\n-- 6. Guard rails that must not have loosened --\n");

  /**
   * Type-level. Each entry is `true` if that client-facing type can express `signatureImageUrl`,
   * which fails `tsc` before this file ever runs. See CanExpressSignatureReference above for why
   * a runtime assertion cannot state this rule.
   */
  const clientShapesCarryingASignatureReference: [
    CanExpressSignatureReference<ClientSignatory>,
    CanExpressSignatureReference<PersonnelDirectoryEntry>,
    CanExpressSignatureReference<WorkspacePersonnelEntry>,
    CanExpressSignatureReference<WorkspaceSignatorySelection>,
  ] = [false, false, false, false];
  assert(
    clientShapesCarryingASignatureReference.every((carries) => carries === false),
    "no client-facing shape — the transported signatory, the personnel directory entry, the Workspace personnel entry or an operator's selection — can express a stored signature reference"
  );

  // Behavioural: project a real completed session, MedTech signature and all, and require that
  // nothing recognisable as a stored reference survives the crossing.
  const transport = toSessionTransport(draftForCompletion);
  const transportJson = JSON.stringify(transport);
  assert(
    !transportJson.includes("signatureImageUrl"),
    "the session the browser receives carries no signature reference field for any signatory, Medical Technologist included"
  );
  assert(
    !transportJson.includes("AUTHORITATIVE-MEDTECH") &&
      !transportJson.includes("AUTHORITATIVE-PATHOLOGIST") &&
      !transportJson.includes("CLIENT-FORGED"),
    "no stored signature location reaches the browser, for either role"
  );

  const transportedMedtech = (transport.completedSnapshot?.reports || [])
    .flatMap((report) => report.signatories)
    .find((signatory) => signatory.role === "MedicalTechnologist");
  assert(
    transportedMedtech !== undefined &&
      typeof transportedMedtech.signatureAddress === "string" &&
      transportedMedtech.signatureAddress.includes(`personnelId=${MEDTECH_SIGNED_ID}`) &&
      !transportedMedtech.signatureAddress.includes("path="),
    "a signed Medical Technologist reaches the browser as an address naming WHO signed, never WHERE the signature is stored"
  );
  assert(
    transportedMedtech!.printedFullName === MEDTECH_PRINTED_NAME &&
      transportedMedtech!.printedPrcLicenseNumber === MEDTECH_PRINTED_LICENSE,
    "the browser still receives the printed identity it must display; only the signature location is withheld"
  );

  process.stdout.write("\nMedTech signature lifecycle verification passed.\n");
}

main().catch((error) => {
  process.stderr.write(
    `\nMedTech signature lifecycle verification FAILED: ${
      error instanceof Error ? error.stack || error.message : String(error)
    }\n`
  );
  process.exit(1);
});
