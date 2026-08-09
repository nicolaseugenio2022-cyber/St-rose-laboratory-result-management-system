"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativePDFExporter = exports.browserNativePdfAssetResolver = void 0;
exports.createNativeReportPdf = createNativeReportPdf;
const jspdf_1 = __importDefault(require("jspdf"));
const composer_1 = require("./composer");
function parseHexColor(value = "#000000") {
    const normalized = value.replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(normalized))
        return [0, 0, 0];
    return [
        Number.parseInt(normalized.slice(0, 2), 16),
        Number.parseInt(normalized.slice(2, 4), 16),
        Number.parseInt(normalized.slice(4, 6), 16),
    ];
}
function setColor(pdf, color, target) {
    const [red, green, blue] = parseHexColor(color);
    if (target === "draw")
        pdf.setDrawColor(red, green, blue);
    if (target === "fill")
        pdf.setFillColor(red, green, blue);
    if (target === "text")
        pdf.setTextColor(red, green, blue);
}
function fontSizeMm(fontSizePt) {
    return (fontSizePt * 25.4) / 72;
}
function encodeStandardPdfFontText(value) {
    // jsPDF's built-in Type1 fonts use WinAnsi. Supplying U+2013 directly is
    // serialized as UTF-8 bytes and copies back as mojibake, while byte 0x96 is
    // the WinAnsi en dash used by the approved laboratory wording.
    return value.replaceAll("\u2013", "\u0096");
}
function drawText(pdf, page, primitive) {
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
function drawRichText(pdf, page, primitive) {
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
async function drawImage(pdf, primitive, resolver) {
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
async function drawPrimitive(pdf, page, primitive, resolver) {
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
    if (primitive.fill)
        setColor(pdf, primitive.fill, "fill");
    if (primitive.stroke) {
        setColor(pdf, primitive.stroke, "draw");
        pdf.setLineWidth(primitive.strokeWidthMm || 0.15);
    }
    pdf.rect(primitive.x, primitive.y, primitive.width, primitive.height, style);
}
function inferFormat(contentType, source) {
    if (contentType?.includes("jpeg") || /\.jpe?g(?:\?|$)/i.test(source))
        return "JPEG";
    return "PNG";
}
exports.browserNativePdfAssetResolver = {
    async load(source) {
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
function createFileName(session, report) {
    const safe = (value, fallback) => (value || fallback).replace(/[^a-zA-Z0-9-]/g, "_");
    return `LabReport_${safe(report.templateCode, "Report")}_${safe(session.accessionNumber, "Accession")}_${safe(session.demographics.fullName, "Patient")}.pdf`;
}
async function createNativeReportPdf(page, resolver = exports.browserNativePdfAssetResolver) {
    const pdf = new jspdf_1.default({
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
class NativePDFExporter {
    static async exportSingleReportPDF(session, report, definition, options = {}) {
        options.onProgress?.(10);
        const page = (0, composer_1.composeNativeReportPage)(definition, session, report);
        options.onProgress?.(25);
        const pdf = await createNativeReportPdf(page, options.assetResolver || exports.browserNativePdfAssetResolver);
        options.onProgress?.(90);
        const blob = pdf.output("blob");
        if (options.download !== false) {
            pdf.save(options.fileName || createFileName(session, report));
        }
        options.onProgress?.(100);
        return blob;
    }
}
exports.NativePDFExporter = NativePDFExporter;
