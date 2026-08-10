import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { CompletedSessionSnapshot } from "../src/domain/completion/completed-snapshot";
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import type { ILaboratoryReport, IPatientReportSession } from "../src/domain/models/interfaces";
import type { RendererFamily, SignatorySnapshot } from "../src/domain/types";
import type { ClinicalReportDefinition } from "../src/domain/types/report-definition";
import {
  CANONICAL_REPORT_LOGO_SOURCE,
  resolveCompletedSessionRenderModel,
  resolveDraftSessionRenderModel,
  resolveSessionRenderModel,
  type RenderDefinitionSource,
} from "../src/rendering/model";
import { createNativeReportPdf, type NativePdfAssetResolver } from "../src/rendering/native/native-pdf-exporter";
import {
  composeStandardNativeReportPage,
  getStandardNativeCompositionDefinition,
} from "../src/rendering/native/standard";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`C1 verification failed: ${message}`);
}

const demographics = {
  fullName: "Render Model Patient",
  age: 29,
  ageUnit: "years" as const,
  sex: "Female" as const,
  address: "Edited Address",
  patientStatus: "OutPatient" as const,
  examinationDate: "2026-08-09",
  requestingPhysician: "Legacy Requested By",
  referrerName: "Referrer",
  companyName: "Company",
};

const pathologist = (signatureImageUrl: string | null = null): SignatorySnapshot => ({
  personnelId: "pathologist-1",
  role: "Pathologist",
  printedFullName: "PATHOLOGIST ONE",
  printedCredentials: "MD",
  printedPrcLicenseNumber: "P-1",
  signatureImageUrl,
  displayOrder: 3,
});
const medtech = (id: number): SignatorySnapshot => ({
  personnelId: `medtech-${id}`,
  role: "MedicalTechnologist",
  printedFullName: `MEDTECH ${id}`,
  printedCredentials: "RMT",
  printedPrcLicenseNumber: `M-${id}`,
  signatureImageUrl: null,
  displayOrder: id,
});

function rendererFamily(definition: ClinicalReportDefinition): RendererFamily {
  return definition.rendererFamily === "Dedicated Certificate"
    ? "NarrativeCertificate"
    : definition.rendererFamily as RendererFamily;
}

function reportFor(definition: ClinicalReportDefinition): ILaboratoryReport {
  return {
    id: `report-${definition.templateCode}`,
    sessionId: "draft-all",
    templateCode: definition.templateCode,
    templateTitle: definition.templateTitle,
    rendererFamily: rendererFamily(definition),
    remarks: definition.defaultRemarks || "",
    reagentKitInfo: definition.requiresKitInfo ? { kitBrand: "", lotNumber: "LOT", expirationDate: "2027-01-01" } : null,
    encodingData: {
      requestedBy: `Scoped ${definition.templateCode}`,
      additionalFields: Object.fromEntries((definition.additionalEncodingFields || []).map((field) => [field.fieldCode, "value"])),
      repeatableFindings: {},
    },
    results: definition.parameters.map((parameter) => ({
      id: `${definition.templateCode}-${parameter.parameterCode}`,
      reportId: `report-${definition.templateCode}`,
      parameterCode: parameter.parameterCode,
      parameterName: parameter.parameterName,
      resultValue: "",
      evaluationOutcome: "NoEvaluation",
      displayOrder: parameter.displayOrder,
    })),
    signatories: [pathologist(), medtech(1), medtech(2)],
  };
}

function sessionWith(reports: ILaboratoryReport[], status: "Draft" | "Completed" = "Draft"): IPatientReportSession {
  return {
    id: "render-session",
    accessionNumber: "ACC-C1",
    status,
    demographics: { ...demographics },
    reports,
    createdAt: "2026-08-09T00:00:00.000Z",
    completedAt: status === "Completed" ? "2026-08-09T01:00:00.000Z" : null,
  };
}

