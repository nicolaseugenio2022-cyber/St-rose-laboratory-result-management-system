import type {
  ResolvedReportRenderModel,
  ResolvedResultRenderModel,
  ResolvedSessionRenderModel,
  ResolvedSignatorySlot,
} from "@/rendering/model";
import { fitNativeTextLines, wrapNativeTextLines } from "../text-layout";
import type {
  NativeFontRoleDefinition,
  NativePagePrimitive,
  NativeTextAlignment,
  NativeTextPrimitive,
} from "../types";
import { NATIVE_REPORT_THEME } from "../theme";
import { STANDARD_PAGE, type NativeFlowSectionResult, type StandardNativeCompositionDefinition } from "./types";

export const STANDARD_FONT_ROLES: Record<string, NativeFontRoleDefinition> = {
  display: { pdfFamily: "helvetica", previewFamily: "Helvetica, Arial, sans-serif" },
  body: { pdfFamily: "helvetica", previewFamily: "Helvetica, Arial, sans-serif" },
};

const { marginMm: PAGE_X, contentWidthMm: PAGE_WIDTH } = STANDARD_PAGE;
const { colors: COLOR, typography: TYPE, header: HEADER, sectionInsets: INSET } = NATIVE_REPORT_THEME;
const TEAL = COLOR.primary;
const BODY = COLOR.text;
const DEMOGRAPHIC_VALUE_LINE_MM = 3.6;
const DEMOGRAPHIC_LABEL_HEIGHT_MM = 2.4;
const RESULT_LINE_MM = 4.55;

function text(options: Omit<NativeTextPrimitive, "kind" | "fontRole"> & { fontRole?: string }): NativeTextPrimitive {
  return { kind: "text", fontRole: options.fontRole ?? "body", ...options };
}

function line(id: string, x1: number, y1: number, x2: number, y2: number, widthMm = 0.15): NativePagePrimitive {
  return { kind: "line", id, x1, y1, x2, y2, color: COLOR.separator, widthMm };
}

function resolvedLines(options: {
  id: string;
  value: string;
  width: number;
  fontSizePt: number;
  maxLines?: 1 | 2 | 3;
  minimumFontSizePt?: number;
  weight?: "normal" | "bold";
}): { lines: string[]; fontSizePt: number } {
  if (!options.value.trim()) return { lines: [], fontSizePt: options.fontSizePt };
  return fitNativeTextLines({
    id: options.id,
    text: options.value,
    font: STANDARD_FONT_ROLES.body,
    weight: options.weight,
    declaredFontSizePt: options.fontSizePt,
    availableWidthMm: options.width,
    maxLines: options.maxLines ?? 3,
    oneLineMinFontSizePt: options.minimumFontSizePt ?? 8,
    twoLineMinFontSizePt: options.minimumFontSizePt ?? 8,
    threeLineMinFontSizePt: options.minimumFontSizePt ?? 8,
  });
}

function addDemographicField(options: {
  primitives: NativePagePrimitive[];
  id: string;
  label: string;
  value: string;
  x: number;
  y: number;
  width: number;
  valueLineHeight: number;
  maxLines?: 1 | 2 | 3;
}): number {
  options.primitives.push(text({
    id: `${options.id}-label`,
    text: options.label,
    x: options.x + 1.2,
    y: options.y + 0.25,
    width: options.width - 2.4,
    height: DEMOGRAPHIC_LABEL_HEIGHT_MM,
    fontSizePt: TYPE.demographicLabelPt,
    fontWeight: "bold",
    color: COLOR.mutedText,
  }));
  const fitted = resolvedLines({
    id: options.id,
    value: options.value,
    width: options.width - 2.4,
    fontSizePt: TYPE.demographicValuePt,
    maxLines: options.maxLines,
    minimumFontSizePt: 7,
    weight: "bold",
  });
  fitted.lines.forEach((value, index) => options.primitives.push(text({
    id: `${options.id}-value-line-${index + 1}`,
    text: value,
    x: options.x + 1.2,
    y: options.y + DEMOGRAPHIC_LABEL_HEIGHT_MM + 0.1 + index * options.valueLineHeight,
    width: options.width - 2.4,
    height: options.valueLineHeight,
    fontSizePt: fitted.fontSizePt,
    fontWeight: "bold",
    color: BODY,
  })));
  return Math.max(1, fitted.lines.length);
}

