import type { ILaboratoryReport, IPatientReportSession } from "@/domain/models/interfaces";
import type { SignatorySnapshot } from "@/domain/types";
import type {
  NativeComposedPage,
  NativeAdaptiveRowsDefinition,
  NativeDefinitionElement,
  NativeImageDefinition,
  NativePagePrimitive,
  NativeReportDefinition,
  NativeTextBinding,
  NativeTextDefinition,
  NativeTextPrimitive,
} from "./types";
import { fitNativeTextFontSizePt, fitNativeTextLines } from "./text-layout";

function formatLongDateUppercase(value: unknown): string {
  if (typeof value !== "string" || !value) return "";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value.toUpperCase();

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return value.toUpperCase();
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .toUpperCase();
}

function formatPatientStatus(value: unknown): string {
  if (value === "InPatient") return "In-Patient";
  if (value === "OutPatient") return "Out-Patient";
  return typeof value === "string" ? value : "";
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number" && !Number.isFinite(value)) return "";
  return String(value);
}

function formatNumericDisplay(value: unknown, precision: number | undefined): string {
  const raw = stringify(value).trim();
  if (!raw || precision === undefined) return raw;

  const numericValue = Number(raw);
  return Number.isFinite(numericValue) ? numericValue.toFixed(precision) : raw;
}

function findSignatory(report: ILaboratoryReport, role: SignatorySnapshot["role"]): SignatorySnapshot | undefined {
  return [...report.signatories]
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .find((candidate) => candidate.role === role);
}

function resolveBinding(
  binding: NativeTextBinding,
  session: IPatientReportSession,
  report: ILaboratoryReport
): string {
  if (binding.source === "session") {
    return stringify(session[binding.field]);
  }

  if (binding.source === "report") {
    return stringify(report[binding.field]);
  }

  if (binding.source === "result") {
    const result = report.results.find(
      (candidate) => candidate.parameterCode.toLowerCase() === binding.parameterCode.toLowerCase()
    );
    return stringify(result?.resultValue);
  }

  if (binding.source === "signatory") {
    const signatory = findSignatory(report, binding.role);
    if (!signatory) return "";
    if (binding.field === "signature-image") return stringify(signatory.signatureImageUrl);
    if (binding.field === "license-number") {
      return signatory.printedPrcLicenseNumber
        ? `License no. ${signatory.printedPrcLicenseNumber}`
        : "";
    }
    return [signatory.printedFullName, signatory.printedCredentials]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ");
  }

  const value = session.demographics[binding.field];
  if (binding.formatter === "positive-number") {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? String(value) : "";
  }
  if (binding.formatter === "age-with-unit") {
    return typeof value === "number" && Number.isFinite(value) && value > 0
      ? `${value} ${session.demographics.ageUnit || ""}`.trim()
      : "";
  }
  if (binding.formatter === "long-date-uppercase") return formatLongDateUppercase(value);
  if (binding.formatter === "patient-status") return formatPatientStatus(value);
  return stringify(value);
}

function composeText(
  definition: NativeTextDefinition,
  session: IPatientReportSession,
  report: ILaboratoryReport,
  fontRoles: NativeReportDefinition["fontRoles"]
): NativeTextPrimitive | null {
  const resolved = definition.binding
    ? resolveBinding(definition.binding, session, report)
    : definition.text || "";
  const text = definition.uppercase ? resolved.toUpperCase() : resolved;
  if (!text) return null;

  const { binding: _binding, fit, ...primitive } = definition;
  const fontSizePt = fit?.mode === "shrink-to-width" && definition.width
    ? fitNativeTextFontSizePt({
        text,
        font: fontRoles[definition.fontRole],
        weight: definition.fontWeight,
        declaredFontSizePt: definition.fontSizePt,
        availableWidthMm: definition.width,
        guardMm: fit.guardMm,
      })
    : definition.fontSizePt;
  return { ...primitive, fontSizePt, text };
}

function composeImage(
  definition: NativeImageDefinition,
  session: IPatientReportSession,
  report: ILaboratoryReport
): NativePagePrimitive | null {
  const source = definition.binding
    ? resolveBinding(definition.binding, session, report)
    : definition.source || "";
  if (!source) return null;
  const { binding: _binding, ...primitive } = definition;
  return { ...primitive, source, fit: definition.fit || "contain" };
}

