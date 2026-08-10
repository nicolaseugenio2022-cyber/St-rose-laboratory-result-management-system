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

function addFittedSignatoryText(
  primitives: NativePagePrimitive[],
  id: string,
  value: string,
  x: number,
  y: number,
  width: number,
  bold = false
): void {
  if (!value) return;
  const fitted = fitNativeTextLines({
    id,
    text: value,
    font: STANDARD_FONT_ROLES.body,
    weight: bold ? "bold" : "normal",
    declaredFontSizePt: bold ? TYPE.signatoryNamePt : TYPE.signatoryDetailPt,
    availableWidthMm: width,
    maxLines: 1,
    oneLineMinFontSizePt: 6.25,
  });
  primitives.push(specializedText({
    id,
    text: fitted.lines[0],
    x,
    y,
    width,
    height: 4,
    fontSizePt: fitted.fontSizePt,
    fontWeight: bold ? "bold" : "normal",
    align: "center",
    color: bold ? COLOR.text : COLOR.mutedText,
  }));
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
  const nameY = y + 7.8;
  let bottomMm = y;
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
      x: x + (columnWidth - 24) / 2,
      y: y + 0.4,
      width: 22,
      height: 6.5,
      fit: "contain",
      failurePolicy: column.slot.signatureAsset.failurePolicy,
    });
    addFittedSignatoryText(primitives, `${column.id}-name`, column.slot?.printedNameWithCredentials || "", x + 2, nameY, columnWidth - 4, true);
    primitives.push(specializedLine(`${column.id}-line`, x + 7, nameY + 3.6, x + columnWidth - 7, nameY + 3.6, 0.1));
    addFittedSignatoryText(primitives, `${column.id}-license`, column.slot?.licenseDisplay || "", x + 2, nameY + 4, columnWidth - 4);
    primitives.push(specializedText({
      id: `${column.id}-role`, text: column.roleLabel, x: x + 2, y: nameY + 7.3, width: columnWidth - 4, height: 3.4,
      fontSizePt: TYPE.signatoryDetailPt, fontWeight: "bold", color: COLOR.primary, align: "center",
    }));
    bottomMm = Math.max(bottomMm, nameY + 10.7);
  });
  return { primitives, bottomMm };
}
