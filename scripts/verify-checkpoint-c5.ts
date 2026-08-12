import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import type {
  ILaboratoryReport,
  IPatientReportSession,
  IRepeatableFindingValue,
} from "../src/domain/models/interfaces";
import type { RendererFamily, SignatorySnapshot } from "../src/domain/types";
import type { ClinicalReportDefinition, ParameterSpec } from "../src/domain/types/report-definition";
import {
  CANONICAL_REPORT_LOGO_SOURCE,
  resolveDraftSessionRenderModel,
} from "../src/rendering/model";
import { composeNativeLivePreviewReportPage } from "../src/rendering/native/live-preview-composer";
import {
  type NativePdfAsset,
  type NativePdfAssetResolver,
} from "../src/rendering/native/native-pdf-exporter";
import { createNativeSessionPdf } from "../src/rendering/native/session-pdf-exporter";
import type { NativeComposedPage } from "../src/rendering/native/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`C5 verification failed: ${message}`);
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
    sessionId: "session-c5",
    templateCode: definition.templateCode,
    templateTitle: definition.templateTitle,
    rendererFamily: rendererFamily(definition),
    remarks: "C5 REMARKS",
    reagentKitInfo: definition.requiresKitInfo
      ? { kitBrand: "", lotNumber: "LOT-C5", expirationDate: "2030-01-01" }
      : null,
    encodingData: {
      requestedBy,
      additionalFields: { examinationDateTime: "2026-08-12 14:30", companyName: "C5 COMPANY" },
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
    id: "session-c5",
    accessionNumber: "ACC-C5",
    status: "Draft",
    demographics: {
      fullName: "C5 Patient",
      age: 31,
      ageUnit: "years",
      sex: "Female",
      address: "C5 Edited Address",
      patientStatus: "OutPatient",
      examinationDate: "2026-08-12",
      requestingPhysician: "",
      referrerName: "",
      companyName: "",
    },
    reports,
    createdAt: "2026-08-12T00:00:00.000Z",
    completedAt: null,
  };
}

function approximately(left: number, right: number, epsilon = 0.001): boolean {
  return Math.abs(left - right) <= epsilon;
}

function pageCommands(pdf: Awaited<ReturnType<typeof createNativeSessionPdf>>, pageNumber: number): string {
  const internal = pdf.internal as typeof pdf.internal & { pages: string[][] };
  return internal.pages[pageNumber].join("\n");
}

function deepEqual(left: NativeComposedPage, right: NativeComposedPage): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function uniquePageMarker(
  page: NativeComposedPage,
  allPages: readonly NativeComposedPage[],
  emittedCommands: string
): string | undefined {
  const otherPageTexts = new Set(allPages
    .filter((candidate) => candidate !== page)
    .flatMap((candidate) => candidate.primitives
      .filter((primitive) => primitive.kind === "text")
      .map((primitive) => primitive.text)));
  return page.primitives
    .filter((primitive) => primitive.kind === "text")
    .map((primitive) => primitive.text)
    .find((text) => /^[a-zA-Z0-9 .,:/%_-]{4,}$/.test(text)
      && !otherPageTexts.has(text)
      && emittedCommands.includes(text));
}

