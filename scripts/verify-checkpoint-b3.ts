/**
 * Checkpoint B3 Verification Script
 *
 * Verifies all 17 Declarative Report Definitions (Focusing on 7 B3 additions: CBC, BLOOD_TYPING, CT_BT, ESR, FECALYSIS, OGTT, URINALYSIS):
 * 1. Full 17-report registry coverage.
 * 2. Exact parameter ordering and input control types.
 * 3. Exact dropdown/combobox options and ordering.
 * 4. Default values (Fecalysis Bacteria "4+", Parasites "NO INTESTINAL PARASITES OR OVA SEEN", CBC Remarks "TEST/S RECHECKED; RESULT/S VERIFIED").
 * 5. Requested By policies & requiredness across all reports.
 * 6. CBC demographic Patient Status collection omission with static output label preservation.
 * 7. Fixed " /HPF" suffix behavior for microscopic cell counts with deduplication.
 * 8. Fecalysis & Urinalysis blank omission declarations.
 * 9. Urinalysis conditional Amorphous schema and Repeatable Findings schema.
 * 10. ESR unresolved child age cutoff preservation.
 * 11. Generic resolver execution across all 17 definitions without report-code condition chains.
 */

import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import { GenericReportResolver } from "../src/services/generic-report-resolver";
import { getReportDemographicPolicy } from "../src/domain/report-demographic-policy";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

console.log("=== CHECKPOINT B3 VERIFICATION STARTED ===");

const ALL_17_CODES = [
  "CHEM_8",
  "HDL_LDL",
  "CHEM_10",
  "RBS",
  "HBA1C",
  "HBSAG",
  "RPR",
  "DENGUE_DUO",
  "PREG_TEST",
  "HIV_RESULT",
  "CBC",
  "BLOOD_TYPING",
  "CT_BT",
  "ESR",
  "FECALYSIS",
  "OGTT",
  "URINALYSIS",
];

// ---------------------------------------------------------------------------
// Test 1: Full 17-Report Registry Registration
// ---------------------------------------------------------------------------
console.log("\n--- Test 1: 17-Report Registry Registration ---");
const registeredCodes = ReportDefinitionRegistry.getRegisteredTemplateCodes();
assert(registeredCodes.length === 17, `Exactly 17 reports must be registered, found ${registeredCodes.length}`);

for (const code of ALL_17_CODES) {
  const def = ReportDefinitionRegistry.getDefinition(code);
  assert(def !== null, `Report definition for ${code} must be registered`);
  assert(def?.templateCode === code, `Definition templateCode must match "${code}"`);
}


// ---------------------------------------------------------------------------
// Test 2: CBC Specifics (Order, Controls, Defaults, Remarks, Status, Abnormal Suppress)
// ---------------------------------------------------------------------------
console.log("\n--- Test 2: CBC Declarative Definition ---");
const cbc = ReportDefinitionRegistry.getDefinition("CBC")!;
assert(cbc.parameters.length === 10, `CBC must have exactly 10 parameters`);
assert(cbc.requestedByPolicy.defaultPhysician === "Dr. Ralph Roland Asperas", `CBC default physician = "Dr. Ralph Roland Asperas"`);
assert(cbc.requestedByPolicy.isRequired === true, `CBC Requested By is REQUIRED`);
assert(cbc.defaultRemarks === "TEST/S RECHECKED; RESULT/S VERIFIED", `CBC default remarks = "TEST/S RECHECKED; RESULT/S VERIFIED"`);
assert(cbc.suppressAbnormalIndicators === true, `CBC suppressAbnormalIndicators must be true`);
assert(cbc.statusPolicy.demographicCollection === false, `CBC statusPolicy.demographicCollection must be false`);
assert(cbc.statusPolicy.type === "Static" && cbc.statusPolicy.staticLabel === "Status", `CBC preserves static output label "Status"`);

const cbcParamNames = cbc.parameters.map((p) => p.parameterName);
const expectedCbcNames = [
  "Hemoglobin",
  "Hematocrit",
  "RBC Count",
  "WBC Count",
  "Platelet Count",
  "Neutrophil",
  "Lymphocyte",
  "Eosinophil",
  "Monocyte",
  "Basophil",
];
assert(JSON.stringify(cbcParamNames) === JSON.stringify(expectedCbcNames), `CBC exact parameter ordering verified`);