function v2Snapshot(signatureImageUrl: string | null = null): CompletedSessionSnapshot {
  return {
    snapshotVersion: 2,
    completedAt: "2026-08-09T01:00:00.000Z",
    demographics: { ...demographics, address: "Frozen Exact Address" },
    reports: [{
      templateCode: "CBC",
      templateTitle: "Frozen CBC",
      rendererFamily: "Tabular",
      renderContractVersion: 1,
      printedTitle: null,
      staticContentVersion: "standard-report-v1",
      requestedBy: "Frozen Requested By",
      additionalFields: { frozen: "yes" },
      results: [{
        parameterCode: "HEMOGLOBIN",
        parameterName: "Frozen Hemoglobin Label",
        rawResultValue: "raw-frozen",
        formattedResultValue: "FROZEN-DISPLAY",
        referenceDisplay: "FROZEN-REFERENCE",
        referenceRule: { currentMustNotMatter: true },
        unit: "frozen-unit",
        suffix: "%",
        evaluationOutcome: "High",
        computationMetadata: {
          formulaId: "frozen-formula",
          dependencies: { HDL: 61.6 },
          unroundedValue: 61.599999,
          precision: 2,
        },
        displayOrder: 1,
      }],
      remarks: "Frozen remarks",
      reagentKitInfo: { kitBrand: "Frozen Kit", lotNumber: "LOT-F", expirationDate: "2030-01-01" },
      repeatableFindings: {
        additional: [
          { id: "finding-1", category: "additional", value: "First", displayOrder: 1 },
          { id: "finding-2", category: "additional", value: "Second", displayOrder: 2 },
        ],
      },
      signatories: [medtech(1), pathologist(signatureImageUrl)],
    }],
  };
}

