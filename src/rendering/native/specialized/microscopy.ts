import type { IRepeatableFindingValue } from "@/domain/models/interfaces";
import type { ResolvedReportRenderModel, ResolvedResultRenderModel } from "@/rendering/model";
import type { NativePagePrimitive } from "../types";
import { NATIVE_REPORT_THEME } from "../theme";
import { STANDARD_PAGE, type NativeFlowSectionResult } from "../standard/types";
import {
  SPECIALIZED_LINE_HEIGHT_MM,
  addSpecializedLines,
  specializedLine,
  specializedText,
  wrapSpecializedText,
} from "./common";
import type { MicroscopyNativeCompositionDefinition, MicroscopySectionDefinition } from "./types";

const COLUMN_GAP_MM = 4;
const COLUMN_WIDTH_MM = (STANDARD_PAGE.contentWidthMm - COLUMN_GAP_MM) / 2;
const LABEL_WIDTH_MM = 47;
const { colors: COLOR, typography: TYPE, sectionInsets: INSET } = NATIVE_REPORT_THEME;

function conditionalDisplay(result: ResolvedResultRenderModel): { label: string; value: string } {
  const label = result.conditionalLabel;
  if (!label) return { label: result.label, value: result.formattedValue };
  const prefix = `${label}:`;
  return {
    label,
    value: result.formattedValue.startsWith(prefix)
      ? result.formattedValue.slice(prefix.length).trimStart()
      : result.formattedValue,
  };
}

function composeMicroscopyResultRow(
  result: ResolvedResultRenderModel,
  x: number,
  y: number,
  sectionId: string,
  isConditional: boolean
): NativeFlowSectionResult {
  const display = isConditional ? conditionalDisplay(result) : { label: result.label, value: result.formattedValue };
  const labelLines = wrapSpecializedText(`microscopy-${sectionId}-${result.parameterCode}-label`, display.label, LABEL_WIDTH_MM - 2, TYPE.resultLabelPt);
  const valueLines = wrapSpecializedText(`microscopy-${sectionId}-${result.parameterCode}-value`, display.value, COLUMN_WIDTH_MM - LABEL_WIDTH_MM - 2, TYPE.resultValuePt);
  const lineCount = Math.max(1, labelLines.length, valueLines.length);
  const height = lineCount * SPECIALIZED_LINE_HEIGHT_MM;
  const primitives: NativePagePrimitive[] = [];
  addSpecializedLines({ primitives, id: `microscopy-${sectionId}-${result.parameterCode}-label`, lines: labelLines, x: x + 1, y: y + 0.2, width: LABEL_WIDTH_MM - 2, fontSizePt: TYPE.resultLabelPt, color: COLOR.text });
  addSpecializedLines({ primitives, id: `microscopy-${sectionId}-${result.parameterCode}-value`, lines: valueLines, x: x + LABEL_WIDTH_MM, y: y + 0.15, width: COLUMN_WIDTH_MM - LABEL_WIDTH_MM - 1, fontSizePt: TYPE.resultValuePt, weight: "bold", align: "center", color: COLOR.primaryDark });
  return { primitives, bottomMm: y + height };
}

function composeFindingRow(
  finding: IRepeatableFindingValue,
  x: number,
  y: number
): NativeFlowSectionResult {
  const lines = wrapSpecializedText(`microscopy-finding-${finding.id}`, finding.value, COLUMN_WIDTH_MM - 2, TYPE.resultLabelPt);
  const height = Math.max(1, lines.length) * SPECIALIZED_LINE_HEIGHT_MM;
  const primitives: NativePagePrimitive[] = [];
  addSpecializedLines({ primitives, id: `microscopy-finding-${finding.id}`, lines, x: x + 1, y: y + 0.2, width: COLUMN_WIDTH_MM - 2, fontSizePt: TYPE.resultLabelPt, color: COLOR.text });
  return { primitives, bottomMm: y + height };
}

function composeColumn(
  section: MicroscopySectionDefinition,
  report: ResolvedReportRenderModel,
  definition: MicroscopyNativeCompositionDefinition,
  x: number,
  y: number,
  includeFindings: boolean
): NativeFlowSectionResult {
  const primitives: NativePagePrimitive[] = [
    { kind: "rect", id: `microscopy-${section.id}-header-fill`, x, y, width: COLUMN_WIDTH_MM, height: 4.6, fill: COLOR.tealTint },
    specializedText({ id: `microscopy-${section.id}-header`, text: section.label, x, y: y + 0.35, width: COLUMN_WIDTH_MM, height: 4.1, fontSizePt: TYPE.resultHeaderPt, fontWeight: "bold", color: COLOR.primaryDark, align: "center" }),
    { kind: "line", id: `microscopy-${section.id}-header-rule`, x1: x, y1: y + 4.6, x2: x + COLUMN_WIDTH_MM, y2: y + 4.6, color: COLOR.primary, widthMm: 0.22 },
  ];
  let cursorY = y + 4.6 + INSET.resultBodyTopMm;
  const results = new Map(report.results.map((result) => [result.parameterCode, result]));
  for (const parameterCode of section.parameterCodes) {
    const result = results.get(parameterCode);
    if (!result || result.omission === "Omit") continue;
    const row = composeMicroscopyResultRow(
      result,
      x,
      cursorY,
      section.id,
      definition.conditionalParameterCodes.includes(parameterCode)
    );
    primitives.push(...row.primitives);
    cursorY = row.bottomMm;
  }
  if (includeFindings) {
    for (const category of definition.repeatableFindingCategories) {
      const findings = (report.repeatableFindings[category] || []).filter((finding) => finding.value.trim());
      if (findings.length === 0) continue;
      cursorY += 1;
      primitives.push({ kind: "rect", id: `microscopy-findings-${category}-accent`, x, y: cursorY + 0.7, width: 0.8, height: 2.2, fill: COLOR.sectionAccent });
      primitives.push(specializedText({ id: `microscopy-findings-${category}-heading`, text: category, x: x + 1.8, y: cursorY, width: COLUMN_WIDTH_MM - 1.8, height: 3.8, fontSizePt: TYPE.sectionLabelPt, fontWeight: "bold", color: COLOR.primaryDark }));
      cursorY += 3.8;
      for (const finding of findings) {
        const row = composeFindingRow(finding, x, cursorY);
        primitives.push(...row.primitives);
        cursorY = row.bottomMm;
      }
    }
  }
  primitives.push(specializedLine(`microscopy-${section.id}-bottom`, x, cursorY, x + COLUMN_WIDTH_MM, cursorY, 0.12));
  return { primitives, bottomMm: cursorY };
}

export function composeMicroscopySpecializedBody(
  definition: MicroscopyNativeCompositionDefinition,
  report: ResolvedReportRenderModel,
  y: number
): NativeFlowSectionResult {
  if (definition.sections.length !== 2) {
    throw new Error(`MicroscopyTwoColumn composition requires exactly two declarative sections for '${report.templateCode}'.`);
  }
  const left = composeColumn(definition.sections[0], report, definition, STANDARD_PAGE.marginMm, y, false);
  const right = composeColumn(
    definition.sections[1],
    report,
    definition,
    STANDARD_PAGE.marginMm + COLUMN_WIDTH_MM + COLUMN_GAP_MM,
    y,
    true
  );
  return { primitives: [...left.primitives, ...right.primitives], bottomMm: Math.max(left.bottomMm, right.bottomMm) };
}