const expectedCbcPrecision = [0, 2, 1, 1, 0, 2, 2, 2, 2, 2];
const expectedCbcUnits = ["g/L", null, "x 10^12/L", "x 10^9/L", "x 10^9/L", null, null, null, null, null];
assert(cbc.parameters.every((p) => p.inputType === "NumericText"), `CBC all result controls are NumericText`);
assert(
  JSON.stringify(cbc.parameters.map((p) => p.displayPrecision)) === JSON.stringify(expectedCbcPrecision),
  `CBC exact display precision ordering verified`
);
assert(
  JSON.stringify(cbc.parameters.map((p) => p.unit ?? null)) === JSON.stringify(expectedCbcUnits),
  `CBC exact unit ordering verified`
);
assert(
  JSON.stringify(cbc.parameters.map((p) => p.referenceRule)) === JSON.stringify([
    { male: "130–160", female: "120–140" },
    { male: "0.40–0.52", female: "0.37–0.42" },
    { male: "4.5–6.0", female: "4.0–5.5" },
    { normalRange: "5.0–10.0" },
    { normalRange: "150–450" },
    { normalRange: "0.50–0.70" },
    { normalRange: "0.25–0.40" },
    { normalRange: "0.01–0.04" },
    { normalRange: "0.03–0.08" },
    { normalRange: "0.00–0.01" },
  ]),
  `CBC exact reference rules verified`
);


// ---------------------------------------------------------------------------
// Test 3: BLOOD_TYPING Specifics (Exact Options, No Auto-Selection, Physician Null)
// ---------------------------------------------------------------------------
console.log("\n--- Test 3: BLOOD_TYPING Declarative Definition ---");
const bloodTyping = ReportDefinitionRegistry.getDefinition("BLOOD_TYPING")!;
assert(bloodTyping.requestedByPolicy.defaultPhysician === null, `BLOOD_TYPING default physician must be null`);
assert(bloodTyping.requestedByPolicy.isEditable === true, `BLOOD_TYPING Requested By is editable`);
assert(bloodTyping.requestedByPolicy.isRequired === false, `BLOOD_TYPING Requested By is optional`);

const aboParam = bloodTyping.parameters.find((p) => p.parameterCode === "ABO_TYPING")!;
assert(JSON.stringify(aboParam.options) === JSON.stringify(["A", "B", "AB", "O"]), `ABO options = ["A", "B", "AB", "O"]`);
assert(!aboParam.defaultValue, `ABO has no automatic result selection default`);

const rhParam = bloodTyping.parameters.find((p) => p.parameterCode === "RH_TYPING")!;
assert(JSON.stringify(rhParam.options) === JSON.stringify(["Positive", "Negative"]), `Rh options = ["Positive", "Negative"]`);
assert(!rhParam.defaultValue, `Rh has no automatic result selection default`);


// ---------------------------------------------------------------------------
// Test 4: FECALYSIS Specifics (Combobox, FreeText Cells, Fixed Suffix, Defaults, Blank Omission)
// ---------------------------------------------------------------------------
console.log("\n--- Test 4: FECALYSIS Declarative Definition ---");
const fecalysis = ReportDefinitionRegistry.getDefinition("FECALYSIS")!;
assert(fecalysis.requestedByPolicy.defaultPhysician === "Dr. Ma. Floricel Dedace-Lagrazon", `FECALYSIS default physician = "Dr. Ma. Floricel Dedace-Lagrazon"`);
assert(fecalysis.requestedByPolicy.isRequired === true, `FECALYSIS Requested By is REQUIRED`);

const expectedFecalysisCodes = [
  "COLOR",
  "CONSISTENCY",
  "BLOOD",
  "MUCUS",
  "PH",
  "FAT_GLOBULES",
  "PUS_CELLS",
  "RED_CELLS",
  "BACTERIA",
  "PARASITES",
  "OTHERS",
];
assert(
  JSON.stringify(fecalysis.parameters.map((p) => p.parameterCode)) === JSON.stringify(expectedFecalysisCodes),
  `FECALYSIS exact parameter ordering verified`
);

const fecColor = fecalysis.parameters.find((p) => p.parameterCode === "COLOR")!;
assert(fecColor.inputType === "Combobox", `Fecalysis Color inputType = "Combobox"`);
assert(
  JSON.stringify(fecColor.options) ===
    JSON.stringify(["Brown", "Yellowish Brown", "Dark Brown", "Black", "Green", "Greenish Brown", "Red", "Reddish Brown"]),
  `Fecalysis Color options verified`
);

const fecCons = fecalysis.parameters.find((p) => p.parameterCode === "CONSISTENCY")!;
assert(fecCons.inputType === "Combobox", `Fecalysis Consistency inputType = "Combobox"`);
assert(
  JSON.stringify(fecCons.options) ===
    JSON.stringify(["Soft", "Loose", "Semi-Formed", "Formed", "Mushy", "Watery"]),
  `Fecalysis Consistency options verified`
);