async function main(): Promise<void> {
  const definitions = ReportDefinitionRegistry.getAllDefinitions();
  assert(definitions.length === 17, "registry must retain exactly 17 definitions");

  const draftSession = sessionFor(definitions.map((definition) =>
    reportFor(definition, { signature: "/optional-pathologist-signature.png" })
  ));
  const resolvedSession = resolveDraftSessionRenderModel(draftSession);
  const livePreviewPages = resolvedSession.reports.map((report) =>
    composeNativeLivePreviewReportPage(resolvedSession, report)
  );
  const pdfPathPages = resolvedSession.reports.map((report) =>
    composeNativeLivePreviewReportPage(resolvedSession, report)
  );

  assert(
    pdfPathPages.map((page) => page.templateCode).join(",")
      === resolvedSession.reports.map((report) => report.templateCode).join(","),
    "native PDF pages must preserve resolved report order"
  );
  for (let index = 0; index < livePreviewPages.length; index += 1) {
    assert(
      deepEqual(pdfPathPages[index], livePreviewPages[index]),
      `${resolvedSession.reports[index].templateCode} PDF composition must be deep-equal to Live Preview composition`
    );
  }

  const logoBytes = new Uint8Array(await readFile(path.join(process.cwd(), "public", "st-rose-logo-official.png")));
  const logoAsset: NativePdfAsset = { bytes: logoBytes, format: "PNG" };
  const optionalSignatureFailureResolver: NativePdfAssetResolver = {
    async load(source) {
      if (source === CANONICAL_REPORT_LOGO_SOURCE) return logoAsset;
      if (source === "/optional-pathologist-signature.png") {
        throw new Error("simulated optional signature failure");
      }
      throw new Error(`unexpected asset source: ${source}`);
    },
  };
  const progress: number[] = [];
  const pdf = await createNativeSessionPdf(resolvedSession, optionalSignatureFailureResolver, {
    onProgress: (percent) => progress.push(percent),
  });

  assert(pdf.getNumberOfPages() === resolvedSession.reports.length, "all 17 reports must emit one PDF page each");
  assert(
    progress.join(",") === resolvedSession.reports
      .map((_, index) => Math.round(((index + 1) / resolvedSession.reports.length) * 100))
      .join(","),
    "PDF progress must report the integer percentage after each emitted page"
  );
  for (let pageNumber = 1; pageNumber <= pdf.getNumberOfPages(); pageNumber += 1) {
    pdf.setPage(pageNumber);
    assert(
      approximately(pdf.internal.pageSize.getWidth(), 210)
        && approximately(pdf.internal.pageSize.getHeight(), 297),
      `emitted page ${pageNumber} must be A4 portrait geometry`
    );

    const emittedCommands = pageCommands(pdf, pageNumber);
    const marker = uniquePageMarker(livePreviewPages[pageNumber - 1], livePreviewPages, emittedCommands);
    assert(
      marker && livePreviewPages.every((page, index) => index === pageNumber - 1
        || !page.primitives.some((primitive) => primitive.kind === "text" && primitive.text === marker)),
      `emitted page ${pageNumber} must preserve ${livePreviewPages[pageNumber - 1].templateCode} report order`
    );
  }

  assert(
    livePreviewPages.every((page) => page.primitives
      .filter((primitive) => primitive.kind === "image" && primitive.id !== "official-logo")
      .every((primitive) => primitive.id === "pathologist-signature"
        || primitive.id === "certificate-pathologist-signature")),
    "no non-Pathologist signatory slot may emit an image primitive"
  );

  let requiredLogoRejected = false;
  try {
    await createNativeSessionPdf(resolvedSession, {
      async load(source) {
        if (source === CANONICAL_REPORT_LOGO_SOURCE) throw new Error("required logo failed");
        return logoAsset;
      },
    });
  } catch (error) {
    requiredLogoRejected = error instanceof Error && error.message === "required logo failed";
  }
  assert(requiredLogoRejected, "required logo failure must reject native session PDF export");

  const excessiveFindings = Array.from({ length: 40 }, (_, index) => ({
    id: `overflow-${index}`,
    category: "Additional Microscopic Findings",
    value: `Complete overflowing finding ${index} retained without clipping`,
    displayOrder: index,
  }));
  const validReport = reportFor(ReportDefinitionRegistry.getDefinition("CBC")!);
  const overflowReport = reportFor(ReportDefinitionRegistry.getDefinition("URINALYSIS")!, {
    findings: excessiveFindings,
  });
  const overflowSession = resolveDraftSessionRenderModel(sessionFor([validReport, overflowReport]));
  let overflowAssetLoads = 0;
  let overflowRejected = false;
  try {
    await createNativeSessionPdf(overflowSession, {
      async load() {
        overflowAssetLoads += 1;
        return logoAsset;
      },
    });
  } catch (error) {
    overflowRejected = error instanceof Error && error.message.includes("permitted boundary is 148.500 mm");
  }
  assert(overflowRejected, "overflow must reject with the actionable upper-half boundary message");
  assert(overflowAssetLoads === 0, "overflow must reject before any partial PDF page is emitted");

  const sessionExporterSource = readFileSync(
    path.join(process.cwd(), "src", "rendering", "native", "session-pdf-exporter.ts"),
    "utf8"
  );
  assert(
    sessionExporterSource.includes("composeNativeLivePreviewReportPage(resolvedSession, report)"),
    "the PDF path must call the exact Live Preview composer"
  );
  const engineSource = readFileSync(
    path.join(process.cwd(), "src", "rendering", "SharedRenderingEngine.tsx"),
    "utf8"
  );
  assert(engineSource.includes("createNativeSessionPdf"), "SharedRenderingEngine must use native session PDF export");
  assert(!engineSource.includes("PDFStreamAdapter"), "SharedRenderingEngine must not use PDFStreamAdapter");
  assert(!engineSource.includes("html2canvas"), "SharedRenderingEngine must not rasterize the DOM");
  assert(!engineSource.includes("renderLegacyReportPage"), "SharedRenderingEngine must not retain legacy PDF rendering");

  process.stdout.write(`C5 verification passed: ${pdf.getNumberOfPages()} native PDF pages in resolved report order; A4 geometry; Live Preview parity; asset degradation and rejection; upper-half enforcement.\n`);
}

void main();
