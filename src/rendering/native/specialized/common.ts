import type { ResolvedSignatorySlot } from "@/rendering/model";
import { fitNativeTextLines, wrapNativeTextLines } from "../text-layout";
import type { NativePagePrimitive, NativeTextAlignment, NativeTextPrimitive } from "../types";
import { NATIVE_REPORT_THEME } from "../theme";
import { STANDARD_FONT_ROLES } from "../standard/sections";
import { STANDARD_PAGE, type NativeFlowSectionResult } from "../standard/types";

export const SPECIALIZED_LINE_HEIGHT_MM = 4.2;
const { colors: COLOR, typography: TYPE } = NATIVE_REPORT_THEME;

export function specializedText(
  options: Omit<NativeTextPrimitive, "kind" | "fontRole"> & { fontRole?: string }
): NativeTextPrimitive {
  return { kind: "text", fontRole: options.fontRole ?? "body", ...options };
}

export function specializedLine(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  widthMm = 0.12
): NativePagePrimitive {
  return { kind: "line", id, x1, y1, x2, y2, color: COLOR.separator, widthMm };
}

export function wrapSpecializedText(
  id: string,
  value: string,
  widthMm: number,
  fontSizePt = 8.5,
  weight?: "normal" | "bold"
): string[] {
  return wrapNativeTextLines({
    id,
    text: value,
    font: STANDARD_FONT_ROLES.body,
    weight,
    fontSizePt,
    availableWidthMm: widthMm,
  });
}

export function addSpecializedLines(options: {
  primitives: NativePagePrimitive[];
  id: string;
  lines: string[];
  x: number;
  y: number;
  width: number;
  fontSizePt?: number;
  weight?: "normal" | "bold";
  align?: NativeTextAlignment;
  color?: string;
}): void {
  options.lines.forEach((value, index) => options.primitives.push(specializedText({
    id: `${options.id}-line-${index + 1}`,
    text: value,
    x: options.x,
    y: options.y + index * SPECIALIZED_LINE_HEIGHT_MM,
    width: options.width,
    height: SPECIALIZED_LINE_HEIGHT_MM,
    fontSizePt: options.fontSizePt ?? 8.5,
    fontWeight: options.weight,
    align: options.align,
    color: options.color ?? COLOR.text,
  })));
}

/**
 * Vertical step between wrapped signatory lines. It matches the established name-to-underline gap,
 * so a wrapped column keeps the same visual rhythm as an unwrapped one. Note the nominal text boxes
 * are 4 mm tall on this 3.6 mm step, so declared rectangles overlap slightly by design.
 */
const SIGNATORY_LINE_STEP_MM = 3.6;

interface FittedSignatoryText {
  lines: string[];
  fontSizePt: number;
}

/**
 * Pass-one fit. Emits nothing: the shared band cannot be computed until every column has been
 * measured. The stable base ID is passed through so a composition failure names the real primitive
 * rather than an anonymous fragment. A value that still cannot fit within its allowed line budget at
 * the 6.25 pt floor throws, which is deliberate - identity text is never truncated or abbreviated.
 */
function fitSignatoryText(
  id: string,
  value: string,
  width: number,
  bold: boolean,
  maxLines: 2 | 3
): FittedSignatoryText {
  if (!value) return { lines: [], fontSizePt: 0 };
  return fitNativeTextLines({
    id,
    text: value,
    font: STANDARD_FONT_ROLES.body,
    weight: bold ? "bold" : "normal",
    declaredFontSizePt: bold ? TYPE.signatoryNamePt : TYPE.signatoryDetailPt,
    availableWidthMm: width,
    maxLines,
    oneLineMinFontSizePt: 6.25,
    twoLineMinFontSizePt: 6.25,
    ...(maxLines >= 3 ? { threeLineMinFontSizePt: 6.25 } : {}),
  });
}

/**
 * Pass-two emit. The first line keeps the established base ID so every existing identifier and
 * assertion stays valid; continuation lines take `-line-2` and `-line-3`. `y` is the text top of the
 * first line, not a typographic baseline.
 */
function emitSignatoryText(
  primitives: NativePagePrimitive[],
  baseId: string,
  fitted: FittedSignatoryText,
  x: number,
  y: number,
  width: number,
  bold: boolean
): void {
  fitted.lines.forEach((line, index) => primitives.push(specializedText({
    id: index === 0 ? baseId : `${baseId}-line-${index + 1}`,
    text: line,
    x,
    y: y + index * SIGNATORY_LINE_STEP_MM,
    width,
    height: 4,
    fontSizePt: fitted.fontSizePt,
    fontWeight: bold ? "bold" : "normal",
    align: "center",
    color: bold ? COLOR.text : COLOR.mutedText,
  })));
}

