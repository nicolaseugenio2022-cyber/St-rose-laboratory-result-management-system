import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import type { ILaboratoryReport, IPatientReportSession } from "../src/domain/models/interfaces";
import type { RendererFamily, SignatorySnapshot } from "../src/domain/types";
import type { ClinicalReportDefinition, ParameterSpec } from "../src/domain/types/report-definition";
import { resolveDraftSessionRenderModel } from "../src/rendering/model";
import {
  NativeLivePreviewPage,
  composeNativeLivePreviewReportPage,
  nativePrimitiveBottomMm,
} from "../src/rendering/native";
import { NATIVE_REPORT_THEME } from "../src/rendering/native/theme";
import type { NativeComposedPage, NativeImagePrimitive, NativeTextPrimitive } from "../src/rendering/native/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`C4.2 verification failed: ${message}`);
}

function rendererFamily(definition: ClinicalReportDefinition): RendererFamily {
  return definition.rendererFamily === "Dedicated Certificate"
    ? "NarrativeCertificate"
    : definition.rendererFamily as RendererFamily;
}

function signatory(
  role: "MedicalTechnologist" | "Pathologist",
  order: number,
  // The signature reference for THIS signatory, whatever its role. It was Pathologist-only while
  // the project's policy made a Medical Technologist textual; both roles may now hold one.
  signatureSource: string | null = "/optional-pathologist-signature.png"
): SignatorySnapshot {
  return {
    personnelId: `c42-${role}-${order}`,
    role,
    printedFullName: role === "Pathologist" ? "C4.2 PATHOLOGIST" : `C4.2 MEDTECH ${order}`,
    printedCredentials: role === "Pathologist" ? "MD, FPSP" : "RMT",
    printedPrcLicenseNumber: `C42-${order}`,
    signatureImageUrl: signatureSource,
    displayOrder: order,
  };
}

function inputValue(parameter: ParameterSpec): string {
  if (parameter.parameterCode === "CHOLESTEROL") return "150";
  if (parameter.parameterCode === "TRIGLYCERIDES") return "700";
  if (parameter.parameterCode === "WBC") return "0-2 /HPF";
  if (parameter.parameterCode === "RBC") return ">50 /HPF";
  if (parameter.parameterCode === "AMORPHOUS_CRYSTAL" || parameter.inputType === "Computed") return "";
  if (parameter.inputType === "NumericText") return "100";
  return parameter.defaultValue ?? parameter.options?.[0] ?? "ENTERED VALUE";
}

function reportFor(
  definition: ClinicalReportDefinition,
  pathologistSignature: string | null = "/optional-pathologist-signature.png",
  // A Medical Technologist may now hold a signature. Defaulted to none so every existing fixture
  // keeps the exact signatory shape it had, and only the case that opts in changes.
  medtechSignature: string | null = null
): ILaboratoryReport {
  const isCertificate = definition.rendererFamily === "Dedicated Certificate" || definition.rendererFamily === "NarrativeCertificate";
  return {
    id: `c42-${definition.templateCode}`,
    sessionId: "session-c42",
    templateCode: definition.templateCode,
    templateTitle: definition.templateTitle,
    rendererFamily: rendererFamily(definition),
    remarks: "Exact resolved remarks.",
    reagentKitInfo: definition.requiresKitInfo
      ? { kitBrand: "", lotNumber: "LOT-C42", expirationDate: "2032-08-10" }
      : null,
    encodingData: {
      requestedBy: "REQUESTED PHYSICIAN",
      additionalFields: { examinationDateTime: "2026-08-10 10:30", companyName: "ST. ROSE CLIENT" },
      repeatableFindings: {},
    },
    results: definition.parameters.map((parameter) => ({
      id: `${definition.templateCode}-${parameter.parameterCode}`,
      reportId: `c42-${definition.templateCode}`,
      parameterCode: parameter.parameterCode,
      parameterName: parameter.parameterName,
      resultValue: inputValue(parameter),
      evaluationOutcome: "NoEvaluation",
      displayOrder: parameter.displayOrder,
    })),
    signatories: isCertificate
      ? [signatory("MedicalTechnologist", 1, medtechSignature), signatory("MedicalTechnologist", 2, medtechSignature), signatory("Pathologist", 3, pathologistSignature)]
      : [signatory("Pathologist", 1, pathologistSignature), signatory("MedicalTechnologist", 2, medtechSignature)],
  };
}

