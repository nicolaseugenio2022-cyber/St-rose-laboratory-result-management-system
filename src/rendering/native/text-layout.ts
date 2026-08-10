import jsPDF from "jspdf";
import type { NativeFontRoleDefinition, NativeFontWeight } from "./types";

const DEFAULT_FIT_GUARD_MM = 0.3;

let measurementDocument: jsPDF | null = null;

function getMeasurementDocument(): jsPDF {
  if (!measurementDocument) {
    measurementDocument = new jsPDF({ unit: "mm", format: "a4", putOnlyUsedFonts: true });
  }
  return measurementDocument;
}

export function measureNativeTextWidthMm(
  text: string,
  font: NativeFontRoleDefinition | undefined,
  weight: NativeFontWeight | undefined,
  fontSizePt: number
): number {
  const pdf = getMeasurementDocument();
  pdf.setFont(font?.pdfFamily || "helvetica", weight === "bold" ? "bold" : "normal");
  pdf.setFontSize(fontSizePt);
  return pdf.getTextWidth(text.replaceAll("\u2013", "\u0096"));
}

export function fitNativeTextFontSizePt(options: {
  text: string;
  font: NativeFontRoleDefinition | undefined;
  weight?: NativeFontWeight;
  declaredFontSizePt: number;
  availableWidthMm: number;
  guardMm?: number;
}): number {
  const {
    text,
    font,
    weight,
    declaredFontSizePt,
    availableWidthMm,
    guardMm = DEFAULT_FIT_GUARD_MM,
  } = options;
  if (!text || availableWidthMm <= 0) return declaredFontSizePt;

  const measuredWidthMm = measureNativeTextWidthMm(text, font, weight, declaredFontSizePt);
  // Built-in Helvetica metrics differ slightly between jsPDF and browser/PDF
  // extraction engines. The two-percent guard keeps the one composed size
  // inside the physical frame on every adapter without changing short text.
  const targetWidthMm = fitTargetWidthMm(availableWidthMm, guardMm);
  if (measuredWidthMm <= targetWidthMm) return declaredFontSizePt;

  const fitted = declaredFontSizePt * (targetWidthMm / measuredWidthMm);
  return Math.max(0.1, Math.floor(fitted * 1000) / 1000);
}

function fitTargetWidthMm(availableWidthMm: number, guardMm = DEFAULT_FIT_GUARD_MM): number {
  return Math.max(0, Math.min(availableWidthMm - guardMm, availableWidthMm * 0.98));
}

function wrapAtAllowedBoundaries(
  text: string,
  maxWidthMm: number,
  measure: (value: string) => number
): string[] | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const tokens = words.flatMap((word, wordIndex) => {
    const hyphenParts = word.match(/[^-]+-?|-/g) || [word];
    return hyphenParts.map((part, partIndex) => ({
      text: part,
      spaceBefore: wordIndex > 0 && partIndex === 0,
    }));
  });
  const lines: string[] = [];
  let current = "";

  for (const token of tokens) {
    const candidate = current
      ? `${current}${token.spaceBefore ? " " : ""}${token.text}`
      : token.text;
    if (measure(candidate) <= maxWidthMm) {
      current = candidate;
      continue;
    }
    if (!current || measure(token.text) > maxWidthMm) return null;
    lines.push(current);
    current = token.text;
  }
  if (current) lines.push(current);
  return lines;
}

export function fitNativeTextLines(options: {
  id: string;
  text: string;
  font: NativeFontRoleDefinition | undefined;
  weight: NativeFontWeight | undefined;
  declaredFontSizePt: number;
  availableWidthMm: number;
  maxLines: 1 | 2 | 3;
  oneLineMinFontSizePt: number;
  twoLineMinFontSizePt?: number;
  threeLineMinFontSizePt?: number;
  guardMm?: number;
}): { lines: string[]; fontSizePt: number } {
  const targetWidthMm = fitTargetWidthMm(options.availableWidthMm, options.guardMm);
  const stages = [
    { lines: 1, minimum: options.oneLineMinFontSizePt },
    ...(options.maxLines >= 2 && options.twoLineMinFontSizePt !== undefined
      ? [{ lines: 2, minimum: options.twoLineMinFontSizePt }]
      : []),
    ...(options.maxLines >= 3 && options.threeLineMinFontSizePt !== undefined
      ? [{ lines: 3, minimum: options.threeLineMinFontSizePt }]
      : []),
  ];

  for (const stage of stages) {
    for (
      let fontSizePt = options.declaredFontSizePt;
      fontSizePt >= stage.minimum - 0.0001;
      fontSizePt = Math.round((fontSizePt - 0.01) * 100) / 100
    ) {
      const lines = wrapAtAllowedBoundaries(options.text, targetWidthMm, (value) =>
        measureNativeTextWidthMm(value, options.font, options.weight, fontSizePt)
      );
      if (lines && lines.length <= stage.lines) return { lines, fontSizePt };
    }
  }

  throw new Error(
    `Native report composition failed: ${options.id} cannot fit complete text within ${options.maxLines} line(s) at the approved minimum font size.`
  );
}

export function wrapNativeTextLines(options: {
  id: string;
  text: string;
  font: NativeFontRoleDefinition | undefined;
  weight?: NativeFontWeight;
  fontSizePt: number;
  availableWidthMm: number;
  guardMm?: number;
}): string[] {
  if (!options.text.trim()) return [];
  const targetWidthMm = fitTargetWidthMm(options.availableWidthMm, options.guardMm);
  const lines = wrapAtAllowedBoundaries(options.text, targetWidthMm, (value) =>
    measureNativeTextWidthMm(value, options.font, options.weight, options.fontSizePt)
  );
  if (lines) return lines;
  throw new Error(
    `Native report composition failed: ${options.id} contains text that cannot wrap within its declared width.`
  );
}