export function composeOfficialHeader(session: ResolvedSessionRenderModel): NativeFlowSectionResult {
  const primitives: NativePagePrimitive[] = [
    {
      kind: "image",
      id: "official-logo",
      source: session.logoSource,
      x: HEADER.logoXmm,
      y: HEADER.topMm,
      width: HEADER.logoWidthMm,
      height: HEADER.logoHeightMm,
      fit: "contain",
      failurePolicy: "Error",
    },
    text({ id: "laboratory-name", text: "ST. ROSE DIAGNOSTIC LABORATORY", x: HEADER.identityXmm, y: 4.1, width: HEADER.identityWidthMm, height: 5.4, fontRole: "display", fontSizePt: TYPE.laboratoryNamePt, fontWeight: "bold", color: COLOR.primaryDark, align: "left" }),
    text({ id: "laboratory-address", text: "LA FUENTE, SANTA ROSA NUEVA ECIJA", x: HEADER.identityXmm, y: 10.2, width: HEADER.identityWidthMm, height: 3.4, fontSizePt: TYPE.laboratoryDetailPt, color: COLOR.text, align: "left" }),
    text({ id: "laboratory-landmark", text: "(IN FRONT OF LA FUENTE ELEMENTARY SCHOOL)", x: HEADER.identityXmm, y: 13.8, width: HEADER.identityWidthMm, height: 3.1, fontSizePt: 7.2, color: COLOR.mutedText, align: "left" }),
    text({ id: "laboratory-phone", text: "CELLPHONE NO. 0905-309-3602", x: HEADER.identityXmm, y: 17.1, width: HEADER.identityWidthMm, height: 3.2, fontSizePt: TYPE.laboratoryDetailPt, fontWeight: "bold", color: COLOR.primary, align: "left" }),
    { kind: "line", id: "header-divider", x1: PAGE_X, y1: HEADER.dividerYmm, x2: PAGE_X + PAGE_WIDTH, y2: HEADER.dividerYmm, color: TEAL, widthMm: 0.38 },
  ];
  return { primitives, bottomMm: HEADER.dividerYmm };
}

interface DemographicField {
  id: string;
  label: string;
  value: string;
  x: number;
  width: number;
  maxLines?: 1 | 2 | 3;
}

function demographicRow(
  id: string,
  y: number,
  fields: DemographicField[],
  separator: "none" | "bottom" = "none"
): NativeFlowSectionResult {
  const provisional = fields.map((field) => resolvedLines({
    id: field.id,
    value: field.value,
    width: field.width - 2.4,
    fontSizePt: TYPE.demographicValuePt,
    maxLines: field.maxLines,
    minimumFontSizePt: 7,
    weight: "bold",
  }));
  const lineCount = Math.max(1, ...provisional.map((item) => item.lines.length));
  const height = DEMOGRAPHIC_LABEL_HEIGHT_MM + lineCount * DEMOGRAPHIC_VALUE_LINE_MM + 0.7;
  const primitives: NativePagePrimitive[] = [];
  fields.forEach((field) => addDemographicField({ primitives, ...field, y, valueLineHeight: DEMOGRAPHIC_VALUE_LINE_MM }));
  if (separator === "bottom") {
    primitives.push(line(`${id}-bottom`, PAGE_X, y + height, PAGE_X + PAGE_WIDTH, y + height, 0.1));
  }
  return { primitives, bottomMm: y + height };
}

