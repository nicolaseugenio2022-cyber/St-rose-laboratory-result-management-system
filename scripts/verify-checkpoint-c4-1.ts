import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import type { ILaboratoryReport, IPatientReportSession, IRepeatableFindingValue } from "../src/domain/models/interfaces";
import type { RendererFamily, SignatorySnapshot } from "../src/domain/types";
import type { ClinicalReportDefinition, ParameterSpec } from "../src/domain/types/report-definition";
import { resolveDraftSessionRenderModel } from "../src/rendering/model";
import {
  NativeReportPreview,
  NativeLivePreviewPage,
  NativeCompositionOverflowError,
  composeNativeLivePreviewReportPage,
  createNativeReportPdf,
  nativePrimitiveBottomMm,
} from "../src/rendering/native";
import { NATIVE_REPORT_THEME } from "../src/rendering/native/theme";
import type { NativeComposedPage, NativeImagePrimitive, NativeTextPrimitive } from "../src/rendering/native/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`C4.1 verification failed: ${message}`);
}

function rendererFamily(definition: ClinicalReportDefinition): RendererFamily {
  return definition.rendererFamily === "Dedicated Certificate"
    ? "NarrativeCertificate"
    : definition.rendererFamily as RendererFamily;
}

function medtech(id = 1): SignatorySnapshot {
  return {
    personnelId: `c41-medtech-${id}`,
    role: "MedicalTechnologist",
    printedFullName: `C4.1 MEDTECH ${id}`,
    printedCredentials: "RMT",
    printedPrcLicenseNumber: `M-C41-${id}`,
    signatureImageUrl: null,
    displayOrder: id,
  };
}

function pathologist(signatureImageUrl: string | null): SignatorySnapshot {
  return {
    personnelId: "c41-pathologist",
    role: "Pathologist",
    printedFullName: "C4.1 PATHOLOGIST",
    printedCredentials: "MD, FPSP",
    printedPrcLicenseNumber: "P-C41",
    signatureImageUrl,
    displayOrder: 3,
  };
}

function inputValue(parameter: ParameterSpec): string {
  if (parameter.parameterCode === "CHOLESTEROL") return "150";
  if (parameter.parameterCode === "TRIGLYCERIDES") return "700";
  if (parameter.parameterCode === "WBC") return "0-2 /HPF";
  if (parameter.parameterCode === "RBC") return ">50 /HPF";
  if (parameter.parameterCode === "AMORPHOUS_CRYSTAL") return "";
  if (parameter.inputType === "Computed") return "";
  if (parameter.inputType === "NumericText") return "100";
  return parameter.defaultValue ?? parameter.options?.[0] ?? "ENTERED VALUE";
}

function reportFor(
  definition: ClinicalReportDefinition,
  options: { signature?: string | null; findings?: IRepeatableFindingValue[]; remarks?: string } = {}
): ILaboratoryReport {
  return {
    id: `c41-${definition.templateCode}`,
    sessionId: "session-c41",
    templateCode: definition.templateCode,
    templateTitle: definition.templateTitle,
    rendererFamily: rendererFamily(definition),
    remarks: options.remarks ?? "Resolved remarks remain exact.",
    reagentKitInfo: definition.requiresKitInfo
      ? { kitBrand: "", lotNumber: "LOT-C41", expirationDate: "2031-04-19" }
      : null,
    encodingData: {
      requestedBy: definition.templateCode === "BLOOD_TYPING" ? "" : `REQUESTED ${definition.templateCode}`,
      additionalFields: { examinationDateTime: "2026-08-10 14:30", companyName: "C4.1 COMPANY" },
      repeatableFindings: options.findings ? { "Additional Microscopic Findings": options.findings } : {},
    },
    results: definition.parameters.map((parameter) => ({
      id: `${definition.templateCode}-${parameter.parameterCode}`,
      reportId: `c41-${definition.templateCode}`,
      parameterCode: parameter.parameterCode,
      parameterName: parameter.parameterName,
      resultValue: inputValue(parameter),
      evaluationOutcome: "NoEvaluation",
      displayOrder: parameter.displayOrder,
    })),
    signatories: definition.templateCode === "HIV_RESULT"
      ? [medtech(1), medtech(2), pathologist(options.signature ?? null)]
      : [pathologist(options.signature ?? null), medtech(1)],
  };
}