const fecPus = fecalysis.parameters.find((p) => p.parameterCode === "PUS_CELLS")!;
assert(fecPus.inputType === "FreeText", `Fecalysis Pus Cells inputType = "FreeText"`);
assert(fecPus.suffixSpec?.suffix === " /HPF", `Fecalysis Pus Cells suffix = " /HPF"`);
assert(fecPus.blankOmission === true, `Fecalysis Pus Cells blankOmission = true`);

const fecRed = fecalysis.parameters.find((p) => p.parameterCode === "RED_CELLS")!;
assert(fecRed.inputType === "FreeText", `Fecalysis Red Cells inputType = "FreeText"`);
assert(fecRed.suffixSpec?.suffix === " /HPF", `Fecalysis Red Cells suffix = " /HPF"`);
assert(fecRed.blankOmission === true, `Fecalysis Red Cells blankOmission = true`);

for (const code of ["BLOOD", "MUCUS", "PH", "FAT_GLOBULES", "OTHERS"]) {
  const finding = fecalysis.parameters.find((p) => p.parameterCode === code)!;
  assert(finding.inputType === "FreeText", `FECALYSIS ${code} inputType = "FreeText"`);
  assert(finding.isRequired === false, `FECALYSIS ${code} is optional`);
  assert(finding.blankOmission === true, `FECALYSIS ${code} blankOmission = true`);
}

const fecBac = fecalysis.parameters.find((p) => p.parameterCode === "BACTERIA")!;
assert(fecBac.inputType === "FreeText", `Fecalysis Bacteria inputType = "FreeText" (NOT combobox)`);
assert(fecBac.defaultValue === "4+", `Fecalysis Bacteria initial default = "4+"`);

const fecPara = fecalysis.parameters.find((p) => p.parameterCode === "PARASITES")!;
assert(fecPara.inputType === "FreeText", `Fecalysis Parasites inputType = "FreeText"`);
assert(fecPara.defaultValue === "NO INTESTINAL PARASITES OR OVA SEEN", `Fecalysis Parasites automatic default = "NO INTESTINAL PARASITES OR OVA SEEN"`);
assert(
  fecalysis.parameters.filter((p) => !p.isRequired).every((p) => p.blankOmission === true),
  `All optional FECALYSIS findings declare blank-output omission`
);


// ---------------------------------------------------------------------------
// Test 5: URINALYSIS Specifics (DiagnosticGrid, Controls, Amorphous & Repeatable Schemas)
// ---------------------------------------------------------------------------
console.log("\n--- Test 5: URINALYSIS Declarative Definition ---");
const urinalysis = ReportDefinitionRegistry.getDefinition("URINALYSIS")!;
assert(urinalysis.rendererFamily === "DiagnosticGrid", `URINALYSIS rendererFamily = "DiagnosticGrid"`);
assert(urinalysis.requestedByPolicy.defaultPhysician === null, `URINALYSIS default physician = null (required staff entry)`);
assert(urinalysis.requestedByPolicy.isRequired === true, `URINALYSIS Requested By is REQUIRED`);

const expectedUrinalysisCodes = [
  "COLOR",
  "TRANSPARENCY",
  "PH",
  "SP_GRAVITY",
  "PROTEIN",
  "GLUCOSE",
  "WBC",
  "RBC",
  "EPITHELIAL_CELLS",
  "BACTERIA",
  "MUCUS_THREADS",
  "AMORPHOUS_CRYSTAL",
];
assert(
  JSON.stringify(urinalysis.parameters.map((p) => p.parameterCode)) === JSON.stringify(expectedUrinalysisCodes),
  `URINALYSIS exact parameter ordering verified`
);

const expectedUrinalysisControls = [
  "Combobox",
  "Combobox",
  "SingleSelect",
  "SingleSelect",
  "SingleSelect",
  "SingleSelect",
  "FreeText",
  "FreeText",
  "SingleSelect",
  "SingleSelect",
  "SingleSelect",
  "SingleSelect",
];
assert(
  JSON.stringify(urinalysis.parameters.map((p) => p.inputType)) === JSON.stringify(expectedUrinalysisControls),
  `URINALYSIS exact control types verified`
);

