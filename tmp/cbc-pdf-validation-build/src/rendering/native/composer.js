"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.composeNativeReportPage = composeNativeReportPage;
const text_layout_1 = require("./text-layout");
function formatLongDateUppercase(value) {
    if (typeof value !== "string" || !value)
        return "";
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match)
        return value.toUpperCase();
    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(date.getTime()) ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day) {
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
function formatPatientStatus(value) {
    if (value === "InPatient")
        return "In-Patient";
    if (value === "OutPatient")
        return "Out-Patient";
    return typeof value === "string" ? value : "";
}
function stringify(value) {
    if (value === undefined || value === null)
        return "";
    if (typeof value === "number" && !Number.isFinite(value))
        return "";
    return String(value);
}
function formatNumericDisplay(value, precision) {
    const raw = stringify(value).trim();
    if (!raw || precision === undefined)
        return raw;
    const numericValue = Number(raw);
    return Number.isFinite(numericValue) ? numericValue.toFixed(precision) : raw;
}
function findSignatory(report, role) {
    return [...report.signatories]
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .find((candidate) => candidate.role === role);
}
function resolveBinding(binding, session, report) {
    if (binding.source === "session") {
        return stringify(session[binding.field]);
    }
    if (binding.source === "report") {
        return stringify(report[binding.field]);
    }
    if (binding.source === "result") {
        const result = report.results.find((candidate) => candidate.parameterCode.toLowerCase() === binding.parameterCode.toLowerCase());
        return stringify(result?.resultValue);
    }
    if (binding.source === "signatory") {
        const signatory = findSignatory(report, binding.role);
        if (!signatory)
            return "";
        if (binding.field === "signature-image")
            return stringify(signatory.signatureImageUrl);
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
    if (binding.formatter === "long-date-uppercase")
        return formatLongDateUppercase(value);
    if (binding.formatter === "patient-status")
        return formatPatientStatus(value);
    return stringify(value);
}
function composeText(definition, session, report, fontRoles) {
    const resolved = definition.binding
        ? resolveBinding(definition.binding, session, report)
        : definition.text || "";
    const text = definition.uppercase ? resolved.toUpperCase() : resolved;
    if (!text)
        return null;
    const { binding: _binding, fit, ...primitive } = definition;
    const fontSizePt = fit?.mode === "shrink-to-width" && definition.width
        ? (0, text_layout_1.fitNativeTextFontSizePt)({
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
function composeImage(definition, session, report) {
    const source = definition.binding
        ? resolveBinding(definition.binding, session, report)
        : definition.source || "";
    if (!source)
        return null;
    const { binding: _binding, ...primitive } = definition;
    return { ...primitive, source, fit: definition.fit || "contain" };
}
function expandTable(element) {
    const primitives = [];
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
function expandResultRows(element, session, report) {
    const [labelWidth, resultWidth] = element.columns;
    const primitives = [];
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
            const rawText = resolveBinding({ source: "result", parameterCode: row.parameterCode, field: "resultValue" }, session, report);
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
function composeNativeReportPage(definition, session, report) {
    const primitives = [];
    for (const element of definition.elements) {
        if (element.kind === "text") {
            const text = composeText(element, session, report, definition.fontRoles);
            if (text)
                primitives.push(text);
            continue;
        }
        if (element.kind === "image") {
            const image = composeImage(element, session, report);
            if (image)
                primitives.push(image);
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
        contentBottomMm: definition.page.contentBottomMm,
        fontRoles: definition.fontRoles,
        primitives,
    };
}
