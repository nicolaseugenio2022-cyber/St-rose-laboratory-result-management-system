import { readFile, readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import type { ILaboratoryReport, IPatientReportSession } from "../src/domain/models/interfaces";
import type { RendererFamily, SignatorySnapshot } from "../src/domain/types";
import type { ClinicalReportDefinition, ParameterSpec } from "../src/domain/types/report-definition";
import { resolveDraftSessionRenderModel, type ResolvedReportRenderModel, type ResolvedSessionRenderModel } from "../src/rendering/model";
import { createNativeReportPdf, type NativePdfAssetResolver } from "../src/rendering/native/native-pdf-exporter";
import type { NativeComposedPage, NativePagePrimitive, NativeTextPrimitive } from "../src/rendering/native/types";
import {
  NativeCompositionOverflowError,
  STANDARD_PAGE,
  composeStandardNativeReportPage,
  getAllStandardNativeCompositionDefinitions,
  getStandardNativeCompositionDefinition,
} from "../src/rendering/native/standard";

const readFileAsync = promisify(readFile);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`C2 verification failed: ${message}`);
}

function rendererFamily(definition: ClinicalReportDefinition): RendererFamily {
  return definition.rendererFamily === "Dedicated Certificate"
    ? "NarrativeCertificate"
    : definition.rendererFamily as RendererFamily;
}

function inputValue(parameter: ParameterSpec): string {
  if (parameter.parameterCode === "CHOLESTEROL") return "150";
  if (parameter.parameterCode === "TRIGLYCERIDES") return "700";
  if (parameter.inputType === "Computed") return "";
  if (parameter.inputType === "NumericText") return "100";
  return parameter.defaultValue ?? parameter.options?.[0] ?? "EXACT VALUE";
}

function pathologist(signatureImageUrl: string | null = null): SignatorySnapshot {
  return {
    personnelId: "pathologist",
    role: "Pathologist",
    printedFullName: "DR. PATHOLOGIST",
    printedCredentials: "MD, FPSP",
    printedPrcLicenseNumber: "P-100",
    signatureImageUrl,
    displayOrder: 1,
  };
}

function medtech(): SignatorySnapshot {
  return {
    personnelId: "medtech",
    role: "MedicalTechnologist",
    printedFullName: "MEDICAL TECHNOLOGIST",
    printedCredentials: "RMT",
    printedPrcLicenseNumber: "M-200",
    signatureImageUrl: null,
    displayOrder: 2,
  };
}

function reportFor(definition: ClinicalReportDefinition, signatureImageUrl: string | null = null): ILaboratoryReport {
  return {
    id: `report-${definition.templateCode}`,
    sessionId: "session-c2",
    templateCode: definition.templateCode,
    templateTitle: definition.templateTitle,
    rendererFamily: rendererFamily(definition),
    remarks: "EXACT REMARKS",
    reagentKitInfo: definition.requiresKitInfo
      ? { kitBrand: "EXACT KIT", lotNumber: "LOT-C2", expirationDate: "2028-12-31" }
      : null,
    encodingData: { requestedBy: `REQUESTED ${definition.templateCode}`, additionalFields: {}, repeatableFindings: {} },
    results: definition.parameters.map((parameter) => ({
      id: `${definition.templateCode}-${parameter.parameterCode}`,
      reportId: `report-${definition.templateCode}`,
      parameterCode: parameter.parameterCode,
      parameterName: parameter.parameterName,
      resultValue: inputValue(parameter),
      evaluationOutcome: "NoEvaluation",
      displayOrder: parameter.displayOrder,
    })),
    signatories: [pathologist(signatureImageUrl), medtech()],
  };
}

