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
import { NATIVE_REPORT_THEME } from "../src/rendering/native/theme";
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
  assert(!pages.get("CBC")!.primitives.some((primitive) => primitive.id === "report-title") && cbcText.includes("Status"), "CBC native preview rules must remain intact");
  // QA-04 retired the former CBC abnormal-indicator prohibition that this assertion also carried, and
  // REPORT-QA-01 replaced the H / L initials with the complete words. CBC follows that shared
  // HIGH / LOW output policy, so the negative clause stays replaced by positive coverage.
  const cbcModel = resolvedDraft.reports.find((report) => report.templateCode === "CBC")!;
  const cbcRendered = cbcModel.results.filter((result) => result.omission === "Render");
  const cbcHighs = cbcRendered.filter((result) => result.evaluationOutcome === "High");
  const cbcLows = cbcRendered.filter((result) => result.evaluationOutcome === "Low");
  assert(cbcHighs.length > 0 && cbcLows.length > 0, `the CBC fixture must genuinely produce both High and Low outcomes or the marker coverage proves nothing - measured High ${cbcHighs.length}, Low ${cbcLows.length}`);
  const cbcMarkers = pages.get("CBC")!.primitives.flatMap((primitive) => primitive.kind === "text" && primitive.id.endsWith("-indicator") ? [primitive] : []);
  assert(cbcMarkers.length === cbcHighs.length + cbcLows.length, `CBC must render exactly one marker per High or Low result - expected ${cbcHighs.length + cbcLows.length}, measured ${cbcMarkers.length}`);
  for (const result of cbcRendered) {
    const markers = cbcMarkers.filter((primitive) => primitive.id === `result-${result.parameterCode}-indicator`);
    if (result.evaluationOutcome === "High") {
      assert(markers.length === 1 && markers[0].text === "HIGH" && markers[0].fontWeight === "bold" && markers[0].color === NATIVE_REPORT_THEME.colors.abnormalHigh, `CBC ${result.parameterCode} High must render exactly one bold complete-word HIGH in the abnormalHigh token`);
    } else if (result.evaluationOutcome === "Low") {
      assert(markers.length === 1 && markers[0].text === "LOW" && markers[0].fontWeight === "bold" && markers[0].color === NATIVE_REPORT_THEME.colors.abnormalLow, `CBC ${result.parameterCode} Low must render exactly one bold complete-word LOW in the abnormalLow token`);
    } else {
      assert(markers.length === 0, `CBC ${result.parameterCode} (${result.evaluationOutcome}) must render no abnormal marker`);
    }
  }
  // REPORT-QA-01 requirement 2: the five Serology reports display no reference value anywhere in the
  // shared native primitive model, which is the single source Live Preview, Print and PDF all render
  // from. Nothing here suppresses a reference at render time - absence is proved at its real origin,
  // the definitions, and then again in the composed output, so a referenceRule added to one of these
  // parameters later fails at the declaration rather than being quietly hidden downstream.
  const serologyReferenceFreeCodes = ["HBSAG", "RPR", "DENGUE_DUO", "PREG_TEST", "HIV_RESULT"];
  const serologyResultOptions: Record<string, string[]> = {
    HBSAG_RESULT: ["Nonreactive", "Reactive"],
    RPR_RESULT: ["Nonreactive", "Reactive"],
    DENGUE_NS1: ["Negative", "Positive"],
    DENGUE_IGG: ["Negative", "Positive"],
    DENGUE_IGM: ["Negative", "Positive"],
    PREG_RESULT: ["Negative", "Positive"],
    HIV_RESULT: ["Nonreactive", "Reactive"],
  };
  for (const templateCode of serologyReferenceFreeCodes) {
    const serologyDefinition = ReportDefinitionRegistry.getDefinition(templateCode)!;
    for (const parameter of serologyDefinition.parameters) {
      assert(parameter.referenceRule == null, `${templateCode}/${parameter.parameterCode} must declare no referenceRule - a displayed reference value is prohibited on this report`);
      assert(parameter.evaluationPolicy.mode === "ValidEntryOnly", `${templateCode}/${parameter.parameterCode} must keep its ValidEntryOnly evaluation and introduce no Normal/Abnormal interpretation - measured ${parameter.evaluationPolicy.mode}`);
      assert(JSON.stringify(parameter.options) === JSON.stringify(serologyResultOptions[parameter.parameterCode]), `${templateCode}/${parameter.parameterCode} result options must remain exactly ${JSON.stringify(serologyResultOptions[parameter.parameterCode])} - measured ${JSON.stringify(parameter.options)}`);
    }
    const serologyReport = resolvedDraft.reports.find((report) => report.templateCode === templateCode)!;
    for (const result of serologyReport.results) {
      assert(result.referenceDisplay === null, `${templateCode}/${result.parameterCode} must resolve no reference display - measured ${JSON.stringify(result.referenceDisplay)}`);
    }
    const serologyPage = pages.get(templateCode)!;
    const referencePrimitives = serologyPage.primitives.filter((primitive) => primitive.id.startsWith(`result-`) && primitive.id.includes("-reference"));
    assert(referencePrimitives.length === 0, `${templateCode} must emit no reference primitive - measured ${referencePrimitives.map((primitive) => primitive.id).join(", ")}`);
    assert(!/\bRef:/.test(pageText(serologyPage)), `${templateCode} output must carry no Ref: label`);
  }
  // SUPERSEDED: this loop previously required all three result headers, keeping an empty third
  // column so the tracks aligned with every other report. The client reports that the TEST and
  // REFERENCE VALUES headings do not belong on a qualitative screening result, and these five
  // reports carry no reference data at all - the assertions above already prove no reference
  // display, no reference primitive and no Ref: label exist on any of them. The column is now
  // removed rather than emptied, and the first header is blank so the test names keep their
  // column and lose their label.
  //
  // Asserted structurally, not by count alone: an empty header string still emits a primitive, so
  // a count would stay green if the third column came back carrying nothing. The header TEXTS are
  // what pin the contract.
  for (const templateCode of ["BLOOD_TYPING", "HBSAG", "RPR", "DENGUE_DUO", "PREG_TEST"]) {
    const serologyPage = pages.get(templateCode)!;
    const headers = serologyPage.primitives
      .filter((primitive): primitive is typeof primitive & { text: string } => /^result-header-\d+$/.test(primitive.id) && "text" in primitive)
      .map((primitive) => primitive.text);
    assert(headers.length === 2, `${templateCode} must compose exactly two result columns so the reference track is removed, not emptied - measured ${headers.length}`);
    assert(JSON.stringify(headers) === JSON.stringify(["", "RESULT"]), `${templateCode} result headers must be exactly ["", "RESULT"] - measured ${JSON.stringify(headers)}`);
    // Scoped to the header row, never the whole page: DENGUE_DUO's approved printed title is
    // "DENGUE DUO TEST", so a page-wide search for the word would reject the report's own title.
    assert(!headers.some((header) => /\bTEST\b/.test(header)), `${templateCode} must compose no TEST column heading - measured ${JSON.stringify(headers)}`);
    assert(!/REFERENCE VALUES/.test(pageText(serologyPage)), `${templateCode} must print no REFERENCE VALUES heading anywhere on the page`);
    // The names and the results themselves must survive the column removal.
    const definition = ReportDefinitionRegistry.getDefinition(templateCode)!;
    for (const parameter of definition.parameters) {
      const labelPrimitives = serologyPage.primitives.filter((primitive) => primitive.id.startsWith(`result-${parameter.parameterCode}-label`));
      const valuePrimitives = serologyPage.primitives.filter((primitive) => primitive.id.startsWith(`result-${parameter.parameterCode}-value`));
      assert(labelPrimitives.length > 0, `${templateCode}/${parameter.parameterCode} must still compose its test name`);
      assert(valuePrimitives.length > 0, `${templateCode}/${parameter.parameterCode} must still compose its result value`);
    }
  }

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
  const exportSection = engineSource.slice(
    engineSource.indexOf("const handleExportPDF"),
    engineSource.indexOf("const renderReportPage"));
  assert(exportSection.includes("createNativeSessionPdf") && !exportSection.includes("PDFStreamAdapter"),
    "PDF export must resolve through the native session composition");
  assert(!engineSource.includes("html2canvas"),
    "PDF export must not rasterize the DOM");
  assert(engineSource.includes("NativeLivePreviewPage"),
    "Live Preview must route unconditionally through NativeLivePreviewPage");
  assert(!engineSource.includes("previewRendererMode") && !engineSource.includes("PreviewRendererMode"), "Live Preview must have no selectable renderer mode");
  assert(engineSource.includes("NativeLivePreviewPage"), "Live Preview must route unconditionally through NativeLivePreviewPage");
  assert(!engineSource.includes("getReportLayout") && !engineSource.includes("<RenderingEngine"), "experimental preview infrastructure must be removed");
  assert(!engineSource.includes("CBC Pilot (Rollback)"), "the obsolete CBC pilot selector must be absent");
  assert(!/(localStorage|sessionStorage|useSearchParams|searchParams)/.test(engineSource), "preview mode must not be restored from browser or query persistence");

  process.stdout.write(`C4 verification passed: 17 native Live Preview routes; families ${JSON.stringify(familyCounts)}; draft/completed authority; optional signatures; upper-half enforcement; PDF routing preserved.\n`);
}

void main();