export function composeDemographics(
  session: ResolvedSessionRenderModel,
  report: ResolvedReportRenderModel,
  definition: Pick<StandardNativeCompositionDefinition, "demographicsVariant">,
  y = HEADER.contentStartYmm
): NativeFlowSectionResult {
  const isCbc = definition.demographicsVariant === "CBC";
  const first = 88;
  const second = 30;
  const third = PAGE_WIDTH - first - second;
  const displayName = isCbc ? session.demographics.fullName.toUpperCase() : session.demographics.fullName;
  const displayAddress = isCbc ? session.demographics.address.toUpperCase() : session.demographics.address;
  const topRule: NativePagePrimitive = {
    kind: "line",
    id: "demographics-top-rule",
    x1: PAGE_X,
    y1: y,
    x2: PAGE_X + PAGE_WIDTH,
    y2: y,
    color: COLOR.primary,
    widthMm: 0.22,
  };
  const row1 = demographicRow("demographics-row-1", y + INSET.demographicsTopMm, [
    { id: "demographic-name", label: "Name", value: displayName, x: PAGE_X, width: first },
    { id: "demographic-age", label: "Age", value: report.ageDisplay, x: PAGE_X + first, width: second, maxLines: 1 },
    { id: "demographic-date", label: "Date", value: session.demographics.examinationDateDisplay, x: PAGE_X + first + second, width: third, maxLines: 1 },
  ]);
  const row2 = demographicRow("demographics-row-2", row1.bottomMm, [
    { id: "demographic-address", label: "Address", value: displayAddress, x: PAGE_X, width: first + second },
    { id: "demographic-sex", label: "Sex", value: session.demographics.sex, x: PAGE_X + first + second, width: third, maxLines: 1 },
  ]);
  const statusLabel = report.status.type === "Static" ? report.status.staticLabel || "" : "";
  const row3 = demographicRow("demographics-row-3", row2.bottomMm, [
    { id: "demographic-requested-by", label: report.requestedBy.label, value: report.requestedBy.value, x: PAGE_X, width: first + second },
    ...(statusLabel ? [{ id: "demographic-status", label: statusLabel, value: "", x: PAGE_X + first + second, width: third, maxLines: 1 as const }] : []),
  ], "bottom");
  return { primitives: [topRule, ...row1.primitives, ...row2.primitives, ...row3.primitives], bottomMm: row3.bottomMm };
}

export function composeTitle(report: ResolvedReportRenderModel, y: number): NativeFlowSectionResult {
  if (!report.printedTitle) return { primitives: [], bottomMm: y };
  return {
    primitives: [text({ id: "report-title", text: report.printedTitle, x: PAGE_X, y: y + 0.7, width: PAGE_WIDTH, height: 4.8, fontRole: "display", fontSizePt: TYPE.titlePt, fontWeight: "bold", color: COLOR.primaryDark, align: "center" })],
    bottomMm: y + 5.2,
  };
}

function fixedLines(id: string, value: string, width: number, fontSizePt: number = TYPE.resultLabelPt): string[] {
  return wrapNativeTextLines({ id, text: value, font: STANDARD_FONT_ROLES.body, fontSizePt, availableWidthMm: width });
}

function normalizedDisplayText(value: string): string {
  return value.toLocaleLowerCase().replaceAll("×", "x").replace(/\s+/g, "");
}

function displayOwnsUnit(display: string | null | undefined, unit: string | null | undefined): boolean {
  if (!display?.trim() || !unit?.trim()) return false;
  return normalizedDisplayText(display).includes(normalizedDisplayText(unit));
}

function resolvedResultPresentation(result: ResolvedResultRenderModel): string {
  const unit = result.unitDisplay?.trim();
  if (!unit || displayOwnsUnit(result.formattedValue, unit) || displayOwnsUnit(result.referenceDisplay, unit)) {
    return result.formattedValue;
  }
  return result.formattedValue ? `${result.formattedValue} ${unit}` : unit;
}

function resultCellLines(result: ResolvedResultRenderModel, label: string, widths: [number, number, number]) {
  return {
    label: fixedLines(`result-${result.parameterCode}-label`, label, widths[0] - 3, TYPE.resultLabelPt),
    value: fixedLines(`result-${result.parameterCode}-value`, resolvedResultPresentation(result), widths[1] - 2, TYPE.resultValuePt),
    reference: fixedLines(`result-${result.parameterCode}-reference`, result.referenceDisplay || "", widths[2] - 3, TYPE.referencePt),
  };
}

