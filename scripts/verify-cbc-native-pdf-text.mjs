import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(`CBC PDF verification failed: ${message}`);
}

const projectRoot = process.cwd();
const summaryPath = path.join(projectRoot, "output", "pdf", "CBC-native-adaptive-demographics-validation.json");
const summary = JSON.parse(await readFile(summaryPath, "utf8"));
const standardFontDataUrl = `${path.join(projectRoot, "node_modules", "pdfjs-dist", "standard_fonts").replaceAll("\\", "/")}/`;
const allEvidence = [];

for (const fixture of summary.fixtures) {
  const pdfPath = path.join(projectRoot, fixture.pdf);
  const loadingTask = getDocument({ data: new Uint8Array(await readFile(pdfPath)), disableWorker: true, standardFontDataUrl });
  const document = await loadingTask.promise;
  assert(document.numPages === 1, `${fixture.fixture} is not one page`);
  const page = await document.getPage(1);
  const content = await page.getTextContent();
  const items = content.items.filter((item) => "str" in item && item.str.trim());
  const itemTexts = items.map((item) => item.str.trim());
  const extractedText = itemTexts.join(" ");
  const mmPerPdfUnit = 210 / (page.view[2] - page.view[0]);
  const fieldEvidence = [];

  for (const field of fixture.fields) {
    for (const expectedLine of field.lines) {
      const item = items.find((candidate) => candidate.str.trim() === expectedLine.text || candidate.str.trim().includes(expectedLine.text));
      assert(item, `${fixture.fixture}/${expectedLine.id} is not searchable as complete native text`);
      const startMm = item.transform[4] * mmPerPdfUnit;
      const widthMm = item.width * mmPerPdfUnit;
      const endMm = startMm + widthMm;
      const mergedWithLabel = item.str.trim() !== expectedLine.text;
      if (!mergedWithLabel) assert(startMm >= expectedLine.x - 0.05, `${fixture.fixture}/${expectedLine.id} starts outside its frame`);
      assert(endMm <= expectedLine.x + expectedLine.width + 0.05, `${fixture.fixture}/${expectedLine.id} crosses its field boundary`);
      fieldEvidence.push({ id: expectedLine.id, text: expectedLine.text, extractedItem: item.str.trim(), mergedWithLabel, startMm, widthMm, endMm, frameStartMm: expectedLine.x, frameEndMm: expectedLine.x + expectedLine.width });
    }
  }

  for (const expected of ["23", "0.50", "0.25", "0.01", "0.03", "0.00", "21", "Status"]) {
    assert(extractedText.includes(expected), `${fixture.fixture} is missing searchable text ${expected}`);
  }
  assert(!/(?:OutPatient|Out-Patient|InPatient|In-Patient)/i.test(extractedText), `${fixture.fixture} exposes dynamic status`);
  assert(!/21\s+years/i.test(extractedText), `${fixture.fixture} exposes the age unit`);
  assert(!itemTexts.includes("H") && !itemTexts.includes("L"), `${fixture.fixture} contains H/L`);
  assert(!/\b(?:HIGH|LOW|ABNORMAL)\b/i.test(extractedText), `${fixture.fixture} contains abnormal status text`);
  assert(!/COMPLETE BLOOD COUNT/i.test(extractedText), `${fixture.fixture} contains an unapproved report title`);
  allEvidence.push({ fixture: fixture.fixture, pages: document.numPages, extractedTextItems: itemTexts.length, fieldBoundsMm: fieldEvidence });
  await loadingTask.destroy();
}

await writeFile(summaryPath, JSON.stringify({ ...summary, pdfTextAndBoundsVerified: true, pdfjsDistUsedForTextVerification: true, pdfEvidence: allEvidence }, null, 2));
process.stdout.write(JSON.stringify({ verifiedFixtures: allEvidence.length, pdfTextAndBoundsVerified: true, evidence: allEvidence }, null, 2) + "\n");