function sessionFor(reports: ILaboratoryReport[]): IPatientReportSession {
  return {
    id: "session-c2",
    accessionNumber: "ACC-C2",
    status: "Draft",
    demographics: {
      fullName: "Mixed Case Patient",
      age: 21,
      ageUnit: "years",
      sex: "Female",
      address: "Mixed Case Address",
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

function composeAll(session: ResolvedSessionRenderModel): Map<string, NativeComposedPage> {
  return new Map(session.reports.map((report) => {
    const definition = getStandardNativeCompositionDefinition(report.templateCode);
    assert(definition, `${report.templateCode} must have a C2 definition`);
    return [report.templateCode, composeStandardNativeReportPage(definition, session, report)];
  }));
}

function primitiveText(page: NativeComposedPage): string {
  return page.primitives.filter((primitive) => primitive.kind === "text").map((primitive) => primitive.text).join("\n");
}

function textByIdPrefix(page: NativeComposedPage, prefix: string): string {
  return page.primitives
    .filter((primitive): primitive is NativeTextPrimitive => primitive.kind === "text" && primitive.id.startsWith(prefix))
    .map((primitive) => primitive.text)
    .join(" ");
}

function primitiveBottom(primitive: NativePagePrimitive): number {
  if (primitive.kind === "line") return Math.max(primitive.y1, primitive.y2);
  return primitive.y + (primitive.height || 0);
}

function mutableClone<T>(value: T): T {
  return structuredClone(value);
}

function expectOverflow(
  session: ResolvedSessionRenderModel,
  report: ResolvedReportRenderModel,
  reason: string
): void {
  const definition = getStandardNativeCompositionDefinition(report.templateCode)!;
  let error: unknown;
  try { composeStandardNativeReportPage(definition, session, report); } catch (caught) { error = caught; }
  assert(error instanceof NativeCompositionOverflowError, `${reason} must produce NativeCompositionOverflowError`);
  assert(error.templateCode === report.templateCode && error.permittedBottomMm === 148.5, `${reason} overflow must identify report and boundary`);
}

async function main(): Promise<void> {
  const standardDefinitions = getAllStandardNativeCompositionDefinitions();
  assert(standardDefinitions.length === 15, "exactly 15 standard definitions must be available");
  assert(standardDefinitions.filter((definition) => definition.layoutFamily === "StandardAdaptiveTabular").length === 6, "six tabular definitions must share one family");
  assert(standardDefinitions.filter((definition) => definition.layoutFamily === "CompactResultGrid").length === 9, "nine compact definitions must share one family");

  const clinicalDefinitions = standardDefinitions.map((entry) => ReportDefinitionRegistry.getDefinition(entry.templateCode)!);
  const reports = clinicalDefinitions.map((definition) => reportFor(definition, "/missing-signature.png"));
  const resolved = resolveDraftSessionRenderModel(sessionFor(reports));
  const pages = composeAll(resolved);
  assert(pages.size === 15, "all C2 reports compose without active routing registration");

  for (const report of resolved.reports) {
    const page = pages.get(report.templateCode)!;
    const output = primitiveText(page);
    assert(page.widthMm === 210 && page.heightMm === 297, `${report.templateCode} must be one A4 page`);
    assert(page.contentBottomMm <= 148.5 && page.primitives.every((primitive) => primitiveBottom(primitive) <= 148.5001), `${report.templateCode} must remain in the upper half`);
    assert(!/page\s*\d+/i.test(output), `${report.templateCode} must not contain a page number`);
    assert(report.printedTitle ? output.includes(report.printedTitle) : !page.primitives.some((primitive) => primitive.id === "report-title"), `${report.templateCode} title ownership must remain exact`);
    assert(output.includes(report.remarks), `${report.templateCode} remarks must survive exactly`);
    assert(output.includes("DR. PATHOLOGIST, MD, FPSP") && output.includes("MEDICAL TECHNOLOGIST, RMT"), `${report.templateCode} signatory identities must survive`);
    for (const result of report.results.filter((candidate) => candidate.omission === "Render")) {
      if (result.formattedValue) assert(textByIdPrefix(page, `result-${result.parameterCode}-value`) === result.formattedValue, `${report.templateCode}/${result.parameterCode} formatted value must survive`);
      if (result.referenceDisplay) assert(textByIdPrefix(page, `result-${result.parameterCode}-reference`) === result.referenceDisplay, `${report.templateCode}/${result.parameterCode} reference must survive`);
      if (result.unitDisplay) assert(textByIdPrefix(page, `result-${result.parameterCode}-unit`) === result.unitDisplay, `${report.templateCode}/${result.parameterCode} unit must survive`);
    }
    const images = page.primitives.filter((primitive) => primitive.kind === "image");
    assert(images.some((primitive) => primitive.source === "/st-rose-logo-official.png"), `${report.templateCode} must use the canonical logo`);
    assert(images.every((primitive) => primitive.width !== 210 || primitive.height !== 297), `${report.templateCode} must not contain a raster report background`);
  }

  const cbcPage = pages.get("CBC")!;
  const cbcText = primitiveText(cbcPage);
  assert(!cbcPage.primitives.some((primitive) => primitive.id === "report-title"), "CBC must have no report title");
  assert(cbcText.includes("Status") && !cbcText.includes("OutPatient"), "CBC must print static Status only");
  assert(cbcText.includes("DIFFERENTIAL COUNT"), "CBC differential section must survive");
  assert(cbcText.includes("MIXED CASE PATIENT") && cbcText.includes("MIXED CASE ADDRESS"), "CBC demographic casing must survive");
  assert(!/(^|\s)(H|L|HIGH|LOW|ABNORMAL)(\s|$)/m.test(cbcText), "CBC must contain no abnormal output indicator");

  const hba = resolved.reports.find((report) => report.templateCode === "HBA1C")!;
  const hbaPage = pages.get("HBA1C")!;
  const hbaResult = hba.results[0];
  const hbaRenderedResult = textByIdPrefix(hbaPage, `result-${hbaResult.parameterCode}-value`);
  assert(hbaResult.formattedValue.endsWith("%") && hbaRenderedResult === hbaResult.formattedValue && (hbaRenderedResult.match(/%/g) || []).length === 1, "% suffix must render exactly once in the result");

  const fecDefinition = ReportDefinitionRegistry.getDefinition("FECALYSIS")!;
  const fecReport = reportFor(fecDefinition);
  for (const parameter of fecDefinition.parameters.filter((candidate) => !candidate.isRequired)) {
    fecReport.results.find((result) => result.parameterCode === parameter.parameterCode)!.resultValue = "";
  }
  const hpf = fecDefinition.parameters.find((parameter) => parameter.suffixSpec?.suffix.includes("HPF"))!;
  fecReport.results.find((result) => result.parameterCode === hpf.parameterCode)!.resultValue = "0-2 /HPF";
  const fecSession = resolveDraftSessionRenderModel(sessionFor([fecReport]));
  const fecPage = composeAll(fecSession).get("FECALYSIS")!;
  const hpfRenderedResult = textByIdPrefix(fecPage, `result-${hpf.parameterCode}-value`);
  assert(hpfRenderedResult.endsWith("/HPF") && (hpfRenderedResult.match(/\/HPF/g) || []).length === 1, "/HPF suffix must render exactly once in the result");
  const omitted = fecSession.reports[0].results.filter((result) => result.omission === "Omit");
  assert(omitted.length > 0 && omitted.every((result) => !fecPage.primitives.some((primitive) => primitive.id.startsWith(`result-${result.parameterCode}-`))), "omitted Fecalysis rows must reserve no primitives");

  const bloodDefinition = ReportDefinitionRegistry.getDefinition("BLOOD_TYPING")!;
  const bloodReport = reportFor(bloodDefinition);
  bloodReport.encodingData!.requestedBy = "";
  const bloodSession = resolveDraftSessionRenderModel(sessionFor([bloodReport]));
  const bloodPage = composeAll(bloodSession).get("BLOOD_TYPING")!;
  assert(!primitiveText(bloodPage).includes("Dr."), "blank Blood Typing Requested By must gain no fallback physician");

  const kitCodes = resolved.reports.filter((report) => pages.get(report.templateCode)!.primitives.some((primitive) => primitive.id === "kit-lot")).map((report) => report.templateCode).sort();
  assert(kitCodes.join(",") === ["DENGUE_DUO", "HBA1C", "HBSAG", "PREG_TEST", "RPR"].sort().join(","), "kit sections must appear only for the five declared compact reports");
  for (const code of kitCodes) {
    const output = primitiveText(pages.get(code)!);
    assert(output.includes("LOT-C2") && output.includes("2028-12-31"), `${code} kit values must survive exactly`);
  }

  const noSignatureReport = reportFor(ReportDefinitionRegistry.getDefinition("RBS")!, null);
  const noSignatureSession = resolveDraftSessionRenderModel(sessionFor([noSignatureReport]));
  assert(!composeAll(noSignatureSession).get("RBS")!.primitives.some((primitive) => primitive.id === "pathologist-signature"), "absent signature must leave the image area blank");
  const malformedSignatureReport = reportFor(ReportDefinitionRegistry.getDefinition("RBS")!, "javascript:alert(1)");
  const malformedSignatureSession = resolveDraftSessionRenderModel(sessionFor([malformedSignatureReport]));
  assert(!composeAll(malformedSignatureSession).get("RBS")!.primitives.some((primitive) => primitive.id === "pathologist-signature"), "malformed signature must leave the image area blank");

  const signaturePage = pages.get("RBS")!;
  const logoBytes = new Uint8Array(await readFileAsync(path.join(process.cwd(), "public", "st-rose-logo-official.png")));
  const optionalFailureResolver: NativePdfAssetResolver = {
    async load(source) {
      if (source === "/st-rose-logo-official.png") return { bytes: logoBytes, format: "PNG" };
      throw new Error("simulated signature failure");
    },
  };
  await createNativeReportPdf(signaturePage, optionalFailureResolver);
  let logoFailure = false;
  try { await createNativeReportPdf(signaturePage, { async load() { throw new Error("logo failed"); } }); } catch { logoFailure = true; }
  assert(logoFailure, "required logo failure must remain actionable");

  const overflowBase = mutableClone(resolved);
  const overflowReport = overflowBase.reports.find((report) => report.templateCode === "CHEM_10")!;
  overflowReport.remarks = Array.from({ length: 260 }, () => "remark").join(" ");
  expectOverflow(overflowBase, overflowReport, "excessive remarks");

  const resultOverflowSession = mutableClone(resolved);
  const resultOverflowReport = resultOverflowSession.reports.find((report) => report.templateCode === "CHEM_10")!;
  resultOverflowReport.results[0].formattedValue = Array.from({ length: 220 }, () => "result").join(" ");
  expectOverflow(resultOverflowSession, resultOverflowReport, "excessive result text");

  const demographicOverflowSession = mutableClone(resolved);
  const demographicOverflowReport = demographicOverflowSession.reports.find((report) => report.templateCode === "CHEM_10")!;
  demographicOverflowSession.demographics.fullName = Array.from({ length: 14 }, () => "Longname").join(" ");
  demographicOverflowSession.demographics.address = Array.from({ length: 18 }, () => "Longaddress").join(" ");
  demographicOverflowReport.requestedBy.value = Array.from({ length: 18 }, () => "Physician").join(" ");
  expectOverflow(demographicOverflowSession, demographicOverflowReport, "excessive demographics");

  const genericSources = ["composer.ts", "sections.ts"].map((file) => readFileSync(path.join(process.cwd(), "src", "rendering", "native", "standard", file), "utf8")).join("\n");
  assert(!/templateCode\s*(?:===|!==|==|!=)\s*["']/.test(genericSources) && !/switch\s*\([^)]*templateCode/.test(genericSources), "generic C2 composers must not branch on report-code literals");
  assert(!/ILaboratoryReport|IPatientReportSession|GenericReportResolver|resolveReferenceDisplay|FormulaRegistry|domain\/definitions/.test(genericSources), "generic C2 composers must import no mutable or clinical services");

  process.stdout.write(`C2 verification passed: 6 tabular + 9 compact reports; A4 upper-half composition; exact resolved output ownership; optional signatures; explicit overflow.\n`);
}

void main();
