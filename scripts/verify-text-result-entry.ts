/**
 * Text Result Entry Verification Script
 *
 * A laboratory result is often a phrase, not a number: "TOO NUMEROUS TO COUNT" is the reported
 * wording for a field the operator cannot count. Every parameter that accepts text must therefore
 * accept the spaces inside it.
 *
 * This drives the REAL encoding functions one keystroke at a time, exactly as a controlled React
 * input does: the displayed value is derived from the stored value through
 * `getEditableResultValue`, the browser appends one character to what is displayed, and
 * `applyEncodingResultValue` stores the result. A transformation that is individually harmless -
 * trimming a value - becomes destructive inside that loop, because it deletes the trailing space
 * of an in-progress word before the next character arrives. Asserting on the stored string after
 * a whole phrase is typed is the only way to catch it; asserting on a single call cannot.
 *
 * The parameters WITHOUT a fixed suffix are the negative control. They share the same input
 * component and the same store path, so if they did not preserve spaces the loop simulation
 * itself would be wrong rather than the code under test.
 */

import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import {
  applyEncodingResultValue,
  buildEncodingReport,
  getEditableResultValue,
} from "../src/app/(dashboard)/workspace/_lib/encoding/report-encoding";
import { stripFixedSuffix } from "../src/services/formatter-registry";
import type { ILaboratoryReport } from "../src/domain/models/interfaces";
import type { ClinicalReportDefinition, ParameterSpec } from "../src/domain/types/report-definition";
import type { RendererFamily } from "../src/domain/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`❌ Text result entry verification failed: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

function definitionOf(templateCode: string): ClinicalReportDefinition {
  const definition = ReportDefinitionRegistry.getDefinition(templateCode);
  if (!definition) throw new Error(`Definition '${templateCode}' is not registered.`);
  return definition;
}

function parameterOf(definition: ClinicalReportDefinition, parameterCode: string): ParameterSpec {
  const parameter = definition.parameters.find((item) => item.parameterCode === parameterCode);
  if (!parameter) throw new Error(`Parameter '${parameterCode}' is not declared by '${definition.templateCode}'.`);
  return parameter;
}

/**
 * One keystroke at a time, through the controlled-input cycle.
 *
 * `displayed` is what the DOM node actually shows - the stored value passed back through the same
 * accessor the `value` prop uses. The browser appends the character to THAT, never to the raw
 * previous keystroke, which is precisely why a trim on the store path is unrecoverable.
 */
function typeIntoResult(templateCode: string, parameterCode: string, typed: string): string {
  const definition = definitionOf(templateCode);
  const parameter = parameterOf(definition, parameterCode);

  let report: ILaboratoryReport = buildEncodingReport({
    definition,
    sessionId: "verify-session",
    reportId: "verify-report",
    rendererFamily: definition.rendererFamily as RendererFamily,
    signatories: [],
  });

  for (const character of typed) {
    const stored = report.results.find((item) => item.parameterCode === parameterCode)?.resultValue ?? "";
    const displayed = getEditableResultValue(parameter, stored);
    report = applyEncodingResultValue(report, definition, parameterCode, displayed + character, "Entered");
  }

  return report.results.find((item) => item.parameterCode === parameterCode)?.resultValue ?? "";
}

const PHRASE = "TOO NUMEROUS TO COUNT";

// ── Negative control: parameters with no fixed suffix must already preserve spaces ──
// If either of these fails, the simulation above is wrong and every assertion below is void.
assert(
  typeIntoResult("URINALYSIS", "COLOR", "PALE YELLOW") === "PALE YELLOW",
  "NEGATIVE CONTROL: a suffix-free urinalysis parameter preserves interior spaces"
);
assert(
  typeIntoResult("CT_BT", "BLEEDING_TIME", "2 MIN 30 SEC") === "2 MIN 30 SEC",
  "NEGATIVE CONTROL: a suffix-free free-text parameter preserves interior spaces"
);

// ── The reported defect: every suffixed text parameter must accept the same phrase ──
const SUFFIXED_TEXT_PARAMETERS: Array<[string, string]> = [
  ["URINALYSIS", "WBC"],
  ["URINALYSIS", "RBC"],
  ["FECALYSIS", "PUS_CELLS"],
  ["FECALYSIS", "RED_CELLS"],
];

for (const [templateCode, parameterCode] of SUFFIXED_TEXT_PARAMETERS) {
  assert(
    typeIntoResult(templateCode, parameterCode, PHRASE) === PHRASE,
    `${templateCode}.${parameterCode} stores "${PHRASE}" with its spaces intact`
  );
}

// ── Interior spaces are preserved; the fixed suffix is still not duplicated into the value ──
for (const [templateCode, parameterCode] of SUFFIXED_TEXT_PARAMETERS) {
  const definition = definitionOf(templateCode);
  const parameter = parameterOf(definition, parameterCode);
  const suffix = parameter.suffixSpec?.suffix ?? "";
  assert(suffix.trim().length > 0, `${templateCode}.${parameterCode} declares a fixed suffix`);
  const stored = typeIntoResult(templateCode, parameterCode, PHRASE);
  assert(
    !stored.toLowerCase().endsWith(suffix.trim().toLowerCase()),
    `${templateCode}.${parameterCode} does not fold the fixed suffix into the stored value`
  );
}

// ── An ordinary short entry is unaffected ──
assert(typeIntoResult("URINALYSIS", "WBC", "0-2") === "0-2", "URINALYSIS.WBC still stores a plain range unchanged");
assert(typeIntoResult("URINALYSIS", "RBC", ">50") === ">50", "URINALYSIS.RBC still stores a comparator value unchanged");

// ── The stored value carries no leading or trailing whitespace once entry settles ──
assert(
  typeIntoResult("URINALYSIS", "WBC", PHRASE).trim() === typeIntoResult("URINALYSIS", "WBC", PHRASE),
  "URINALYSIS.WBC stores no surrounding whitespace"
);

// ── stripFixedSuffix keeps its own contract: it removes the suffix, not interior spacing ──
assert(
  stripFixedSuffix("TOO NUMEROUS TO COUNT /HPF", " /HPF") === "TOO NUMEROUS TO COUNT",
  "stripFixedSuffix removes the fixed suffix and preserves interior spaces"
);
assert(
  stripFixedSuffix("0-2 /HPF", " /HPF") === "0-2",
  "stripFixedSuffix still removes the suffix from a stored legacy value"
);
assert(
  stripFixedSuffix("  0-2  ", " /HPF") === "0-2",
  "stripFixedSuffix still trims a stored value that carries no suffix"
);

console.log("\n✅ Text result entry verification passed.");
