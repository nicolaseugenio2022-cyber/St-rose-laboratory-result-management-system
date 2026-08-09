"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const react_1 = __importDefault(require("react"));
const server_1 = require("react-dom/server");
const render_payload_1 = require("../src/rendering/engine/render-payload");
const cbc_layout_1 = require("../src/rendering/layouts/cbc.layout");
const composer_1 = require("../src/rendering/native/composer");
const cbc_definition_1 = require("../src/rendering/native/definitions/cbc.definition");
const NativeReportPreview_1 = require("../src/rendering/native/NativeReportPreview");
const PatientDemographicsBlock_1 = require("../src/rendering/components/PatientDemographicsBlock");
const report_demographic_policy_1 = require("../src/domain/report-demographic-policy");
const patient_report_session_aggregate_1 = require("../src/domain/models/patient-report-session-aggregate");
const laboratory_report_domain_1 = require("../src/domain/models/laboratory-report-domain");
const text_layout_1 = require("../src/rendering/native/text-layout");
const native_pdf_exporter_1 = require("../src/rendering/native/native-pdf-exporter");
function assert(condition, message) {
    if (!condition)
        throw new Error(`CBC native PDF validation failed: ${message}`);
}
const resultValues = {
    hemoglobin: "23",
    hematocrit: ".42",
    rbc: "4.8",
    wbc: "6.5",
    platelet: "250",
    neutrophil: ".5",
    lymphocyte: ".25",
    eosinophil: ".01",
    monocyte: ".03",
    basophil: "0",
};
const report = {
    id: "cbc-validation-report",
    sessionId: "cbc-validation-session",
    templateCode: "CBC",
    templateTitle: "CBC",
    rendererFamily: "Tabular",
    remarks: "TEST/S RECHECKED; RESULT/S VERIFIED",
    results: Object.entries(resultValues).map(([parameterCode, resultValue], index) => ({
        id: `cbc-validation-${parameterCode}`,
        reportId: "cbc-validation-report",
        parameterCode,
        parameterName: parameterCode,
        resultValue,
        evaluationOutcome: parameterCode === "hemoglobin" ? "Abnormal" : "Normal",
        displayOrder: index + 1,
    })),
    signatories: [
        {
            personnelId: "cbc-validation-pathologist",
            role: "Pathologist",
            printedFullName: "PAULO ANTONIO E. CLEMENTE",
            printedCredentials: "MD, DPSP",
            printedPrcLicenseNumber: "113927",
            signatureImageUrl: "/pathologist-signature.png",
            displayOrder: 1,
        },
        {
            personnelId: "cbc-validation-medtech",
            role: "MedicalTechnologist",
            printedFullName: "SANDRA ANNE P. GROSPE",
            printedCredentials: "RMT, MLS(ASCPi)",
            printedPrcLicenseNumber: "0124239",
            signatureImageUrl: "",
            displayOrder: 2,
        },
    ],
};
const session = {
    id: "cbc-validation-session",
    accessionNumber: "CBC-VALIDATION-001",
    status: "Draft",
    demographics: {
        fullName: "Juan dela Cruz",
        age: 21,
        ageUnit: "years",
        sex: "Male",
        address: "Sta. Rosa, Nueva Ecija",
        patientStatus: "OutPatient",
        examinationDate: "2026-08-05",
        requestingPhysician: "Dr. Ana Reyes",
    },
    reports: [report],
    createdAt: "2026-08-05T00:00:00.000Z",
};
const longDemographics = {
    fullName: "maria cristina evangelista dela cruz-santos",
    address: "123 maharlika highway, barangay san roque, santa rosa, nueva ecija",
    requestingPhysician: "Dr. Alexandrina Evangelista de la Cruz, MD, FPCP",
};
async function main() {
    const projectRoot = process.cwd();
    const outputDirectory = node_path_1.default.join(projectRoot, "output", "pdf");
    const outputPdf = node_path_1.default.join(outputDirectory, "CBC-native-pilot-validation.pdf");
    const longOutputPdf = node_path_1.default.join(outputDirectory, "CBC-native-long-demographics-validation.pdf");
    const longPreviewHtml = node_path_1.default.join(outputDirectory, "CBC-native-long-demographics-preview.html");
    const outputSummary = node_path_1.default.join(outputDirectory, "CBC-native-pilot-validation.json");
    await (0, promises_1.mkdir)(outputDirectory, { recursive: true });
    const page = (0, composer_1.composeNativeReportPage)(cbc_definition_1.cbcNativeDefinition, session, report);
    const textPrimitives = page.primitives.filter((primitive) => primitive.kind === "text");
    const visibleText = textPrimitives.map((primitive) => primitive.text);
    const shortName = textPrimitives.find((primitive) => primitive.id === "patient-name");
    const shortAddress = textPrimitives.find((primitive) => primitive.id === "patient-address");
    assert(shortName?.text === "JUAN DELA CRUZ", "CBC patient name must display in uppercase");
    assert(shortAddress?.text === "STA. ROSA, NUEVA ECIJA", "CBC patient address must display in uppercase");
    assert(session.demographics.fullName === "Juan dela Cruz", "name display formatting must not mutate session data");
    assert(session.demographics.address === "Sta. Rosa, Nueva Ecija", "address display formatting must not mutate session data");
    assert(shortName.fontSizePt === 13, "a short patient name must retain the declared 13 pt size");
    assert(shortAddress.fontSizePt === 13, "a short patient address must retain the declared 13 pt size");
    const hemoglobin = textPrimitives.find((primitive) => primitive.id === "cbc-result-rows-hemoglobin-result");
    const expectedFormattedResults = {
        hemoglobin: "23",
        hematocrit: "0.42",
        rbc: "4.8",
        wbc: "6.5",
        platelet: "250",
        neutrophil: "0.50",
        lymphocyte: "0.25",
        eosinophil: "0.01",
        monocyte: "0.03",
        basophil: "0.00",
    };
    assert(hemoglobin?.text === "23", "abnormal Hemoglobin must render only the entered value 23");
    for (const [parameterCode, expected] of Object.entries(expectedFormattedResults)) {
        const primitive = textPrimitives.find((candidate) => candidate.id === `cbc-result-rows-${parameterCode}-result`);
        assert(primitive?.text === expected, `${parameterCode} must render as ${expected}`);
        assert(primitive?.color === hemoglobin?.color, `${parameterCode} must not receive abnormal-driven color`);
        assert(primitive?.fontWeight === hemoglobin?.fontWeight, `${parameterCode} must not receive abnormal-driven weight`);
    }
    assert(!page.primitives.some((primitive) => /flag/i.test(primitive.id)), "render tree must not contain flag primitives");
    assert(!visibleText.some((text) => /\b(?:HIGH|LOW|ABNORMAL)\b/i.test(text)), "render tree must not contain abnormal words");
    assert(!visibleText.some((text) => /^(?:H|L)$/i.test(text)), "render tree must not contain standalone H/L values");
    assert(!visibleText.some((text) => /COMPLETE BLOOD COUNT/i.test(text)), "approved form must not gain a report title");
    assert(visibleText.includes("21"), "CBC age must render as the numeric value 21");
    assert(!visibleText.some((text) => /21\s+years/i.test(text)), "CBC age must not append years");
    assert(visibleText.includes("Status"), "CBC must preserve the static Status label");
    assert(!visibleText.some((text) => /^(?:OutPatient|Out-Patient|InPatient|In-Patient|ER)$/i.test(text)), "CBC must suppress dynamic patient status");
    assert(!page.primitives.some((primitive) => primitive.id === "patient-status"), "CBC must not compose a patient-status value primitive");
    assert(page.widthMm === 210 && page.heightMm === 297, "page must be A4 portrait in millimeters");
    assert(page.contentBottomMm === 153.499, "approved upper-form content boundary must remain explicit");
    const blankAgeSession = {
        ...session,
        demographics: { ...session.demographics, age: 0 },
    };
    const blankAgePage = (0, composer_1.composeNativeReportPage)(cbc_definition_1.cbcNativeDefinition, blankAgeSession, report);
    assert(!blankAgePage.primitives.some((primitive) => primitive.id === "patient-age"), "age 0 must not create a visible primitive");
    const blankPatientStatus = "";
    const cbcOnlyAggregate = new patient_report_session_aggregate_1.PatientReportSessionAggregate({
        ...session,
        id: "cbc-status-optional-session",
        demographics: { ...session.demographics, patientStatus: blankPatientStatus },
        reports: [new laboratory_report_domain_1.LaboratoryReportDomain(report)],
    });
    cbcOnlyAggregate.completeSession(() => ({
        requiredPathologistsCount: 1,
        requiredMedtechsCount: 1,
        requiresPatientStatus: false,
    }));
    assert(cbcOnlyAggregate.status === "Completed", "CBC-only completion must not require patient status");
    assert(!cbcOnlyAggregate.demographics.patientStatus, "CBC completion must not manufacture patient status");
    const mixedAggregate = new patient_report_session_aggregate_1.PatientReportSessionAggregate({
        ...session,
        id: "mixed-status-required-session",
        demographics: { ...session.demographics, patientStatus: blankPatientStatus },
        reports: [
            new laboratory_report_domain_1.LaboratoryReportDomain(report),
            new laboratory_report_domain_1.LaboratoryReportDomain({
                ...report,
                id: "non-cbc-validation-report",
                templateCode: "CHEM8",
                templateTitle: "CHEM8",
            }),
        ],
    });
    let mixedStatusRequired = false;
    try {
        mixedAggregate.completeSession((templateCode) => ({
            requiredPathologistsCount: 1,
            requiredMedtechsCount: 1,
            requiresPatientStatus: templateCode !== "CBC",
        }));
    }
    catch {
        mixedStatusRequired = true;
    }
    assert(mixedStatusRequired, "a mixed session with a non-CBC report must still require patient status");
    const previewMarkup = (0, server_1.renderToStaticMarkup)(react_1.default.createElement(NativeReportPreview_1.NativeReportPreview, { page, scale: 0.5 }));
    assert(previewMarkup.includes('data-native-primitive-id="cbc-result-rows-hemoglobin-result"'), "native Live Preview DOM must contain the Hemoglobin result primitive");
    assert(previewMarkup.includes(">23</div>"), "native Live Preview DOM must render the entered abnormal value as 23");
    assert(!/\b(?:HIGH|LOW|ABNORMAL)\b/i.test(previewMarkup), "native Live Preview DOM must suppress abnormal words");
    assert(!/data-native-primitive-id="[^"]*flag/i.test(previewMarkup), "native Live Preview DOM must not contain a flag element");
    assert(previewMarkup.includes(">0.50</div>"), "native Live Preview DOM must use formatted differential precision");
    assert(!/(?:OutPatient|Out-Patient)/i.test(previewMarkup), "native Live Preview DOM must suppress patient status");
    assert(previewMarkup.includes(">JUAN DELA CRUZ</div>"), "native Live Preview must uppercase patient name");
    assert(previewMarkup.includes(">STA. ROSA, NUEVA ECIJA</div>"), "native Live Preview must uppercase patient address");
    const experimentalPayload = (0, render_payload_1.buildReportRenderPayload)(session, report, cbc_layout_1.cbcLayout);
    assert(!experimentalPayload.demographics.some((item) => item.key === "patientStatus"), "experimental CBC preview must not create a patient-status value field");
    assert(experimentalPayload.demographics.find((item) => item.key === "age")?.value === "21", "experimental CBC preview must render age without a unit");
    assert(experimentalPayload.results.find((item) => item.key === "neutrophil-result")?.value === "0.50", "experimental CBC preview must use the CBC precision rule");
    assert(experimentalPayload.results.every((item) => !/flag/i.test(item.key)), "experimental CBC preview must not create an H/L flag field");
    const cbcPolicy = (0, report_demographic_policy_1.getReportDemographicPolicy)("CBC");
    assert(!cbcPolicy.patientStatus.visibleInEncoding, "CBC encoding must hide Patient Status");
    assert(!cbcPolicy.patientStatus.requiredForCompletion, "CBC completion must not require Patient Status");
    assert((0, report_demographic_policy_1.getReportDemographicPolicy)("CHEM8").patientStatus.requiredForCompletion, "an unconfigured non-CBC report must preserve the existing Patient Status requirement");
    const legacyMarkup = (0, server_1.renderToStaticMarkup)(react_1.default.createElement(PatientDemographicsBlock_1.PatientDemographicsBlock, {
        demographics: session.demographics,
        patientStatusOutputMode: cbcPolicy.patientStatus.outputMode,
        ageOutputMode: cbcPolicy.age.outputMode,
    }));
    assert(/>Status<\/span>/.test(legacyMarkup), "legacy CBC comparison must retain Status without a colon");
    assert(!/(?:OutPatient|Out-Patient)/i.test(legacyMarkup), "legacy CBC comparison must suppress patient status");
    assert(!/21\s+years/i.test(legacyMarkup), "legacy CBC comparison must not append the age unit");
    assert(experimentalPayload.results.every((item) => item.config.color === "#000000" && item.config.fontWeight === "normal"), "experimental CBC preview must not apply abnormal-result styling");
    const resolver = {
        async load(source) {
            const sourcePath = source.startsWith("/")
                ? node_path_1.default.join(projectRoot, "public", source.slice(1))
                : node_path_1.default.resolve(projectRoot, source);
            const bytes = new Uint8Array(await (0, promises_1.readFile)(sourcePath));
            return {
                bytes,
                format: /\.jpe?g$/i.test(sourcePath) ? "JPEG" : "PNG",
            };
        },
    };
    const longSession = {
        ...session,
        id: "cbc-long-demographics-session",
        demographics: { ...session.demographics, ...longDemographics },
    };
    const longPage = (0, composer_1.composeNativeReportPage)(cbc_definition_1.cbcNativeDefinition, longSession, report);
    const longTextPrimitives = longPage.primitives.filter((primitive) => primitive.kind === "text");
    const longFieldExpectations = [
        { id: "patient-name", expected: longDemographics.fullName.toUpperCase(), cellEndMm: 110.631 - 1.905 },
        { id: "patient-address", expected: longDemographics.address.toUpperCase(), cellEndMm: 139.33 - 1.905 },
        { id: "requesting-physician", expected: longDemographics.requestingPhysician, cellEndMm: 139.33 - 1.905 },
    ];
    const fittedDemographicEvidence = longFieldExpectations.map(({ id, expected, cellEndMm }) => {
        const primitive = longTextPrimitives.find((candidate) => candidate.id === id);
        assert(primitive, `${id} primitive is missing from long-demographics composition`);
        assert(primitive.text === expected, `${id} must preserve its complete formatted value`);
        assert(primitive.fontSizePt < 13, `${id} must shrink below 13 pt for the long fixture`);
        assert((primitive.x + (primitive.width || 0)) <= cellEndMm + 0.001, `${id} frame crosses its DOCX cell boundary`);
        const measuredWidthMm = (0, text_layout_1.measureNativeTextWidthMm)(primitive.text, longPage.fontRoles[primitive.fontRole], primitive.fontWeight, primitive.fontSizePt);
        assert(measuredWidthMm <= (primitive.width || 0), `${id} fitted text is wider than its frame`);
        return {
            id,
            text: primitive.text,
            declaredFontSizePt: 13,
            fittedFontSizePt: primitive.fontSizePt,
            frameStartMm: primitive.x,
            frameWidthMm: primitive.width,
            frameEndMm: primitive.x + (primitive.width || 0),
            cellContentEndMm: cellEndMm,
            measuredTextWidthMm: measuredWidthMm,
        };
    });
    assert(longSession.demographics.fullName === longDemographics.fullName, "long name storage must remain mixed-case");
    assert(longSession.demographics.address === longDemographics.address, "long address storage must remain mixed-case");
    const longPreviewMarkup = (0, server_1.renderToStaticMarkup)(react_1.default.createElement(NativeReportPreview_1.NativeReportPreview, { page: longPage, scale: 1 }));
    const overflowProbeIds = longFieldExpectations.map(({ id }) => id);
    const overflowProbeScript = `<script>(function(){const ids=${JSON.stringify(overflowProbeIds)};let count=0;for(const id of ids){const el=document.querySelector('[data-native-primitive-id="'+id+'"]');const overflow=!el||el.scrollWidth>el.clientWidth+1;count+=overflow?1:0;if(el)el.dataset.overflow=String(overflow);}document.body.dataset.overflowCount=String(count);})();</script>`;
    await (0, promises_1.writeFile)(longPreviewHtml, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style></head><body>${longPreviewMarkup}${overflowProbeScript}</body></html>`, "utf8");
    const pdf = await (0, native_pdf_exporter_1.createNativeReportPdf)(page, resolver);
    const longPdf = await (0, native_pdf_exporter_1.createNativeReportPdf)(longPage, resolver);
    assert(pdf.getNumberOfPages() === 1, "generated PDF must contain exactly one page");
    assert(Math.abs(pdf.internal.pageSize.getWidth() - 210) < 0.01, "PDF page width must be 210 mm");
    assert(Math.abs(pdf.internal.pageSize.getHeight() - 297) < 0.01, "PDF page height must be 297 mm");
    assert(longPdf.getNumberOfPages() === 1, "long-demographics PDF must contain exactly one page");
    const internalPages = pdf.internal.pages;
    const nativeOperators = internalPages.flat().join("\n");
    assert(nativeOperators.includes("(23) Tj"), "entered abnormal result must be emitted as a native text operator");
    assert(nativeOperators.includes("(0.50) Tj"), "formatted Neutrophil value must be emitted as native text");
    assert(nativeOperators.includes("(0.00) Tj"), "formatted Basophil value must be emitted as native text");
    assert(nativeOperators.includes("(JUAN DELA CRUZ) Tj"), "uppercase patient name must be emitted as native PDF text");
    assert(!nativeOperators.includes("(23 H)"), "PDF operators must not append H to the abnormal result");
    assert(!nativeOperators.includes("(23 L)"), "PDF operators must not append L to the abnormal result");
    assert(!nativeOperators.includes("OutPatient") && !nativeOperators.includes("Out-Patient"), "PDF operators must suppress dynamic patient status");
    const signature = page.primitives.find((primitive) => primitive.id === "pathologist-signature");
    assert(signature?.kind === "image", "pathologist signature image primitive is missing");
    const pathologistSlotCenterMm = 25.4 + 174.131 / 4;
    const signatureCenterMm = signature.x + (signature.width || 0) / 2;
    assert(Math.abs(signatureCenterMm - pathologistSlotCenterMm) < 0.001, "pathologist signature must be centered in the fixed left slot");
    assert(signature.width === 25.682 && signature.height === 13.212, "pathologist signature must retain the DOCX display size");
    assert(signature.y === 132.49, "pathologist signature must use the calibrated 132.49 mm Y position");
    const brokenSignatureReport = {
        ...report,
        signatories: report.signatories.map((signatory) => signatory.role === "Pathologist"
            ? { ...signatory, signatureImageUrl: "/missing-signature.png" }
            : signatory),
    };
    let missingSignatureRejected = false;
    try {
        await (0, native_pdf_exporter_1.createNativeReportPdf)((0, composer_1.composeNativeReportPage)(cbc_definition_1.cbcNativeDefinition, session, brokenSignatureReport), resolver);
    }
    catch {
        missingSignatureRejected = true;
    }
    assert(missingSignatureRejected, "a supplied but unavailable signature asset must fail generation");
    const pdfBytes = Buffer.from(pdf.output("arraybuffer"));
    const longPdfBytes = Buffer.from(longPdf.output("arraybuffer"));
    await (0, promises_1.writeFile)(outputPdf, pdfBytes);
    await (0, promises_1.writeFile)(longOutputPdf, longPdfBytes);
    await (0, promises_1.writeFile)(outputSummary, JSON.stringify({
        generatedAt: new Date().toISOString(),
        pdf: node_path_1.default.relative(projectRoot, outputPdf),
        longDemographicsPdf: node_path_1.default.relative(projectRoot, longOutputPdf),
        longDemographicsPreviewHtml: node_path_1.default.relative(projectRoot, longPreviewHtml),
        bytes: pdfBytes.byteLength,
        pages: pdf.getNumberOfPages(),
        pageSizeMm: { width: 210, height: 297 },
        contentBottomMm: page.contentBottomMm,
        primitiveCount: page.primitives.length,
        nativeTextChecks: ["23", "0.50", "0.25", "0.01", "0.03", "0.00", "21", "JUAN DELA CRUZ"],
        abnormalResultOutput: "23",
        forbiddenAbnormalOutputPresent: false,
        ageZeroSuppressed: true,
        ageUnitSuppressed: true,
        patientStatusSuppressed: true,
        cbcOnlyCompletionWithoutStatus: true,
        mixedSessionStatusStillRequired: true,
        patientStatusEncodingHidden: true,
        signatureSizeMm: { width: signature.width, height: signature.height },
        signaturePositionMm: { x: signature.x, y: signature.y },
        signatureCenteredInPathologistSlot: true,
        displayCasing: {
            storedName: session.demographics.fullName,
            renderedName: shortName.text,
            storedAddress: session.demographics.address,
            renderedAddress: shortAddress.text,
        },
        fittedDemographicEvidence,
        resultDisplayPrecision: expectedFormattedResults,
        previewDomChecked: true,
        missingSignatureRejected: true,
        pdfjsDistUsedForGeneration: false,
    }, null, 2));
    process.stdout.write(`${outputPdf}\n${longOutputPdf}\n${longPreviewHtml}\n${outputSummary}\n`);
}
void main();
