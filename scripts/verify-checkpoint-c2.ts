import { readFile, readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import type { CompletedSessionSnapshot } from "../src/domain/completion/completed-snapshot";
import type { ILaboratoryReport, IPatientReportSession } from "../src/domain/models/interfaces";
import type { RendererFamily, SignatorySnapshot } from "../src/domain/types";
import type { ClinicalReportDefinition, ParameterSpec } from "../src/domain/types/report-definition";
import { resolveCompletedSessionRenderModel, resolveDraftSessionRenderModel, resolveSessionRenderModel, type RenderDefinitionSource, type ResolvedReportRenderModel, type ResolvedSessionRenderModel } from "../src/rendering/model";
import { createNativeReportPdf, type NativePdfAssetResolver } from "../src/rendering/native/native-pdf-exporter";
import { NATIVE_REPORT_THEME } from "../src/rendering/native/theme";
import type { NativeComposedPage, NativePagePrimitive, NativeTextPrimitive } from "../src/rendering/native/types";
import {
  NativeCompositionOverflowError,
  STANDARD_PAGE,
  composeStandardNativeReportPage,
  createStandardNativeCompositionDefinition,
  getAllStandardNativeCompositionDefinitions,
  getStandardNativeCompositionDefinition,
} from "../src/rendering/native/standard";

const readFileAsync = promisify(readFile);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`C2 verification failed: ${message}`);
}

function rendererFamily(definition: ClinicalReportDefinition): RendererFamily {
  return definition.rendererFamily === "Dedicated Certificate"
    ? "NarrativeCertificate"
    : definition.rendererFamily as RendererFamily;
}

function inputValue(parameter: ParameterSpec): string {
  if (parameter.parameterCode === "CHOLESTEROL") return "250";
  if (parameter.parameterCode === "TRIGLYCERIDES") return "700";
  if (parameter.inputType === "Computed") return "";
  if (parameter.inputType === "NumericText") return "100";
  return parameter.defaultValue ?? parameter.options?.[0] ?? "EXACT VALUE";
}

function pathologist(signatureImageUrl: string | null = null): SignatorySnapshot {
  return {
    personnelId: "pathologist",
    role: "Pathologist",
    printedFullName: "DR. PATHOLOGIST",
    printedCredentials: "MD, FPSP",
    printedPrcLicenseNumber: "P-100",
    signatureImageUrl,
    displayOrder: 1,
  };
}

function medtech(): SignatorySnapshot {
  return {
    personnelId: "medtech",
    role: "MedicalTechnologist",
    printedFullName: "MEDICAL TECHNOLOGIST",
    printedCredentials: "RMT",
    printedPrcLicenseNumber: "M-200",
    signatureImageUrl: null,
    displayOrder: 2,
  };
}

function reportFor(definition: ClinicalReportDefinition, signatureImageUrl: string | null = null): ILaboratoryReport {
  return {
    id: `report-${definition.templateCode}`,
    sessionId: "session-c2",
    templateCode: definition.templateCode,
    templateTitle: definition.templateTitle,
    rendererFamily: rendererFamily(definition),
    remarks: "EXACT REMARKS",
    reagentKitInfo: definition.requiresKitInfo
      ? { kitBrand: "EXACT KIT", lotNumber: "LOT-C2", expirationDate: "2028-12-31" }
      : null,
    encodingData: { requestedBy: `REQUESTED ${definition.templateCode}`, additionalFields: {}, repeatableFindings: {} },
    results: definition.parameters.map((parameter) => ({
      id: `${definition.templateCode}-${parameter.parameterCode}`,
      reportId: `report-${definition.templateCode}`,
      parameterCode: parameter.parameterCode,
      parameterName: parameter.parameterName,
      resultValue: inputValue(parameter),
      evaluationOutcome: "NoEvaluation",
      displayOrder: parameter.displayOrder,
    })),
    signatories: [pathologist(signatureImageUrl), medtech()],
  };
}

function sessionFor(reports: ILaboratoryReport[]): IPatientReportSession {
  return {
    id: "session-c2",
    accessionNumber: "ACC-C2",
    status: "Draft",
    demographics: {
      fullName: "Mixed Case Patient",
      age: 21,
      ageUnit: "years",
      sex: "Female",
      address: "Mixed Case Address",
      patientStatus: "OutPatient",
      examinationDate: "2026-08-10",
      requestingPhysician: "",
      referrerName: "",
      companyName: "",
    },
    reports,
    createdAt: "2026-08-10T00:00:00.000Z",
    completedAt: null,
  };
}

function composeAll(session: ResolvedSessionRenderModel): Map<string, NativeComposedPage> {
  return new Map(session.reports.map((report) => {
    // Resolve at the report's own contract version, exactly as the application composer does,
    // so a completed report composes with the layout it was issued under.
    const definition = getStandardNativeCompositionDefinition(report.templateCode, report.renderContractVersion);
    assert(definition, `${report.templateCode} must have a C2 definition`);
    return [report.templateCode, composeStandardNativeReportPage(definition, session, report)];
  }));
}

