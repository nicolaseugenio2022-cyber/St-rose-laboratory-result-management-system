import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CompletedSessionSnapshot } from "../src/domain/completion/completed-snapshot";
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import type { ILaboratoryReport, IPatientReportSession, IRepeatableFindingValue } from "../src/domain/models/interfaces";
import type { RendererFamily, SignatorySnapshot } from "../src/domain/types";
import type { ClinicalReportDefinition } from "../src/domain/types/report-definition";
import {
  resolveCompletedSessionRenderModel,
  resolveDraftSessionRenderModel,
  type ResolvedReportRenderModel,
  type ResolvedSessionRenderModel,
} from "../src/rendering/model";
import { createNativeReportPdf, type NativePdfAssetResolver } from "../src/rendering/native/native-pdf-exporter";
import type { NativeComposedPage, NativeTextPrimitive } from "../src/rendering/native/types";
import {
  NativeCompositionOverflowError,
  composeSpecializedNativeReportPage,
  getAllSpecializedNativeCompositionDefinitions,
  getSpecializedNativeCompositionDefinition,
} from "../src/rendering/native";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`C3 verification failed: ${message}`);
}

function rendererFamily(definition: ClinicalReportDefinition): RendererFamily {
  return definition.rendererFamily === "Dedicated Certificate"
    ? "NarrativeCertificate"
    : definition.rendererFamily as RendererFamily;
}

function medtech(id: number): SignatorySnapshot {
  return {
    personnelId: `medtech-${id}`,
    role: "MedicalTechnologist",
    printedFullName: `MEDTECH ${id}`,
    printedCredentials: "RMT",
    printedPrcLicenseNumber: `M-${id}`,
    signatureImageUrl: null,
    displayOrder: id,
  };
}

function pathologist(signatureImageUrl: string | null = null): SignatorySnapshot {
  return {
    personnelId: "pathologist",
    role: "Pathologist",
    printedFullName: "PATHOLOGIST",
    printedCredentials: "MD, FPSP",
    printedPrcLicenseNumber: "P-1",
    signatureImageUrl,
    displayOrder: 3,
  };
}

function reportFor(
  definition: ClinicalReportDefinition,
  options: { signature?: string | null; findings?: IRepeatableFindingValue[]; conditional?: string } = {}
): ILaboratoryReport {
  const values: Record<string, string> = {
    HIV_RESULT: "Nonreactive",
    COLOR: "Straw",
    TRANSPARENCY: "Clear",
    PH: "6.5",
    SP_GRAVITY: "1.020",
    PROTEIN: "Negative",
    GLUCOSE: "Negative",
    WBC: "0-2 /HPF",
    RBC: ">50",
    EPITHELIAL_CELLS: "Rare",
    BACTERIA: "Few",
    MUCUS_THREADS: "Moderate",
    AMORPHOUS_CRYSTAL: options.conditional ?? "Amorphous Urates: Rare",
  };
  return {
    id: `report-${definition.templateCode}`,
    sessionId: "session-c3",
    templateCode: definition.templateCode,
    templateTitle: definition.templateTitle,
    rendererFamily: rendererFamily(definition),
    remarks: "C3 REMARKS",
    reagentKitInfo: definition.requiresKitInfo
      ? { kitBrand: "", lotNumber: "LOT-HIV", expirationDate: "2029-01-31" }
      : null,
    encodingData: {
      requestedBy: "DR. REFERRING",
      additionalFields: { examinationDateTime: "2026-08-10 10:30", companyName: "COMPANY C3" },
      repeatableFindings: options.findings ? { "Additional Microscopic Findings": options.findings } : {},
    },
    results: definition.parameters.map((parameter) => ({
      id: `${definition.templateCode}-${parameter.parameterCode}`,
      reportId: `report-${definition.templateCode}`,
      parameterCode: parameter.parameterCode,
      parameterName: parameter.parameterName,
      resultValue: values[parameter.parameterCode] ?? "",
      evaluationOutcome: "NoEvaluation",
      displayOrder: parameter.displayOrder,
    })),
    signatories: definition.templateCode === "HIV_RESULT"
      ? [medtech(1), medtech(2), pathologist(options.signature)]
      : [pathologist(options.signature), medtech(1)],
  };
}

function sessionFor(reports: ILaboratoryReport[], address = "Edited HIV Address"): IPatientReportSession {
  return {
    id: "session-c3",
    accessionNumber: "ACC-C3",
    status: "Draft",
    demographics: {
      fullName: "C3 Patient",
      age: 32,
      ageUnit: "years",
      sex: "Female",
      address,
      patientStatus: "OutPatient",
      examinationDate: "2026-08-10",
      requestingPhysician: "",
      referrerName: "",
      companyName: "SESSION COMPANY MUST NOT OVERRIDE",
    },
    reports,
    createdAt: "2026-08-10T00:00:00.000Z",
    completedAt: null,
  };
}