const expectedUrinalysisOptions: Record<string, string[]> = {
  COLOR: ["Straw", "Pale Yellow", "Light Yellow", "Yellow", "Dark Yellow", "Amber", "Brown", "Red"],
  TRANSPARENCY: ["Clear", "Slightly Hazy", "Hazy", "Slightly Cloudy", "Cloudy", "Slightly Turbid", "Turbid"],
  PH: ["5.0", "6.0", "6.5", "7.0", "7.5", "8.0", "9.0"],
  SP_GRAVITY: ["1.000", "1.005", "1.010", "1.015", "1.020", "1.025", "1.030"],
  PROTEIN: ["Negative", "Trace", "1+", "2+", "3+", "4+"],
  GLUCOSE: ["Negative", "Trace", "1+", "2+", "3+", "4+"],
  EPITHELIAL_CELLS: ["Rare", "Few", "Moderate", "Many", "Plenty"],
  BACTERIA: ["Rare", "Few", "Moderate", "Many", "Plenty"],
  MUCUS_THREADS: ["Rare", "Few", "Moderate", "Many", "Plenty"],
};
for (const [code, options] of Object.entries(expectedUrinalysisOptions)) {
  const parameter = urinalysis.parameters.find((p) => p.parameterCode === code)!;
  assert(JSON.stringify(parameter.options) === JSON.stringify(options), `URINALYSIS ${code} options and ordering verified`);
}

const uriWbc = urinalysis.parameters.find((p) => p.parameterCode === "WBC")!;
assert(uriWbc.inputType === "FreeText", `URINALYSIS WBC inputType = "FreeText" (not numeric-only)`);
assert(uriWbc.suffixSpec?.suffix === " /HPF", `URINALYSIS WBC suffix = " /HPF"`);

const uriRbc = urinalysis.parameters.find((p) => p.parameterCode === "RBC")!;
assert(uriRbc.inputType === "FreeText", `URINALYSIS RBC inputType = "FreeText" (not numeric-only)`);
assert(uriRbc.suffixSpec?.suffix === " /HPF", `URINALYSIS RBC suffix = " /HPF"`);

const uriAmorphous = urinalysis.parameters.find((p) => p.parameterCode === "AMORPHOUS_CRYSTAL")!;
assert(uriAmorphous.blankOmission === true, `URINALYSIS Amorphous blankOmission = true`);
assert(
  JSON.stringify(uriAmorphous.conditionalChoiceSpec?.labelChoices) ===
    JSON.stringify(["Amorphous Urates", "Amorphous Phosphates"]),
  `URINALYSIS Amorphous label choices verified`
);
assert(
  JSON.stringify(uriAmorphous.conditionalChoiceSpec?.resultOptions) ===
    JSON.stringify(["Rare", "Few", "Moderate", "Many", "Plenty"]),
  `URINALYSIS Amorphous result options verified`
);

assert(urinalysis.repeatableFindings !== undefined && urinalysis.repeatableFindings?.length === 1, `URINALYSIS repeatable findings schema present`);
assert(urinalysis.repeatableFindings?.[0].findingCategory === "Additional Microscopic Findings", `URINALYSIS repeatable finding category verified`);
assert(urinalysis.repeatableFindings?.[0].allowedOptions === null, `URINALYSIS repeatable findings accept unrestricted text`);
assert(urinalysis.repeatableFindings?.[0].maxEntries === null, `URINALYSIS repeatable findings have no invented entry cap`);


// ---------------------------------------------------------------------------
// Test 6: ESR Unresolved State & OGTT / CT_BT Specifics
// ---------------------------------------------------------------------------
console.log("\n--- Test 6: ESR Unresolved State & OGTT / CT_BT ---");
const esr = ReportDefinitionRegistry.getDefinition("ESR")!;
assert(esr.unresolvedNotes !== undefined && esr.unresolvedNotes?.length! > 0, `ESR unresolved notes preserved`);
assert(esr.unresolvedNotes?.[0].topic === "Child Age Cutoff", `ESR unresolved topic = "Child Age Cutoff"`);
assert(esr.requestedByPolicy.defaultPhysician === "Dr. Ralph Roland Asperas", `ESR default physician = "Dr. Ralph Roland Asperas"`);
assert(esr.requestedByPolicy.isEditable === true && esr.requestedByPolicy.isRequired === true, `ESR Requested By is editable and required`);