async function main(): Promise<void> {
  const definitions = ReportDefinitionRegistry.getAllDefinitions();
  assert(definitions.length === 17, "registry must still contain exactly 17 definitions");
  const allDraft = resolveDraftSessionRenderModel(sessionWith(definitions.map(reportFor)));
  assert(allDraft.reports.length === 17, "all definitions adapt to the draft render model");
  const familyCounts = allDraft.reports.reduce<Record<string, number>>((counts, report) => {
    counts[report.layoutFamily] = (counts[report.layoutFamily] || 0) + 1;
    return counts;
  }, {});
  for (const family of ["StandardAdaptiveTabular", "CompactResultGrid", "MicroscopyTwoColumn", "Certificate"]) {
    assert((familyCounts[family] || 0) > 0, `${family} must be represented`);
  }
  assert(allDraft.logoSource === CANONICAL_REPORT_LOGO_SOURCE, "canonical logo source must be frozen into the render model");
  assert(allDraft.demographics.address === "Edited Address", "draft Address must be copied exactly");
  assert(Object.isFrozen(allDraft) && Object.isFrozen(allDraft.reports[0].results), "resolved model must be deeply frozen");
  assert(allDraft.reports.every((report) => report.requestedBy.value === `Scoped ${report.templateCode}`), "Requested By must remain report-scoped");

  const hba = ReportDefinitionRegistry.getDefinition("HBA1C")!;
  const fecalysis = ReportDefinitionRegistry.getDefinition("FECALYSIS")!;
  const hbaReport = reportFor(hba);
  const hbaSuffix = hba.parameters.find((parameter) => parameter.suffixSpec)!;
  hbaReport.results.find((result) => result.parameterCode === hbaSuffix.parameterCode)!.resultValue = "7.2%";
  const fecReport = reportFor(fecalysis);
  const hpfParameter = fecalysis.parameters.find((parameter) => parameter.suffixSpec?.suffix.includes("HPF"))!;
  fecReport.results.find((result) => result.parameterCode === hpfParameter.parameterCode)!.resultValue = "0-2 /HPF";
  const suffixModel = resolveDraftSessionRenderModel(sessionWith([hbaReport, fecReport]));
  assert(suffixModel.reports[0].results.find((result) => result.parameterCode === hbaSuffix.parameterCode)!.formattedValue === "7.2%", "% is emitted exactly once");
  assert(suffixModel.reports[0].results.find((result) => result.parameterCode === hbaSuffix.parameterCode)!.unitDisplay === null, "fixed % suffix is not repeated as a separate unit");
  assert(suffixModel.reports[1].results.find((result) => result.parameterCode === hpfParameter.parameterCode)!.formattedValue === "0-2 /HPF", "/HPF is emitted exactly once");
  assert(suffixModel.reports[1].results.find((result) => result.parameterCode === hpfParameter.parameterCode)!.unitDisplay === null, "fixed /HPF suffix is not repeated as a separate unit");

  const urine = reportFor(ReportDefinitionRegistry.getDefinition("URINALYSIS")!);
  urine.encodingData!.repeatableFindings = {
    additional: [
      { id: "b", category: "additional", value: "Second", displayOrder: 2 },
      { id: "blank", category: "additional", value: "", displayOrder: 3 },
      { id: "a", category: "additional", value: "First", displayOrder: 1 },
    ],
  };
  const urineModel = resolveDraftSessionRenderModel(sessionWith([urine]));
  assert(urineModel.reports[0].repeatableFindings.additional.map((finding) => finding.value).join(",") === "First,Second", "populated repeatable findings retain declared order");

  const hiv = reportFor(ReportDefinitionRegistry.getDefinition("HIV_RESULT")!);
  const hivSession = sessionWith([hiv]);
  hivSession.demographics.address = "Current HIV Address";
  const hivModel = resolveDraftSessionRenderModel(hivSession);
  assert(hivModel.demographics.address === "Current HIV Address", "HIV PatientAddress maps to current stored Address");
  const resolvedAddressSegment = hivModel.reports[0].staticContent?.narrativeParagraphs[0].segments.find((segment) => segment.sourceKind === "PatientAddress");
  assert(resolvedAddressSegment?.text === "Current HIV Address", "HIV PatientAddress binding resolves to the exact stored Address");
  assert(hivModel.reports[0].signatories.map((slot) => slot.semanticRole).join(",") === "Examiner,Verifier,Pathologist", "HIV signatory order is declarative");
  const frozenHivSnapshot = v2Snapshot();
  frozenHivSnapshot.demographics.address = "Frozen HIV Address";
  frozenHivSnapshot.reports[0] = {
    ...frozenHivSnapshot.reports[0],
    templateCode: "HIV_RESULT",
    templateTitle: "HIV 1 & 2 Rapid Test Certificate",
    rendererFamily: "NarrativeCertificate",
    printedTitle: "HIV 1 & 2 RAPID TEST CERTIFICATE",
    staticContentVersion: "hiv-certificate-v1",
    results: [{
      ...frozenHivSnapshot.reports[0].results[0],
      parameterCode: "HIV_RESULT",
      parameterName: "HIV 1 & 2 Rapid Test",
      rawResultValue: "Nonreactive",
      formattedResultValue: "Nonreactive",
      referenceDisplay: null,
      unit: null,
      suffix: null,
      evaluationOutcome: "Entered",
      computationMetadata: null,
    }],
    signatories: [medtech(1), medtech(2), pathologist()],
  };
  const frozenHiv = resolveCompletedSessionRenderModel(frozenHivSnapshot);
  const frozenAddressSegment = frozenHiv.reports[0].staticContent?.narrativeParagraphs[0].segments.find((segment) => segment.sourceKind === "PatientAddress");
  assert(frozenAddressSegment?.text === "Frozen HIV Address", "completed HIV PatientAddress resolves only from the frozen snapshot Address");

  const contradictoryDefinition: ClinicalReportDefinition = {
    ...ReportDefinitionRegistry.getDefinition("CBC")!,
    parameters: ReportDefinitionRegistry.getDefinition("CBC")!.parameters.map((parameter) => ({
      ...parameter,
      parameterName: `Contradictory ${parameter.parameterName}`,
      referenceRule: { normalRange: "CURRENT-MUTABLE" },
      displayPrecision: 9,
    })),
  };
  const contradictorySource: RenderDefinitionSource = {
    getDefinition(code) { return code === "CBC" ? contradictoryDefinition : ReportDefinitionRegistry.getDefinition(code); },
  };
  const frozen = resolveCompletedSessionRenderModel(v2Snapshot(), contradictorySource, { accessionNumber: "FROZEN-ACC" });
  const frozenResult = frozen.reports[0].results[0];
  assert(frozen.origin === "Completed" && frozen.snapshotVersion === 2, "completed origin and snapshot version survive");
  assert(frozen.accessionNumber === "FROZEN-ACC" && frozen.demographics.address === "Frozen Exact Address", "completed session values are copied exactly");
  assert(frozenResult.label === "Frozen Hemoglobin Label" && frozenResult.formattedValue === "FROZEN-DISPLAY" && frozenResult.referenceDisplay === "FROZEN-REFERENCE", "v2 clinical display fields are never recomputed");
  assert(frozenResult.computationMetadata?.unroundedValue === 61.599999 && frozenResult.computationMetadata?.formulaId === "frozen-formula", "frozen computation evidence survives");
  assert(frozen.reports[0].repeatableFindings.additional.map((finding) => finding.value).join(",") === "First,Second", "completed finding order survives");
  assert(frozen.reports[0].requestedBy.value === "Frozen Requested By", "completed Requested By is snapshot-authoritative");

  const v1 = v2Snapshot();
  v1.snapshotVersion = 1;
  delete v1.reports[0].renderContractVersion;
  delete v1.reports[0].printedTitle;
  delete v1.reports[0].staticContentVersion;
  const legacyV1 = resolveCompletedSessionRenderModel(v1, contradictorySource);
  assert(legacyV1.reports[0].staticContentVersion === "standard-report-v1" && legacyV1.reports[0].results[0].formattedValue === "FROZEN-DISPLAY", "v1 uses current static metadata without clinical recomputation");

  const malformedV2 = v2Snapshot();
  delete malformedV2.reports[0].staticContentVersion;
  let malformedRejected = false;
  try { resolveCompletedSessionRenderModel(malformedV2); } catch { malformedRejected = true; }
  assert(malformedRejected, "malformed v2 render metadata must be rejected");

  const legacyReport = reportFor(ReportDefinitionRegistry.getDefinition("CBC")!);
  legacyReport.results = [{
    id: "legacy-result", reportId: legacyReport.id, parameterCode: "HEMOGLOBIN", parameterName: "Legacy Label",
    resultValue: "LEGACY", formattedResultValue: "LEGACY-FORMATTED", evaluationOutcome: "High", displayOrder: 1,
  }];
  const legacySession = resolveSessionRenderModel(sessionWith([legacyReport], "Completed"));
  assert(legacySession.reports[0].results[0].formattedValue === "LEGACY-FORMATTED" && legacySession.reports[0].results[0].referenceDisplay === null, "legacy completed stored values remain authoritative without reference recomputation");

  const blankAddress = v2Snapshot();
  blankAddress.demographics.address = "";
  assert(resolveCompletedSessionRenderModel(blankAddress).demographics.address === "", "intentionally blank completed Address remains blank");

  const missingSignature = resolveCompletedSessionRenderModel(v2Snapshot()).reports[0].signatories.find((slot) => slot.slotId === "pathologist")!;
  assert(missingSignature.signatureAsset === null && missingSignature.printedFullName === "PATHOLOGIST ONE", "missing signature keeps textual pathologist data without an image");
  const malformedSignature = resolveCompletedSessionRenderModel(v2Snapshot("javascript:alert(1)")).reports[0].signatories.find((slot) => slot.slotId === "pathologist")!;
  assert(malformedSignature.signatureAsset === null, "unsupported signature protocols resolve to no image");

  const signatureSnapshot = v2Snapshot("/missing-signature.png");
  const signatureModel = resolveCompletedSessionRenderModel(signatureSnapshot);
  const cbcComposition = getStandardNativeCompositionDefinition("CBC");
  assert(cbcComposition, "CBC standard composition must remain registered");
  const signaturePage = composeStandardNativeReportPage(cbcComposition, signatureModel, signatureModel.reports[0]);
  const signaturePrimitive = signaturePage.primitives.find((primitive) => primitive.kind === "image" && primitive.id === "pathologist-signature");
  assert(signaturePrimitive?.kind === "image" && signaturePrimitive.failurePolicy === "OmitImage", "optional signature primitive carries OmitImage policy");
  const logoBytes = new Uint8Array(await readFile(path.join(process.cwd(), "public", "st-rose-logo-official.png")));
  const optionalFailureResolver: NativePdfAssetResolver = {
    async load(source) {
      if (source === CANONICAL_REPORT_LOGO_SOURCE) return { bytes: logoBytes, format: "PNG" };
      throw new Error("simulated optional signature failure");
    },
  };
  await createNativeReportPdf(signaturePage, optionalFailureResolver);
  let requiredLogoRejected = false;
  try {
    await createNativeReportPdf(signaturePage, { async load() { throw new Error("required logo failed"); } });
  } catch (error) {
    requiredLogoRejected = error instanceof Error && error.message === "required logo failed";
  }
  assert(requiredLogoRejected, "required logo failure remains actionable");
  const frozenValuePrimitive = signaturePage.primitives.find((primitive) => primitive.kind === "text" && primitive.id === "result-HEMOGLOBIN-value-line-1");
  assert(frozenValuePrimitive?.kind === "text" && frozenValuePrimitive.text === "FROZEN-DISPLAY", "CBC composer consumes resolved formatted values verbatim");

  const adapterSource = readFileSync(path.join(process.cwd(), "src/rendering/model/render-model-adapters.ts"), "utf8");
  const composerSource = [
    "src/rendering/native/live-preview-composer.ts",
    "src/rendering/native/standard/composer.ts",
    "src/rendering/native/specialized/composer.ts",
  ].map((file) => readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
  for (const code of ReportDefinitionRegistry.getRegisteredTemplateCodes()) {
    assert(!adapterSource.includes(`\"${code}\"`) && !composerSource.includes(`\"${code}\"`), `generic render path must not branch on ${code}`);
  }
  assert(!/ILaboratoryReport|IPatientReportSession|GenericReportResolver|resolveReferenceDisplay|FormulaRegistry/.test(composerSource), "native composer must not import mutable domain or clinical services");

  process.stdout.write(`C1 verification passed: 17 reports; families ${JSON.stringify(familyCounts)}; immutable draft/completed/legacy adapters; optional signature degradation; resolved CBC composer boundary.\n`);
}

void main();