function composeResultGrid(
  report: ResolvedReportRenderModel,
  definition: StandardNativeCompositionDefinition,
  y: number
): NativeFlowSectionResult {
  const ratios = definition.columnRatios;
  const ratioTotal = ratios.reduce((sum, ratio) => sum + ratio, 0);
  const widths = ratios.map((ratio) => PAGE_WIDTH * ratio / ratioTotal) as [number, number, number];
  const primitives: NativePagePrimitive[] = [
    { kind: "rect", id: "result-header-fill", x: PAGE_X, y, width: PAGE_WIDTH, height: 5, fill: COLOR.tealTint },
    { kind: "line", id: "result-header-rule", x1: PAGE_X, y1: y + 5, x2: PAGE_X + PAGE_WIDTH, y2: y + 5, color: COLOR.primary, widthMm: 0.2 },
  ];
  let x = PAGE_X;
  definition.resultHeaders.forEach((header, index) => {
    primitives.push(text({ id: `result-header-${index + 1}`, text: header, x, y: y + 0.45, width: widths[index], height: 4.2, fontSizePt: TYPE.resultHeaderPt, fontWeight: "bold", color: COLOR.primaryDark, align: "center" }));
    x += widths[index];
  });
  let cursorY = y + 5 + INSET.resultBodyTopMm;
  const sectionByParameter = new Map(report.resultSections.map((section) => [section.beforeParameterCode, section]));
  for (const result of report.results.filter((candidate) => candidate.omission === "Render")) {
    const section = sectionByParameter.get(result.parameterCode);
    if (section) {
      cursorY += 1.4;
      primitives.push({ kind: "rect", id: `result-section-${section.id}-accent`, x: PAGE_X, y: cursorY + 0.75, width: 0.8, height: 2.3, fill: COLOR.sectionAccent });
      primitives.push(text({ id: `result-section-${section.id}`, text: section.label, x: PAGE_X + 2, y: cursorY, width: PAGE_WIDTH - 2, height: 3.8, fontSizePt: TYPE.sectionLabelPt, fontWeight: "bold", color: COLOR.primaryDark }));
      cursorY += 3.8;
    }
    const label = definition.uppercaseParameterLabels ? result.label.toUpperCase() : result.label;
    const lines = resultCellLines(result, label, widths);
    const lineCount = Math.max(1, lines.label.length, lines.value.length, lines.reference.length);
    const height = lineCount * RESULT_LINE_MM;
    const addLines = (id: string, values: string[], cellX: number, width: number, align: NativeTextAlignment, weight: "normal" | "bold" = "normal", fontSizePt: number = TYPE.resultLabelPt, color: string = BODY) => values.forEach((value, index) => primitives.push(text({
      id: `${id}-line-${index + 1}`, text: value, x: cellX, y: cursorY + index * RESULT_LINE_MM + 0.25, width, height: RESULT_LINE_MM - 0.25, fontSizePt, fontWeight: weight, color, align,
    })));
    addLines(`result-${result.parameterCode}-label`, lines.label, PAGE_X + 1.5, widths[0] - 3, "left", "bold", TYPE.resultLabelPt);
    addLines(`result-${result.parameterCode}-value`, lines.value, PAGE_X + widths[0], widths[1], "center", "bold", TYPE.resultValuePt, COLOR.primaryDark);
    addLines(`result-${result.parameterCode}-reference`, lines.reference, PAGE_X + widths[0] + widths[1] + 1.5, widths[2] - 3, "center", "normal", TYPE.referencePt, COLOR.mutedText);
    cursorY += height;
  }
  primitives.push(line("result-grid-bottom", PAGE_X, cursorY, PAGE_X + PAGE_WIDTH, cursorY, 0.12));
  return { primitives, bottomMm: cursorY };
}

export const STANDARD_RESULT_FAMILY_COMPOSERS = {
  StandardAdaptiveTabular: composeResultGrid,
  CompactResultGrid: composeResultGrid,
} as const;

export function composeRemarks(report: ResolvedReportRenderModel, y: number): NativeFlowSectionResult {
  const labelWidth = 22;
  const lines = fixedLines("remarks-value", report.remarks, PAGE_WIDTH - labelWidth - 3, TYPE.resultLabelPt);
  const height = Math.max(5.2, Math.max(1, lines.length) * RESULT_LINE_MM + 0.7);
  const primitives: NativePagePrimitive[] = [
    line("remarks-top", PAGE_X, y, PAGE_X + PAGE_WIDTH, y, 0.12),
    text({ id: "remarks-label", text: "REMARKS", x: PAGE_X + 1.2, y: y + 0.65, width: labelWidth - 1.2, height: 3.8, fontSizePt: TYPE.sectionLabelPt, fontWeight: "bold", color: COLOR.primaryDark }),
  ];
  lines.forEach((value, index) => primitives.push(text({ id: `remarks-value-line-${index + 1}`, text: value, x: PAGE_X + labelWidth, y: y + 0.55 + index * RESULT_LINE_MM, width: PAGE_WIDTH - labelWidth - 1.2, height: RESULT_LINE_MM, fontSizePt: TYPE.resultLabelPt, color: BODY })));
  return { primitives, bottomMm: y + height };
}

