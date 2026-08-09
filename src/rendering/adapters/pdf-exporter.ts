import jsPDF from "jspdf";
import { ILaboratoryReport, IPatientReportSession } from "@/domain/models/interfaces";
import { ArtworkMask, ImageField, ReportLayout, TextField } from "../types/layout.types";
import { CoordinateTransformer } from "../engine/CoordinateTransformer";
import { buildReportRenderPayload, PositionedText } from "../engine/render-payload";

export interface PDFExportOptions {
  fileName?: string;
  onProgress?: (progressPercent: number) => void;
  download?: boolean;
}

type RGB = [number, number, number];

function parseHexColor(value: string | undefined, fallback: RGB): RGB {
  if (!value) return fallback;
  const normalized = value.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

async function loadAsset(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load required PDF asset "${url}" (${response.status}).`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function drawMask(pdf: jsPDF, mask: ArtworkMask): void {
  const [red, green, blue] = parseHexColor(mask.color, [255, 255, 255]);
  pdf.setFillColor(red, green, blue);
  pdf.rect(mask.x, mask.y, mask.width, mask.height, "F");
}

function getFontStyle(weight: TextField["fontWeight"]): "normal" | "bold" {
  return weight === "bold" || (typeof weight === "number" && weight >= 600) ? "bold" : "normal";
}

function drawText(
  pdf: jsPDF,
  transformer: CoordinateTransformer,
  item: PositionedText
): void {
  if (!item.value) return;

  const config = item.config;
  const fontSizeMm = config.fontSize || 3.2;
  const [red, green, blue] = parseHexColor(config.color, [0, 0, 0]);
  const align = config.align || "left";
  const width = config.width || 0;
  const anchorX = align === "center" ? config.x + width / 2 : align === "right" ? config.x + width : config.x;
  const baselineY = config.y + fontSizeMm * 0.82;

  pdf.setFont("helvetica", getFontStyle(config.fontWeight));
  pdf.setFontSize(transformer.mmToPt(fontSizeMm));
  pdf.setTextColor(red, green, blue);
  pdf.text(item.value, anchorX, baselineY, { align });

  if (config.underline) {
    const textWidth = pdf.getTextWidth(item.value);
    const lineStart = align === "center" ? anchorX - textWidth / 2 : align === "right" ? anchorX - textWidth : anchorX;
    pdf.setDrawColor(red, green, blue);
    pdf.setLineWidth(0.15);
    pdf.line(lineStart, baselineY + 0.45, lineStart + textWidth, baselineY + 0.45);
  }
}

async function drawImage(pdf: jsPDF, url: string, config: ImageField): Promise<void> {
  const data = await loadAsset(url);
  pdf.addImage(data, "PNG", config.x, config.y, config.width, config.height, undefined, "FAST");
}

function createFileName(session: IPatientReportSession, report: ILaboratoryReport): string {
  const accession = session.accessionNumber.replace(/[^a-zA-Z0-9-]/g, "_");
  const patient = (session.demographics.fullName || "Patient").replace(/[^a-zA-Z0-9-]/g, "_");
  return `LabReport_${report.templateCode}_${accession}_${patient}.pdf`;
}

/**
 * CBC native-text PDF adapter.
 *
 * The approved template PNG is embedded once as immutable artwork. Only the
 * report values, remarks, and signatory metadata are written as PDF text, so
 * they remain selectable, searchable, and copyable.
 */
export class PDFExporter {
  public static async exportSingleReportPDF(
    session: IPatientReportSession,
    report: ILaboratoryReport,
    layout: ReportLayout,
    options: PDFExportOptions = {}
  ): Promise<Blob> {
    if (report.templateCode !== "CBC" || layout.templateCode !== "CBC") {
      throw new Error("The native-text PDF exporter is currently enabled for CBC only.");
    }

    const transformer = new CoordinateTransformer(1);
    const payload = buildReportRenderPayload(session, report, layout);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    options.onProgress?.(10);
    const background = await loadAsset(layout.backgroundAssetPath);
    pdf.addImage(background, "PNG", 0, 0, 210, 297, undefined, "FAST");

    for (const mask of layout.artworkMasks || []) drawMask(pdf, mask);
    options.onProgress?.(35);

    for (const item of payload.demographics) drawText(pdf, transformer, item);
    for (const item of payload.results) drawText(pdf, transformer, item);
    for (const item of payload.remarks) drawText(pdf, transformer, item);
    options.onProgress?.(70);

    for (const signature of payload.signatures) {
      if (signature.imageUrl && signature.imageConfig) {
        await drawImage(pdf, signature.imageUrl, signature.imageConfig);
      }
      drawText(pdf, transformer, signature.name);
      if (signature.title) drawText(pdf, transformer, signature.title);
      drawText(pdf, transformer, signature.licenseNo);
    }
    options.onProgress?.(90);

    const blob = pdf.output("blob");
    if (options.download !== false) {
      pdf.save(options.fileName || createFileName(session, report));
    }
    options.onProgress?.(100);
    return blob;
  }
}
