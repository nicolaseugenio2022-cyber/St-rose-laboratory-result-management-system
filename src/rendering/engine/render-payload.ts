import { ILaboratoryReport, ILaboratoryResult, IPatientReportSession } from "@/domain/models/interfaces";
import { SignatorySnapshot } from "@/domain/types";
import { ReportLayout, TextField } from "../types/layout.types";
import { getReportDemographicPolicy } from "../../domain/report-demographic-policy";

export interface PositionedText {
  key: string;
  value: string;
  config: TextField;
}

export interface PositionedSignature {
  key: string;
  snapshot: SignatorySnapshot;
  name: PositionedText;
  title?: PositionedText;
  licenseNo: PositionedText;
  imageUrl?: string;
  imageConfig?: NonNullable<ReportLayout["signatories"]["pathologist"]["signatureImage"]>;
}

export interface ReportRenderPayload {
  demographics: PositionedText[];
  results: PositionedText[];
  remarks: PositionedText[];
  signatures: PositionedSignature[];
}

function formatDate(value: string): string {
  if (!value) return "";

  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return value.toUpperCase();
  }

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return value.toUpperCase();

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .toUpperCase();
}

function formatPatientStatus(value: string | undefined): string {
  if (value === "InPatient") return "In-Patient";
  if (value === "OutPatient") return "Out-Patient";
  return value || "";
}

function applyTextTransform(value: string, config: TextField): string {
  const transformed = config.textTransform === "uppercase" ? value.toUpperCase() : value;
  return config.maxChars && transformed.length > config.maxChars
    ? `${transformed.substring(0, config.maxChars)}...`
    : transformed;
}

function buildDemographics(
  session: IPatientReportSession,
  report: ILaboratoryReport,
  layout: ReportLayout
): PositionedText[] {
  const demographics = session.demographics;
  const hasAge = typeof demographics.age === "number" && demographics.age > 0;
  const demographicPolicy = getReportDemographicPolicy(report.templateCode);
  const age = hasAge
    ? demographicPolicy.age.outputMode === "number-only"
      ? String(demographics.age)
      : `${demographics.age} ${demographics.ageUnit || ""}`.trim()
    : "";
  const values: Record<string, string> = {
    patientName: demographics.fullName || "",
    age,
    ageSex: hasAge && demographics.sex
      ? `${demographics.age} / ${demographics.sex}`
      : hasAge
        ? String(demographics.age)
        : demographics.sex || "",
    sex: demographics.sex || "",
    gender: demographics.sex || "",
    dateOfExam: formatDate(demographics.examinationDate),
    accessionNo: session.accessionNumber || "",
    address: demographics.address || "",
    requestingPhysician: demographics.requestingPhysician || "",
    patientStatus: formatPatientStatus(demographics.patientStatus),
  };

  return Object.entries(layout.fields).map(([key, config]) => ({
    key,
    value: applyTextTransform(values[key] || String((report as unknown as Record<string, unknown>)[key] || ""), config),
    config,
  }));
}

function normalizeResults(results: ILaboratoryResult[]): Map<string, ILaboratoryResult> {
  const resultMap = new Map<string, ILaboratoryResult>();
  for (const result of results) {
    resultMap.set(result.parameterCode.toLowerCase(), result);
  }
  return resultMap;
}

function buildResults(report: ILaboratoryReport, layout: ReportLayout): PositionedText[] {
  const resultMap = normalizeResults(report.results || []);
  const fields: PositionedText[] = [];
  const defaultFontSize = layout.results.defaultFontSize || 3.2;

  for (const row of layout.results.rows) {
    const result = resultMap.get(row.testKey.toLowerCase());
    if (!result) continue;

    for (const [columnKey, column] of Object.entries(layout.results.columns)) {
      let value = "";
      if (columnKey === "result" || columnKey === "value") {
        value = result.resultValue || "";
        if (value && row.displayPrecision !== undefined) {
          const numericValue = Number(value);
          if (Number.isFinite(numericValue)) value = numericValue.toFixed(row.displayPrecision);
        }
      }
      if (columnKey === "unit") value = result.unit || "";
      if (!value) continue;

      fields.push({
        key: `${row.testKey}-${columnKey}`,
        value,
        config: {
          x: column.x,
          y: row.y,
          width: column.width,
          align: column.align || "left",
          fontSize: defaultFontSize,
          fontWeight: "normal",
          color: "#000000",
        },
      });
    }
  }

  return fields;
}

function buildRemarks(report: ILaboratoryReport, layout: ReportLayout): PositionedText[] {
  if (!layout.remarks || !report.remarks) return [];
  return [{
    key: "remarks",
    value: applyTextTransform(report.remarks, layout.remarks),
    config: layout.remarks,
  }];
}

function formatSignatoryName(snapshot: SignatorySnapshot): string {
  if (!snapshot.printedCredentials) return snapshot.printedFullName;
  return `${snapshot.printedFullName}, ${snapshot.printedCredentials}`;
}

function buildSignatures(report: ILaboratoryReport, layout: ReportLayout): PositionedSignature[] {
  const roleConfigs = [
    { role: "Pathologist" as const, key: "pathologist", config: layout.signatories.pathologist },
    { role: "MedicalTechnologist" as const, key: "medical-technologist", config: layout.signatories.medicalTechnologist },
  ];

  return roleConfigs.flatMap(({ role, key, config }) => {
    const snapshot = report.signatories.find((candidate) => candidate.role === role);
    if (!snapshot) return [];

    return [{
      key,
      snapshot,
      name: {
        key: `${key}-name`,
        value: formatSignatoryName(snapshot),
        config: config.name,
      },
      title: config.title
        ? { key: `${key}-title`, value: role === "Pathologist" ? "Pathologist" : "Medical Technologist", config: config.title }
        : undefined,
      licenseNo: {
        key: `${key}-license`,
        value: snapshot.printedPrcLicenseNumber ? `License no. ${snapshot.printedPrcLicenseNumber}` : "",
        config: config.licenseNo,
      },
      imageUrl: snapshot.signatureImageUrl || undefined,
      imageConfig: config.signatureImage,
    }];
  });
}

export function buildReportRenderPayload(
  session: IPatientReportSession,
  report: ILaboratoryReport,
  layout: ReportLayout
): ReportRenderPayload {
  return {
    demographics: buildDemographics(session, report, layout),
    results: buildResults(report, layout),
    remarks: buildRemarks(report, layout),
    signatures: buildSignatures(report, layout),
  };
}