function compose(session: ResolvedSessionRenderModel, report: ResolvedReportRenderModel): NativeComposedPage {
  const definition = getSpecializedNativeCompositionDefinition(report.templateCode);
  assert(definition, `${report.templateCode} specialized metadata must resolve`);
  return composeSpecializedNativeReportPage(definition, session, report);
}

function pageText(page: NativeComposedPage): string {
  return page.primitives.filter((primitive): primitive is NativeTextPrimitive => primitive.kind === "text").map((primitive) => primitive.text).join("\n");
}

function textByPrefix(page: NativeComposedPage, prefix: string): string {
  return page.primitives
    .filter((primitive): primitive is NativeTextPrimitive => primitive.kind === "text" && primitive.id.startsWith(prefix))
    .map((primitive) => primitive.text)
    .join(" ");
}

function normalizeDisplayWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function completedHivSnapshot(address: string): CompletedSessionSnapshot {
  return {
    snapshotVersion: 2,
    completedAt: "2026-08-10T11:00:00.000Z",
    demographics: {
      ...sessionFor([]).demographics,
      address,
    },
    reports: [{
      templateCode: "HIV_RESULT",
      templateTitle: "HIV 1 & 2 Rapid Test Certificate",
      rendererFamily: "NarrativeCertificate",
      renderContractVersion: 1,
      printedTitle: "HIV 1 & 2 RAPID TEST CERTIFICATE",
      staticContentVersion: "hiv-certificate-v1",
      requestedBy: "FROZEN REFERRING DOCTOR",
      additionalFields: { examinationDateTime: "2026-08-10 11:15", companyName: "FROZEN COMPANY" },
      results: [{
        parameterCode: "HIV_RESULT",
        parameterName: "HIV 1 & 2 Rapid Test",
        rawResultValue: "Reactive",
        formattedResultValue: "FROZEN REACTIVE DISPLAY",
        referenceDisplay: null,
        referenceRule: null,
        unit: null,
        suffix: null,
        evaluationOutcome: "Entered",
        computationMetadata: null,
        displayOrder: 1,
      }],
      remarks: "FROZEN HIV REMARKS",
      reagentKitInfo: { kitBrand: "", lotNumber: "FROZEN LOT", expirationDate: "2030-02-01" },
      repeatableFindings: {},
      signatories: [medtech(1), medtech(2), pathologist()],
    }],
  };
}

function expectOverflow(session: ResolvedSessionRenderModel, report: ResolvedReportRenderModel, label: string): void {
  let error: unknown;
  try { compose(session, report); } catch (caught) { error = caught; }
  assert(error instanceof NativeCompositionOverflowError, `${label} must use NativeCompositionOverflowError`);
  assert(error.permittedBottomMm === 148.5 && error.templateCode === report.templateCode, `${label} must identify the physical boundary and report`);
}