export function composeKit(report: ResolvedReportRenderModel, y: number): NativeFlowSectionResult {
  const kit = report.reagentKitInfo;
  const height = 5.4;
  return {
    primitives: [
      line("kit-top", PAGE_X, y, PAGE_X + PAGE_WIDTH, y, 0.12),
      text({ id: "kit-lot-label", text: "LOT NO", x: PAGE_X + 1.2, y: y + 0.55, width: 16, height: 3.8, fontSizePt: TYPE.sectionLabelPt, fontWeight: "bold", color: COLOR.primaryDark }),
      text({ id: "kit-lot", text: kit?.lotNumber || "", x: PAGE_X + 17, y: y + 0.55, width: 72, height: 3.8, fontSizePt: TYPE.resultLabelPt, fontWeight: "bold", color: BODY }),
      text({ id: "kit-expiration-label", text: "EXPIRATION DATE", x: PAGE_X + 91, y: y + 0.55, width: 28, height: 3.8, fontSizePt: TYPE.sectionLabelPt, fontWeight: "bold", color: COLOR.primaryDark }),
      text({ id: "kit-expiration", text: kit?.expirationDate || "", x: PAGE_X + 120, y: y + 0.55, width: 58, height: 3.8, fontSizePt: TYPE.resultLabelPt, fontWeight: "bold", color: BODY }),
    ],
    bottomMm: y + height,
  };
}

function slotBySemantic(report: ResolvedReportRenderModel, semanticRole: string): ResolvedSignatorySlot | undefined {
  return report.signatories.find((slot) => slot.semanticRole === semanticRole);
}

function signatoryText(primitives: NativePagePrimitive[], id: string, value: string, x: number, y: number, width: number, bold = false): void {
  if (!value) return;
  const fitted = resolvedLines({ id, value, width, fontSizePt: bold ? TYPE.signatoryNamePt : TYPE.signatoryDetailPt, maxLines: 1, minimumFontSizePt: 6.25, weight: bold ? "bold" : "normal" });
  primitives.push(text({ id, text: fitted.lines[0], x, y, width, height: 3.5, fontSizePt: fitted.fontSizePt, fontWeight: bold ? "bold" : "normal", color: bold ? BODY : COLOR.mutedText, align: "center" }));
}

export function composeStandardSignatories(report: ResolvedReportRenderModel, y: number): NativeFlowSectionResult {
  const primitives: NativePagePrimitive[] = [];
  const slotWidth = PAGE_WIDTH / 2;
  const pathologist = slotBySemantic(report, "Pathologist");
  const medtech = slotBySemantic(report, "MedicalTechnologist");
  const nameY = y + 7.4;
  if (pathologist?.signatureAsset) primitives.push({ kind: "image", id: "pathologist-signature", source: pathologist.signatureAsset.source, x: PAGE_X + (slotWidth - 24) / 2, y, width: 24, height: 6.6, fit: "contain", failurePolicy: pathologist.signatureAsset.failurePolicy });
  const addSlot = (slot: ResolvedSignatorySlot | undefined, slotIndex: number, role: string) => {
    const x = PAGE_X + slotIndex * slotWidth;
    const key = role.toLowerCase().replaceAll(" ", "-");
    signatoryText(primitives, `${key}-name`, slot?.printedNameWithCredentials || "", x + 2, nameY, slotWidth - 4, true);
    primitives.push(line(`${key}-line`, x + 10, nameY + 3.6, x + slotWidth - 10, nameY + 3.6, 0.1));
    signatoryText(primitives, `${key}-license`, slot?.licenseDisplay || "", x + 2, nameY + 4, slotWidth - 4);
    primitives.push(text({ id: `${key}-role`, text: role.toUpperCase(), x: x + 2, y: nameY + 7.3, width: slotWidth - 4, height: 3.4, fontSizePt: TYPE.signatoryDetailPt, fontWeight: "bold", color: TEAL, align: "center" }));
    return nameY + 10.7;
  };
  const pathologistBottom = addSlot(pathologist, 0, "Pathologist");
  const medtechBottom = addSlot(medtech, 1, "Medical Technologist");
  return { primitives, bottomMm: Math.max(pathologistBottom, medtechBottom) };
}