function sessionFor(reports: ILaboratoryReport[]): IPatientReportSession {
  return {
    id: "session-c42",
    accessionNumber: "ACC-C42",
    status: "Draft",
    demographics: {
      fullName: "Maria Rosario Dela Cruz",
      age: 34,
      ageUnit: "years",
      sex: "Female",
      address: "Sta. Rosa, Nueva Ecija",
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

function textPrimitives(page: NativeComposedPage): NativeTextPrimitive[] {
  return page.primitives.filter((primitive): primitive is NativeTextPrimitive => primitive.kind === "text");
}

function textForPrefix(page: NativeComposedPage, prefix: string): string {
  return textPrimitives(page)
    .filter((primitive) => primitive.id.startsWith(prefix))
    .map((primitive) => primitive.text)
    .join(" ");
}

function compactDisplay(value: string | null | undefined): string {
  return (value || "").toLocaleLowerCase().replaceAll("×", "x").replace(/\s+/g, "");
}

function displayOwnsUnit(display: string | null | undefined, unit: string | null | undefined): boolean {
  return Boolean(display?.trim() && unit?.trim() && compactDisplay(display).includes(compactDisplay(unit)));
}

function textCoordinates(page: NativeComposedPage, id: string) {
  const primitive = textPrimitives(page).find((candidate) => candidate.id === id);
  assert(primitive, `${id} must be rendered`);
  return { x: primitive.x, y: primitive.y, width: primitive.width, height: primitive.height };
}

function imageById(page: NativeComposedPage, id: string): NativeImagePrimitive | undefined {
  return page.primitives.find((primitive): primitive is NativeImagePrimitive => primitive.kind === "image" && primitive.id === id);
}

function primitiveTopMm(page: NativeComposedPage, id: string): number {
  const primitive = page.primitives.find((candidate) => candidate.id === id);
  assert(primitive, `${id} must be rendered`);
  return primitive.kind === "line" ? Math.min(primitive.y1, primitive.y2) : primitive.y;
}

function primitiveBottomByIdMm(page: NativeComposedPage, id: string): number {
  const primitive = page.primitives.find((candidate) => candidate.id === id);
  assert(primitive, `${id} must be rendered`);
  return nativePrimitiveBottomMm(primitive);
}

function pageDimensions(markup: string): { width: number; height: number } {
  const match = /data-native-report-preview="[^"]+"[^>]*style="[^"]*width:([\d.]+)px;height:([\d.]+)px/.exec(markup);
  assert(match, "native preview markup must expose physical A4 dimensions");
  return { width: Number(match[1]), height: Number(match[2]) };
}

function approximately(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < 0.001;
}

async function main(): Promise<void> {
  const definitions = ReportDefinitionRegistry.getAllDefinitions();
  assert(definitions.length === 17, "all 17 definitions must remain registered");
  const draftSession = sessionFor(definitions.map((definition) => reportFor(definition)));
  const resolved = resolveDraftSessionRenderModel(draftSession);
  const pages = new Map<string, NativeComposedPage>();
  const familyCounts: Record<string, number> = {};

  for (const report of resolved.reports) {
    const page = composeNativeLivePreviewReportPage(resolved, report);
    pages.set(report.templateCode, page);
    familyCounts[report.layoutFamily] = (familyCounts[report.layoutFamily] || 0) + 1;
    assert(page.compositionSource === report.layoutFamily, `${report.templateCode} must use its declarative production composer`);
    assert(page.widthMm === 210 && page.heightMm === 297, `${report.templateCode} must remain A4`);
    assert(page.contentBottomMm <= 148.5, `${report.templateCode} content must remain in the upper half`);
    assert(page.primitives.every((primitive) => nativePrimitiveBottomMm(primitive) <= 148.5001), `${report.templateCode} primitives must remain bounded`);
    assert(!textPrimitives(page).some((primitive) => /page\s*\d+/i.test(primitive.text)), `${report.templateCode} must not add a page number`);
    assert(page.primitives.filter((primitive) => primitive.kind === "image").every((primitive) => primitive.source === "/st-rose-logo-official.png" || primitive.failurePolicy === "OmitImage"), `${report.templateCode} must not use a raster report background`);
    // SUPERSEDED: this required that a Medical Technologist could NEVER carry a signature image.
    // The laboratory has since decided a MedTech may sign, so the rule is no longer about the ROLE
    // - it is that an image is composed exactly when that slot carries a resolved signature asset,
    // and never otherwise. Stated as an equivalence rather than an absence, so it stays meaningful
    // in both directions instead of passing vacuously on a fixture whose signatories have none.
    // Scoped to the shared standard signatory band. The HIV certificate composes its own columns
    // with their own primitive ids and is asserted separately, below.
    if (report.layoutFamily !== "Certificate") {
      for (const slot of report.signatories) {
        const slotImageId = slot.personnelRole === "Pathologist" ? "pathologist-signature" : "medical-technologist-signature";
        const hasImage = page.primitives.some((primitive) => primitive.kind === "image" && primitive.id === slotImageId);
        assert(hasImage === Boolean(slot.signatureAsset), `${report.templateCode}/${slot.slotId} composes a signature image exactly when it has one on file`);
      }
    }
    const logo = imageById(page, "official-logo");
    assert(logo?.width === 18 && logo.height === 18 && logo.fit === "contain", `${report.templateCode} must retain the declared physical logo box`);
    assert(logo.x === 15 && logo.y === 4 && logo.y + logo.height === 22, `${report.templateCode} logo must occupy the approved 18 x 18 mm header band at x = 15 mm, ending 1.5 mm above the divider`);
  }

  assert(JSON.stringify(familyCounts) === JSON.stringify({ StandardAdaptiveTabular: 6, CompactResultGrid: 9, Certificate: 1, MicroscopyTwoColumn: 1 }), "all four layout families must remain represented");

  for (const report of resolved.reports) {
    const page = pages.get(report.templateCode)!;
    for (const result of report.results.filter((candidate) => candidate.omission === "Render")) {
      const renderedReference = textForPrefix(page, `result-${result.parameterCode}-reference`);
      if (result.referenceDisplay) {
        assert(compactDisplay(renderedReference) === compactDisplay(result.referenceDisplay), `${report.templateCode}/${result.parameterCode} must preserve referenceDisplay exactly`);
      }
      if (!result.unitDisplay) continue;
      assert(!page.primitives.some((primitive) => primitive.id.startsWith(`result-${result.parameterCode}-unit`)), `${report.templateCode}/${result.parameterCode} must not create a fourth unit pseudo-column`);
      const renderedResult = textForPrefix(page, `result-${result.parameterCode}-value`);
      const unitOwnedByExistingDisplay = displayOwnsUnit(result.formattedValue, result.unitDisplay) || displayOwnsUnit(result.referenceDisplay, result.unitDisplay);
      const expectedResult = unitOwnedByExistingDisplay
        ? result.formattedValue
        : result.formattedValue ? `${result.formattedValue} ${result.unitDisplay}` : result.unitDisplay;
      assert(compactDisplay(renderedResult) === compactDisplay(expectedResult), `${report.templateCode}/${result.parameterCode} must retain its unit in the declared RESULT or reference owner`);
    }
  }

  const cbcReport = resolved.reports.find((report) => report.templateCode === "CBC")!;
  const cbc = pages.get("CBC")!;

  // QA-04 abnormal markers. The corpus above cannot prove the Low branch on its own - its only two
  // Low outcomes sit on CBC, which suppresses markers - so one dedicated CHEM_8 fixture drives every
  // outcome reachable on that template, and a marker-free twin of identical string lengths makes the
  // geometry claim falsifiable rather than merely asserted.
  const chem8Definition = ReportDefinitionRegistry.getDefinition("CHEM_8")!;
  const markedInputs: Record<string, string> = {
    FBS: "50",            // 70-110 -> Low
    CHOLESTEROL: "150",   // < 200  -> Normal
    TRIGLYCERIDES: "700", // 35-165 -> High
    URIC_ACID: "",        //        -> NoEvaluation
    SGPT: "abc",          //        -> Invalid
    CREATININE: "1.0",    // 0.4-1.4 -> Normal
  };
  // Same character counts as the marked pair, so the twin differs only in outcome, never in wrapping.
  const unmarkedInputs: Record<string, string> = { ...markedInputs, FBS: "90", TRIGLYCERIDES: "100" };
  const chem8With = (inputs: Record<string, string>): ILaboratoryReport => {
    const base = reportFor(chem8Definition);
    return {
      ...base,
      results: base.results.map((result) => ({ ...result, resultValue: inputs[result.parameterCode] ?? result.resultValue })),
    };
  };
  const markedModel = resolveDraftSessionRenderModel(sessionFor([chem8With(markedInputs)]));
  const markedReport = markedModel.reports[0];
  const markedPage = composeNativeLivePreviewReportPage(markedModel, markedReport);
  const unmarkedModel = resolveDraftSessionRenderModel(sessionFor([chem8With(unmarkedInputs)]));
  const unmarkedPage = composeNativeLivePreviewReportPage(unmarkedModel, unmarkedModel.reports[0]);

  const markerPrimitives = (page: NativeComposedPage): NativeTextPrimitive[] =>
    textPrimitives(page).filter((primitive) => primitive.id.endsWith("-indicator"));
  const markerFor = (page: NativeComposedPage, parameterCode: string): NativeTextPrimitive[] =>
    markerPrimitives(page).filter((primitive) => primitive.id === `result-${parameterCode}-indicator`);

  const markedOutcomes = new Map(markedReport.results.map((result) => [result.parameterCode, result.evaluationOutcome]));
  assert(
    markedOutcomes.get("FBS") === "Low" && markedOutcomes.get("TRIGLYCERIDES") === "High"
      && markedOutcomes.get("CHOLESTEROL") === "Normal" && markedOutcomes.get("CREATININE") === "Normal"
      && markedOutcomes.get("URIC_ACID") === "NoEvaluation" && markedOutcomes.get("SGPT") === "Invalid",
    `the QA-04 fixture must actually reach Low, High, Normal, NoEvaluation and Invalid or the marker assertions prove nothing - measured ${JSON.stringify(Object.fromEntries(markedOutcomes))}`
  );

  // REPORT-QA-01 replaces the QA-04 H / L initials with the complete words. The marker text is
  // pinned by exact equality, so an initial - or any abbreviation of either word - fails here.
  assert(markerFor(markedPage, "FBS").length === 1 && markerFor(markedPage, "FBS")[0].text === "LOW", `a Low result must render exactly one complete-word LOW marker - measured ${JSON.stringify(markerFor(markedPage, "FBS").map((primitive) => primitive.text))}`);
  assert(markerFor(markedPage, "TRIGLYCERIDES").length === 1 && markerFor(markedPage, "TRIGLYCERIDES")[0].text === "HIGH", `a High result must render exactly one complete-word HIGH marker - measured ${JSON.stringify(markerFor(markedPage, "TRIGLYCERIDES").map((primitive) => primitive.text))}`);
  assert(markerPrimitives(markedPage).length === 2, `Normal, Invalid and NoEvaluation results must render no marker - measured ${markerPrimitives(markedPage).map((primitive) => primitive.id).join(", ")}`);

  const fbs = markedReport.results.find((result) => result.parameterCode === "FBS")!;
  const fbsUnitOwned = displayOwnsUnit(fbs.formattedValue, fbs.unitDisplay) || displayOwnsUnit(fbs.referenceDisplay, fbs.unitDisplay);
  const fbsExpectedValueText = fbsUnitOwned ? fbs.formattedValue : `${fbs.formattedValue} ${fbs.unitDisplay}`;
  assert(compactDisplay(textForPrefix(markedPage, "result-FBS-value")) === compactDisplay(fbsExpectedValueText), "the marker must never be concatenated into the RESULT value text");

  for (const marker of markerPrimitives(markedPage)) {
    const parameterCode = marker.id.slice("result-".length, -"-indicator".length);
    const valueLine = textPrimitives(markedPage).find((primitive) => primitive.id === `result-${parameterCode}-value-line-1`);
    assert(valueLine, `${parameterCode} must still render its own RESULT value line beside the marker`);
    assert(marker.fontWeight === "bold" && marker.text === marker.text.toLocaleUpperCase(), `${parameterCode} marker must be bold and uppercase`);
    // The complete word is what carries the clinical meaning, so the printed marker may only ever be
    // one of the two approved words - never an initial, and never a truncation of either.
    assert(marker.text === "HIGH" || marker.text === "LOW", `${parameterCode} marker must print the complete word HIGH or LOW - measured "${marker.text}"`);
    const expectedTone = marker.text === "HIGH" ? NATIVE_REPORT_THEME.colors.abnormalHigh : NATIVE_REPORT_THEME.colors.abnormalLow;
    assert(marker.color === expectedTone, `${parameterCode} marker must carry its semantic QA-04 tone`);
    assert(marker.width != null && valueLine.width != null, `${parameterCode} marker and value line must both declare a measurable box`);
    assert(marker.x >= valueLine.x && marker.x + marker.width <= valueLine.x + valueLine.width, `${parameterCode} marker must sit inside the existing RESULT column and create no fourth column`);
    assert(approximately(nativePrimitiveBottomMm(marker), nativePrimitiveBottomMm(valueLine)), `${parameterCode} marker must share the value line's vertical box so the row gains no height`);
  }

  assert(markerPrimitives(unmarkedPage).length === 0, "the marker-free twin must carry no marker or it cannot isolate the marker's geometric cost");
  assert(approximately(markedPage.contentBottomMm, unmarkedPage.contentBottomMm), `markers must not move contentBottomMm - marked ${markedPage.contentBottomMm}, unmarked ${unmarkedPage.contentBottomMm}`);
  assert(approximately(primitiveBottomByIdMm(markedPage, "result-grid-bottom"), primitiveBottomByIdMm(unmarkedPage, "result-grid-bottom")), "the result grid must close at the same y with and without markers");

  // QA-04 retired CBC suppression: CBC participates in the shared output policy, which REPORT-QA-01
  // now expresses as the complete words HIGH and LOW.
  const cbcRendered = cbcReport.results.filter((result) => result.omission === "Render");
  const cbcHighs = cbcRendered.filter((result) => result.evaluationOutcome === "High");
  const cbcLows = cbcRendered.filter((result) => result.evaluationOutcome === "Low");
  assert(cbcHighs.length > 0 && cbcLows.length > 0, `the CBC fixture must genuinely produce both High and Low outcomes or the marker coverage proves nothing - measured High ${cbcHighs.length}, Low ${cbcLows.length}`);
  assert(markerPrimitives(cbc).length === cbcHighs.length + cbcLows.length, `CBC must render exactly one marker per High or Low result - expected ${cbcHighs.length + cbcLows.length}, measured ${markerPrimitives(cbc).length}`);
  for (const result of cbcRendered) {
    const markers = markerFor(cbc, result.parameterCode);
    if (result.evaluationOutcome === "High") {
      assert(markers.length === 1 && markers[0].text === "HIGH" && markers[0].fontWeight === "bold" && markers[0].color === NATIVE_REPORT_THEME.colors.abnormalHigh, `CBC ${result.parameterCode} High must render exactly one bold complete-word HIGH in the abnormalHigh token`);
    } else if (result.evaluationOutcome === "Low") {
      assert(markers.length === 1 && markers[0].text === "LOW" && markers[0].fontWeight === "bold" && markers[0].color === NATIVE_REPORT_THEME.colors.abnormalLow, `CBC ${result.parameterCode} Low must render exactly one bold complete-word LOW in the abnormalLow token`);
    } else {
      assert(markers.length === 0, `CBC ${result.parameterCode} (${result.evaluationOutcome}) must render no abnormal marker`);
    }
  }
  // Every CBC marker stays inside the RESULT column and shares its row's first value line, so no
  // fourth column appears and no row grows.
  for (const marker of markerPrimitives(cbc)) {
    const parameterCode = marker.id.slice("result-".length, -"-indicator".length);
    const valueLine = textPrimitives(cbc).find((primitive) => primitive.id === `result-${parameterCode}-value-line-1`);
    assert(valueLine && marker.width != null && valueLine.width != null, `CBC ${parameterCode} marker and value line must both declare a measurable box`);
    assert(marker.x >= valueLine.x && marker.x + marker.width <= valueLine.x + valueLine.width, `CBC ${parameterCode} marker must sit inside the existing RESULT column and create no fourth column`);
    assert(approximately(nativePrimitiveBottomMm(marker), nativePrimitiveBottomMm(valueLine)), `CBC ${parameterCode} marker must share the value line's vertical box so the row gains no height`);
  }
  // The pre-QA-04 CBC geometry and grid contracts must survive the markers untouched.
  assert(approximately(cbc.contentBottomMm, 130.65), `CBC contentBottomMm must remain exactly 130.65 mm after QA-04 - measured ${cbc.contentBottomMm}`);
  // The three-column heading contract is already pinned below; not duplicated here.
  const cbcStripes = cbc.primitives.filter((primitive) => /^result-.+-stripe$/.test(primitive.id));
  assert(cbcStripes.length === Math.floor(cbcRendered.length / 2) && cbcStripes.every((primitive) => primitive.kind === "rect" && primitive.fill === NATIVE_REPORT_THEME.colors.tealTint), `CBC zebra striping must remain one tealTint fill on every second row - expected ${Math.floor(cbcRendered.length / 2)}, measured ${cbcStripes.length}`);
  // No template may reintroduce a suppression exception. Placed after the CBC marker assertions on
  // purpose: restoring CBC suppression must surface as a missing marker, not as a flag mismatch.
  const suppressingDefinitions = definitions.filter((definition) => definition.suppressAbnormalIndicators === true);
  assert(definitions.length === 17 && suppressingDefinitions.length === 0, `no registered definition may declare an active abnormal-indicator suppression exception - measured ${suppressingDefinitions.map((definition) => definition.templateCode).join(", ") || "none"}`);
  const at100 = renderToStaticMarkup(React.createElement(NativeLivePreviewPage, { resolvedSession: resolved, resolvedReport: cbcReport, reportTitle: "CBC", zoomLevel: 100 }));
  const at75 = renderToStaticMarkup(React.createElement(NativeLivePreviewPage, { resolvedSession: resolved, resolvedReport: cbcReport, reportTitle: "CBC", zoomLevel: 75 }));
  const dimensions100 = pageDimensions(at100);
  const dimensions75 = pageDimensions(at75);
  assert(at100.includes('data-live-preview-scale="1"') && !at100.includes("transform:scale"), "toolbar 100% must have one scale owner at native scale 1.0");
  assert(at75.includes('data-live-preview-scale="0.75"') && !at75.includes("transform:scale"), "toolbar 75% must have one scale owner at native scale 0.75");
  assert(approximately(dimensions100.width, 210 * 96 / 25.4) && approximately(dimensions100.height, 297 * 96 / 25.4), "100% must emit physical A4 CSS dimensions");
  assert(approximately(dimensions75.width, dimensions100.width * 0.75) && approximately(dimensions75.height, dimensions100.height * 0.75), "75% must scale the complete A4 page uniformly");
  assert(at100.includes('data-live-preview-composition-provider="StandardNative"') && at100.includes('data-live-preview-composition-source="StandardAdaptiveTabular"'), "manual provenance must remain exposed as machine-readable attributes");

  const moduleRuntime = await import("node:module");
  const extensionRuntime = moduleRuntime.default as unknown as { _extensions: Record<string, (module: unknown, filename: string) => void> };
  extensionRuntime._extensions[".css"] = () => undefined;
  const { SharedRenderingEngine } = await import("../src/rendering/SharedRenderingEngine");
  const cbcDraftReport = draftSession.reports.find((report) => report.templateCode === "CBC")!;
  const multiReportSession = {
    ...draftSession,
    reports: [cbcDraftReport, ...draftSession.reports.filter((report) => report.templateCode !== "CBC")],
  };
  const engineMarkup = renderToStaticMarkup(React.createElement(SharedRenderingEngine, {
    session: multiReportSession,
    targetOutput: "ScreenPreview",
  }));
  assert((engineMarkup.match(/data-native-report-preview=/g) || []).length === 1, "Native mode must mount exactly one visible Native report page");
  assert(engineMarkup.includes('data-native-report-preview="CBC"') && engineMarkup.includes('data-live-preview-composition-provider="StandardNative"') && engineMarkup.includes('data-live-preview-composition-source="StandardAdaptiveTabular"'), "the selected CBC page must expose StandardNative / StandardAdaptiveTabular provenance as machine-readable attributes");
  assert(!engineMarkup.includes('data-live-preview-renderer="legacy"'), "Native mode must not mount a legacy comparison renderer");
  assert(!engineMarkup.includes('data-live-preview-renderer="experimental"'), "Native mode must not mount an experimental comparison renderer");
  assert(!engineMarkup.includes('data-live-preview-renderer="legacy-export"') && !engineMarkup.includes("data-c4-preserved-pdf-route"), "the print/export clone must not mount during normal Live Preview");
  assert(engineMarkup.includes('data-live-preview-viewport="true"') && engineMarkup.includes("overflow-auto"), "the preview viewport must own horizontal and vertical overflow");
  assert(engineMarkup.includes('data-live-preview-page-track="true"') && engineMarkup.includes("w-max") && engineMarkup.includes("min-w-full"), "the page track must preserve page width while centering only when space permits");
  assert(engineMarkup.includes("shrink-0"), "the physical A4 page wrapper must not flex-shrink in a narrow viewport");

  assert(!cbc.primitives.some((primitive) => primitive.id.endsWith("-fill") && primitive.id.startsWith("demographics-row")), "CBC demographics must not use continuous spreadsheet row fills");
  assert(cbc.primitives.some((primitive) => primitive.id === "demographics-top-rule") && cbc.primitives.some((primitive) => primitive.id === "demographics-row-3-bottom"), "demographics must use restrained group-level separators");
  assert(approximately(NATIVE_REPORT_THEME.header.contentStartYmm - NATIVE_REPORT_THEME.header.dividerYmm, 3), "the approved compact header-to-content rhythm must be restored");
  assert(approximately(primitiveTopMm(cbc, "demographics-top-rule"), NATIVE_REPORT_THEME.header.contentStartYmm), "CBC demographics must begin at the shared post-header content position");
  assert(approximately(primitiveTopMm(cbc, "demographic-name-label") - primitiveTopMm(cbc, "demographics-top-rule"), NATIVE_REPORT_THEME.sectionInsets.demographicsTopMm + 0.25), "the first demographic labels must use only the shared internal top inset below their rule");
  assert(approximately(primitiveTopMm(cbc, "result-header-fill"), primitiveTopMm(cbc, "demographics-row-3-bottom")), "title-less CBC must not retain the reverted broad inter-section gap");
  assert(approximately(primitiveTopMm(cbc, "result-HEMOGLOBIN-label-line-1") - primitiveTopMm(cbc, "result-header-rule"), NATIVE_REPORT_THEME.sectionInsets.resultBodyTopMm + 0.25), "the first CBC result row must use the shared internal inset below the header rule");
  // QA-08 deliberately reverses the C4.2 group-only separator rule this assertion used to encode.
  // It is replaced, not dropped: both composition paths must now positively carry one zero-height
  // hairline at every INTERNAL result-row boundary and none after the final row, so the divider can
  // never cost vertical space and can never be confused with the closing rule asserted below.
  const cbcRenderedResultCount = cbcReport.results.filter((result) => result.omission === "Render").length;
  const cbcGridBottomMm = primitiveTopMm(cbc, "result-grid-bottom");
  const cbcRowSeparators = cbc.primitives.filter((primitive) => /^result-(?!grid-).+-bottom$/.test(primitive.id));
  assert(cbcRenderedResultCount > 1 && cbcRowSeparators.length === cbcRenderedResultCount - 1 && cbcRowSeparators.every((primitive) => primitive.kind === "line" && primitive.color === NATIVE_REPORT_THEME.colors.separator && primitive.widthMm === 0.12 && primitive.y1 === primitive.y2 && primitive.y1 < cbcGridBottomMm), "the shared Standard result grid must divide adjacent result rows with a zero-height hairline at every internal boundary and none after the final result");

  const urinalysisColumns = pages.get("URINALYSIS")!;
  const microscopySectionIds = urinalysisColumns.primitives
    .filter((primitive) => /^microscopy-.+-header-rule$/.test(primitive.id))
    .map((primitive) => primitive.id.slice("microscopy-".length, -"-header-rule".length));
  assert(microscopySectionIds.length === 2 && microscopySectionIds.every((sectionId) => {
    const rowCount = urinalysisColumns.primitives.filter((primitive) => new RegExp(`^microscopy-${sectionId}-.+-label-line-1$`).test(primitive.id)).length;
    const columnBottomMm = primitiveTopMm(urinalysisColumns, `microscopy-${sectionId}-bottom`);
    const separators = urinalysisColumns.primitives.filter((primitive) => new RegExp(`^microscopy-${sectionId}-.+-bottom$`).test(primitive.id));
    return rowCount > 1 && separators.length === rowCount - 1 && separators.every((primitive) => primitive.kind === "line" && primitive.color === NATIVE_REPORT_THEME.colors.separator && primitive.widthMm === 0.12 && primitive.y1 === primitive.y2 && primitive.y1 < columnBottomMm);
  }), "each Urinalysis microscopy column must divide adjacent declared result rows with a zero-height hairline at every internal boundary and none after its final result");
  assert(cbc.primitives.some((primitive) => primitive.id === "result-grid-bottom"), "result groups must retain one closing rule");
  assert(textPrimitives(cbc).find((primitive) => primitive.id === "result-HEMOGLOBIN-value-line-1")?.fontSizePt === NATIVE_REPORT_THEME.typography.resultValuePt, "result values must use the strengthened hierarchy");
  assert(!cbc.primitives.some((primitive) => primitive.kind === "rect" && ["#8064A2", "#DFD8E8", "#F8A8B8"].includes(primitive.fill || "")), "CBC must not use legacy purple or dominant pink fills");
  const cbcHeaders = [1, 2, 3].map((index) => textPrimitives(cbc).find((primitive) => primitive.id === `result-header-${index}`)?.text);
  assert(JSON.stringify(cbcHeaders) === JSON.stringify(["EXAMINATION", "RESULT", "NORMAL VALUES"]), "CBC must expose exactly its three declared result columns");
  assert(!cbc.primitives.some((primitive) => /result-.+-unit/.test(primitive.id)), "CBC must not emit an undeclared fourth unit column");
  const cbcHemoglobin = cbcReport.results.find((result) => result.parameterCode === "HEMOGLOBIN")!;
  assert(compactDisplay(textForPrefix(cbc, "result-HEMOGLOBIN-reference")) === compactDisplay(cbcHemoglobin.referenceDisplay), "CBC Hemoglobin referenceDisplay must remain unchanged");

  const hba1c = pages.get("HBA1C")!;
  assert(approximately(primitiveTopMm(hba1c, "result-HBA1C_RESULT-label-line-1") - primitiveTopMm(hba1c, "result-header-rule"), NATIVE_REPORT_THEME.sectionInsets.resultBodyTopMm + 0.25), "CompactResultGrid must use the same first-row inset");
  assert((textForPrefix(hba1c, "result-HBA1C_RESULT-value").match(/%/g) || []).length === 1, "HbA1c fixed percent suffix must appear exactly once in RESULT");
  for (const [code, parameterCodes] of [["FECALYSIS", ["PUS_CELLS", "RED_CELLS"]], ["URINALYSIS", ["WBC", "RBC"]]] as const) {
    const page = pages.get(code)!;
    for (const parameterCode of parameterCodes) {
      assert((textForPrefix(page, `${code === "URINALYSIS" ? "microscopy-" : "result-"}${code === "URINALYSIS" ? `microscopic-${parameterCode}` : parameterCode}-value`).match(/\/HPF/g) || []).length === 1, `${code}/${parameterCode} must render /HPF exactly once`);
    }
  }

  const cbcDefinition = ReportDefinitionRegistry.getDefinition("CBC")!;
  const composeCbcWithSignature = (signatureSource: string | null, medtechSignatureSource: string | null = null) => {
    const signatureSession = resolveDraftSessionRenderModel(sessionFor([reportFor(cbcDefinition, signatureSource, medtechSignatureSource)]));
    return composeNativeLivePreviewReportPage(signatureSession, signatureSession.reports[0]);
  };
  const signaturePresentPage = composeCbcWithSignature("/optional-pathologist-signature.png");
  const signatureAbsentPage = composeCbcWithSignature(null);
  const signatureMalformedPage = composeCbcWithSignature("javascript:invalid");
  for (const suffix of ["name", "license", "role"] as const) {
    const pathologistId = `pathologist-${suffix}`;
    const medtechId = `medical-technologist-${suffix}`;
    assert(textCoordinates(signaturePresentPage, pathologistId).y === textCoordinates(signaturePresentPage, medtechId).y, `standard ${suffix} baselines must align`);
    assert(JSON.stringify(textCoordinates(signaturePresentPage, pathologistId)) === JSON.stringify(textCoordinates(signatureAbsentPage, pathologistId)), `Pathologist ${suffix} coordinates must not depend on signature presence`);
    assert(JSON.stringify(textCoordinates(signaturePresentPage, medtechId)) === JSON.stringify(textCoordinates(signatureAbsentPage, medtechId)), `MedTech ${suffix} coordinates must not depend on Pathologist signature presence`);
    assert(JSON.stringify(textCoordinates(signatureAbsentPage, pathologistId)) === JSON.stringify(textCoordinates(signatureMalformedPage, pathologistId)), `malformed signatures must preserve Pathologist ${suffix} geometry`);
  }
  assert(imageById(signaturePresentPage, "pathologist-signature")?.failurePolicy === "OmitImage", "valid Pathologist signatures must retain optional omission behavior");
  // The enlarged frame deliberately overlaps the upper part of the name row, so a positive
  // clearance below the image is no longer the contract. What is pinned instead is the exact
  // overlap, which keeps the typed name readable and the licence and role rows untouched.
  // Coordinates are text tops (first-line Y), never typographic baselines.
  const standardSignature = imageById(signaturePresentPage, "pathologist-signature")!;
  const standardNameTextTop = primitiveTopMm(signaturePresentPage, "pathologist-name");
  assert(standardSignature.width === 24 && standardSignature.height === 10, "the Standard Pathologist signature must use the approved 24 x 10 mm frame");
  assert(standardSignature.x === 48 && standardSignature.x + standardSignature.width / 2 === 60, "the Standard Pathologist signature must remain centred at x = 48 mm with centre 60 mm");
  assert(Math.abs(standardSignature.y - (standardNameTextTop - 8.75)) < 0.001, "the Standard Pathologist signature top must sit exactly 8.75 mm above the name text top");
  assert(Math.abs(primitiveBottomByIdMm(signaturePresentPage, "pathologist-signature") - standardNameTextTop - 1.25) < 0.001, "the Standard Pathologist signature must overlap the name row by exactly 1.25 mm");
  assert(!imageById(signatureAbsentPage, "pathologist-signature") && !imageById(signatureMalformedPage, "pathologist-signature"), "absent or malformed Pathologist signatures must create no image primitive");
  // SUPERSEDED: the Medical Technologist column was text-only by policy. A MedTech may now sign,
  // and its signature is composed by the SAME rule as the Pathologist's - so the proof is that the
  // two frames are mirror images of each other, not that one of them is absent.
  assert(!signaturePresentPage.primitives.some((primitive) => primitive.kind === "image" && primitive.id.includes("medical-technologist")), "a Medical Technologist with no signature on file still creates no image");
  const medtechSignedPage = composeCbcWithSignature("/optional-pathologist-signature.png", "/optional-medtech-signature.png");
  const medtechSignature = imageById(medtechSignedPage, "medical-technologist-signature")!;
  const medtechNameTextTop = primitiveTopMm(medtechSignedPage, "medical-technologist-name");
  assert(medtechSignature !== undefined, "a Medical Technologist with a signature on file composes one");
  assert(medtechSignature.width === 24 && medtechSignature.height === 10, "the Medical Technologist signature must use the same approved 24 x 10 mm frame as the Pathologist");
  assert(medtechSignature.x === 138 && medtechSignature.x + medtechSignature.width / 2 === 150, "the Medical Technologist signature must be centred in its own half of the band");
  assert(Math.abs(medtechSignature.y - (medtechNameTextTop - 8.75)) < 0.001, "the Medical Technologist signature top must sit exactly 8.75 mm above its name text top, as the Pathologist's does");
  assert(Math.abs(medtechSignature.y - imageById(medtechSignedPage, "pathologist-signature")!.y) < 0.001, "both signature frames must share one baseline");
  // The MedTech signature must not disturb anything that was already measured.
  assert(Math.abs(medtechSignedPage.contentBottomMm - signaturePresentPage.contentBottomMm) < 0.001, "adding a Medical Technologist signature must not move the report bottom");
  assert(Math.abs(primitiveTopMm(medtechSignedPage, "pathologist-name") - primitiveTopMm(signaturePresentPage, "pathologist-name")) < 0.001, "adding a Medical Technologist signature must not move the Pathologist column");
  // ...and a report whose MedTech has no signature still renders, which is the degradation rule.
  assert(imageById(signatureAbsentPage, "medical-technologist-signature") === undefined, "a report generates normally when neither signatory has a signature image");

  const hiv = pages.get("HIV_RESULT")!;
  const hivNameIds = ["certificate-examiner-name", "certificate-pathologist-name", "certificate-verifier-name"];
  const hivRoleIds = ["certificate-examiner-role", "certificate-pathologist-role", "certificate-verifier-role"];
  assert(hivNameIds.every((id) => textPrimitives(hiv).some((primitive) => primitive.id === id)) && hivRoleIds.every((id) => textPrimitives(hiv).some((primitive) => primitive.id === id)), "HIV must render all three signatory names and roles before their order can be judged");
  assert(new Set(hivNameIds.map((id) => textCoordinates(hiv, id).y)).size === 1, "HIV signatory name baselines must align");
  assert(new Set(hivRoleIds.map((id) => textCoordinates(hiv, id).y)).size === 1, "HIV signatory role baselines must align");
  // Exact coordinates, not a sorted-copy comparison: a sorted list equals itself when two or three
  // columns share an x, so the previous form passed for a collapsed layout. These fail closed.
  const hivNameXs = hivNameIds.map((id) => textCoordinates(hiv, id).x);
  const hivRoleXs = hivRoleIds.map((id) => textCoordinates(hiv, id).x);
  assert(hivNameXs.join(",") === "17,77,137", `HIV signatory names must sit at exactly 17, 77 and 137 mm as Examiner, Pathologist, Verifier - measured ${hivNameXs.join(",")}`);
  assert(hivRoleXs.join(",") === "17,77,137", `HIV signatory roles must sit at exactly 17, 77 and 137 mm as Examiner, Pathologist, Verifier - measured ${hivRoleXs.join(",")}`);
  assert(hivNameXs[0] < hivNameXs[1] && hivNameXs[1] < hivNameXs[2] && hivRoleXs[0] < hivRoleXs[1] && hivRoleXs[1] < hivRoleXs[2], "HIV signatory columns must be strictly left to right, with no two columns sharing a coordinate");

  // Heading association. Ordering alone cannot detect swapped headings, because both headings keep
  // their column coordinates when only their text is exchanged. The labels are read from the
  // resolved static content rather than restated here, so no wording is invented or normalised.
  const hivStaticContent = resolved.reports.find((report) => report.templateCode === "HIV_RESULT")!.staticContent;
  assert(Boolean(hivStaticContent), "HIV must resolve its static certificate content before its headings can be judged");
  const hivExaminerHeading = textPrimitives(hiv).find((primitive) => primitive.id === "certificate-examiner-heading");
  const hivVerifierHeading = textPrimitives(hiv).find((primitive) => primitive.id === "certificate-verifier-heading");
  assert(Boolean(hivExaminerHeading) && Boolean(hivVerifierHeading), "HIV must render both the Performed By and Verified By column headings");
  assert(hivExaminerHeading!.text === hivStaticContent!.signatoryLabels.performedBy && hivExaminerHeading!.x === 16, `the Performed By heading must carry the resolved label and remain on the left Examiner column at 16 mm - measured "${hivExaminerHeading!.text}" at ${hivExaminerHeading!.x}`);
  assert(hivVerifierHeading!.text === hivStaticContent!.signatoryLabels.verifiedBy && hivVerifierHeading!.x === 136, `the Verified By heading must carry the resolved label and remain on the right Verifier column at 136 mm - measured "${hivVerifierHeading!.text}" at ${hivVerifierHeading!.x}`);
  assert(hivExaminerHeading!.text !== hivVerifierHeading!.text, "the two HIV signatory headings must remain distinct labels");
  assert(!textPrimitives(hiv).some((primitive) => primitive.id === "certificate-pathologist-heading"), "the centre Pathologist column must carry no invented heading");
  const hivSignatureImage = imageById(hiv, "certificate-pathologist-signature");
  assert(hivSignatureImage?.x === 94 && hivSignatureImage.width === 22, "the HIV Pathologist signature must sit at x = 94 mm with its declared 22 mm frame");
  assert(hivSignatureImage.x + hivSignatureImage.width / 2 === 105, "the HIV Pathologist signature centre must fall on the 105 mm A4 content centre line");
  // Stated relative to the first name-line text top rather than as an absolute coordinate: the
  // section origin is an accumulated float, so a literal would pin fixture arithmetic instead of the
  // geometry. The enlarged frame overlaps the upper part of the name row on purpose.
  assert(hivSignatureImage.height === 10, "the HIV Pathologist signature must use the approved 10 mm frame height");
  assert(Math.abs(hivSignatureImage.y - (primitiveTopMm(hiv, "certificate-pathologist-name") - 9.05)) < 0.001, "the HIV Pathologist signature top must sit exactly 9.05 mm above the first name-line text top");
  assert(Math.abs(primitiveBottomByIdMm(hiv, "certificate-pathologist-signature") - primitiveTopMm(hiv, "certificate-pathologist-name") - 0.95) < 0.001, "the HIV Pathologist signature must overlap the first name line by exactly 0.95 mm");
  // The overlap into the name row is pinned above. What was missing is the guard BENEATH the frame:
  // nothing asserted the distance from the signature to the shared underline, so a later change that
  // moved the underline up toward the name row would have gone unnoticed. This claims only what it
  // proves - a minimum gap to the underline, not anything about the licence or role rows.
  const hivUnderlineYmm = (hiv.primitives.find((primitive) => primitive.kind === "line" && primitive.id === "certificate-pathologist-line") as { y1: number }).y1;
  assert(hivUnderlineYmm - primitiveBottomByIdMm(hiv, "certificate-pathologist-signature") >= 2.649, "the HIV Pathologist signature must keep at least 2.649 mm between its bottom and the shared signatory underline");
  assert(Math.abs(hiv.contentBottomMm - 120.8) < 0.001, "HIV contentBottomMm must remain exactly 120.80 mm after the placement correction");

  // ---- QA-06N: multiline signatory bands ------------------------------------------------------
  // Text-top (first-line Y) coordinates throughout, never typographic baselines.
  const QA06N_STEP_MM = 3.6;
  const hivDefinitionForBands = ReportDefinitionRegistry.getDefinition("HIV_RESULT")!;
  const LONG_TWO_LINE_NAME = "ACCEPTANCE-EDITED P2-PATHOLOGIST";
  const LONG_THREE_LINE_NAME = "MARIA THERESA DE LOS SANTOS DELA CRUZ VILLANUEVA GONZALES DE LEON";
  const LONG_TWO_LINE_LICENSE = "PRC-0000123-4567890-ABCDEFG-HIJKLMNOP";

  function hivBandPage(
    label: string,
    overrides: { examiner?: Partial<SignatorySnapshot>; verifier?: Partial<SignatorySnapshot>; pathologist?: Partial<SignatorySnapshot> }
  ): NativeComposedPage {
    const base = reportFor(hivDefinitionForBands);
    const [examiner, verifier, pathologistSlot] = base.signatories as SignatorySnapshot[];
    const report = { ...base, signatories: [
      { ...examiner, ...(overrides.examiner || {}) },
      { ...verifier, ...(overrides.verifier || {}) },
      { ...pathologistSlot, ...(overrides.pathologist || {}) },
    ] };
    const resolvedBand = resolveDraftSessionRenderModel(sessionFor([report]));
    try {
      return composeNativeLivePreviewReportPage(resolvedBand, resolvedBand.reports[0]);
    } catch (error) {
      // Caught so a composition throw surfaces as this named assertion rather than an undefined page.
      assert(false, `${label} must compose completely without truncating identity text (${error instanceof Error ? error.message : String(error)})`);
      throw error;
    }
  }
  const bandNameLineCount = (page: NativeComposedPage, columnId: string) =>
    [`${columnId}-name`, `${columnId}-name-line-2`, `${columnId}-name-line-3`]
      .filter((id) => textPrimitives(page).some((primitive) => primitive.id === id)).length;
  const bandLicenseLineCount = (page: NativeComposedPage, columnId: string) =>
    [`${columnId}-license`, `${columnId}-license-line-2`]
      .filter((id) => textPrimitives(page).some((primitive) => primitive.id === id)).length;
  const bandColumns = ["certificate-examiner", "certificate-pathologist", "certificate-verifier"];
  const underlineY = (page: NativeComposedPage, columnId: string) =>
    (page.primitives.find((primitive) => primitive.kind === "line" && primitive.id === `${columnId}-line`) as { y1: number }).y1;

  // State 1: every column one name line and one licence line - geometry must be unchanged.
  const bandShort = hivBandPage("the short HIV fixture", {});
  assert(bandColumns.every((id) => bandNameLineCount(bandShort, id) === 1 && bandLicenseLineCount(bandShort, id) === 1), "the short HIV fixture must keep every name and licence on one line");
  assert(Math.abs(bandShort.contentBottomMm - 120.8) < 0.001, "one name line and one licence line must keep HIV at exactly 120.80 mm");
  assert(Math.abs(textCoordinates(bandShort, "certificate-pathologist-name").y - 110.1) < 0.001, "the first name line text top must remain 110.10 mm");

  // State 2: exactly ONE column wraps to two name lines. An all-long fixture cannot prove this,
  // because per-column offsets would still agree with each other.
  const bandMixedName = hivBandPage("a mixed-length HIV name fixture", { pathologist: { printedFullName: LONG_TWO_LINE_NAME, printedCredentials: "MD, FPSP, PhD" } });
  assert(bandNameLineCount(bandMixedName, "certificate-pathologist") === 2, "the mixed-name fixture must wrap exactly the Pathologist name to two lines");
  assert(bandNameLineCount(bandMixedName, "certificate-examiner") === 1 && bandNameLineCount(bandMixedName, "certificate-verifier") === 1, "the mixed-name fixture must leave the other two names on one line");
  assert(bandColumns.every((id) => bandLicenseLineCount(bandMixedName, id) === 1), "the mixed-name fixture must leave every licence on one line");
  assert(new Set(bandColumns.map((id) => underlineY(bandMixedName, id))).size === 1, "one wrapped name must move ALL THREE underlines together, never just its own column");
  assert(new Set(bandColumns.map((id) => textCoordinates(bandMixedName, `${id}-license`).y)).size === 1, "one wrapped name must move ALL THREE licence rows together");
  assert(new Set(bandColumns.map((id) => textCoordinates(bandMixedName, `${id}-role`).y)).size === 1, "one wrapped name must move ALL THREE role rows together");
  assert(Math.abs(underlineY(bandMixedName, "certificate-examiner") - (113.7 + QA06N_STEP_MM)) < 0.001, "a two-line name band must shift the shared underline by exactly one 3.6 mm step");
  assert(Math.abs(bandMixedName.contentBottomMm - 124.4) < 0.001, "two name lines and one licence line must place HIV at exactly 124.40 mm");

  // State 3: three name lines.
  const bandThreeName = hivBandPage("a three-line HIV name fixture", { pathologist: { printedFullName: LONG_THREE_LINE_NAME, printedCredentials: "MD, FPSP, MSc, PhD" } });
  assert(bandNameLineCount(bandThreeName, "certificate-pathologist") === 3, "the three-line fixture must render exactly three contiguous name primitives");
  assert(!textPrimitives(bandThreeName).some((primitive) => primitive.id === "certificate-pathologist-name-line-4"), "a name must never render a fourth line");
  assert(Math.abs(bandThreeName.contentBottomMm - 128) < 0.001, "three name lines and one licence line must place HIV at exactly 128.00 mm");

  // State 4: three name lines and exactly ONE wrapped licence.
  const bandThreeNameTwoLicense = hivBandPage("a three-line name with a two-line licence", {
    pathologist: { printedFullName: LONG_THREE_LINE_NAME, printedCredentials: "MD, FPSP, MSc, PhD" },
    verifier: { printedPrcLicenseNumber: LONG_TWO_LINE_LICENSE },
  });
  assert(bandLicenseLineCount(bandThreeNameTwoLicense, "certificate-verifier") === 2, "the mixed-licence fixture must wrap exactly the Verifier licence to two lines");
  assert(bandLicenseLineCount(bandThreeNameTwoLicense, "certificate-examiner") === 1 && bandLicenseLineCount(bandThreeNameTwoLicense, "certificate-pathologist") === 1, "the mixed-licence fixture must leave the other two licences on one line");
  assert(!textPrimitives(bandThreeNameTwoLicense).some((primitive) => primitive.id === "certificate-verifier-license-line-3"), "a licence must never render a third line");
  assert(new Set(bandColumns.map((id) => textCoordinates(bandThreeNameTwoLicense, `${id}-role`).y)).size === 1, "one wrapped licence must move ALL THREE role rows together");
  assert(Math.abs(bandThreeNameTwoLicense.contentBottomMm - 131.6) < 0.001, "three name lines and two licence lines must place HIV at exactly 131.60 mm");
  assert(bandThreeNameTwoLicense.contentBottomMm <= 144.5, "the worst-case multiline HIV page must remain within the 144.5 mm client output boundary");

  // The signature is unaffected by a band that grows downward.
  const bandSignature = imageById(bandThreeNameTwoLicense, "certificate-pathologist-signature");
  assert(bandSignature?.x === 94 && bandSignature.width === 22 && bandSignature.height === 10, "multiline signatory bands must not move or resize the enlarged Pathologist signature");

  // Live Preview markup must carry every continuation line, not only the composed primitives.
  const bandPreviewReport = { ...reportFor(hivDefinitionForBands) };
  const bandPreviewSignatories = bandPreviewReport.signatories as SignatorySnapshot[];
  bandPreviewReport.signatories = [
    bandPreviewSignatories[0],
    bandPreviewSignatories[1],
    { ...bandPreviewSignatories[2], printedFullName: LONG_THREE_LINE_NAME, printedCredentials: "MD, FPSP, MSc, PhD" },
  ];
  const bandPreviewSession = resolveDraftSessionRenderModel(sessionFor([bandPreviewReport]));
  const bandMarkup = renderToStaticMarkup(React.createElement(NativeLivePreviewPage, {
    resolvedSession: bandPreviewSession,
    resolvedReport: bandPreviewSession.reports[0],
    reportTitle: "HIV_RESULT",
  }));
  for (const continuationId of ["certificate-pathologist-name-line-2", "certificate-pathologist-name-line-3"]) {
    const continuation = textPrimitives(bandThreeName).find((primitive) => primitive.id === continuationId)!;
    assert(bandMarkup.includes(continuation.text), `Live Preview markup must contain the rendered continuation line "${continuation.text}"`);
  }
  assert(hiv.primitives.filter((primitive) => primitive.kind === "image" && primitive.id !== "official-logo").every((primitive) => primitive.id === "certificate-pathologist-signature"), "only the HIV Pathologist may render an image");
  assert(primitiveTopMm(hiv, "certificate-test-label") - primitiveBottomByIdMm(hiv, "certificate-test-header") >= NATIVE_REPORT_THEME.sectionInsets.resultBodyTopMm - 0.001, "Certificate result content must use the shared internal inset below its header");

  const urinalysis = pages.get("URINALYSIS")!;
  const firstMicroscopyResult = urinalysis.primitives
    .filter((primitive) => primitive.kind === "text" && /^microscopy-physical-.+-label-line-1$/.test(primitive.id))
    .sort((left, right) => primitiveTopMm({ ...urinalysis, primitives: [left] }, left.id) - primitiveTopMm({ ...urinalysis, primitives: [right] }, right.id))[0];
  assert(firstMicroscopyResult, "Urinalysis physical section must render a first result row");
  assert(primitiveTopMm(urinalysis, firstMicroscopyResult.id) - primitiveTopMm(urinalysis, "microscopy-physical-chemical-header-rule") >= NATIVE_REPORT_THEME.sectionInsets.resultBodyTopMm + 0.199, "MicroscopyTwoColumn must use the shared first-row inset");

  const fecalysis = pages.get("FECALYSIS")!;
  assert(fecalysis.contentBottomMm <= 144.5, "Fecalysis must regain safe upper-half margin after broad spacing is reverted");

  const source = [
    "src/rendering/native/NativeLivePreviewPage.tsx",
    "src/rendering/native/NativeReportPreview.tsx",
    "src/rendering/native/standard/sections.ts",
    "src/rendering/native/specialized/certificate.ts",
    "src/rendering/native/specialized/microscopy.ts",
    "src/rendering/SharedRenderingEngine.tsx",
  ].map((file) => readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
  assert(!source.includes("scale={0.5}"), "the hidden fixed half-scale must be removed");
  assert(!/templateCode\s*(?:===|!==|==|!=)\s*["']/.test(source) && !/switch\s*\([^)]*templateCode/.test(source), "generic presentation code must contain no report-code branches");

  const contentBottomMm = Object.fromEntries([...pages.entries()].map(([code, page]) => [code, Number(page.contentBottomMm.toFixed(3))]));
  process.stdout.write(`C4.2 verification passed: scale 100%=${dimensions100.width.toFixed(3)}x${dimensions100.height.toFixed(3)} px; scale 75%=${dimensions75.width.toFixed(3)}x${dimensions75.height.toFixed(3)} px; families ${JSON.stringify(familyCounts)}; contentBottomMm ${JSON.stringify(contentBottomMm)}\n`);
}

void main();
