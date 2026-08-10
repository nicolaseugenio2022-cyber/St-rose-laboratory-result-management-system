import type {
  CompletedReportSnapshot,
  CompletedSessionSnapshot,
} from "@/domain/completion/completed-snapshot";
import { ReportDefinitionRegistry } from "@/domain/definitions/report-definition-registry";
import type {
  ILaboratoryReport,
  ILaboratoryResult,
  IPatientReportSession,
  IRepeatableFindingValue,
} from "@/domain/models/interfaces";
import { getResultDisplayValue } from "@/domain/models/interfaces";
import type { PatientDemographics, SignatorySnapshot } from "@/domain/types";
import type { ClinicalReportDefinition, ParameterSpec } from "@/domain/types/report-definition";
import { resolveReferenceDisplay } from "@/domain/reference-display";
import { stripFixedSuffix } from "@/services/formatter-registry";
import { GenericReportResolver } from "@/services/generic-report-resolver";
import {
  CANONICAL_REPORT_LOGO_SOURCE,
  type ResolvedDemographicsRenderModel,
  type ResolvedLayoutFamily,
  type ResolvedReportRenderModel,
  type ResolvedResultRenderModel,
  type ResolvedSessionRenderModel,
  type ResolvedSignatorySlot,
  type ResolvedCertificateStaticContent,
} from "./types";

const STANDARD_RENDER_CONTRACT_VERSION = 1;
const STANDARD_STATIC_CONTENT_VERSION = "standard-report-v1";

export interface RenderDefinitionSource {
  getDefinition(templateCode: string): ClinicalReportDefinition | null;
}

const DEFAULT_DEFINITIONS: RenderDefinitionSource = ReportDefinitionRegistry;

const LAYOUT_FAMILIES: Readonly<Record<string, ResolvedLayoutFamily>> = {
  Tabular: "StandardAdaptiveTabular",
  SimpleResult: "CompactResultGrid",
  DiagnosticGrid: "MicroscopyTwoColumn",
  "Dedicated Certificate": "Certificate",
  NarrativeCertificate: "Certificate",
};

const STANDARD_SIGNATORY_SLOTS: NonNullable<ClinicalReportDefinition["renderContract"]>["signatorySlots"] = [
  { slotId: "pathologist", personnelRole: "Pathologist", semanticRole: "Pathologist", displayOrder: 1 },
  { slotId: "medical-technologist", personnelRole: "MedicalTechnologist", semanticRole: "MedicalTechnologist", displayOrder: 2 },
];

function deepCloneAndFreeze<T>(value: T): T {
  const clone = structuredClone(value);
  const freeze = (entry: unknown): void => {
    if (!entry || typeof entry !== "object" || Object.isFrozen(entry)) return;
    Object.values(entry).forEach(freeze);
    Object.freeze(entry);
  };
  freeze(clone);
  return clone;
}

function resolveLayoutFamily(rendererFamily: string): ResolvedLayoutFamily {
  const family = LAYOUT_FAMILIES[rendererFamily];
  if (!family) throw new Error(`Unsupported renderer family '${rendererFamily}'.`);
  return family;
}

function formatLongDateUppercase(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value ? value.toUpperCase() : "";
  const [, yearText, monthText, dayText] = match;
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  if (Number.isNaN(date.getTime())) return value.toUpperCase();
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date).toUpperCase();
}

function resolveDemographics(
  demographics: PatientDemographics,
  ageDisplay: "NumberOnly" | "NumberWithUnit" = "NumberWithUnit"
): ResolvedDemographicsRenderModel {
  const validAge = Number.isFinite(demographics.age) && demographics.age > 0 ? demographics.age : null;
  return {
    fullName: demographics.fullName || "",
    age: validAge,
    ageUnit: demographics.ageUnit,
    ageDisplay: validAge == null ? "" : ageDisplay === "NumberOnly" ? String(validAge) : `${validAge} ${demographics.ageUnit}`,
    sex: demographics.sex || "",
    address: demographics.address ?? "",
    examinationDate: demographics.examinationDate || "",
    examinationDateDisplay: formatLongDateUppercase(demographics.examinationDate || ""),
    referrerName: demographics.referrerName ?? "",
    companyName: demographics.companyName ?? "",
  };
}