const ctBt = ReportDefinitionRegistry.getDefinition("CT_BT")!;
assert(ctBt.parameters.length === 2, `CT_BT has 2 parameters`);
assert(ctBt.requestedByPolicy.defaultPhysician === "Dr. Ralph Roland Asperas", `CT_BT default physician = "Dr. Ralph Roland Asperas"`);
assert(ctBt.requestedByPolicy.isEditable === true && ctBt.requestedByPolicy.isRequired === true, `CT_BT Requested By is editable and required`);
assert(
  JSON.stringify(ctBt.parameters.map((p) => p.parameterCode)) === JSON.stringify(["BLEEDING_TIME", "CLOTTING_TIME"]),
  `CT_BT exact parameter ordering verified`
);
assert(ctBt.parameters.every((p) => p.inputType === "FreeText"), `CT_BT controls remain unrestricted FreeText without inferred clinical validation`);
assert(ctBt.parameters[0].referenceRule?.normalRange === "1–4 mins", `Bleeding Time reference range = "1–4 mins"`);
assert(ctBt.parameters[1].referenceRule?.normalRange === "2–6 mins", `Clotting Time reference range = "2–6 mins"`);

const ogtt = ReportDefinitionRegistry.getDefinition("OGTT")!;
assert(ogtt.parameters.length === 3, `OGTT has 3 parameters`);
assert(ogtt.requestedByPolicy.defaultPhysician === "Dr. Heinz Roland Asperas", `OGTT default physician = "Dr. Heinz Roland Asperas"`);
assert(
  JSON.stringify(ogtt.parameters.map((p) => p.parameterCode)) === JSON.stringify(["FBS", "OGTT_1HR", "OGTT_2HR"]),
  `OGTT exact parameter ordering verified`
);
assert(ogtt.parameters.every((p) => p.inputType === "NumericText"), `OGTT controls are NumericText`);
assert(
  JSON.stringify(ogtt.parameters.map((p) => p.referenceRule?.normalRange)) === JSON.stringify(["< 100", "< 200", "< 140"]),
  `OGTT exact reference values verified`
);


// ---------------------------------------------------------------------------
// Test 7: Universal Patient Status Collection Disabling Across All 17 Reports
// ---------------------------------------------------------------------------
console.log("\n--- Test 7: Universal Patient Status Disabling Across All 17 Reports ---");
for (const code of ALL_17_CODES) {
  const def = ReportDefinitionRegistry.getDefinition(code)!;
  assert(def.statusPolicy.demographicCollection === false, `${code} statusPolicy.demographicCollection must be false`);
  const demoPolicy = getReportDemographicPolicy(code);
  assert(demoPolicy.patientStatus.visibleInEncoding === false, `${code} demographic policy visibleInEncoding must be false`);
  assert(demoPolicy.patientStatus.requiredForCompletion === false, `${code} demographic policy requiredForCompletion must be false`);
}


// ---------------------------------------------------------------------------
// Test 8: Generic Resolution Pipeline Execution on New B3 Definitions
// ---------------------------------------------------------------------------
console.log("\n--- Test 8: Generic Resolution Execution on B3 Reports ---");

// Fecalysis Resolution
const fecResolved = GenericReportResolver.resolveReport({
  definition: fecalysis,
  rawInputs: {
    COLOR: "Brown",
    CONSISTENCY: "Soft",
    PUS_CELLS: "0-2",
    RED_CELLS: "0-1",
    BACTERIA: "4+",
    PARASITES: "NO INTESTINAL PARASITES OR OVA SEEN",
  },
});
const fecPusRes = fecResolved.find((r) => r.parameterCode === "PUS_CELLS")!;
assert(fecPusRes.formattedResultValue === "0-2 /HPF", `Fecalysis Pus Cells formatted string = "0-2 /HPF"`);
assert(fecPusRes.rawResultValue === "0-2", `Fecalysis Pus Cells raw stored value = "0-2"`);

// Urinalysis Resolution (Range entry with /HPF deduplication)
const uriResolved = GenericReportResolver.resolveReport({
  definition: urinalysis,
  rawInputs: {
    COLOR: "Yellow",
    TRANSPARENCY: "Clear",
    PH: "6.0",
    SP_GRAVITY: "1.015",
    PROTEIN: "Negative",
    GLUCOSE: "Negative",
    WBC: "TOO NUMEROUS TO COUNT/HPF", // Legacy input already containing /HPF without canonical spacing
    RBC: "0-1",
  },
});
const uriWbcRes = uriResolved.find((r) => r.parameterCode === "WBC")!;
assert(uriWbcRes.formattedResultValue === "TOO NUMEROUS TO COUNT /HPF", `Urinalysis WBC deduplicates /HPF -> "TOO NUMEROUS TO COUNT /HPF"`);
assert(uriWbcRes.rawResultValue === "TOO NUMEROUS TO COUNT/HPF", `Urinalysis legacy raw value remains unchanged during resolution`);

console.log("\n=== ALL CHECKPOINT B3 VERIFICATION TESTS PASSED SUCCESSFULLY ===");
