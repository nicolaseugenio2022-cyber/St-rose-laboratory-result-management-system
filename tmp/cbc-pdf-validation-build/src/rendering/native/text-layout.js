"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.measureNativeTextWidthMm = measureNativeTextWidthMm;
exports.fitNativeTextFontSizePt = fitNativeTextFontSizePt;
const jspdf_1 = __importDefault(require("jspdf"));
const DEFAULT_FIT_GUARD_MM = 0.3;
let measurementDocument = null;
function getMeasurementDocument() {
    if (!measurementDocument) {
        measurementDocument = new jspdf_1.default({ unit: "mm", format: "a4", putOnlyUsedFonts: true });
    }
    return measurementDocument;
}
function measureNativeTextWidthMm(text, font, weight, fontSizePt) {
    const pdf = getMeasurementDocument();
    pdf.setFont(font?.pdfFamily || "helvetica", weight === "bold" ? "bold" : "normal");
    pdf.setFontSize(fontSizePt);
    return pdf.getTextWidth(text.replaceAll("\u2013", "\u0096"));
}
function fitNativeTextFontSizePt(options) {
    const { text, font, weight, declaredFontSizePt, availableWidthMm, guardMm = DEFAULT_FIT_GUARD_MM, } = options;
    if (!text || availableWidthMm <= 0)
        return declaredFontSizePt;
    const measuredWidthMm = measureNativeTextWidthMm(text, font, weight, declaredFontSizePt);
    // Built-in Helvetica metrics differ slightly between jsPDF and browser/PDF
    // extraction engines. The two-percent guard keeps the one composed size
    // inside the physical frame on every adapter without changing short text.
    const targetWidthMm = Math.max(0, Math.min(availableWidthMm - guardMm, availableWidthMm * 0.98));
    if (measuredWidthMm <= targetWidthMm)
        return declaredFontSizePt;
    const fitted = declaredFontSizePt * (targetWidthMm / measuredWidthMm);
    return Math.max(0.1, Math.floor(fitted * 1000) / 1000);
}