export interface SpecializedSignatoryColumn {
  id: string;
  heading: string;
  roleLabel: string;
  slot: ResolvedSignatorySlot | undefined;
  allowSignatureImage: boolean;
}

export function composeSpecializedSignatoryColumns(
  columns: SpecializedSignatoryColumn[],
  y: number
): NativeFlowSectionResult {
  const primitives: NativePagePrimitive[] = [];
  const columnWidth = STANDARD_PAGE.contentWidthMm / columns.length;
  // One source for the frame width, so the centring expression and the declared width cannot
  // drift apart again. They previously did: the position was computed from 24 while the frame
  // declared 22, leaving the image 1 mm left of its column centre.
  const signatureWidthMm = 22;
  const textWidth = columnWidth - 4;

  // PASS ONE - measure every column before emitting anything. A signatory identity longer than one
  // line has to push the rows beneath it down, and those rows are shared across all three columns,
  // so the expansion can only be known once every name and licence has been fitted.
  const fittedNames = columns.map((column) => fitSignatoryText(
    `${column.id}-name`, column.slot?.printedNameWithCredentials || "", textWidth, true, 3
  ));
  const fittedLicenses = columns.map((column) => fitSignatoryText(
    `${column.id}-license`, column.slot?.licenseDisplay || "", textWidth, false, 2
  ));
  const sharedNameLineCount = Math.max(1, ...fittedNames.map((fitted) => fitted.lines.length));
  const sharedLicenseLineCount = Math.max(1, ...fittedLicenses.map((fitted) => fitted.lines.length));
  const nameExpansionMm = (sharedNameLineCount - 1) * SIGNATORY_LINE_STEP_MM;
  const licenseExpansionMm = (sharedLicenseLineCount - 1) * SIGNATORY_LINE_STEP_MM;

  // Text-top coordinates, not typographic baselines. The first name line keeps its established top;
  // every row beneath it moves by the SHARED expansion, so one long identity can never leave a
  // single column's underline, licence or role sitting at a different height from its neighbours.
  const nameY = y + 7.8;
  const underlineY = nameY + 3.6 + nameExpansionMm;
  const licenseY = nameY + 4 + nameExpansionMm;
  const roleY = nameY + 7.3 + nameExpansionMm + licenseExpansionMm;
  const bottomMm = nameY + 10.7 + nameExpansionMm + licenseExpansionMm;

  // PASS TWO - emit from the pre-fitted content using the shared coordinates.
  columns.forEach((column, index) => {
    const x = STANDARD_PAGE.marginMm + index * columnWidth;
    if (column.heading) primitives.push(specializedText({
      id: `${column.id}-heading`, text: column.heading, x: x + 1, y, width: columnWidth - 2, height: 4,
      fontSizePt: TYPE.sectionLabelPt, fontWeight: "bold", color: COLOR.primaryDark, align: "center",
    }));
    const hasSignature = Boolean(column.allowSignatureImage && column.slot?.signatureAsset);
    if (hasSignature && column.slot?.signatureAsset) primitives.push({
      kind: "image",
      id: `${column.id}-signature`,
      source: column.slot.signatureAsset.source,
      x: x + (columnWidth - signatureWidthMm) / 2,
      y: y + 0.4,
      width: signatureWidthMm,
      height: 6.5,
      fit: "contain",
      failurePolicy: column.slot.signatureAsset.failurePolicy,
    });
    emitSignatoryText(primitives, `${column.id}-name`, fittedNames[index], x + 2, nameY, textWidth, true);
    primitives.push(specializedLine(`${column.id}-line`, x + 7, underlineY, x + columnWidth - 7, underlineY, 0.1));
    emitSignatoryText(primitives, `${column.id}-license`, fittedLicenses[index], x + 2, licenseY, textWidth, false);
    primitives.push(specializedText({
      id: `${column.id}-role`, text: column.roleLabel, x: x + 2, y: roleY, width: textWidth, height: 3.4,
      fontSizePt: TYPE.signatoryDetailPt, fontWeight: "bold", color: COLOR.primary, align: "center",
    }));
  });
  return { primitives, bottomMm };
}