function expandTable(element: Extract<NativeDefinitionElement, { kind: "table" }>): NativePagePrimitive[] {
  const primitives: NativePagePrimitive[] = [];
  const borderColor = element.borderColor || "#000000";
  const borderWidthMm = element.borderWidthMm ?? 0.15;
  let rowY = element.y;

  element.rows.forEach((row, rowIndex) => {
    if (row.fill) {
      primitives.push({
        kind: "rect",
        id: `${element.id}-row-${rowIndex}-fill`,
        x: element.x,
        y: rowY,
        width: element.width,
        height: row.height,
        fill: row.fill,
      });
    }
    if (row.topBorder) {
      primitives.push({
        kind: "line",
        id: `${element.id}-row-${rowIndex}-top`,
        x1: element.x,
        y1: rowY,
        x2: element.x + element.width,
        y2: rowY,
        color: borderColor,
        widthMm: row.topBorderWidthMm ?? borderWidthMm,
      });
    }
    rowY += row.height;
    if (row.bottomBorder) {
      primitives.push({
        kind: "line",
        id: `${element.id}-row-${rowIndex}-bottom`,
        x1: element.x,
        y1: rowY,
        x2: element.x + element.width,
        y2: rowY,
        color: borderColor,
        widthMm: row.bottomBorderWidthMm ?? borderWidthMm,
      });
    }
  });

  if (element.drawOuterBorder) {
    primitives.push({
      kind: "rect",
      id: `${element.id}-outer-border`,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.rows.reduce((sum, row) => sum + row.height, 0),
      stroke: borderColor,
      strokeWidthMm: borderWidthMm,
    });
  }

  if (element.drawVerticalBorders) {
    let columnX = element.x;
    const tableHeight = element.rows.reduce((sum, row) => sum + row.height, 0);
    element.columns.slice(0, -1).forEach((columnWidth, columnIndex) => {
      columnX += columnWidth;
      primitives.push({
        kind: "line",
        id: `${element.id}-column-${columnIndex}`,
        x1: columnX,
        y1: element.y,
        x2: columnX,
        y2: element.y + tableHeight,
        color: borderColor,
        widthMm: borderWidthMm,
      });
    });
  }

  return primitives;
}

function expandResultRows(
  element: Extract<NativeDefinitionElement, { kind: "result-rows" }>,
  session: IPatientReportSession,
  report: ILaboratoryReport
): NativePagePrimitive[] {
  const [labelWidth, resultWidth] = element.columns;
  const primitives: NativePagePrimitive[] = [];

  for (const row of element.rows) {
    if (row.label) {
      primitives.push({
        kind: "text",
        id: `${element.id}-${row.id}-label`,
        text: row.label,
        x: element.x + element.cellPaddingMm + (row.labelIndentMm || 0),
        y: row.y,
        width: labelWidth - element.cellPaddingMm * 2,
        height: row.height,
        ...element.labelStyle,
      });
    }

    if (row.parameterCode) {
      const rawText = resolveBinding(
        { source: "result", parameterCode: row.parameterCode, field: "resultValue" },
        session,
        report
      );
      const text = formatNumericDisplay(rawText, row.displayPrecision);
      if (text) {
        primitives.push({
          kind: "text",
          id: `${element.id}-${row.id}-result`,
          text,
          x: element.x + labelWidth,
          y: row.y,
          width: resultWidth,
          height: row.height,
          ...element.resultStyle,
        });
      }
    }

    row.reference?.forEach((reference, lineIndex) => {
      primitives.push({
        kind: "text",
        id: `${element.id}-${row.id}-reference-${lineIndex}`,
        text: reference,
        x: element.x + labelWidth + resultWidth + element.cellPaddingMm,
        y: row.y + lineIndex * (element.referenceStyle.lineHeightMm || 3.15),
        width: element.columns[2] - element.cellPaddingMm * 2,
        height: row.height,
        ...element.referenceStyle,
      });
    });
  }

  return primitives;
}

