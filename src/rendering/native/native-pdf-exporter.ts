import jsPDF from "jspdf";
import type { ILaboratoryReport, IPatientReportSession } from "@/domain/models/interfaces";
import { composeNativeReportPage } from "./composer";
import type {
  NativeComposedPage,
  NativeImagePrimitive,
  NativePagePrimitive,
  NativeReportDefinition,
  NativeRichTextPrimitive,
  NativeTextPrimitive,
} from "./types";

type RGB = [number, number, number];

export interface NativePdfAsset {
  bytes: Uint8Array;
  format: "PNG" | "JPEG";
}

export interface NativePdfAssetResolver {
  load(source: string): Promise<NativePdfAsset>;
}

export interface NativePdfExportOptions {
  fileName?: string;
  download?: boolean;
  onProgress?: (progressPercent: number) => void;
  assetResolver?: NativePdfAssetResolver;
}

function parseHexColor(value = "#000000"): RGB {
  const normalized = value.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return [0, 0, 0];
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function setColor(pdf: jsPDF, color: string, target: "draw" | "fill" | "text"): void {
  const [red, green, blue] = parseHexColor(color);
  if (target === "draw") pdf.setDrawColor(red, green, blue);
  if (target === "fill") pdf.setFillColor(red, green, blue);
  if (target === "text") pdf.setTextColor(red, green, blue);
}

function fontSizeMm(fontSizePt: number): number {
  return (fontSizePt * 25.4) / 72;
}

function encodeStandardPdfFontText(value: string): string {
  // jsPDF's built-in Type1 fonts use WinAnsi. Supplying U+2013 directly is
  // serialized as UTF-8 bytes and copies back as mojibake, while byte 0x96 is
  // the WinAnsi en dash used by the approved laboratory wording.
  return value.replaceAll("\u2013", "\u0096");
}

function drawText(pdf: jsPDF, page: NativeComposedPage, primitive: NativeTextPrimitive): void {
  const role = page.fontRoles[primitive.fontRole];
  pdf.setFont(role?.pdfFamily || "helvetica", primitive.fontWeight === "bold" ? "bold" : "normal");
  pdf.setFontSize(primitive.fontSizePt);
  setColor(pdf, primitive.color || "#000000", "text");

  const align = primitive.align || "left";
  const anchorX = align === "center"
    ? primitive.x + (primitive.width || 0) / 2
    : align === "right"
      ? primitive.x + (primitive.width || 0)
      : primitive.x;
  const baselineY = primitive.y + fontSizeMm(primitive.fontSizePt) * 0.78;

  const encodedText = encodeStandardPdfFontText(primitive.text);
  pdf.text(encodedText, anchorX, baselineY, {
    align,
    maxWidth: primitive.width,
  });

  if (primitive.underline) {
    const textWidth = Math.min(pdf.getTextWidth(encodedText), primitive.width || Number.POSITIVE_INFINITY);
    const startX = align === "center"
      ? anchorX - textWidth / 2
      : align === "right"
        ? anchorX - textWidth
        : anchorX;
    setColor(pdf, primitive.color || "#000000", "draw");
    pdf.setLineWidth(0.12);
    pdf.line(startX, baselineY + 0.5, startX + textWidth, baselineY + 0.5);
  }
}

function drawRichText(pdf: jsPDF, page: NativeComposedPage, primitive: NativeRichTextPrimitive): void {
  const role = page.fontRoles[primitive.fontRole];
  const family = role?.pdfFamily || "helvetica";
  const lineHeight = primitive.lineHeightMm || fontSizeMm(primitive.fontSizePt) * 1.05;
  setColor(pdf, primitive.color || "#000000", "text");

  primitive.lines.forEach((line, lineIndex) => {
    let cursorX = primitive.x;
    const baselineY = primitive.y + fontSizeMm(primitive.fontSizePt) * 0.78 + lineIndex * lineHeight;
    for (const run of line) {
      const size = run.fontSizePt || primitive.fontSizePt;
      pdf.setFont(family, primitive.fontWeight === "bold" ? "bold" : "normal");
      pdf.setFontSize(size);
      const encodedText = encodeStandardPdfFontText(run.text);
      pdf.text(encodedText, cursorX, baselineY + (run.riseMm || 0));
      cursorX += pdf.getTextWidth(encodedText);
    }
  });
}

async function drawImage(
  pdf: jsPDF,
  primitive: NativeImagePrimitive,
  resolver: NativePdfAssetResolver
): Promise<void> {
  const asset = await resolver.load(primitive.source);
  let x = primitive.x;
  let y = primitive.y;
  let width = primitive.width || 0;
  let height = primitive.height || 0;

  if (primitive.fit === "contain") {
    const properties = pdf.getImageProperties(asset.bytes);
    const scale = Math.min(width / properties.width, height / properties.height);
    const containedWidth = properties.width * scale;
    const containedHeight = properties.height * scale;
    x += (width - containedWidth) / 2;
    y += (height - containedHeight) / 2;
    width = containedWidth;
    height = containedHeight;
  }

  pdf.addImage(asset.bytes, asset.format, x, y, width, height, undefined, "FAST");
}

async function drawPrimitive(
  pdf: jsPDF,
  page: NativeComposedPage,
  primitive: NativePagePrimitive,
  resolver: NativePdfAssetResolver
): Promise<void> {
  if (primitive.kind === "text") {
    drawText(pdf, page, primitive);
    return;
  }
  if (primitive.kind === "rich-text") {
    drawRichText(pdf, page, primitive);
    return;
  }
  if (primitive.kind === "image") {
    await drawImage(pdf, primitive, resolver);
    return;
  }
  if (primitive.kind === "line") {
    setColor(pdf, primitive.color, "draw");
    pdf.setLineWidth(primitive.widthMm);
    pdf.line(primitive.x1, primitive.y1, primitive.x2, primitive.y2);
    return;
  }

  const style = primitive.fill && primitive.stroke ? "FD" : primitive.fill ? "F" : "S";
  if (primitive.fill) setColor(pdf, primitive.fill, "fill");
  if (primitive.stroke) {
    setColor(pdf, primitive.stroke, "draw");
    pdf.setLineWidth(primitive.strokeWidthMm || 0.15);
  }
  pdf.rect(primitive.x, primitive.y, primitive.width, primitive.height, style);
}

function inferFormat(contentType: string | null, source: string): NativePdfAsset["format"] {
  if (contentType?.includes("jpeg") || /\.jpe?g(?:\?|$)/i.test(source)) return "JPEG";
  return "PNG";
}

export const browserNativePdfAssetResolver: NativePdfAssetResolver = {
  async load(source: string): Promise<NativePdfAsset> {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Unable to load required native PDF asset "${source}" (${response.status}).`);
    }
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      format: inferFormat(response.headers.get("content-type"), source),
    };
  },
};

function createFileName(session: IPatientReportSession, report: ILaboratoryReport): string {
  const safe = (value: string, fallback: string) =>
    (value || fallback).replace(/[^a-zA-Z0-9-]/g, "_");
  return `LabReport_${safe(report.templateCode, "Report")}_${safe(session.accessionNumber, "Accession")}_${safe(session.demographics.fullName, "Patient")}.pdf`;
}

export async function createNativeReportPdf(
  page: NativeComposedPage,
  resolver: NativePdfAssetResolver = browserNativePdfAssetResolver
): Promise<jsPDF> {
  const pdf = new jsPDF({
    orientation: page.widthMm <= page.heightMm ? "portrait" : "landscape",
    unit: "mm",
    format: [page.widthMm, page.heightMm],
    compress: true,
    putOnlyUsedFonts: true,
  });

  for (const primitive of page.primitives) {
    await drawPrimitive(pdf, page, primitive, resolver);
  }
  return pdf;
}

export class NativePDFExporter {
  static async exportSingleReportPDF(
    session: IPatientReportSession,
    report: ILaboratoryReport,
    definition: NativeReportDefinition,
    options: NativePdfExportOptions = {}
  ): Promise<Blob> {
    options.onProgress?.(10);
    const page = composeNativeReportPage(definition, session, report);
    options.onProgress?.(25);
    const pdf = await createNativeReportPdf(
      page,
      options.assetResolver || browserNativePdfAssetResolver
    );
    options.onProgress?.(90);

    const blob = pdf.output("blob");
    if (options.download !== false) {
      pdf.save(options.fileName || createFileName(session, report));
    }
    options.onProgress?.(100);
    return blob;
  }
}
