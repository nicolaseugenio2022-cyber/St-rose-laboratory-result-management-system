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
  pathologistSignature: string | null = "/optional-pathologist-signature.png"
): SignatorySnapshot {
  return {
    personnelId: `c42-${role}-${order}`,
    role,
    printedFullName: role === "Pathologist" ? "C4.2 PATHOLOGIST" : `C4.2 MEDTECH ${order}`,
    printedCredentials: role === "Pathologist" ? "MD, FPSP" : "RMT",
    printedPrcLicenseNumber: `C42-${order}`,
    signatureImageUrl: role === "Pathologist" ? pathologistSignature : null,
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
  pathologistSignature: string | null = "/optional-pathologist-signature.png"
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
      ? [signatory("MedicalTechnologist", 1), signatory("MedicalTechnologist", 2), signatory("Pathologist", 3, pathologistSignature)]
      : [signatory("Pathologist", 1, pathologistSignature), signatory("MedicalTechnologist", 2)],
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
    assert(!page.primitives.some((primitive) => primitive.kind === "image" && primitive.id.includes("medical-technologist-signature")), `${report.templateCode} must not create Medical Technologist signature images`);
    const logo = imageById(page, "official-logo");
    assert(logo?.width === 21 && logo.height === 15 && logo.fit === "contain", `${report.templateCode} must retain the declared physical logo box`);
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
  const at100 = renderToStaticMarkup(React.createElement(NativeLivePreviewPage, { resolvedSession: resolved, resolvedReport: cbcReport, reportTitle: "CBC", zoomLevel: 100 }));
  const at75 = renderToStaticMarkup(React.createElement(NativeLivePreviewPage, { resolvedSession: resolved, resolvedReport: cbcReport, reportTitle: "CBC", zoomLevel: 75 }));
  const dimensions100 = pageDimensions(at100);
  const dimensions75 = pageDimensions(at75);
  assert(at100.includes('data-live-preview-scale="1"') && !at100.includes("transform:scale"), "toolbar 100% must have one scale owner at native scale 1.0");
  assert(at75.includes('data-live-preview-scale="0.75"') && !at75.includes("transform:scale"), "toolbar 75% must have one scale owner at native scale 0.75");
  assert(approximately(dimensions100.width, 210 * 96 / 25.4) && approximately(dimensions100.height, 297 * 96 / 25.4), "100% must emit physical A4 CSS dimensions");
  assert(approximately(dimensions75.width, dimensions100.width * 0.75) && approximately(dimensions75.height, dimensions100.height * 0.75), "75% must scale the complete A4 page uniformly");
  assert(at100.includes("Preview mode:") && at100.includes("StandardNative") && at100.includes("StandardAdaptiveTabular"), "manual provenance must remain visible");

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
  assert(engineMarkup.includes('data-native-report-preview="CBC"') && engineMarkup.includes("Preview mode:") && engineMarkup.includes("StandardNative") && engineMarkup.includes("StandardAdaptiveTabular"), "the selected CBC page must expose Native / StandardNative / StandardAdaptiveTabular provenance");
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
  assert(!cbc.primitives.some((primitive) => /^result-(?!grid-).+-bottom$/.test(primitive.id)), "result rows must not draw a rule after every parameter");
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
  const composeCbcWithSignature = (signatureSource: string | null) => {
    const signatureSession = resolveDraftSessionRenderModel(sessionFor([reportFor(cbcDefinition, signatureSource)]));
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
  assert(primitiveTopMm(signaturePresentPage, "pathologist-name") - primitiveBottomByIdMm(signaturePresentPage, "pathologist-signature") >= 0.799, "standard Pathologist signature image must have added clearance above the unchanged name baseline");
  assert(!imageById(signatureAbsentPage, "pathologist-signature") && !imageById(signatureMalformedPage, "pathologist-signature"), "absent or malformed Pathologist signatures must create no image primitive");
  assert(!signaturePresentPage.primitives.some((primitive) => primitive.kind === "image" && primitive.id.includes("medical-technologist")), "Medical Technologist must remain text-only");

  const hiv = pages.get("HIV_RESULT")!;
  const hivNameIds = ["certificate-examiner-name", "certificate-verifier-name", "certificate-pathologist-name"];
  const hivRoleIds = ["certificate-examiner-role", "certificate-verifier-role", "certificate-pathologist-role"];
  assert(new Set(hivNameIds.map((id) => textCoordinates(hiv, id).y)).size === 1, "HIV signatory name baselines must align");
  assert(new Set(hivRoleIds.map((id) => textCoordinates(hiv, id).y)).size === 1, "HIV signatory role baselines must align");
  assert(hivRoleIds.map((id) => textCoordinates(hiv, id).x).join(",") === [...hivRoleIds.map((id) => textCoordinates(hiv, id).x)].sort((a, b) => a - b).join(","), "HIV signatories must remain Examiner, Verifier, Pathologist from left to right");
  assert(hiv.primitives.filter((primitive) => primitive.kind === "image" && primitive.id !== "official-logo").every((primitive) => primitive.id === "certificate-pathologist-signature"), "only the HIV Pathologist may render an image");
  assert(primitiveTopMm(hiv, "certificate-pathologist-name") - primitiveBottomByIdMm(hiv, "certificate-pathologist-signature") >= 0.899, "HIV Pathologist signature image must have added clearance above the unchanged name baseline");
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
