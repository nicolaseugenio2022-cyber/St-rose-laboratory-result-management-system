import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ILaboratoryReport, IPatientReportSession } from "../src/domain/models/interfaces";
import { composeNativeReportPage } from "../src/rendering/native/composer";
import { cbcNativeDefinition } from "../src/rendering/native/definitions/cbc.definition";
import { NativeReportPreview } from "../src/rendering/native/NativeReportPreview";
import { measureNativeTextWidthMm } from "../src/rendering/native/text-layout";
import type { NativeComposedPage, NativeLineDefinition, NativeTextPrimitive } from "../src/rendering/native/types";
import { createNativeReportPdf, type NativePdfAssetResolver } from "../src/rendering/native/native-pdf-exporter";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CBC native PDF validation failed: ${message}`);
}

const resultValues: Record<string, string> = {
  hemoglobin: "23", hematocrit: ".42", rbc: "4.8", wbc: "6.5", platelet: "250",
  neutrophil: ".5", lymphocyte: ".25", eosinophil: ".01", monocyte: ".03", basophil: "0",
};

const report: ILaboratoryReport = {
  id: "cbc-validation-report", sessionId: "cbc-validation-session", templateCode: "CBC",
  templateTitle: "CBC", rendererFamily: "Tabular", remarks: "TEST/S RECHECKED; RESULT/S VERIFIED",
  results: Object.entries(resultValues).map(([parameterCode, resultValue], index) => ({
    id: `cbc-validation-${parameterCode}`, reportId: "cbc-validation-report", parameterCode,
    parameterName: parameterCode, resultValue,
    evaluationOutcome: parameterCode === "hemoglobin" ? "Abnormal" : "Normal", displayOrder: index + 1,
  })),
  signatories: [
    { personnelId: "cbc-validation-pathologist", role: "Pathologist", printedFullName: "PAULO ANTONIO E. CLEMENTE", printedCredentials: "MD, DPSP", printedPrcLicenseNumber: "113927", signatureImageUrl: "/pathologist-signature.png", displayOrder: 1 },
    { personnelId: "cbc-validation-medtech", role: "MedicalTechnologist", printedFullName: "SANDRA ANNE P. GROSPE", printedCredentials: "RMT, MLS(ASCPi)", printedPrcLicenseNumber: "0124239", signatureImageUrl: "", displayOrder: 2 },
  ],
};

const baseSession: IPatientReportSession = {
  id: "cbc-validation-session", accessionNumber: "CBC-VALIDATION-001", status: "Draft",
  demographics: {
    fullName: "Juan dela Cruz", age: 21, ageUnit: "years", sex: "Male",
    address: "Sta. Rosa, Nueva Ecija", patientStatus: "OutPatient",
    examinationDate: "2026-08-05", requestingPhysician: "Dr. Ana Reyes",
  },
  reports: [report], createdAt: "2026-08-05T00:00:00.000Z",
};

const fixtures = [
  { id: "short-address", demographics: {} },
  { id: "two-line-address", demographics: { address: "26 Abigail Street, Barangay Kapitan Pepe, Cabanatuan City, Nueva Ecija, Philippines" }, expectedAddressLines: 2 },
  { id: "three-line-address", demographics: { address: "26 Abigail Street, Barangay Kapitan Pepe, Cabanatuan City, Nueva Ecija, Central Luzon Region, Republic of the Philippines" }, expectedAddressLines: 3 },
  { id: "long-patient-name", demographics: { fullName: "Maria Cristina Evangelista dela Cruz-Santos Villanueva" } },
  { id: "long-requesting-physician", demographics: { requestingPhysician: "Dr. Alexandrina Evangelista de la Cruz-Santos, MD, FPCP, FPSHBT" } },
  { id: "combined-long", demographics: {
    fullName: "Maria Cristina Evangelista dela Cruz-Santos Villanueva",
    address: "26 Abigail Street, Barangay Kapitan Pepe, Cabanatuan City, Nueva Ecija, Central Luzon Region, Republic of the Philippines",
    requestingPhysician: "Dr. Alexandrina Evangelista de la Cruz-Santos, MD, FPCP, FPSHBT",
  } },
] as const;

const fieldIds = ["patient-name", "patient-address", "requesting-physician"] as const;

function fieldLines(page: NativeComposedPage, id: string): NativeTextPrimitive[] {
  return page.primitives
    .filter((primitive): primitive is NativeTextPrimitive => primitive.kind === "text" && (primitive.id === id || primitive.id.startsWith(`${id}-line-`)))
    .sort((left, right) => left.y - right.y);
}

function joinedFieldText(lines: NativeTextPrimitive[]): string {
  return lines.reduce((value, line) => value ? `${value}${value.endsWith("-") ? "" : " "}${line.text}` : line.text, "");
}

function line(id: string, page: NativeComposedPage) {
  return page.primitives.find((primitive) => primitive.kind === "line" && primitive.id === id);
}

function assertClose(actual: number, expected: number, message: string): void {
  assert(Math.abs(actual - expected) < 0.001, `${message}: expected ${expected}, received ${actual}`);
}

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const outputDirectory = path.join(projectRoot, "output", "pdf");
  await mkdir(outputDirectory, { recursive: true });
  const resolver: NativePdfAssetResolver = {
    async load(source) {
      const sourcePath = source.startsWith("/") ? path.join(projectRoot, "public", source.slice(1)) : path.resolve(projectRoot, source);
      return { bytes: new Uint8Array(await readFile(sourcePath)), format: /\.jpe?g$/i.test(sourcePath) ? "JPEG" : "PNG" };
    },
  };

  const evidence = [];
  const previewSections: string[] = [];
  for (const fixture of fixtures) {
    const session: IPatientReportSession = {
      ...baseSession,
      id: `cbc-${fixture.id}-session`,
      demographics: { ...baseSession.demographics, ...fixture.demographics },
    };
    const page = composeNativeReportPage(cbcNativeDefinition, session, report);
    const text = page.primitives.filter((primitive): primitive is NativeTextPrimitive => primitive.kind === "text");
    const expected: Record<(typeof fieldIds)[number], string> = {
      "patient-name": session.demographics.fullName.toUpperCase(),
      "patient-address": (session.demographics.address || "").toUpperCase(),
      "requesting-physician": session.demographics.requestingPhysician,
    };
    const fields = fieldIds.map((id) => {
      const lines = fieldLines(page, id);
      assert(lines.length > 0 && lines.length <= 3, `${fixture.id}/${id} must resolve to one through three lines`);
      assert(joinedFieldText(lines) === expected[id], `${fixture.id}/${id} must retain complete display text`);
      const allowedMinimum = lines.length === 1 ? 11 : lines.length === 2 ? 10.5 : 10;
      assert(lines[0].fontSizePt >= allowedMinimum && lines[0].fontSizePt <= 13, `${fixture.id}/${id} violates the approved font profile`);
      for (const primitive of lines) {
        const measured = measureNativeTextWidthMm(primitive.text, page.fontRoles[primitive.fontRole], primitive.fontWeight, primitive.fontSizePt);
        assert(measured <= (primitive.width || 0), `${fixture.id}/${primitive.id} exceeds its composed frame`);
      }
      return { id, text: joinedFieldText(lines), lineCount: lines.length, fontSizePt: lines[0].fontSizePt, lines: lines.map((item) => ({ id: item.id, text: item.text, x: item.x, y: item.y, width: item.width, measuredWidthMm: measureNativeTextWidthMm(item.text, page.fontRoles[item.fontRole], item.fontWeight, item.fontSizePt) })) };
    });
    if ("expectedAddressLines" in fixture) {
      assert(fields.find((field) => field.id === "patient-address")?.lineCount === fixture.expectedAddressLines, `${fixture.id} must resolve to ${fixture.expectedAddressLines} address lines`);
    }
    const storedFixtureName = "fullName" in fixture.demographics ? fixture.demographics.fullName : baseSession.demographics.fullName;
    const storedFixtureAddress = "address" in fixture.demographics ? fixture.demographics.address : baseSession.demographics.address;
    assert(session.demographics.fullName === storedFixtureName, `${fixture.id} stored name was mutated`);
    assert(session.demographics.address === storedFixtureAddress, `${fixture.id} stored address was mutated`);

    const nameLines = fields.find((field) => field.id === "patient-name")?.lineCount || 1;
    const addressLines = fields.find((field) => field.id === "patient-address")?.lineCount || 1;
    const physicianLines = fields.find((field) => field.id === "requesting-physician")?.lineCount || 1;
    const demographicDeltaMm = (nameLines - 1 + addressLines - 1 + physicianLines - 1) * 5.662;
    const row1BottomY = 37.35 + nameLines * 5.662;
    const row2BottomY = row1BottomY + addressLines * 5.662;
    const row3BottomY = row2BottomY + physicianLines * 5.662;
    const row1Bottom = line("cbc-demographics-row-1-bottom", page);
    const row2Vertical = line("cbc-demographics-row-2-vertical-0", page);
    const row2Bottom = line("cbc-demographics-row-2-bottom", page);
    const row3Vertical = line("cbc-demographics-row-3-vertical-0", page);
    const row3Bottom = line("cbc-demographics-row-3-bottom", page);
    assert(row1Bottom?.kind === "line" && row2Vertical?.kind === "line" && row2Bottom?.kind === "line" && row3Vertical?.kind === "line" && row3Bottom?.kind === "line", `${fixture.id} demographic separators are incomplete`);
    assertClose(row1Bottom.y1, row1BottomY, `${fixture.id} Row 1 bottom`);
    assertClose(row2Vertical.x1, 139.33, `${fixture.id} Row 2 divider x`);
    assertClose(row2Vertical.y1, row1BottomY, `${fixture.id} Row 2 divider start`);
    assertClose(row2Vertical.y2, row2BottomY, `${fixture.id} Row 2 divider end`);
    assertClose(row2Bottom.y1, row2BottomY, `${fixture.id} Row 2 bottom`);
    assertClose(row3Vertical.x1, 139.33, `${fixture.id} Row 3 divider x`);
    assertClose(row3Vertical.y1, row2BottomY, `${fixture.id} Row 3 divider start`);
    assertClose(row3Vertical.y2, row3BottomY, `${fixture.id} Row 3 divider end`);
    assertClose(row3Bottom.y1, row3BottomY, `${fixture.id} Row 3 bottom`);
    const demographicLines = page.primitives.filter((primitive): primitive is NativeLineDefinition => primitive.kind === "line" && primitive.id.startsWith("cbc-demographics-"));
    assert(demographicLines.length === 5, `${fixture.id} must have exactly three row bottoms and two vertical separators`);
    assert(!demographicLines.some((item) => item.x1 === 110.631 || item.x2 === 110.631), `${fixture.id} must not contain the removed 110.631 mm separator`);
    assert(!page.primitives.some((item) => item.id === "cbc-demographics-outer-border"), `${fixture.id} must not contain an outside border`);

    const tableTop = line("cbc-result-table-row-0-top", page);
    const signature = page.primitives.find((primitive) => primitive.id === "pathologist-signature");
    assert(tableTop?.kind === "line" && signature?.kind === "image", `${fixture.id} downstream reference primitives are missing`);
    assertClose(tableTop.y1, 60.4 + demographicDeltaMm, `${fixture.id} result table flow`);
    assertClose(signature.y, 132.49 + demographicDeltaMm, `${fixture.id} signature flow`);
    assertClose(page.contentBottomMm, 153.499 + demographicDeltaMm, `${fixture.id} content boundary flow`);
    assertClose(signature.x, 56.092, `${fixture.id} approved signature x position`);
    assert(signature.width === 25.682 && signature.height === 13.212, `${fixture.id} signature dimensions changed`);

    const visible = text.map((item) => item.text);
    assert(visible.includes("21") && !visible.some((item) => /21\s+years/i.test(item)), `${fixture.id} numeric-only age regressed`);
    assert(visible.includes("Status") && !visible.some((item) => /OutPatient|Out-Patient/i.test(item)), `${fixture.id} status suppression regressed`);
    assert(!visible.some((item) => /\b(?:HIGH|LOW|ABNORMAL)\b/i.test(item) || /^(?:H|L)$/i.test(item)), `${fixture.id} abnormal suppression regressed`);
    assert(!visible.some((item) => /COMPLETE BLOOD COUNT/i.test(item)), `${fixture.id} gained an unapproved title`);

    const pdf = await createNativeReportPdf(page, resolver);
    assert(pdf.getNumberOfPages() === 1, `${fixture.id} must remain one PDF page`);
    const pdfPath = path.join(outputDirectory, `CBC-native-${fixture.id}-validation.pdf`);
    await writeFile(pdfPath, Buffer.from(pdf.output("arraybuffer")));
    const markup = renderToStaticMarkup(React.createElement(NativeReportPreview, { page, scale: 1 }));
    previewSections.push(`<section data-fixture="${fixture.id}">${markup}</section>`);
    evidence.push({ fixture: fixture.id, pdf: path.relative(projectRoot, pdfPath), lineCounts: { name: nameLines, address: addressLines, physician: physicianLines }, demographicRowHeightsMm: { row1: nameLines * 5.662, row2: addressLines * 5.662, row3: physicianLines * 5.662 }, demographicDeltaMm, resultTableYmm: tableTop.y1, signature: { x: signature.x, y: signature.y, width: signature.width, height: signature.height }, contentBottomMm: page.contentBottomMm, fields });
  }

  let excessiveValueRejected = false;
  try {
    composeNativeReportPage(cbcNativeDefinition, {
      ...baseSession,
      demographics: { ...baseSession.demographics, address: "X".repeat(500) },
    }, report);
  } catch (error) {
    excessiveValueRejected = error instanceof Error && error.message.includes("cannot fit complete text within 3 line(s)");
  }
  assert(excessiveValueRejected, "content exceeding the approved three-line profile must produce an actionable composition error");

  const previewPath = path.join(outputDirectory, "CBC-native-adaptive-demographics-preview.html");
  const probeScript = `<script>(function(){const prefixes=${JSON.stringify(fieldIds)};let checked=0,overflow=0;for(const el of document.querySelectorAll('[data-native-primitive-id]')){const id=el.getAttribute('data-native-primitive-id')||'';if(!prefixes.some(p=>id===p||id.startsWith(p+'-line-')))continue;checked++;const bad=el.scrollWidth>el.clientWidth+1;el.dataset.overflow=String(bad);if(bad)overflow++;}document.body.dataset.checkedCount=String(checked);document.body.dataset.overflowCount=String(overflow);})();</script>`;
  await writeFile(previewPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:white}section{margin-bottom:16px}</style></head><body>${previewSections.join("")}${probeScript}</body></html>`, "utf8");
  const summaryPath = path.join(outputDirectory, "CBC-native-adaptive-demographics-validation.json");
  await writeFile(summaryPath, JSON.stringify({ generatedAt: new Date().toISOString(), separatorModel: { row1VerticalSeparators: [], row2VerticalSeparatorsMm: [139.33], row3VerticalSeparatorsMm: [139.33], outsideBorder: false, firstColumnSeparatorAt110_631Mm: false, bottomSeparatorWidthsMm: [0.529, 0.088, 0.088] }, lineAdvanceMm: 5.662, excessiveValueRejected, preview: path.relative(projectRoot, previewPath), fixtures: evidence }, null, 2));
  process.stdout.write(`${previewPath}\n${summaryPath}\n`);
}

void main();
