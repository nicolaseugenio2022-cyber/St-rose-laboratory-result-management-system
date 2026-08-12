import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CompletedSessionSnapshot } from "../src/domain/completion/completed-snapshot";
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import type { ILaboratoryReport, IPatientReportSession, IRepeatableFindingValue } from "../src/domain/models/interfaces";
import type { RendererFamily, SignatorySnapshot } from "../src/domain/types";
import type { ClinicalReportDefinition, ParameterSpec } from "../src/domain/types/report-definition";
import {
  resolveDraftSessionRenderModel,
  resolveSessionRenderModel,
  type ResolvedSessionRenderModel,
} from "../src/rendering/model";
import {
  NativeReportPreview,
  NativeLivePreviewPage,
  composeNativeLivePreviewReportPage,
  getNativeLivePreviewCompositionDefinition,
  nativePrimitiveBottomMm,
} from "../src/rendering/native";
import type { NativeComposedPage, NativeTextPrimitive } from "../src/rendering/native/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`C4 verification failed: ${message}`);
}

function rendererFamily(definition: ClinicalReportDefinition): RendererFamily {
  return definition.rendererFamily === "Dedicated Certificate"
    ? "NarrativeCertificate"
    : definition.rendererFamily as RendererFamily;
}

function medtech(id = 1): SignatorySnapshot {
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

function inputValue(parameter: ParameterSpec): string {
  if (parameter.parameterCode === "CHOLESTEROL") return "150";
  if (parameter.parameterCode === "TRIGLYCERIDES") return "700";
  if (parameter.parameterCode === "HEMOGLOBIN") return "120";
  if (parameter.parameterCode === "WBC") return "0-2 /HPF";
  if (parameter.parameterCode === "RBC") return ">50 /HPF";
  if (parameter.parameterCode === "AMORPHOUS_CRYSTAL") return "";
  if (parameter.inputType === "Computed") return "";
  if (parameter.inputType === "NumericText") return "100";
  return parameter.defaultValue ?? parameter.options?.[0] ?? "ENTERED VALUE";
}

function reportFor(
  definition: ClinicalReportDefinition,
  options: { signature?: string | null; findings?: IRepeatableFindingValue[] } = {}
): ILaboratoryReport {
  const requestedBy = definition.templateCode === "BLOOD_TYPING" ? "" : `REQUESTED ${definition.templateCode}`;
  return {
    id: `report-${definition.templateCode}`,
    sessionId: "session-c4",
    templateCode: definition.templateCode,
    templateTitle: definition.templateTitle,
    rendererFamily: rendererFamily(definition),
    remarks: "C4 REMARKS",
    reagentKitInfo: definition.requiresKitInfo
      ? { kitBrand: "", lotNumber: "LOT-C4", expirationDate: "2030-01-01" }
      : null,
    encodingData: {
      requestedBy,
      additionalFields: { examinationDateTime: "2026-08-10 14:30", companyName: "C4 COMPANY" },
      repeatableFindings: options.findings ? { "Additional Microscopic Findings": options.findings } : {},
    },
    results: definition.parameters.map((parameter) => ({
      id: `${definition.templateCode}-${parameter.parameterCode}`,
      reportId: `report-${definition.templateCode}`,
      parameterCode: parameter.parameterCode,
      parameterName: parameter.parameterName,
      resultValue: inputValue(parameter),
      evaluationOutcome: "NoEvaluation",
      displayOrder: parameter.displayOrder,
    })),
    signatories: definition.templateCode === "HIV_RESULT"
      ? [medtech(1), medtech(2), pathologist(options.signature)]
      : [pathologist(options.signature), medtech(1)],
  };
}

function sessionFor(reports: ILaboratoryReport[]): IPatientReportSession {
  return {
    id: "session-c4",
    accessionNumber: "ACC-C4",
    status: "Draft",
    demographics: {
      fullName: "C4 Patient",
      age: 31,
      ageUnit: "years",
      sex: "Female",
      address: "C4 Edited Address",
      patientStatus: "OutPatient",
      examinationDate: "2026-08-10",
      requestingPhysician: "",
      referrerName: "",
      companyName: "",
    },
    reports,
    createdAt: "2026-08-10T00:00:00.000Z",
    completedAt: null,
  };
}

function pageText(page: NativeComposedPage): string {
  return page.primitives
    .filter((primitive): primitive is NativeTextPrimitive => primitive.kind === "text")
    .map((primitive) => primitive.text)
    .join("\n");
}

function normalizedPageText(page: NativeComposedPage): string {
  return pageText(page).replace(/\s+/g, " ").trim();
}

function completedCbcSnapshot(): CompletedSessionSnapshot {
  return {
    snapshotVersion: 2,
    completedAt: "2026-08-10T15:00:00.000Z",
    demographics: { ...sessionFor([]).demographics, address: "FROZEN C4 ADDRESS" },
    reports: [{
      templateCode: "CBC",
      templateTitle: "Frozen CBC",
      rendererFamily: "Tabular",
      renderContractVersion: 1,
      printedTitle: null,
      staticContentVersion: "standard-report-v1",
      requestedBy: "FROZEN REQUESTED BY",
      additionalFields: {},
      results: [{
        parameterCode: "HEMOGLOBIN",
        parameterName: "Frozen Hemoglobin",
        rawResultValue: "999",
        formattedResultValue: "FROZEN-C4-DISPLAY",
        referenceDisplay: "FROZEN-C4-REFERENCE",
        referenceRule: null,
        unit: "g/L",
        suffix: null,
        evaluationOutcome: "High",
        computationMetadata: null,
        displayOrder: 1,
      }],
      remarks: "FROZEN C4 REMARKS",
      reagentKitInfo: null,
      repeatableFindings: {},
      signatories: [pathologist(), medtech()],
    }],
  };
}

async function main(): Promise<void> {
  const definitions = ReportDefinitionRegistry.getAllDefinitions();
  assert(definitions.length === 17, "registry must retain exactly 17 definitions");
  const draftSession = sessionFor(definitions.map((definition) => reportFor(definition, { signature: "/missing-signature.png" })));
  const resolvedDraft = resolveDraftSessionRenderModel(draftSession);
  assert(resolvedDraft.origin === "Draft" && resolvedDraft.reports.length === 17, "draft Live Preview must use the C1 draft adapter");

  const familyCounts: Record<string, number> = {};
  const pages = new Map<string, NativeComposedPage>();
  for (const report of resolvedDraft.reports) {
    assert(getNativeLivePreviewCompositionDefinition(report), `${report.templateCode} must resolve a native Live Preview definition`);
    familyCounts[report.layoutFamily] = (familyCounts[report.layoutFamily] || 0) + 1;
    const page = composeNativeLivePreviewReportPage(resolvedDraft, report);
    pages.set(report.templateCode, page);
    assert(page.compositionSource === report.layoutFamily, `${report.templateCode} production preview must use its declarative family composer`);
    assert(page.widthMm === 210 && page.heightMm === 297, `${report.templateCode} must use an A4 canvas`);
    assert(page.contentBottomMm <= 148.5 && page.primitives.every((primitive) => nativePrimitiveBottomMm(primitive) <= 148.5001), `${report.templateCode} primitives must remain in the upper half`);
    assert(!/page\s*\d+/i.test(pageText(page)), `${report.templateCode} must contain no page number`);
    assert(page.primitives.filter((primitive) => primitive.kind === "image").every((primitive) => primitive.source === "/st-rose-logo-official.png" || primitive.failurePolicy === "OmitImage"), `${report.templateCode} must contain no raster report background`);
  }
  assert(JSON.stringify(familyCounts) === JSON.stringify({ StandardAdaptiveTabular: 6, CompactResultGrid: 9, Certificate: 1, MicroscopyTwoColumn: 1 }), "all four approved family counts must route natively");

  const cbcText = pageText(pages.get("CBC")!);
  assert(pages.get("CBC")!.compositionSource === "StandardAdaptiveTabular", "active CBC preview must not resolve to the legacy native pilot");
  assert(!pages.get("CBC")!.primitives.some((primitive) => primitive.id === "report-title") && cbcText.includes("Status") && !/(^|\s)(HIGH|LOW|ABNORMAL|H|L)(\s|$)/m.test(cbcText), "CBC native preview rules must remain intact");
  assert(!pageText(pages.get("BLOOD_TYPING")!).includes("Dr."), "Blood Typing blank Requested By must remain blank");
  assert(normalizedPageText(pages.get("HIV_RESULT")!).includes("C4 Patient of C4 Edited Address was examined"), "HIV preview must use the resolved Patient Address");
  const urineText = pageText(pages.get("URINALYSIS")!);
  assert((urineText.match(/0-2 \/HPF/g) || []).length === 1 && (urineText.match(/>50 \/HPF/g) || []).length === 1, "Urinalysis fixed suffixes must appear exactly once");
  assert(!pages.get("URINALYSIS")!.primitives.some((primitive) => primitive.id.includes("AMORPHOUS_CRYSTAL")), "omitted conditional Urinalysis rows must remain omitted");
  const hdl = resolvedDraft.reports.find((report) => report.templateCode === "CHEM_10")!.results.find((result) => result.parameterCode === "HDL")!;
  assert(hdl.formattedValue && pageText(pages.get("CHEM_10")!).includes(hdl.formattedValue), "computed HDL must use its already-resolved formatted value");
  const femaleHemoglobin = resolvedDraft.reports.find((report) => report.templateCode === "CBC")!.results.find((result) => result.parameterCode === "HEMOGLOBIN")!;
  assert(femaleHemoglobin.referenceDisplay?.includes("120") && femaleHemoglobin.evaluationOutcome === "Normal", "sex-aware draft reference/evaluation must reach Live Preview composition");

  const currentCbc = reportFor(ReportDefinitionRegistry.getDefinition("CBC")!);
  currentCbc.results[0].resultValue = "111";
  const completedSession: IPatientReportSession = {
    ...sessionFor([currentCbc]),
    status: "Completed",
    completedAt: "2026-08-10T15:00:00.000Z",
    completedSnapshot: completedCbcSnapshot(),
  };
  const resolvedCompleted = resolveSessionRenderModel(completedSession);
  assert(resolvedCompleted.origin === "Completed" && resolvedCompleted.snapshotVersion === 2, "history preview must select the completed adapter");
  const completedPage = composeNativeLivePreviewReportPage(resolvedCompleted, resolvedCompleted.reports[0]);
  const completedText = pageText(completedPage);
  const compactCompletedText = completedText.replace(/\s+/g, "");
  assert(compactCompletedText.includes("FROZEN-C4-DISPLAY") && compactCompletedText.includes("FROZEN-C4-REFERENCE") && !completedText.includes("111"), "completed Live Preview must remain snapshot-authoritative without recomputation");

  const optionalPreviewMarkup = renderToStaticMarkup(React.createElement(NativeReportPreview, { page: pages.get("CBC")!, scale: 0.5 }));
  assert(optionalPreviewMarkup.includes("data-native-optional-image=\"true\"") && optionalPreviewMarkup.includes("visibility:hidden"), "optional signature images must remain hidden until successfully loaded");
  assert(optionalPreviewMarkup.includes("data-content-limit-mm=\"148.5\"") && optionalPreviewMarkup.includes("data-native-text-content=\"selectable\""), "native preview DOM must expose the physical limit and selectable-text contract");

  const productionPreviewMarkup = renderToStaticMarkup(React.createElement(NativeLivePreviewPage, {
    resolvedSession: resolvedDraft,
    resolvedReport: resolvedDraft.reports[0],
    reportTitle: resolvedDraft.reports[0].templateTitle,
  }));
  assert(productionPreviewMarkup.includes("data-live-preview-production-path=\"native\"") && productionPreviewMarkup.includes("data-native-report-preview=\"CHEM_8\""), "production native page component must render the resolved Live Preview path");
  assert(productionPreviewMarkup.includes("data-live-preview-composition-source=\"StandardAdaptiveTabular\"") && productionPreviewMarkup.includes("data-native-composition-source=\"StandardAdaptiveTabular\""), "production preview DOM must expose its family-composer provenance");

  const excessiveFindings = Array.from({ length: 40 }, (_, index) => ({
    id: `overflow-${index}`,
    category: "Additional Microscopic Findings",
    value: `Complete overflowing finding ${index} retained without clipping`,
    displayOrder: index,
  }));
  const overflowReport = reportFor(ReportDefinitionRegistry.getDefinition("URINALYSIS")!, { findings: excessiveFindings });
  const overflowSession = resolveDraftSessionRenderModel(sessionFor([overflowReport]));
  const overflowMarkup = renderToStaticMarkup(React.createElement(NativeLivePreviewPage, {
    resolvedSession: overflowSession,
    resolvedReport: overflowSession.reports[0],
    reportTitle: overflowSession.reports[0].templateTitle,
  }));
  assert(overflowMarkup.includes("data-native-preview-composition-error=\"URINALYSIS\"") && overflowMarkup.includes("permitted boundary is 148.500 mm"), "Preview overflow must render an actionable failure rather than a clipped page");

  const routingSource = readFileSync(path.join(process.cwd(), "src", "rendering", "native", "live-preview-composer.ts"), "utf8");
  assert(!/templateCode\s*(?:===|!==|==|!=)\s*["']/.test(routingSource) && !/switch\s*\([^)]*templateCode/.test(routingSource), "generic Live Preview routing must contain no report-code literal branches");
  const engineSource = readFileSync(path.join(process.cwd(), "src", "rendering", "SharedRenderingEngine.tsx"), "utf8");
  const exportSection = engineSource.slice(engineSource.indexOf("const handleExportPDF"), engineSource.indexOf("const renderLegacyReportPage"));
  assert(exportSection.includes("PDFStreamAdapter") && !exportSection.includes("NativePDFExporter"), "pre-C5 PDF export must remain on the existing stream adapter");
  assert(engineSource.includes("NativeLivePreviewPage") && engineSource.includes("data-c4-preserved-pdf-route=\"legacy\""), "SharedRenderingEngine must use native Live Preview while isolating legacy PDF DOM");
  assert(!engineSource.includes("previewRendererMode") && !engineSource.includes("PreviewRendererMode"), "Live Preview must have no selectable renderer mode");
  assert(engineSource.includes("NativeLivePreviewPage"), "Live Preview must route unconditionally through NativeLivePreviewPage");
  assert(!engineSource.includes("getReportLayout") && !engineSource.includes("<RenderingEngine"), "experimental preview infrastructure must be removed");
  assert(!engineSource.includes("CBC Pilot (Rollback)"), "the obsolete CBC pilot selector must be absent");
  assert(!/(localStorage|sessionStorage|useSearchParams|searchParams)/.test(engineSource), "preview mode must not be restored from browser or query persistence");
  const legacyReportPageCallIndexes = Array.from(engineSource.matchAll(/renderLegacyReportPage\(/g), (match) => match.index)
    .filter((matchIndex) => !engineSource.slice(0, matchIndex).trimEnd().endsWith("const"));
  const exportContainerMarkerIndex = engineSource.indexOf('data-c4-preserved-pdf-route="legacy"');
  const exportContainerStartIndex = engineSource.lastIndexOf("{isExportingPDF &&", exportContainerMarkerIndex);
  const exportContainerEndIndex = engineSource.indexOf("</div>", exportContainerMarkerIndex);
  assert(legacyReportPageCallIndexes.length === 1
    && legacyReportPageCallIndexes[0] > exportContainerStartIndex
    && legacyReportPageCallIndexes[0] < exportContainerEndIndex
    && engineSource.includes('data-c4-preserved-pdf-route="legacy"'), "legacy HTML must be reachable only through the explicit PDF export container");

  process.stdout.write(`C4 verification passed: 17 native Live Preview routes; families ${JSON.stringify(familyCounts)}; draft/completed authority; optional signatures; upper-half enforcement; PDF routing preserved.\n`);
}

void main();