function primitiveText(page: NativeComposedPage): string {
  return page.primitives.filter((primitive) => primitive.kind === "text").map((primitive) => primitive.text).join("\n");
}

function textByIdPrefix(page: NativeComposedPage, prefix: string): string {
  return page.primitives
    .filter((primitive): primitive is NativeTextPrimitive => primitive.kind === "text" && primitive.id.startsWith(prefix))
    .map((primitive) => primitive.text)
    .join(" ");
}

function normalizedDisplayText(value: string): string {
  return value.toLocaleLowerCase().replaceAll("×", "x").replace(/\s+/g, "");
}

function displayOwnsUnit(display: string, unit: string): boolean {
  return normalizedDisplayText(display).includes(normalizedDisplayText(unit));
}

function primitiveBottom(primitive: NativePagePrimitive): number {
  if (primitive.kind === "line") return Math.max(primitive.y1, primitive.y2);
  return primitive.y + (primitive.height || 0);
}

function mutableClone<T>(value: T): T {
  return structuredClone(value);
}

function expectOverflow(
  session: ResolvedSessionRenderModel,
  report: ResolvedReportRenderModel,
  reason: string
): void {
  const definition = getStandardNativeCompositionDefinition(report.templateCode, report.renderContractVersion)!;
  let error: unknown;
  try { composeStandardNativeReportPage(definition, session, report); } catch (caught) { error = caught; }
  assert(error instanceof NativeCompositionOverflowError, `${reason} must produce NativeCompositionOverflowError`);
  assert(error.templateCode === report.templateCode && error.permittedBottomMm === 148.5, `${reason} overflow must identify report and boundary`);
}