function expandAdaptiveRows(
  element: NativeAdaptiveRowsDefinition,
  session: IPatientReportSession,
  report: ILaboratoryReport,
  fontRoles: NativeReportDefinition["fontRoles"]
): { primitives: NativePagePrimitive[]; heightDeltaMm: number } {
  const primitives: NativePagePrimitive[] = [];
  let rowY = element.y;
  let baseHeightMm = 0;

  for (const row of element.rows) {
    baseHeightMm += row.baseHeightMm;
    const fields = row.fields.map((field) => {
      const resolved = field.binding ? resolveBinding(field.binding, session, report) : field.text || "";
      const text = field.uppercase ? resolved.toUpperCase() : resolved;
      if (!text) return { field, lines: [] as string[], fontSizePt: field.fontSizePt };
      if (!field.fit) return { field, lines: [text], fontSizePt: field.fontSizePt };
      const fitted = fitNativeTextLines({
        id: field.id,
        text,
        font: fontRoles[field.fontRole],
        weight: field.fontWeight,
        declaredFontSizePt: field.fontSizePt,
        availableWidthMm: field.width,
        ...field.fit,
      });
      return { field, ...fitted };
    });
    const lineCount = Math.max(1, ...fields.map((field) => field.lines.length));
    const rowHeightMm = lineCount * row.baseHeightMm;

    if (row.fill) {
      primitives.push({
        kind: "rect",
        id: `${element.id}-${row.id}-fill`,
        x: element.x,
        y: rowY,
        width: element.width,
        height: rowHeightMm,
        fill: row.fill,
      });
    }

    for (const { field, lines, fontSizePt } of fields) {
      const { id: _id, x: _x, width: _width, binding: _binding, fit: _fit, ...style } = field;
      lines.forEach((text, lineIndex) => {
        primitives.push({
          kind: "text",
          id: lineIndex === 0 ? field.id : `${field.id}-line-${lineIndex + 1}`,
          text,
          x: field.x,
          y: rowY + lineIndex * row.baseHeightMm,
          width: field.width,
          height: row.baseHeightMm,
          ...style,
          fontSizePt,
        });
      });
    }

    row.verticalSeparatorsX?.forEach((x, index) => {
      primitives.push({
        kind: "line",
        id: `${element.id}-${row.id}-vertical-${index}`,
        x1: x,
        y1: rowY,
        x2: x,
        y2: rowY + rowHeightMm,
        color: row.bottomSeparator?.color || "#000000",
        widthMm: row.bottomSeparator?.widthMm ?? 0.088,
      });
    });
    rowY += rowHeightMm;
    if (row.bottomSeparator) {
      primitives.push({
        kind: "line",
        id: `${element.id}-${row.id}-bottom`,
        x1: element.x,
        y1: rowY,
        x2: element.x + element.width,
        y2: rowY,
        color: row.bottomSeparator.color,
        widthMm: row.bottomSeparator.widthMm,
      });
    }
  }

  return { primitives, heightDeltaMm: rowY - element.y - baseHeightMm };
}

function offsetElement(element: NativeDefinitionElement, offsetMm: number): NativeDefinitionElement {
  if (!offsetMm) return element;
  if (element.kind === "line") {
    return { ...element, y1: element.y1 + offsetMm, y2: element.y2 + offsetMm };
  }
  if (element.kind === "result-rows") {
    return { ...element, rows: element.rows.map((row) => ({ ...row, y: row.y + offsetMm })) };
  }
  return { ...element, y: element.y + offsetMm };
}

export function composeNativeReportPage(
  definition: NativeReportDefinition,
  session: IPatientReportSession,
  report: ILaboratoryReport
): NativeComposedPage {
  const primitives: NativePagePrimitive[] = [];
  let flowOffsetMm = 0;

  for (const sourceElement of definition.elements) {
    const element = offsetElement(sourceElement, flowOffsetMm);
    if (element.kind === "adaptive-rows") {
      const resolved = expandAdaptiveRows(element, session, report, definition.fontRoles);
      primitives.push(...resolved.primitives);
      if (element.propagateHeightToFollowing) flowOffsetMm += resolved.heightDeltaMm;
      continue;
    }
    if (element.kind === "text") {
      const text = composeText(element, session, report, definition.fontRoles);
      if (text) primitives.push(text);
      continue;
    }
    if (element.kind === "image") {
      const image = composeImage(element, session, report);
      if (image) primitives.push(image);
      continue;
    }
    if (element.kind === "rich-text") {
      primitives.push(element);
      continue;
    }
    if (element.kind === "table") {
      primitives.push(...expandTable(element));
      continue;
    }
    if (element.kind === "result-rows") {
      primitives.push(...expandResultRows(element, session, report));
      continue;
    }
    primitives.push(element);
  }

  return {
    templateCode: definition.templateCode,
    widthMm: definition.page.widthMm,
    heightMm: definition.page.heightMm,
    contentBottomMm: definition.page.contentBottomMm + flowOffsetMm,
    fontRoles: definition.fontRoles,
    primitives,
  };
}