function sessionFor(reports: ILaboratoryReport[]): IPatientReportSession {
  return {
    id: "session-c41",
    accessionNumber: "ACC-C41",
    status: "Draft",
    demographics: {
      fullName: "Rosario Dela Cruz",
      age: 42,
      ageUnit: "years",
      sex: "Female",
      address: "San Jose, Nueva Ecija",
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

function pageText(page: NativeComposedPage): string {
  return textPrimitives(page).map((primitive) => primitive.text).join("\n");
}

function normalized(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function imageById(page: NativeComposedPage, id: string): NativeImagePrimitive | undefined {
  return page.primitives.find((primitive): primitive is NativeImagePrimitive => primitive.kind === "image" && primitive.id === id);
}

const ONE_PIXEL_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));

async function main(): Promise<void> {
  const definitions = ReportDefinitionRegistry.getAllDefinitions();
  assert(definitions.length === 17, "all 17 definitions must remain registered");
  const resolved = resolveDraftSessionRenderModel(sessionFor(
    definitions.map((definition) => reportFor(definition, { signature: "/optional-pathologist-signature.png" }))
  ));
  const pages = new Map<string, NativeComposedPage>();
  const familyCounts: Record<string, number> = {};

  for (const report of resolved.reports) {
    const page = composeNativeLivePreviewReportPage(resolved, report);
    pages.set(report.templateCode, page);
    familyCounts[report.layoutFamily] = (familyCounts[report.layoutFamily] || 0) + 1;
    assert(page.compositionSource === report.layoutFamily, `${report.templateCode} must use its production family composer`);
    assert(page.widthMm === 210 && page.heightMm === 297, `${report.templateCode} must remain A4`);
    assert(page.contentBottomMm <= 148.5, `${report.templateCode} content must remain in the upper half`);
    assert(page.primitives.every((primitive) => nativePrimitiveBottomMm(primitive) <= 148.5001), `${report.templateCode} primitives must remain bounded`);

    const logo = imageById(page, "official-logo");
    assert(logo?.source === "/st-rose-logo-official.png", `${report.templateCode} must use the canonical logo`);
    assert(logo.fit === "contain" && logo.width === 21 && logo.height === 15, `${report.templateCode} logo must preserve aspect ratio in the compact 21 x 15 mm box`);
    assert(logo.width >= 18 && logo.width <= 25, `${report.templateCode} logo must stay within the approved compact range`);
    const divider = page.primitives.find((primitive) => primitive.id === "header-divider");
    assert(divider?.kind === "line" && divider.y1 === 23.5, `${report.templateCode} header must use the shortened identity block`);

    const title = textPrimitives(page).find((primitive) => primitive.id === "report-title");
    assert(report.printedTitle ? title?.text === report.printedTitle : title === undefined, `${report.templateCode} must preserve its exact resolved title contract`);
    const rendered = normalized(pageText(page));
    for (const result of report.results.filter((candidate) => candidate.omission === "Render")) {
      assert(!result.formattedValue || rendered.includes(normalized(result.formattedValue)), `${report.templateCode}/${result.parameterCode} must preserve formattedValue`);
      assert(!result.referenceDisplay || rendered.includes(normalized(result.referenceDisplay)), `${report.templateCode}/${result.parameterCode} must preserve referenceDisplay`);
      assert(!result.unitDisplay || rendered.includes(normalized(result.unitDisplay)), `${report.templateCode}/${result.parameterCode} must preserve unitDisplay`);
    }
    assert(!page.primitives.some((primitive) => primitive.kind === "image" && primitive.id.includes("medical-technologist-signature")), `${report.templateCode} must not create a Medical Technologist image`);
  }

  assert(JSON.stringify(familyCounts) === JSON.stringify({ StandardAdaptiveTabular: 6, CompactResultGrid: 9, Certificate: 1, MicroscopyTwoColumn: 1 }), "all four layout families must retain their approved counts");
  const cbc = pages.get("CBC")!;
  assert(cbc.compositionSource === "StandardAdaptiveTabular", "active CBC must use StandardAdaptiveTabular, never the legacy pilot");
  assert(!cbc.primitives.some((primitive) => primitive.id === "laboratory-logo" || primitive.id === "cbc-result-table"), "active CBC must contain no old-pilot primitive identifiers");
  assert(cbc.primitives.filter((primitive) => primitive.kind === "rect").every((primitive) => !primitive.fill || [NATIVE_REPORT_THEME.colors.tealTint, NATIVE_REPORT_THEME.colors.sectionAccent].includes(primitive.fill as typeof NATIVE_REPORT_THEME.colors.tealTint | typeof NATIVE_REPORT_THEME.colors.sectionAccent)), "active CBC rectangles must use only the approved native clinical-report accents");
  assert(!cbc.primitives.some((primitive) => primitive.id === "report-title"), "CBC must remain title-free");
  assert(!/(^|\s)(HIGH|LOW|ABNORMAL|H|L)(\s|$)/m.test(pageText(cbc)), "CBC must not introduce abnormal output indicators");
  assert(textPrimitives(cbc).some((primitive) => primitive.id === "demographic-status-label" && primitive.text === "Status"), "CBC must retain exact static Status text");

  const representativeSources = {
    CBC: "StandardAdaptiveTabular",
    CHEM_10: "StandardAdaptiveTabular",
    RBS: "CompactResultGrid",
    FECALYSIS: "StandardAdaptiveTabular",
    URINALYSIS: "MicroscopyTwoColumn",
    HIV_RESULT: "Certificate",
  } as const;
  for (const [code, source] of Object.entries(representativeSources)) {
    assert(pages.get(code)?.compositionSource === source, `${code} must route through ${source}`);
  }

  const activeCbcMarkup = renderToStaticMarkup(React.createElement(NativeLivePreviewPage, {
    resolvedSession: resolved,
    resolvedReport: resolved.reports.find((report) => report.templateCode === "CBC")!,
    reportTitle: "CBC",
  }));
  assert(activeCbcMarkup.includes("data-live-preview-composition-source=\"StandardAdaptiveTabular\""), "active CBC browser markup must prove the standardized production composer");
  assert(activeCbcMarkup.includes('data-live-preview-composition-provider="StandardNative"') && activeCbcMarkup.includes('data-live-preview-composition-source="StandardAdaptiveTabular"'), "active CBC must expose StandardNative / StandardAdaptiveTabular provenance as machine-readable attributes");

  const urineText = pageText(pages.get("URINALYSIS")!);
  assert((urineText.match(/0-2 \/HPF/g) || []).length === 1 && (urineText.match(/>50 \/HPF/g) || []).length === 1, "Urinalysis /HPF suffixes must occur exactly once");
  assert(!pages.get("URINALYSIS")!.primitives.some((primitive) => primitive.id.includes("AMORPHOUS_CRYSTAL")), "omitted Urinalysis rows must reserve no visual space");
  const hba1cReport = resolved.reports.find((report) => report.templateCode === "HBA1C")!;
  const hba1cCode = hba1cReport.results.find((result) => result.omission === "Render")!.parameterCode;
  const hba1cResultDisplay = textPrimitives(pages.get("HBA1C")!)
    .filter((primitive) => primitive.id.startsWith(`result-${hba1cCode}-value`) || primitive.id.startsWith(`result-${hba1cCode}-unit`))
    .map((primitive) => primitive.text)
    .join(" ");
  assert((hba1cResultDisplay.match(/%/g) || []).length === 1, "HBA1C result percent suffix must occur exactly once");

  const sparseCodes = ["RBS", "PREG_TEST", "BLOOD_TYPING", "HBSAG", "RPR"];
  const sparseBottoms = Object.fromEntries(sparseCodes.map((code) => [code, pages.get(code)!.contentBottomMm]));
  assert(Object.values(sparseBottoms).every((bottom) => bottom < 120), "sparse reports must finish naturally instead of stretching toward 148.5 mm");

  const noSignatureResolved = resolveDraftSessionRenderModel(sessionFor([
    reportFor(ReportDefinitionRegistry.getDefinition("CBC")!, { signature: null }),
  ]));
  const noSignaturePage = composeNativeLivePreviewReportPage(noSignatureResolved, noSignatureResolved.reports[0]);
  assert(!imageById(noSignaturePage, "pathologist-signature"), "an absent Pathologist signature must create no image primitive");
  assert(pageText(noSignaturePage).includes("C4.1 PATHOLOGIST"), "Pathologist text must remain without an image");
  const medtechName = textPrimitives(noSignaturePage).find((primitive) => primitive.id === "medical-technologist-name");
  const pathologistName = textPrimitives(noSignaturePage).find((primitive) => primitive.id === "pathologist-name");
  assert(medtechName?.y === pathologistName?.y, "without a signature, both textual columns must remain naturally balanced");

  const malformedResolved = resolveDraftSessionRenderModel(sessionFor([
    reportFor(ReportDefinitionRegistry.getDefinition("CBC")!, { signature: "javascript:invalid" }),
  ]));
  const malformedPage = composeNativeLivePreviewReportPage(malformedResolved, malformedResolved.reports[0]);
  assert(!imageById(malformedPage, "pathologist-signature") && pageText(malformedPage).includes("C4.1 PATHOLOGIST"), "malformed signature sources must degrade to textual identity only");

  const signaturePage = pages.get("CBC")!;
  const signature = imageById(signaturePage, "pathologist-signature");
  assert(signature?.failurePolicy === "OmitImage" && signature.fit === "contain", "valid optional Pathologist signatures must preserve aspect ratio and omit on failure");
  const previewMarkup = renderToStaticMarkup(React.createElement(NativeReportPreview, { page: signaturePage, scale: 1 }));
  assert(previewMarkup.includes("data-native-optional-image=\"true\"") && previewMarkup.includes("visibility:hidden"), "failed or pending optional images must show no broken-image state");

  const hiv = pages.get("HIV_RESULT")!;
  const hivRoles = ["certificate-examiner-role", "certificate-verifier-role", "certificate-pathologist-role"];
  assert(hivRoles.every((id) => textPrimitives(hiv).some((primitive) => primitive.id === id)), "HIV must retain its three signatory roles");
  assert(hivRoles.map((id) => textPrimitives(hiv).find((primitive) => primitive.id === id)!.x).join(",") === [...hivRoles.map((id) => textPrimitives(hiv).find((primitive) => primitive.id === id)!.x)].sort((a, b) => a - b).join(","), "HIV signatories must remain Examiner, Verifier, Pathologist from left to right");

  await createNativeReportPdf(signaturePage, {
    async load(source) {
      if (source === "/st-rose-logo-official.png") return { bytes: ONE_PIXEL_PNG, format: "PNG" };
      throw new Error("optional signature load failed");
    },
  });
  let logoFailure = "";
  try {
    await createNativeReportPdf(noSignaturePage, { async load() { throw new Error("required logo unavailable"); } });
  } catch (error) {
    logoFailure = error instanceof Error ? error.message : String(error);
  }
  assert(logoFailure.includes("required logo unavailable"), "required logo failure must remain actionable");

  const excessiveFindings = Array.from({ length: 40 }, (_, index) => ({
    id: `c41-overflow-${index}`,
    category: "Additional Microscopic Findings",
    value: `Complete overflowing finding ${index} retained without clipping`,
    displayOrder: index,
  }));
  const overflowResolved = resolveDraftSessionRenderModel(sessionFor([
    reportFor(ReportDefinitionRegistry.getDefinition("URINALYSIS")!, { findings: excessiveFindings }),
  ]));
  let overflow: unknown;
  try {
    composeNativeLivePreviewReportPage(overflowResolved, overflowResolved.reports[0]);
  } catch (error) {
    overflow = error;
  }
  assert(overflow instanceof NativeCompositionOverflowError && overflow.permittedBottomMm === 148.5, "excessive content must retain the actionable upper-half overflow error");

  const presentationFiles = [
    "src/rendering/native/standard/sections.ts",
    "src/rendering/native/standard/composer.ts",
    "src/rendering/native/specialized/common.ts",
    "src/rendering/native/specialized/certificate.ts",
    "src/rendering/native/specialized/microscopy.ts",
    "src/rendering/native/specialized/composer.ts",
  ];
  const presentationSource = presentationFiles.map((file) => readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
  assert(!/templateCode\s*(?:===|!==|==|!=)\s*["']/.test(presentationSource) && !/switch\s*\([^)]*templateCode/.test(presentationSource), "generic composers must contain no report-code branches");
  assert(!/(formula|evaluation-service|reference-display-resolver|patient-report-session-service)/i.test(presentationSource), "presentation modules must import no clinical or mutable-session services");
  assert(Object.values(NATIVE_REPORT_THEME.colors).includes("#0B6384") && Object.values(NATIVE_REPORT_THEME.colors).includes("#78AFC0"), "approved teal visual tokens must be centralized");

  process.stdout.write(`C4.1 verification passed: 17 pages; families ${JSON.stringify(familyCounts)}; sparse bottoms ${JSON.stringify(sparseBottoms)}; compact 21 x 15 mm logo; upper-half, content, suffix, signature, overflow, and architecture contracts preserved.\n`);
}

void main();