async function main(): Promise<void> {
  const standardDefinitions = getAllStandardNativeCompositionDefinitions();
  assert(standardDefinitions.length === 15, "exactly 15 standard definitions must be available");
  assert(standardDefinitions.filter((definition) => definition.layoutFamily === "StandardAdaptiveTabular").length === 6, "six tabular definitions must share one family");
  assert(standardDefinitions.filter((definition) => definition.layoutFamily === "CompactResultGrid").length === 9, "nine compact definitions must share one family");

  const clinicalDefinitions = standardDefinitions.map((entry) => ReportDefinitionRegistry.getDefinition(entry.templateCode)!);
  const reports = clinicalDefinitions.map((definition) => reportFor(definition, "/missing-signature.png"));
  const resolved = resolveDraftSessionRenderModel(sessionFor(reports));
  const pages = composeAll(resolved);
  assert(pages.size === 15, "all C2 reports compose without active routing registration");

  for (const report of resolved.reports) {
    const page = pages.get(report.templateCode)!;
    const output = primitiveText(page);
    assert(page.widthMm === 210 && page.heightMm === 297, `${report.templateCode} must be one A4 page`);
    assert(page.contentBottomMm <= 148.5 && page.primitives.every((primitive) => primitiveBottom(primitive) <= 148.5001), `${report.templateCode} must remain in the upper half`);
    assert(!/page\s*\d+/i.test(output), `${report.templateCode} must not contain a page number`);
    assert(report.printedTitle ? output.includes(report.printedTitle) : !page.primitives.some((primitive) => primitive.id === "report-title"), `${report.templateCode} title ownership must remain exact`);
    assert(output.includes(report.remarks), `${report.templateCode} remarks must survive exactly`);
    assert(output.includes("DR. PATHOLOGIST, MD, FPSP") && output.includes("MEDICAL TECHNOLOGIST, RMT"), `${report.templateCode} signatory identities must survive`);
    for (const result of report.results.filter((candidate) => candidate.omission === "Render")) {
      if (result.formattedValue) assert(textByIdPrefix(page, `result-${result.parameterCode}-value`) === result.formattedValue, `${report.templateCode}/${result.parameterCode} formatted value must survive`);
      if (result.referenceDisplay) assert(textByIdPrefix(page, `result-${result.parameterCode}-reference`) === result.referenceDisplay, `${report.templateCode}/${result.parameterCode} reference must survive`);
      if (result.unitDisplay) {
        const renderedValue = textByIdPrefix(page, `result-${result.parameterCode}-value`);
        const renderedReference = textByIdPrefix(page, `result-${result.parameterCode}-reference`);
        assert(!page.primitives.some((primitive) => primitive.id.startsWith(`result-${result.parameterCode}-unit`)), `${report.templateCode}/${result.parameterCode} must not create a fourth unit pseudo-column`);
        assert(displayOwnsUnit(renderedValue, result.unitDisplay) || displayOwnsUnit(renderedReference, result.unitDisplay), `${report.templateCode}/${result.parameterCode} unit must survive in its declared RESULT or reference owner`);
      }
    }
    const images = page.primitives.filter((primitive) => primitive.kind === "image");
    assert(images.some((primitive) => primitive.source === "/st-rose-logo-official.png"), `${report.templateCode} must use the canonical logo`);
    assert(images.every((primitive) => primitive.width !== 210 || primitive.height !== 297), `${report.templateCode} must not contain a raster report background`);
  }

  const cbcPage = pages.get("CBC")!;
  const cbcText = primitiveText(cbcPage);
  assert(!cbcPage.primitives.some((primitive) => primitive.id === "report-title"), "CBC must have no report title");
  assert(cbcText.includes("Status") && !cbcText.includes("OutPatient"), "CBC must print static Status only");
  assert(cbcText.includes("DIFFERENTIAL COUNT"), "CBC differential section must survive");
  assert(cbcText.includes("MIXED CASE PATIENT") && cbcText.includes("MIXED CASE ADDRESS"), "CBC demographic casing must survive");
  // QA-04 retired the former CBC abnormal-indicator prohibition and REPORT-QA-01 replaced the H / L
  // initials with the complete words. CBC follows that shared HIGH / LOW output policy, so the old
  // negative assertion stays replaced by positive coverage rather than deleted: the fixture must
  // genuinely reach both outcomes, and every marker is checked for its complete word, its semantic
  // token and its one-per-result count.
  const cbcModel = resolved.reports.find((report) => report.templateCode === "CBC")!;
  const cbcRendered = cbcModel.results.filter((result) => result.omission === "Render");
  const cbcHighs = cbcRendered.filter((result) => result.evaluationOutcome === "High");
  const cbcLows = cbcRendered.filter((result) => result.evaluationOutcome === "Low");
  assert(cbcHighs.length > 0 && cbcLows.length > 0, `the CBC fixture must genuinely produce both High and Low outcomes or the marker coverage proves nothing - measured High ${cbcHighs.length}, Low ${cbcLows.length}`);
  const cbcMarkers = cbcPage.primitives.flatMap((primitive) => primitive.kind === "text" && primitive.id.endsWith("-indicator") ? [primitive] : []);
  assert(cbcMarkers.length === cbcHighs.length + cbcLows.length, `CBC must render exactly one marker per High or Low result - expected ${cbcHighs.length + cbcLows.length}, measured ${cbcMarkers.length}`);
  for (const result of cbcRendered) {
    const markers = cbcMarkers.filter((primitive) => primitive.id === `result-${result.parameterCode}-indicator`);
    if (result.evaluationOutcome === "High") {
      assert(markers.length === 1 && markers[0].text === "HIGH" && markers[0].fontWeight === "bold" && markers[0].color === NATIVE_REPORT_THEME.colors.abnormalHigh, `CBC ${result.parameterCode} High must render exactly one bold complete-word HIGH in the abnormalHigh token`);
    } else if (result.evaluationOutcome === "Low") {
      assert(markers.length === 1 && markers[0].text === "LOW" && markers[0].fontWeight === "bold" && markers[0].color === NATIVE_REPORT_THEME.colors.abnormalLow, `CBC ${result.parameterCode} Low must render exactly one bold complete-word LOW in the abnormalLow token`);
    } else {
      assert(markers.length === 0, `CBC ${result.parameterCode} (${result.evaluationOutcome}) must render no abnormal marker`);
    }
  }

  const hba = resolved.reports.find((report) => report.templateCode === "HBA1C")!;
  const hbaPage = pages.get("HBA1C")!;
  const hbaResult = hba.results[0];
  const hbaRenderedResult = textByIdPrefix(hbaPage, `result-${hbaResult.parameterCode}-value`);
  assert(hbaResult.formattedValue.endsWith("%") && hbaRenderedResult === hbaResult.formattedValue && (hbaRenderedResult.match(/%/g) || []).length === 1, "% suffix must render exactly once in the result");

  const fecDefinition = ReportDefinitionRegistry.getDefinition("FECALYSIS")!;
  const fecReport = reportFor(fecDefinition);
  for (const parameter of fecDefinition.parameters.filter((candidate) => !candidate.isRequired)) {
    fecReport.results.find((result) => result.parameterCode === parameter.parameterCode)!.resultValue = "";
  }
  const hpf = fecDefinition.parameters.find((parameter) => parameter.suffixSpec?.suffix.includes("HPF"))!;
  fecReport.results.find((result) => result.parameterCode === hpf.parameterCode)!.resultValue = "0-2 /HPF";
  const fecSession = resolveDraftSessionRenderModel(sessionFor([fecReport]));
  const fecPage = composeAll(fecSession).get("FECALYSIS")!;
  const hpfRenderedResult = textByIdPrefix(fecPage, `result-${hpf.parameterCode}-value`);
  assert(hpfRenderedResult.endsWith("/HPF") && (hpfRenderedResult.match(/\/HPF/g) || []).length === 1, "/HPF suffix must render exactly once in the result");

  // ----- REPORT-QA-02B: Fecalysis client corrections -----
  // The fixture above deliberately blanks every optional row to prove omission reserves no
  // primitives, which omits PARASITES. These corrections need the opposite: a Fecalysis report with
  // its rows populated. So this is a SEPARATE fixture, leaving that omission proof exactly as it is.
  const fecalysisDefinition = ReportDefinitionRegistry.getDefinition("FECALYSIS")!;
  const fecalysisComposition = getStandardNativeCompositionDefinition("FECALYSIS")!;
  const populatedFecPage = composeAll(
    resolveDraftSessionRenderModel(sessionFor([reportFor(fecalysisDefinition)]))
  ).get("FECALYSIS")!;

  // 1. COLOR and CONSISTENCY both render uppercase, and neither is uppercased in storage. Every
  // fixture value below is a declared option in its stored mixed case, so a rendered uppercase
  // proves the value was uppercased on its way out rather than having arrived that way. The second
  // fixture carries a multi-word value and a non-first option, which proves the whole value is
  // uppercased and that nothing here depends on the first declared option.
  const uppercasedFecFixtures: ReadonlyArray<Readonly<Record<string, string>>> = [
    { COLOR: "Brown", CONSISTENCY: "Soft" },
    { COLOR: "Yellowish Brown", CONSISTENCY: "Loose" },
  ];
  for (const fixture of uppercasedFecFixtures) {
    const uppercasedFecReport = reportFor(fecalysisDefinition);
    for (const [parameterCode, storedValue] of Object.entries(fixture)) {
      const parameter = fecalysisDefinition.parameters.find(
        (candidate) => candidate.parameterCode === parameterCode
      )!;
      assert(
        parameter.options!.includes(storedValue) && storedValue !== storedValue.toLocaleUpperCase(),
        `the ${parameterCode} fixture value "${storedValue}" must be a declared option still in mixed case or this proves nothing`
      );
      assert(
        parameter.resultPresentation?.casing === "Uppercase" &&
          parameter.resultPresentation?.sinceRenderContractVersion === 2,
        `FECALYSIS ${parameterCode} must declare the version-2 uppercase result presentation`
      );
      uppercasedFecReport.results.find((result) => result.parameterCode === parameterCode)!.resultValue = storedValue;
    }
    const uppercasedFecModel = resolveDraftSessionRenderModel(sessionFor([uppercasedFecReport]));
    const uppercasedFecPage = composeAll(uppercasedFecModel).get("FECALYSIS")!;
    const uppercasedFecResults = uppercasedFecModel.reports.find(
      (report) => report.templateCode === "FECALYSIS"
    )!.results;
    for (const [parameterCode, storedValue] of Object.entries(fixture)) {
      assert(
        textByIdPrefix(uppercasedFecPage, `result-${parameterCode}-value`) === storedValue.toLocaleUpperCase(),
        `FECALYSIS ${parameterCode} must render "${storedValue}" as "${storedValue.toLocaleUpperCase()}"`
      );
      assert(
        uppercasedFecResults.find((result) => result.parameterCode === parameterCode)!.rawValue === storedValue,
        `FECALYSIS ${parameterCode} must leave the stored value "${storedValue}" in its entered case`
      );
    }
  }

  // 2. PARASITES / OVA renders italic - the value primitive only, never the examination label. The
  // default fixture carries the negative phrase; the second carries a detected organism, so both
  // the "nothing seen" wording and a parasite name are proven to receive the same emphasis.
  const detectedFecReport = reportFor(fecalysisDefinition);
  detectedFecReport.results.find((result) => result.parameterCode === "PARASITES")!.resultValue = "ENTAMOEBA COLI";
  const detectedFecPage = composeAll(
    resolveDraftSessionRenderModel(sessionFor([detectedFecReport]))
  ).get("FECALYSIS")!;
  for (const [page, expected] of [
    [populatedFecPage, "NO INTESTINAL PARASITES OR OVA SEEN"],
    [detectedFecPage, "ENTAMOEBA COLI"],
  ] as const) {
    assert(textByIdPrefix(page, "result-PARASITES-value") === expected, `FECALYSIS must render the PARASITES value "${expected}"`);
    const valuePrimitives = page.primitives.filter(
      (primitive) => primitive.kind === "text" && primitive.id.startsWith("result-PARASITES-value")
    );
    assert(valuePrimitives.length > 0, `FECALYSIS must compose a PARASITES result value for "${expected}"`);
    assert(
      valuePrimitives.every((primitive) => (primitive as NativeTextPrimitive).italic === true),
      `FECALYSIS PARASITES result value must render italic for "${expected}"`
    );
    assert(
      page.primitives.every(
        (primitive) =>
          primitive.kind !== "text" ||
          !primitive.id.startsWith("result-PARASITES-label") ||
          !(primitive as NativeTextPrimitive).italic
      ),
      "the PARASITES / OVA examination label must never be italicised"
    );
    // Emphasis is scoped to that one result: nothing else on the page may become italic.
    assert(
      page.primitives.every(
        (primitive) =>
          primitive.kind !== "text" ||
          primitive.id.startsWith("result-PARASITES-value") ||
          !(primitive as NativeTextPrimitive).italic
      ),
      "no FECALYSIS primitive other than the PARASITES result value may be italic"
    );
  }

  // 3. No Fecalysis reference survives composition - not a value, not a cell, not a column header.
  // Encoding shares the root cause: no parameter declares a referenceRule, and ParameterRow renders
  // its Ref: element only when a reference actually resolves.
  assert(
    fecalysisDefinition.parameters.every((parameter) => !parameter.referenceRule),
    "no FECALYSIS parameter may declare a referenceRule, so Encoding resolves no Ref: element"
  );
  assert(
    !populatedFecPage.primitives.some((primitive) => primitive.id.includes("-reference")),
    "FECALYSIS composition must emit no reference primitive on any row"
  );
  assert(
    fecalysisComposition.resultHeaders.length === 2 &&
      !fecalysisComposition.resultHeaders.some((header) => /NORMAL|REFERENCE/i.test(header)),
    "FECALYSIS must declare two result columns with no normal-values header"
  );
  assert(
    !populatedFecPage.primitives.some((primitive) => primitive.id === "result-header-3"),
    "FECALYSIS must compose no third result-column header"
  );

  // 4. Every other examination keeps its reference behaviour. CHEM_8 is the control: three columns,
  // its NORMAL VALUES header intact, and reference primitives still composed.
  const chem8Composition = getStandardNativeCompositionDefinition("CHEM_8")!;
  assert(chem8Composition.resultHeaders.length === 3, "CHEM_8 must keep three result columns");
  assert(
    chem8Composition.resultHeaders.some((header) => /NORMAL/i.test(header)),
    "CHEM_8 must keep its NORMAL VALUES header"
  );
  const chem8Page = pages.get("CHEM_8")!;
  assert(
    chem8Page.primitives.some((primitive) => primitive.id === "result-header-3"),
    "CHEM_8 must keep its third result-column header"
  );
  assert(
    chem8Page.primitives.some((primitive) => primitive.id.includes("-reference")),
    "CHEM_8 must still emit reference primitives"
  );

  // 5. A Fecalysis report completed BEFORE the corrections must render exactly as it was issued.
  // The presentation contract is versioned: the corrections are declared from version 2, and a
  // snapshot frozen at version 1 resolves the version-1 presentation. Both versions are composed
  // from the same snapshot content here, so any difference is attributable to the frozen version
  // alone.
  // The realistic completed value: the approved automatic default. It wraps onto two lines in the
  // version-1 result column and fits on one in the wider version-2 column, so the frozen version
  // changes the page geometry as well as the styling.
  const completedFecReport = reportFor(fecalysisDefinition);
  const frozenFecSnapshot = (renderContractVersion: number): CompletedSessionSnapshot => ({
    snapshotVersion: 2,
    completedAt: "2026-01-01T00:00:00.000Z",
    demographics: sessionFor([completedFecReport]).demographics,
    reports: [
      {
        templateCode: "FECALYSIS",
        templateTitle: fecalysisDefinition.templateTitle,
        rendererFamily: fecalysisDefinition.rendererFamily as CompletedSessionSnapshot["reports"][number]["rendererFamily"],
        renderContractVersion,
        printedTitle: fecalysisDefinition.reportTitle ?? null,
        staticContentVersion: "standard-report-v1",
        requestedBy: fecalysisDefinition.requestedByPolicy.defaultPhysician ?? "",
        additionalFields: {},
        results: fecalysisDefinition.parameters.map((parameter) => ({
          parameterCode: parameter.parameterCode,
          parameterName: parameter.parameterName,
          rawResultValue: inputValue(parameter),
          formattedResultValue: inputValue(parameter),
          referenceDisplay: null,
          referenceRule: null,
          unit: parameter.unit ?? null,
          suffix: parameter.suffixSpec?.suffix ?? null,
          evaluationOutcome: "NoEvaluation",
          computationMetadata: null,
          displayOrder: parameter.displayOrder,
        })),
        remarks: "",
        reagentKitInfo: null,
        repeatableFindings: {},
        signatories: [pathologist()],
      },
    ],
  });

  const legacyFecPage = composeAll(resolveCompletedSessionRenderModel(frozenFecSnapshot(1))).get("FECALYSIS")!;
  const currentFecPage = composeAll(resolveCompletedSessionRenderModel(frozenFecSnapshot(2))).get("FECALYSIS")!;

  // Frozen at version 1: the three-column layout, its NORMAL VALUES header, mixed-case COLOR and CONSISTENCY
  // and an upright PARASITES value - the exact output that report was issued with.
  assert(
    legacyFecPage.primitives.some((primitive) => primitive.id === "result-header-3"),
    "a FECALYSIS report completed at contract v1 must keep its third result-column header"
  );
  assert(
    textByIdPrefix(legacyFecPage, "result-COLOR-value") === "Brown",
    "a FECALYSIS report completed at contract v1 must keep its mixed-case COLOR value"
  );
  assert(
    textByIdPrefix(legacyFecPage, "result-CONSISTENCY-value") === "Soft",
    "a FECALYSIS report completed at contract v1 must keep its mixed-case CONSISTENCY value"
  );
  assert(
    legacyFecPage.primitives.every(
      (primitive) => primitive.kind !== "text" || !(primitive as NativeTextPrimitive).italic
    ),
    "a FECALYSIS report completed at contract v1 must contain no italic primitive"
  );

  // Frozen at version 2: the corrections apply, from identical snapshot content.
  assert(
    !currentFecPage.primitives.some((primitive) => primitive.id === "result-header-3"),
    "a FECALYSIS report completed at contract v2 must compose no third result-column header"
  );
  assert(
    textByIdPrefix(currentFecPage, "result-COLOR-value") === "BROWN",
    "a FECALYSIS report completed at contract v2 must render COLOR uppercase"
  );
  assert(
    textByIdPrefix(currentFecPage, "result-CONSISTENCY-value") === "SOFT",
    "a FECALYSIS report completed at contract v2 must render CONSISTENCY uppercase"
  );
  assert(
    currentFecPage.primitives.some(
      (primitive) =>
        primitive.id.startsWith("result-PARASITES-value") && (primitive as NativeTextPrimitive).italic === true
    ),
    "a FECALYSIS report completed at contract v2 must render the PARASITES value italic"
  );

  // The two must actually differ, or the version gate is not doing anything.
  assert(
    legacyFecPage.contentBottomMm !== currentFecPage.contentBottomMm,
    "the two frozen contract versions must produce different Fecalysis geometry"
  );

  // 5a-v1. A snapshotVersion 1 completed report froze NO render metadata, so it resolves at the
  // baseline contract - the same rule as the legacy no-snapshot path below. Every assertion above
  // uses snapshotVersion 2 fixtures, which carry an explicit per-report renderContractVersion, so
  // nothing reached this branch: it returned the definition's CURRENT version and handed an
  // already-issued report the two-column layout and uppercase values it was never issued with.
  const v1Snapshot: CompletedSessionSnapshot = {
    ...frozenFecSnapshot(1),
    snapshotVersion: 1,
  };
  const v1FecPage = composeAll(resolveCompletedSessionRenderModel(v1Snapshot)).get("FECALYSIS")!;
  assert(
    v1FecPage.primitives.some((primitive) => primitive.id === "result-header-3"),
    "a snapshotVersion 1 FECALYSIS report must keep its third result-column header"
  );
  assert(
    textByIdPrefix(v1FecPage, "result-COLOR-value") === "Brown" &&
      textByIdPrefix(v1FecPage, "result-CONSISTENCY-value") === "Soft",
    "a snapshotVersion 1 FECALYSIS report must keep its mixed-case values"
  );
  assert(
    v1FecPage.primitives.every(
      (primitive) => primitive.kind !== "text" || !(primitive as NativeTextPrimitive).italic
    ),
    "a snapshotVersion 1 FECALYSIS report must contain no italic primitive"
  );

  // 5b. The LEGACY path: a session completed before snapshots existed, so there is no frozen
  // contract metadata to read at all. Everything above resolves through the snapshot branch, which
  // is exactly how this path came to advertise the CURRENT contract version while resolving its
  // values at the baseline - a report composed two-column but printed mixed-case, a state no
  // version was ever issued in. It resolves wholly at the baseline or the split is back.
  const legacyNoSnapshotSession: IPatientReportSession = {
    ...sessionFor([completedFecReport]),
    status: "Completed",
    completedAt: "2026-01-01T00:00:00.000Z",
  };
  const legacyNoSnapshotPage = composeAll(resolveSessionRenderModel(legacyNoSnapshotSession)).get("FECALYSIS")!;
  assert(
    legacyNoSnapshotPage.primitives.some((primitive) => primitive.id === "result-header-3"),
    "a legacy completed FECALYSIS report carrying no frozen snapshot must keep its third result-column header"
  );
  assert(
    textByIdPrefix(legacyNoSnapshotPage, "result-COLOR-value") === "Brown" &&
      textByIdPrefix(legacyNoSnapshotPage, "result-CONSISTENCY-value") === "Soft",
    "a legacy completed FECALYSIS report carrying no frozen snapshot must keep its mixed-case values"
  );
  assert(
    legacyNoSnapshotPage.primitives.every(
      (primitive) => primitive.kind !== "text" || !(primitive as NativeTextPrimitive).italic
    ),
    "a legacy completed FECALYSIS report carrying no frozen snapshot must contain no italic primitive"
  );


  // 5c. A two-column contract must not swallow a UNIT.
  //
  // The unit is suppressed on the value when the reference display already shows it - correct while
  // that column is printed. A two-column contract composes no reference cell at all, so consulting
  // it there deduplicated against something the operator never sees and the unit vanished from a
  // clinical result entirely.
  //
  // No shipped definition exhibits this: FECALYSIS is the only two-column contract and declares no
  // units, which is exactly why the general unit assertion in section 1 stays green and cannot
  // catch it. The fixture below is therefore synthetic ON PURPOSE - a two-column contract whose
  // parameter carries a unit that appears ONLY in the reference - and it is the combination, not
  // either half, that reproduces the defect.
  const unitBearingDefinition: ClinicalReportDefinition = {
    ...fecalysisDefinition,
    templateCode: "C2_UNIT_PROBE",
    parameters: [
      {
        ...fecalysisDefinition.parameters[0],
        parameterCode: "UNIT_PROBE",
        parameterName: "Unit Probe",
        inputType: "NumericText",
        options: null,
        unit: "mg/L",
        // The reference display is BUILT from the rule plus the unit, so this is the shape that
        // actually produces a reference carrying the unit - the precondition for the defect.
        referenceRule: { normalRange: "0.0-5.0" },
        resultPresentation: null,
      },
    ],
    renderContract: {
      ...fecalysisDefinition.renderContract!,
      standardComposition: {
        resultHeaders: ["EXAMINATION", "RESULT"],
        columnRatios: [40, 60],
        sinceRenderContractVersion: 1,
      },
    },
  } as ClinicalReportDefinition;

  const unitProbeReport = reportFor(unitBearingDefinition);
  const unitProbeSource: RenderDefinitionSource = {
    getDefinition: (templateCode: string) =>
      templateCode === unitBearingDefinition.templateCode ? unitBearingDefinition : null,
  };
  const unitProbeSession = resolveDraftSessionRenderModel(
    sessionFor([unitProbeReport]),
    unitProbeSource
  );
  const unitProbeComposition = createStandardNativeCompositionDefinition(unitBearingDefinition)!;
  assert(
    unitProbeComposition.resultHeaders.length === 2,
    "the unit probe composes as a two-column contract, or it is not exercising the branch"
  );
  const unitProbePage = composeStandardNativeReportPage(
    unitProbeComposition,
    unitProbeSession,
    unitProbeSession.reports[0]
  );
  assert(
    !unitProbePage.primitives.some((primitive) => primitive.id.startsWith("result-UNIT_PROBE-reference")),
    "the unit probe composes no reference cell, which is the precondition for the defect"
  );
  assert(
    displayOwnsUnit(textByIdPrefix(unitProbePage, "result-UNIT_PROBE-value"), "mg/L"),
    "a two-column result keeps its unit on the value, since no reference column is printed to carry it"
  );

  // 5d. The specialized live-preview resolver drops the contract version, and that is only safe
  // while specialized compositions are version-independent.
  //
  // `getNativeLivePreviewCompositionDefinition` passes `report.renderContractVersion` to every
  // resolver, but `getSpecializedNativeCompositionDefinition` accepts a template code alone, so
  // for MicroscopyTwoColumn and Certificate the argument is silently discarded. Nothing renders
  // differently today because no `specializedComposition` declares a version gate - so this pins
  // exactly that precondition rather than the dropped argument. If it ever fails, thread the
  // version through the specialized resolver BEFORE declaring the gate, or completed specialized
  // reports will re-render at the current definition.
  for (const definition of ReportDefinitionRegistry.getAllDefinitions()) {
    const specialized = definition.renderContract?.specializedComposition as
      | (Record<string, unknown> & { sinceRenderContractVersion?: number })
      | undefined;
    assert(
      !specialized || specialized.sinceRenderContractVersion === undefined,
      `${definition.templateCode} declares a versioned specialized composition, but the live-preview resolver discards the contract version - thread it through getSpecializedNativeCompositionDefinition first`
    );
  }

  // 6. Column declarations fail closed. A header/ratio length mismatch and a non-positive ratio are
  // both declaration errors and must be rejected at resolution rather than composed.
  for (const [broken, reason] of [
    [{ resultHeaders: ["A", "B"] as [string, string], columnRatios: [40, 30, 30] as [number, number, number] }, "length mismatch"],
    [{ resultHeaders: ["A", "B"] as [string, string], columnRatios: [40, 0] as [number, number] }, "zero ratio"],
    [{ resultHeaders: ["A", "B"] as [string, string], columnRatios: [40, -60] as [number, number] }, "negative ratio"],
    [{ resultHeaders: ["A", "B"] as [string, string], columnRatios: [40, Number.NaN] as [number, number] }, "non-finite ratio"],
  ] as const) {
    let caught: unknown;
    try {
      createStandardNativeCompositionDefinition({
        ...fecalysisDefinition,
        renderContract: {
          ...fecalysisDefinition.renderContract!,
          standardComposition: { ...broken, sinceRenderContractVersion: 1 },
        },
      });
    } catch (error) {
      caught = error;
    }
    // The rejection is identified, not merely counted. A bare `catch` accepted ANY exception, so
    // these four cases proved only that the resolver threw something - an unrelated future throw
    // inside it would have kept them green with the column validation gone. `validatedColumns`
    // names the template and the declaration in its message, so both are required here.
    assert(
      caught instanceof Error &&
        caught.message.includes("Standard composition for 'FECALYSIS'") &&
        /result header\(s\) but|invalid column ratio at index/.test(caught.message),
      `an invalid column declaration (${reason}) must be rejected at resolution by the column validator (got ${String(caught)})`
    );
  }
  const omitted = fecSession.reports[0].results.filter((result) => result.omission === "Omit");
  assert(omitted.length > 0 && omitted.every((result) => !fecPage.primitives.some((primitive) => primitive.id.startsWith(`result-${result.parameterCode}-`))), "omitted Fecalysis rows must reserve no primitives");

  const bloodDefinition = ReportDefinitionRegistry.getDefinition("BLOOD_TYPING")!;
  const bloodReport = reportFor(bloodDefinition);
  bloodReport.encodingData!.requestedBy = "";
  const bloodSession = resolveDraftSessionRenderModel(sessionFor([bloodReport]));
  const bloodPage = composeAll(bloodSession).get("BLOOD_TYPING")!;
  assert(!primitiveText(bloodPage).includes("Dr."), "blank Blood Typing Requested By must gain no fallback physician");

  const kitCodes = resolved.reports.filter((report) => pages.get(report.templateCode)!.primitives.some((primitive) => primitive.id === "kit-lot")).map((report) => report.templateCode).sort();
  assert(kitCodes.join(",") === ["DENGUE_DUO", "HBA1C", "HBSAG", "PREG_TEST", "RPR"].sort().join(","), "kit sections must appear only for the five declared compact reports");
  for (const code of kitCodes) {
    const output = primitiveText(pages.get(code)!);
    assert(output.includes("LOT-C2") && output.includes("2028-12-31"), `${code} kit values must survive exactly`);
  }

  const noSignatureReport = reportFor(ReportDefinitionRegistry.getDefinition("RBS")!, null);
  const noSignatureSession = resolveDraftSessionRenderModel(sessionFor([noSignatureReport]));
  assert(!composeAll(noSignatureSession).get("RBS")!.primitives.some((primitive) => primitive.id === "pathologist-signature"), "absent signature must leave the image area blank");
  const malformedSignatureReport = reportFor(ReportDefinitionRegistry.getDefinition("RBS")!, "javascript:alert(1)");
  const malformedSignatureSession = resolveDraftSessionRenderModel(sessionFor([malformedSignatureReport]));
  assert(!composeAll(malformedSignatureSession).get("RBS")!.primitives.some((primitive) => primitive.id === "pathologist-signature"), "malformed signature must leave the image area blank");

  const signaturePage = pages.get("RBS")!;
  const logoBytes = new Uint8Array(await readFileAsync(path.join(process.cwd(), "public", "st-rose-logo-official.png")));
  const optionalFailureResolver: NativePdfAssetResolver = {
    async load(source) {
      if (source === "/st-rose-logo-official.png") return { bytes: logoBytes, format: "PNG" };
      throw new Error("simulated signature failure");
    },
  };
  await createNativeReportPdf(signaturePage, optionalFailureResolver);
  let logoFailure = false;
  try { await createNativeReportPdf(signaturePage, { async load() { throw new Error("logo failed"); } }); } catch { logoFailure = true; }
  assert(logoFailure, "required logo failure must remain actionable");

  const overflowBase = mutableClone(resolved);
  const overflowReport = overflowBase.reports.find((report) => report.templateCode === "CHEM_10")!;
  overflowReport.remarks = Array.from({ length: 260 }, () => "remark").join(" ");
  expectOverflow(overflowBase, overflowReport, "excessive remarks");

  const resultOverflowSession = mutableClone(resolved);
  const resultOverflowReport = resultOverflowSession.reports.find((report) => report.templateCode === "CHEM_10")!;
  resultOverflowReport.results[0].formattedValue = Array.from({ length: 220 }, () => "result").join(" ");
  expectOverflow(resultOverflowSession, resultOverflowReport, "excessive result text");

  const demographicOverflowSession = mutableClone(resolved);
  const demographicOverflowReport = demographicOverflowSession.reports.find((report) => report.templateCode === "CHEM_10")!;
  demographicOverflowSession.demographics.fullName = Array.from({ length: 14 }, () => "Longname").join(" ");
  demographicOverflowSession.demographics.address = Array.from({ length: 18 }, () => "Longaddress").join(" ");
  demographicOverflowReport.requestedBy.value = Array.from({ length: 18 }, () => "Physician").join(" ");
  expectOverflow(demographicOverflowSession, demographicOverflowReport, "excessive demographics");

  const genericSources = ["composer.ts", "sections.ts"].map((file) => readFileSync(path.join(process.cwd(), "src", "rendering", "native", "standard", file), "utf8")).join("\n");
  assert(!/templateCode\s*(?:===|!==|==|!=)\s*["']/.test(genericSources) && !/switch\s*\([^)]*templateCode/.test(genericSources), "generic C2 composers must not branch on report-code literals");
  assert(!/ILaboratoryReport|IPatientReportSession|GenericReportResolver|resolveReferenceDisplay|FormulaRegistry|domain\/definitions/.test(genericSources), "generic C2 composers must import no mutable or clinical services");

  process.stdout.write(`C2 verification passed: 6 tabular + 9 compact reports; A4 upper-half composition; exact resolved output ownership; optional signatures; explicit overflow.\n`);
}

void main();
