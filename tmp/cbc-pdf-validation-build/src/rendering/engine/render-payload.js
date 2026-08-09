"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReportRenderPayload = buildReportRenderPayload;
const report_demographic_policy_1 = require("../../domain/report-demographic-policy");
function formatDate(value) {
    if (!value)
        return "";
    const parts = value.split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
        return value.toUpperCase();
    }
    const [year, month, day] = parts;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(date.getTime()))
        return value.toUpperCase();
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
    return value || "";
}
function applyTextTransform(value, config) {
    const transformed = config.textTransform === "uppercase" ? value.toUpperCase() : value;
    return config.maxChars && transformed.length > config.maxChars
        ? `${transformed.substring(0, config.maxChars)}...`
        : transformed;
}
function buildDemographics(session, report, layout) {
    const demographics = session.demographics;
    const hasAge = typeof demographics.age === "number" && demographics.age > 0;
    const demographicPolicy = (0, report_demographic_policy_1.getReportDemographicPolicy)(report.templateCode);
    const age = hasAge
        ? demographicPolicy.age.outputMode === "number-only"
            ? String(demographics.age)
            : `${demographics.age} ${demographics.ageUnit || ""}`.trim()
        : "";
    const values = {
        patientName: demographics.fullName || "",
        age,
        ageSex: hasAge && demographics.sex
            ? `${demographics.age} / ${demographics.sex}`
            : hasAge
                ? String(demographics.age)
                : demographics.sex || "",
        sex: demographics.sex || "",
        gender: demographics.sex || "",
        dateOfExam: formatDate(demographics.examinationDate),
        accessionNo: session.accessionNumber || "",
        address: demographics.address || "",
        requestingPhysician: demographics.requestingPhysician || "",
        patientStatus: formatPatientStatus(demographics.patientStatus),
    };
    return Object.entries(layout.fields).map(([key, config]) => ({
        key,
        value: applyTextTransform(values[key] || String(report[key] || ""), config),
        config,
    }));
}
function normalizeResults(results) {
    const resultMap = new Map();
    for (const result of results) {
        resultMap.set(result.parameterCode.toLowerCase(), result);
    }
    return resultMap;
}
function buildResults(report, layout) {
    const resultMap = normalizeResults(report.results || []);
    const fields = [];
    const defaultFontSize = layout.results.defaultFontSize || 3.2;
    for (const row of layout.results.rows) {
        const result = resultMap.get(row.testKey.toLowerCase());
        if (!result)
            continue;
        for (const [columnKey, column] of Object.entries(layout.results.columns)) {
            let value = "";
            if (columnKey === "result" || columnKey === "value") {
                value = result.resultValue || "";
                if (value && row.displayPrecision !== undefined) {
                    const numericValue = Number(value);
                    if (Number.isFinite(numericValue))
                        value = numericValue.toFixed(row.displayPrecision);
                }
            }
            if (columnKey === "unit")
                value = result.unit || "";
            if (!value)
                continue;
            fields.push({
                key: `${row.testKey}-${columnKey}`,
                value,
                config: {
                    x: column.x,
                    y: row.y,
                    width: column.width,
                    align: column.align || "left",
                    fontSize: defaultFontSize,
                    fontWeight: "normal",
                    color: "#000000",
                },
            });
        }
    }
    return fields;
}
function buildRemarks(report, layout) {
    if (!layout.remarks || !report.remarks)
        return [];
    return [{
            key: "remarks",
            value: applyTextTransform(report.remarks, layout.remarks),
            config: layout.remarks,
        }];
}
function formatSignatoryName(snapshot) {
    if (!snapshot.printedCredentials)
        return snapshot.printedFullName;
    return `${snapshot.printedFullName}, ${snapshot.printedCredentials}`;
}
function buildSignatures(report, layout) {
    const roleConfigs = [
        { role: "Pathologist", key: "pathologist", config: layout.signatories.pathologist },
        { role: "MedicalTechnologist", key: "medical-technologist", config: layout.signatories.medicalTechnologist },
    ];
    return roleConfigs.flatMap(({ role, key, config }) => {
        const snapshot = report.signatories.find((candidate) => candidate.role === role);
        if (!snapshot)
            return [];
        return [{
                key,
                snapshot,
                name: {
                    key: `${key}-name`,
                    value: formatSignatoryName(snapshot),
                    config: config.name,
                },
                title: config.title
                    ? { key: `${key}-title`, value: role === "Pathologist" ? "Pathologist" : "Medical Technologist", config: config.title }
                    : undefined,
                licenseNo: {
                    key: `${key}-license`,
                    value: snapshot.printedPrcLicenseNumber ? `License no. ${snapshot.printedPrcLicenseNumber}` : "",
                    config: config.licenseNo,
                },
                imageUrl: snapshot.signatureImageUrl || undefined,
                imageConfig: config.signatureImage,
            }];
    });
}
function buildReportRenderPayload(session, report, layout) {
    return {
        demographics: buildDemographics(session, report, layout),
        results: buildResults(report, layout),
        remarks: buildRemarks(report, layout),
        signatures: buildSignatures(report, layout),
    };
}