function findResult(report: ILaboratoryReport, parameter: ParameterSpec): ILaboratoryResult | undefined {
  const acceptedCodes = [parameter.parameterCode, ...(parameter.legacyParameterCodes || [])];
  return report.results.find((result) => acceptedCodes.includes(result.parameterCode));
}

function sanitizeOptionalSignatureSource(source: string | null | undefined): string | null {
  const value = source?.trim() || "";
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function composeSignatorySlots(
  source: readonly SignatorySnapshot[],
  definition: ClinicalReportDefinition
): ResolvedSignatorySlot[] {
  const specs = definition.renderContract?.signatorySlots || STANDARD_SIGNATORY_SLOTS || [];
  const personnel = [...source].sort((left, right) => left.displayOrder - right.displayOrder);
  const roleOffsets = new Map<string, number>();
  return [...specs].sort((left, right) => left.displayOrder - right.displayOrder).map((spec) => {
    const offset = roleOffsets.get(spec.personnelRole) || 0;
    const matching = personnel.filter((candidate) => candidate.role === spec.personnelRole)[offset];
    roleOffsets.set(spec.personnelRole, offset + 1);
    const fullName = matching?.printedFullName || "";
    const credentials = matching?.printedCredentials || "";
    const license = matching?.printedPrcLicenseNumber || "";
    const signatureSource = spec.personnelRole === "Pathologist"
      ? sanitizeOptionalSignatureSource(matching?.signatureImageUrl)
      : null;
    return {
      ...spec,
      personnelId: matching?.personnelId || "",
      printedFullName: fullName,
      printedCredentials: credentials,
      printedNameWithCredentials: [fullName.trim(), credentials.trim()].filter(Boolean).join(", "),
      printedPrcLicenseNumber: license,
      licenseDisplay: license ? `License no. ${license}` : "",
      signatureAsset: signatureSource ? { source: signatureSource, failurePolicy: "OmitImage" as const } : null,
    };
  });
}

function resolveRequestedBy(report: ILaboratoryReport, definition: ClinicalReportDefinition, demographics: PatientDemographics): string {
  if (report.encodingData) {
    return Object.prototype.hasOwnProperty.call(report.encodingData, "requestedBy")
      ? report.encodingData.requestedBy || ""
      : "";
  }
  return demographics.requestingPhysician || definition.requestedByPolicy.defaultPhysician || "";
}

function populatedFindings(
  source: Record<string, IRepeatableFindingValue[]> | undefined,
  sortByDisplayOrder = true
): Record<string, IRepeatableFindingValue[]> {
  return Object.fromEntries(Object.entries(source || {}).map(([category, findings]) => {
    const populated = [...findings].filter((finding) => finding.value.trim());
    return [category, sortByDisplayOrder
      ? populated.sort((left, right) => left.displayOrder - right.displayOrder)
      : populated] as const;
  }).filter(([, findings]) => findings.length > 0));
}

function legacyUnitDisplay(formattedValue: string, unit: string | null | undefined): string | null {
  const normalizedUnit = unit?.trim();
  if (!normalizedUnit) return null;
  return formattedValue.trim().toLowerCase().endsWith(normalizedUnit.toLowerCase()) ? null : unit || null;
}

function resolveStaticContent(
  definition: ClinicalReportDefinition,
  demographics: PatientDemographics,
  results: ResolvedResultRenderModel[]
): ResolvedCertificateStaticContent | null {
  const content = definition.renderContract?.staticContent;
  if (!content) return null;
  return {
    ...structuredClone(content),
    narrativeParagraphs: content.narrativeParagraphs.map((paragraph) => ({
      id: paragraph.id,
      segments: paragraph.segments.map((segment) => {
        if (segment.kind === "Text") return { sourceKind: segment.kind, text: segment.text };
        if (segment.kind === "PatientName") return { sourceKind: segment.kind, text: demographics.fullName || "" };
        if (segment.kind === "PatientAddress") return { sourceKind: segment.kind, text: demographics.address ?? "" };
        const selected = results.some((result) =>
          result.omission === "Render" && result.formattedValue.trim().toLowerCase() === segment.resultValue.toLowerCase()
        );
        return { sourceKind: segment.kind, text: selected ? "X" : "", resultValue: segment.resultValue };
      }),
    })),
  };
}

function draftReport(
  report: ILaboratoryReport,
  definition: ClinicalReportDefinition,
  demographics: PatientDemographics
): ResolvedReportRenderModel {
  const rawInputs: Record<string, string> = {};
  for (const parameter of definition.parameters) {
    const source = findResult(report, parameter);
    rawInputs[parameter.parameterCode] = parameter.suffixSpec
      ? stripFixedSuffix(source?.resultValue || "", parameter.suffixSpec.suffix)
      : source?.resultValue || "";
  }
  const resolved = GenericReportResolver.resolveReport({
    definition,
    rawInputs,
    evaluationContext: { sex: demographics.sex || null },
  });
  const results: ResolvedResultRenderModel[] = [...definition.parameters]
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((parameter) => {
      const source = findResult(report, parameter) as (ILaboratoryResult & { isSelected?: boolean }) | undefined;
      const selected = source?.isSelected ?? true;
      const value = resolved.find((candidate) => candidate.parameterCode === parameter.parameterCode)!;
      const conditionalSeparator = value.formattedResultValue?.indexOf(":") ?? -1;
      return {
        parameterCode: parameter.parameterCode,
        label: parameter.parameterName,
        rawValue: value.rawResultValue,
        formattedValue: value.formattedResultValue || "",
        referenceDisplay: resolveReferenceDisplay(
          parameter.referenceRule,
          demographics.sex || null,
          parameter.suffixSpec?.suffix || parameter.unit
        ),
        unit: parameter.unit || null,
        unitDisplay: parameter.suffixSpec ? null : parameter.unit || null,
        suffix: parameter.suffixSpec?.suffix || null,
        evaluationOutcome: value.evaluationOutcome,
        computationMetadata: value.computationMetadata ? structuredClone(value.computationMetadata) : null,
        displayOrder: parameter.displayOrder,
        omission: !selected || (!value.formattedResultValue && !parameter.isRequired && parameter.blankOmission) ? "Omit" : "Render",
        conditionalLabel: conditionalSeparator >= 0 ? value.formattedResultValue!.slice(0, conditionalSeparator).trim() : null,
      };
    });
  return {
    templateCode: definition.templateCode,
    templateTitle: report.templateTitle || definition.templateTitle,
    layoutFamily: resolveLayoutFamily(definition.rendererFamily),
    renderContractVersion: definition.renderContract?.renderContractVersion ?? STANDARD_RENDER_CONTRACT_VERSION,
    printedTitle: definition.reportTitle ?? null,
    staticContentVersion: definition.renderContract?.staticContentVersion ?? STANDARD_STATIC_CONTENT_VERSION,
    staticContent: resolveStaticContent(definition, demographics, results),
    resultSections: structuredClone(definition.renderContract?.resultSections || []),
    ageDisplay: resolveDemographics(demographics, definition.renderContract?.demographics?.ageDisplay).ageDisplay,
    requestedBy: {
      label: definition.requestedByPolicy.fieldLabel || "Requested By",
      value: resolveRequestedBy(report, definition, demographics),
      isRequired: definition.requestedByPolicy.isRequired,
    },
    status: {
      type: definition.statusPolicy.type,
      staticLabel: definition.statusPolicy.staticLabel ?? null,
      value: "",
    },
    additionalFields: { ...(report.encodingData?.additionalFields || {}) },
    results,
    remarks: report.remarks || "",
    reagentKitInfo: report.reagentKitInfo ? { ...report.reagentKitInfo } : null,
    repeatableFindings: populatedFindings(report.encodingData?.repeatableFindings),
    signatories: composeSignatorySlots(report.signatories, definition),
    suppressAbnormalIndicators: definition.suppressAbnormalIndicators === true,
  };
}

function validatedSnapshotMetadata(
  snapshot: CompletedSessionSnapshot,
  report: CompletedReportSnapshot,
  definition: ClinicalReportDefinition
): { renderContractVersion: number; printedTitle: string | null; staticContentVersion: string } {
  const current = {
    renderContractVersion: definition.renderContract?.renderContractVersion ?? STANDARD_RENDER_CONTRACT_VERSION,
    printedTitle: definition.reportTitle ?? null,
    staticContentVersion: definition.renderContract?.staticContentVersion ?? STANDARD_STATIC_CONTENT_VERSION,
  };
  if (snapshot.snapshotVersion === 1) return current;
  if (report.renderContractVersion == null || report.printedTitle === undefined || !report.staticContentVersion) {
    throw new Error(`Completed snapshot v2 report '${report.templateCode}' is missing frozen render metadata.`);
  }
  if (
    report.renderContractVersion !== current.renderContractVersion ||
    report.staticContentVersion !== current.staticContentVersion
  ) {
    throw new Error(`Unsupported frozen render contract for '${report.templateCode}'.`);
  }
  return {
    renderContractVersion: report.renderContractVersion,
    printedTitle: report.printedTitle,
    staticContentVersion: report.staticContentVersion,
  };
}

function completedReport(
  snapshot: CompletedSessionSnapshot,
  report: CompletedReportSnapshot,
  definition: ClinicalReportDefinition
): ResolvedReportRenderModel {
  const metadata = validatedSnapshotMetadata(snapshot, report, definition);
  const results: ResolvedResultRenderModel[] = report.results.map((result) => ({
    parameterCode: result.parameterCode,
    label: result.parameterName,
    rawValue: result.rawResultValue,
    formattedValue: result.formattedResultValue,
    referenceDisplay: result.referenceDisplay,
    unit: result.unit,
    unitDisplay: result.suffix ? null : result.unit,
    suffix: result.suffix,
    evaluationOutcome: result.evaluationOutcome,
    computationMetadata: result.computationMetadata ? structuredClone(result.computationMetadata) : null,
    displayOrder: result.displayOrder,
    omission: "Render",
    conditionalLabel: null,
  }));
  return {
    templateCode: report.templateCode,
    templateTitle: report.templateTitle,
    layoutFamily: resolveLayoutFamily(report.rendererFamily),
    ...metadata,
    staticContent: resolveStaticContent(definition, snapshot.demographics, results),
    resultSections: structuredClone(definition.renderContract?.resultSections || []),
    ageDisplay: resolveDemographics(snapshot.demographics, definition.renderContract?.demographics?.ageDisplay).ageDisplay,
    requestedBy: {
      label: definition.requestedByPolicy.fieldLabel || "Requested By",
      value: report.requestedBy,
      isRequired: definition.requestedByPolicy.isRequired,
    },
    status: { type: definition.statusPolicy.type, staticLabel: definition.statusPolicy.staticLabel ?? null, value: "" },
    additionalFields: { ...report.additionalFields },
    results,
    remarks: report.remarks,
    reagentKitInfo: report.reagentKitInfo ? { ...report.reagentKitInfo } : null,
    repeatableFindings: populatedFindings(report.repeatableFindings, false),
    signatories: composeSignatorySlots(report.signatories, definition),
    suppressAbnormalIndicators: definition.suppressAbnormalIndicators === true,
  };
}

function requireDefinition(source: RenderDefinitionSource, templateCode: string): ClinicalReportDefinition {
  const definition = source.getDefinition(templateCode);
  if (!definition) throw new Error(`No declarative render definition is registered for '${templateCode}'.`);
  return definition;
}

export function resolveDraftSessionRenderModel(
  session: IPatientReportSession,
  definitions: RenderDefinitionSource = DEFAULT_DEFINITIONS
): ResolvedSessionRenderModel {
  const reports = session.reports.map((report) => draftReport(report, requireDefinition(definitions, report.templateCode), session.demographics));
  const agePresentation = session.reports.length === 1
    ? requireDefinition(definitions, session.reports[0].templateCode).renderContract?.demographics?.ageDisplay
    : undefined;
  return deepCloneAndFreeze({
    origin: "Draft",
    accessionNumber: session.accessionNumber,
    completedAt: null,
    snapshotVersion: null,
    logoSource: CANONICAL_REPORT_LOGO_SOURCE,
    demographics: resolveDemographics(session.demographics, agePresentation),
    reports,
  });
}

export function resolveCompletedSessionRenderModel(
  snapshot: CompletedSessionSnapshot,
  definitions: RenderDefinitionSource = DEFAULT_DEFINITIONS,
  context: { accessionNumber?: string } = {}
): ResolvedSessionRenderModel {
  const reports = snapshot.reports.map((report) => completedReport(snapshot, report, requireDefinition(definitions, report.templateCode)));
  const agePresentation = snapshot.reports.length === 1
    ? requireDefinition(definitions, snapshot.reports[0].templateCode).renderContract?.demographics?.ageDisplay
    : undefined;
  return deepCloneAndFreeze({
    origin: "Completed",
    accessionNumber: context.accessionNumber || "",
    completedAt: snapshot.completedAt,
    snapshotVersion: snapshot.snapshotVersion,
    logoSource: CANONICAL_REPORT_LOGO_SOURCE,
    demographics: resolveDemographics(snapshot.demographics, agePresentation),
    reports,
  });
}

function legacyCompletedReport(
  report: ILaboratoryReport,
  definition: ClinicalReportDefinition,
  demographics: PatientDemographics
): ResolvedReportRenderModel {
  const results: ResolvedResultRenderModel[] = report.results.map((result) => ({
    parameterCode: result.parameterCode,
    label: result.parameterName,
    rawValue: result.rawResultValue ?? result.resultValue,
    formattedValue: getResultDisplayValue(result),
    referenceDisplay: null,
    unit: result.unit || null,
    unitDisplay: legacyUnitDisplay(getResultDisplayValue(result), result.unit),
    suffix: null,
    evaluationOutcome: result.evaluationOutcome,
    computationMetadata: result.computationMetadata ? structuredClone(result.computationMetadata) : null,
    displayOrder: result.displayOrder,
    omission: "Render",
    conditionalLabel: null,
  }));
  return {
    templateCode: report.templateCode,
    templateTitle: report.templateTitle,
    layoutFamily: resolveLayoutFamily(report.rendererFamily),
    renderContractVersion: definition.renderContract?.renderContractVersion ?? STANDARD_RENDER_CONTRACT_VERSION,
    printedTitle: definition.reportTitle ?? null,
    staticContentVersion: definition.renderContract?.staticContentVersion ?? STANDARD_STATIC_CONTENT_VERSION,
    staticContent: resolveStaticContent(definition, demographics, results),
    resultSections: structuredClone(definition.renderContract?.resultSections || []),
    ageDisplay: resolveDemographics(demographics, definition.renderContract?.demographics?.ageDisplay).ageDisplay,
    requestedBy: {
      label: definition.requestedByPolicy.fieldLabel || "Requested By",
      value: report.encodingData && Object.prototype.hasOwnProperty.call(report.encodingData, "requestedBy")
        ? report.encodingData.requestedBy || ""
        : demographics.requestingPhysician || "",
      isRequired: definition.requestedByPolicy.isRequired,
    },
    status: { type: definition.statusPolicy.type, staticLabel: definition.statusPolicy.staticLabel ?? null, value: "" },
    additionalFields: { ...(report.encodingData?.additionalFields || {}) },
    results,
    remarks: report.remarks || "",
    reagentKitInfo: report.reagentKitInfo ? { ...report.reagentKitInfo } : null,
    repeatableFindings: populatedFindings(report.encodingData?.repeatableFindings),
    signatories: composeSignatorySlots(report.signatories, definition),
    suppressAbnormalIndicators: definition.suppressAbnormalIndicators === true,
  };
}

export function resolveSessionRenderModel(
  session: IPatientReportSession,
  definitions: RenderDefinitionSource = DEFAULT_DEFINITIONS
): ResolvedSessionRenderModel {
  if (session.completedSnapshot) {
    return resolveCompletedSessionRenderModel(session.completedSnapshot, definitions, { accessionNumber: session.accessionNumber });
  }
  if (session.status !== "Completed") return resolveDraftSessionRenderModel(session, definitions);
  const reports = session.reports.map((report) => legacyCompletedReport(report, requireDefinition(definitions, report.templateCode), session.demographics));
  return deepCloneAndFreeze({
    origin: "Completed",
    accessionNumber: session.accessionNumber,
    completedAt: session.completedAt || null,
    snapshotVersion: null,
    logoSource: CANONICAL_REPORT_LOGO_SOURCE,
    demographics: resolveDemographics(session.demographics),
    reports,
  });
}
