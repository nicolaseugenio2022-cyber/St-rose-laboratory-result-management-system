import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

function assert(condition, message) {
  if (!condition) throw new Error(`CBC preview overflow verification failed: ${message}`);
}

const projectRoot = process.cwd();
const previewPath = path.join(
  projectRoot,
  "output",
  "pdf",
  "CBC-native-adaptive-demographics-preview.html"
);
const domEvidencePath = path.join(
  projectRoot,
  "output",
  "pdf",
  "CBC-native-adaptive-demographics-preview-dom.html"
);
const summaryPath = path.join(projectRoot, "output", "pdf", "CBC-native-adaptive-demographics-validation.json");
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];
const browserPath = chromeCandidates.find(existsSync);
assert(browserPath, "Chrome is required for computed DOM overflow verification");
assert(existsSync(previewPath), "generated preview fixture is missing");

const result = spawnSync(
  browserPath,
  [
    "--headless=new",
    "--disable-gpu",
    "--allow-file-access-from-files",
    "--dump-dom",
    pathToFileURL(previewPath).href,
  ],
  { encoding: "utf8", timeout: 30000 }
);
assert(result.status === 0, result.stderr || "headless browser returned a non-zero status");
assert(/data-overflow-count="0"/.test(result.stdout), "one or more demographic values overflow their preview frames");
const checkedCount = Number(/data-checked-count="(\d+)"/.exec(result.stdout)?.[1] || 0);
assert(checkedCount > 0, "the browser did not inspect any composed demographic lines");

for (const id of ["patient-name", "patient-address", "requesting-physician"]) {
  const pattern = new RegExp(
    `data-native-primitive-id="${id}(?:-line-\\d+)?"[^>]*data-overflow="false"|data-overflow="false"[^>]*data-native-primitive-id="${id}(?:-line-\\d+)?"`
  );
  assert(pattern.test(result.stdout), `${id} did not pass the browser overflow probe`);
}

await writeFile(domEvidencePath, result.stdout, "utf8");
const source = await readFile(previewPath, "utf8");
assert(source.includes("MARIA CRISTINA EVANGELISTA"), "uppercase long name is absent from preview source");
assert(source.includes("26 ABIGAIL STREET"), "uppercase long address is absent from preview source");
const existingSummary = JSON.parse(await readFile(summaryPath, "utf8"));
await writeFile(
  summaryPath,
  JSON.stringify(
    {
      ...existingSummary,
      previewBrowserOverflowCount: 0,
      previewBrowserCheckedLineCount: checkedCount,
    },
    null,
    2
  )
);

process.stdout.write(
  JSON.stringify(
    {
      browser: browserPath,
      overflowCount: 0,
      checkedLineCount: checkedCount,
      domEvidencePath,
    },
    null,
    2
  ) + "\n"
);