async function main(): Promise<void> {
  const specialized = getAllSpecializedNativeCompositionDefinitions();
  assert(specialized.length === 2, "exactly two C3 definitions must be specialized");
  assert(specialized.map((entry) => entry.kind).sort().join(",") === "Certificate,MicroscopyTwoColumn", "specialized strategies must be selected by declarative kind");

  const hivDefinition = ReportDefinitionRegistry.getDefinition("HIV_RESULT")!;
  const hivDraft = resolveDraftSessionRenderModel(sessionFor([reportFor(hivDefinition, { signature: "/missing-signature.png" })]));
  const hivReport = hivDraft.reports[0];
  const hivPage = compose(hivDraft, hivReport);
  const hivText = pageText(hivPage);
  assert(hivPage.widthMm === 210 && hivPage.heightMm === 297 && hivPage.contentBottomMm <= 148.5, "HIV must remain one upper-half A4 page");
  for (const exact of [
    "HIV 1 & 2 RAPID TEST CERTIFICATE",
    "AIDS FREE CERTIFICATE",
    "TO WHOM IT MAY CONCERN:",
    "SEROLOGY (HIV)",
    "Anti HIV-1/2 (Screening)",
    "LOT-HIV",
    "2029-01-31",
    "DR. REFERRING",
    "COMPANY C3",
  ]) assert(hivText.includes(exact), `HIV must render exact resolved/static content '${exact}'`);
  const narrative = hivReport.staticContent!.narrativeParagraphs[0].segments.map((segment) => segment.text).join("");
  assert(textByPrefix(hivPage, "certificate-certification") === narrative, "HIV certificate narrative must preserve resolved Patient Name and Address binding");
  const resultNarrative = hivReport.staticContent!.narrativeParagraphs[1].segments.map((segment) => segment.text).join("");
  assert(normalizeDisplayWhitespace(textByPrefix(hivPage, "certificate-result-statement")) === normalizeDisplayWhitespace(resultNarrative), "HIV result narrative must preserve exact versioned wording and marks");
  assert(narrative.includes("C3 Patient of Edited HIV Address was examined"), "HIV narrative must use the edited stored Address");
  assert(!hivText.includes("SESSION COMPANY MUST NOT OVERRIDE"), "HIV Company must remain report-scoped");
  assert(hivText.indexOf("MEDTECH 1") < hivText.indexOf("MEDTECH 2") && hivText.indexOf("MEDTECH 2") < hivText.indexOf("PATHOLOGIST"), "HIV signatory order must remain Examiner, Verifier, Pathologist");
  const pathSignature = hivPage.primitives.find((primitive) => primitive.id === "certificate-pathologist-signature");
  assert(pathSignature?.kind === "image" && pathSignature.failurePolicy === "OmitImage", "HIV Pathologist signature must remain optional");

  const blankHivDraft = resolveDraftSessionRenderModel(sessionFor([reportFor(hivDefinition)], ""));
  const blankHivPage = compose(blankHivDraft, blankHivDraft.reports[0]);
  assert(blankHivDraft.demographics.address === "" && !pageText(blankHivPage).includes("STA. ROSA"), "blank draft HIV Address must remain blank without a rendering default");
  const blankCompanyReport = reportFor(hivDefinition);
  blankCompanyReport.encodingData = {
    ...(blankCompanyReport.encodingData || {}),
    additionalFields: { ...(blankCompanyReport.encodingData?.additionalFields || {}), companyName: "" },
  };
  const blankCompanyHiv = resolveDraftSessionRenderModel(sessionFor([blankCompanyReport]));
  assert(!pageText(compose(blankCompanyHiv, blankCompanyHiv.reports[0])).includes("Company:"), "blank optional HIV Company must be omitted without a placeholder");
  const completedHiv = resolveCompletedSessionRenderModel(completedHivSnapshot("Frozen Exact Address"));
  const completedHivPage = compose(completedHiv, completedHiv.reports[0]);
  assert(completedHiv.reports[0].staticContent!.narrativeParagraphs[0].segments.some((segment) => segment.sourceKind === "PatientAddress" && segment.text === "Frozen Exact Address"), "completed HIV PatientAddress must come from the frozen snapshot");
  assert(pageText(completedHivPage).includes("FROZEN REACTIVE DISPLAY") && pageText(completedHivPage).includes("FROZEN LOT"), "completed HIV output must use frozen display and kit values without recomputation");
  const blankCompletedHiv = resolveCompletedSessionRenderModel(completedHivSnapshot(""));
  assert(!pageText(compose(blankCompletedHiv, blankCompletedHiv.reports[0])).includes("STA. ROSA"), "blank completed HIV Address must remain blank without a rendering default");

  const missingSignatureHiv = resolveDraftSessionRenderModel(sessionFor([reportFor(hivDefinition)]));
  assert(!compose(missingSignatureHiv, missingSignatureHiv.reports[0]).primitives.some((primitive) => primitive.id === "certificate-pathologist-signature"), "missing HIV signature must leave a blank image area");
  const malformedSignatureHiv = resolveDraftSessionRenderModel(sessionFor([reportFor(hivDefinition, { signature: "javascript:bad" })]));
  assert(!compose(malformedSignatureHiv, malformedSignatureHiv.reports[0]).primitives.some((primitive) => primitive.id === "certificate-pathologist-signature"), "malformed HIV signature must leave a blank image area");
  const logoBytes = new Uint8Array(await readFile(path.join(process.cwd(), "public", "st-rose-logo-official.png")));
  const optionalFailureResolver: NativePdfAssetResolver = {
    async load(source) {
      if (source === "/st-rose-logo-official.png") return { bytes: logoBytes, format: "PNG" };
      throw new Error("signature failed");
    },
  };
  await createNativeReportPdf(hivPage, optionalFailureResolver);

  const findings: IRepeatableFindingValue[] = [
    { id: "later", category: "Additional Microscopic Findings", value: "WBC seen in clumps", displayOrder: 2 },
    { id: "blank", category: "Additional Microscopic Findings", value: "", displayOrder: 3 },
    { id: "first", category: "Additional Microscopic Findings", value: "Calcium Oxalate Crystals: Rare", displayOrder: 1 },
  ];
  const urineDefinition = ReportDefinitionRegistry.getDefinition("URINALYSIS")!;
  const urineDraft = resolveDraftSessionRenderModel(sessionFor([reportFor(urineDefinition, { findings })]));
  const urineReport = urineDraft.reports[0];
  const urinePage = compose(urineDraft, urineReport);
  const urineText = pageText(urinePage);
  assert(urinePage.widthMm === 210 && urinePage.heightMm === 297 && urinePage.contentBottomMm <= 148.5, "Urinalysis must remain one upper-half A4 page");
  assert([...hivPage.primitives, ...urinePage.primitives].filter((primitive) => primitive.kind === "image").every((primitive) => primitive.source === "/st-rose-logo-official.png" || primitive.failurePolicy === "OmitImage"), "specialized pages must use only the canonical logo and optional signature images");
  assert(!/page\s*\d+/i.test(`${hivText}\n${urineText}`), "specialized pages must contain no page numbers");
  assert(urineText.includes("PHYSICAL / CHEMICAL EXAMINATION") && urineText.includes("MICROSCOPIC EXAMINATION"), "Urinalysis must render both declarative sections");
  const wbc = urineReport.results.find((result) => result.parameterCode === "WBC")!;
  const rbc = urineReport.results.find((result) => result.parameterCode === "RBC")!;
  const renderedWbc = textByPrefix(urinePage, "microscopy-microscopic-WBC-value");
  const renderedRbc = textByPrefix(urinePage, "microscopy-microscopic-RBC-value");
  assert(renderedWbc === wbc.formattedValue && (renderedWbc.match(/\/HPF/g) || []).length === 1, "Urinalysis WBC /HPF suffix must appear exactly once");
  assert(renderedRbc === rbc.formattedValue && (renderedRbc.match(/\/HPF/g) || []).length === 1, "Urinalysis RBC /HPF suffix must appear exactly once");
  const amorphous = urineReport.results.find((result) => result.parameterCode === "AMORPHOUS_CRYSTAL")!;
  assert(`${textByPrefix(urinePage, "microscopy-microscopic-AMORPHOUS_CRYSTAL-label")}: ${textByPrefix(urinePage, "microscopy-microscopic-AMORPHOUS_CRYSTAL-value")}` === amorphous.formattedValue, "conditional amorphous row must preserve the resolved display form");
  assert(urineText.indexOf("Calcium Oxalate Crystals: Rare") < urineText.indexOf("WBC seen in clumps"), "repeatable findings must retain resolved display order");
  assert(!urineText.includes("blank"), "blank repeatable findings must produce no output row");

  const omittedUrine = resolveDraftSessionRenderModel(sessionFor([reportFor(urineDefinition, { conditional: "" })]));
  const omittedUrinePage = compose(omittedUrine, omittedUrine.reports[0]);
  assert(omittedUrine.reports[0].results.find((result) => result.parameterCode === "AMORPHOUS_CRYSTAL")!.omission === "Omit", "blank amorphous result must resolve to Omit");
  assert(!omittedUrinePage.primitives.some((primitive) => primitive.id.includes("AMORPHOUS_CRYSTAL")), "omitted amorphous result must reserve no primitive or row");

  const excessiveFindings = Array.from({ length: 35 }, (_, index) => ({
    id: `overflow-${index}`,
    category: "Additional Microscopic Findings",
    value: `Additional finding ${index} with complete retained wording`,
    displayOrder: index,
  }));
  const overflowUrine = resolveDraftSessionRenderModel(sessionFor([reportFor(urineDefinition, { findings: excessiveFindings })]));
  expectOverflow(overflowUrine, overflowUrine.reports[0], "Urinalysis repeatable findings overflow");
  const longAddress = Array.from({ length: 180 }, () => "Addressword").join(" ");
  const overflowHiv = resolveDraftSessionRenderModel(sessionFor([reportFor(hivDefinition)], longAddress));
  expectOverflow(overflowHiv, overflowHiv.reports[0], "HIV narrative overflow");

  const genericSource = ["composer.ts", "certificate.ts", "microscopy.ts"]
    .map((file) => readFileSync(path.join(process.cwd(), "src", "rendering", "native", "specialized", file), "utf8"))
    .join("\n");
  assert(!/templateCode\s*(?:===|!==|==|!=)\s*["']/.test(genericSource) && !/switch\s*\([^)]*templateCode/.test(genericSource), "generic specialized composers must contain no report-code literal branches");
  assert(!/GenericReportResolver|resolveReferenceDisplay|FormulaRegistry|ILaboratoryReport|IPatientReportSession/.test(genericSource), "specialized composers must import no clinical resolver or mutable session logic");
  const activeRoutingSource = ["SharedRenderingEngine.tsx", "native/NativeReportPreview.tsx", "native/definition-registry.ts"]
    .map((file) => readFileSync(path.join(process.cwd(), "src", "rendering", file), "utf8"))
    .join("\n");
  assert(!activeRoutingSource.includes("composeSpecializedNativeReportPage"), "C3 must not switch active Preview or PDF routing");

  process.stdout.write("C3 verification passed: HIV certificate and Urinalysis specialized composition, frozen Address/content ownership, optional signatures, conditional findings, suffix deduplication, and upper-half overflow protection.\n");
}

void main();
