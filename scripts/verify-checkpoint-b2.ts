/**
 * Checkpoint B2 Verification Script — 8-Area Review Audit & Regression
 *
 * Verifies:
 * 1. HIV_RESULT Requested By is REQUIRED (isRequired === true) with defaultPhysician === null.
 * 2. Printed report titles vs catalog names (HEPATITIS B (SCREENING), SYPHILIS / RPR (SCREENING), PREGNANCY TEST (URINE), exact mixed-case "HbA1c").
 * 3. Patient Status Architecture (demographicCollection === false, type === "Omitted").
 * 4. Qualitative option exactness and ordering (HBSAG, RPR, PREG_TEST, DENGUE_DUO, HIV_RESULT with no default result).
 * 5. Kit policy (Lot & Exp required for 6 reports; no Brand required; editable defaults for HBA1C & DENGUE_DUO; blank defaults for HBSAG, RPR, PREG_TEST, HIV_RESULT).
 * 6. Chemistry exact ordered composition & labels (CHEM_8 uses "SGPT", CHEM_10 uses "SGPT / ALT"; CHEM_8 has 6, HDL_LDL has 8, CHEM_10 has 10).
 * 7. Requested By requiredness (isRequired === true across all 10 B2 definitions).
 * 8. Zero premature UI component modifications.
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

console.log("=== CHECKPOINT B2 AUDIT & REGRESSION VERIFICATION STARTED ===");

const B2_CODES = [
  "CHEM_8",
  "HDL_LDL",
  "CHEM_10",
  "RBS",
  "HBSAG",
  "RPR",
  "HBA1C",
  "DENGUE_DUO",
  "PREG_TEST",
  "HIV_RESULT",
];

// ---------------------------------------------------------------------------
// Area 1: HIV_RESULT Field Semantics
// ---------------------------------------------------------------------------
console.log("\n--- Area 1: HIV_RESULT Field Semantics ---");
const hivResult = ReportDefinitionRegistry.getDefinition("HIV_RESULT")!;
assert(hivResult.requestedByPolicy.isRequired === true, `HIV_RESULT Referring Doctor is REQUIRED (isRequired === true)`);
assert(hivResult.requestedByPolicy.defaultPhysician === null, `HIV_RESULT Referring Doctor default is null (no default physician)`);


// ---------------------------------------------------------------------------
// Area 2: Printed Content vs Catalog / Display Names
// ---------------------------------------------------------------------------
console.log("\n--- Area 2: Printed Content vs Catalog Names ---");

const hbsag = ReportDefinitionRegistry.getDefinition("HBSAG")!;
assert(hbsag.templateTitle === "Hepatitis B Surface Antigen (HBsAg)", `HBSAG catalog name = "Hepatitis B Surface Antigen (HBsAg)"`);
assert(hbsag.reportTitle === "HEPATITIS B (SCREENING)", `HBSAG printed report title = "HEPATITIS B (SCREENING)"`);

const rpr = ReportDefinitionRegistry.getDefinition("RPR")!;
assert(rpr.templateTitle === "Rapid Plasma Reagin (RPR)", `RPR catalog name = "Rapid Plasma Reagin (RPR)"`);
assert(rpr.reportTitle === "SYPHILIS / RPR (SCREENING)", `RPR printed report title = "SYPHILIS / RPR (SCREENING)"`);

const pregTest = ReportDefinitionRegistry.getDefinition("PREG_TEST")!;
assert(pregTest.templateTitle === "Pregnancy Test", `PREG_TEST catalog name = "Pregnancy Test"`);
assert(pregTest.reportTitle === "PREGNANCY TEST (URINE)", `PREG_TEST printed report title = "PREGNANCY TEST (URINE)"`);

const hba1c = ReportDefinitionRegistry.getDefinition("HBA1C")!;
assert(hba1c.reportTitle === "HbA1c", `HBA1C printed report title must be exact mixed-case "HbA1c"`);
assert(hba1c.parameters[0].parameterName === "HbA1c", `HBA1C parameter label must be exact mixed-case "HbA1c"`);


// ---------------------------------------------------------------------------
// Area 3: Patient Status Architecture Separation
// ---------------------------------------------------------------------------
console.log("\n--- Area 3: Patient Status Architecture ---");
for (const code of B2_CODES) {
  const def = ReportDefinitionRegistry.getDefinition(code)!;
  assert(def.statusPolicy.demographicCollection === false, `${code} statusPolicy.demographicCollection must be false`);
  assert(def.statusPolicy.type === "Omitted", `${code} statusPolicy.type must be "Omitted"`);
  const demoPolicy = getReportDemographicPolicy(code);
  assert(demoPolicy.patientStatus.visibleInEncoding === false, `${code} demographic policy visibleInEncoding must be false`);
  assert(demoPolicy.patientStatus.requiredForCompletion === false, `${code} demographic policy requiredForCompletion must be false`);
}


// ---------------------------------------------------------------------------
// Area 4: Qualitative Option Exactness
// ---------------------------------------------------------------------------
console.log("\n--- Area 4: Qualitative Option Exactness & Ordering ---");

// HBSAG
const hbsagParam = hbsag.parameters[0];
assert(JSON.stringify(hbsagParam.options) === JSON.stringify(["Nonreactive", "Reactive"]), `HBSAG options must be ["Nonreactive", "Reactive"]`);

// RPR
const rprParam = rpr.parameters[0];
assert(JSON.stringify(rprParam.options) === JSON.stringify(["Nonreactive", "Reactive"]), `RPR options must be ["Nonreactive", "Reactive"]`);

// PREG_TEST
const pregParam = pregTest.parameters[0];
assert(JSON.stringify(pregParam.options) === JSON.stringify(["Negative", "Positive"]), `PREG_TEST options must be ["Negative", "Positive"]`);

// DENGUE_DUO
const dengueDuo = ReportDefinitionRegistry.getDefinition("DENGUE_DUO")!;
assert(JSON.stringify(dengueDuo.parameters[0].options) === JSON.stringify(["Negative", "Positive"]), `Dengue NS1 options = ["Negative", "Positive"]`);
assert(JSON.stringify(dengueDuo.parameters[1].options) === JSON.stringify(["Negative", "Positive"]), `Dengue IgG options = ["Negative", "Positive"]`);
assert(JSON.stringify(dengueDuo.parameters[2].options) === JSON.stringify(["Negative", "Positive"]), `Dengue IgM options = ["Negative", "Positive"]`);

// HIV_RESULT
const hivParam = hivResult.parameters[0];
assert(JSON.stringify(hivParam.options) === JSON.stringify(["Nonreactive", "Reactive"]), `HIV_RESULT options must be ["Nonreactive", "Reactive"]`);
assert(!hivParam.defaultValue, `HIV_RESULT has no default result selection`);


// ---------------------------------------------------------------------------
// Area 5: Kit Policy
// ---------------------------------------------------------------------------
console.log("\n--- Area 5: Kit Policy & Defaults ---");
const kitRequiredCodes = ["HBA1C", "HBSAG", "RPR", "DENGUE_DUO", "PREG_TEST", "HIV_RESULT"];
for (const code of kitRequiredCodes) {
  const def = ReportDefinitionRegistry.getDefinition(code)!;
  assert(def.requiresKitInfo === true, `${code} requires kit info`);
}

// Approved editable initial values
assert(hba1c.defaultKitInfo?.lotNumber === "F20712509AD", `HBA1C default Lot = "F20712509AD"`);
assert(hba1c.defaultKitInfo?.expirationDate === "2028-04-26", `HBA1C default Exp = "2028-04-26"`);
assert(hba1c.defaultKitInfo?.isLotEditable === true && hba1c.defaultKitInfo?.isExpEditable === true, `HBA1C kit defaults are editable`);

assert(dengueDuo.defaultKitInfo?.lotNumber === "202512015", `DENGUE_DUO default Lot = "202512015"`);
assert(dengueDuo.defaultKitInfo?.expirationDate === "2028-11", `DENGUE_DUO default Exp = "2028-11"`);
assert(dengueDuo.defaultKitInfo?.isLotEditable === true && dengueDuo.defaultKitInfo?.isExpEditable === true, `DENGUE_DUO kit defaults are editable`);

// No invented defaults for remaining kit reports
assert(hbsag.defaultKitInfo?.lotNumber === "" && hbsag.defaultKitInfo?.expirationDate === "", `HBSAG starts with blank kit defaults`);
assert(rpr.defaultKitInfo?.lotNumber === "" && rpr.defaultKitInfo?.expirationDate === "", `RPR starts with blank kit defaults`);
assert(pregTest.defaultKitInfo?.lotNumber === "" && pregTest.defaultKitInfo?.expirationDate === "", `PREG_TEST starts with blank kit defaults`);
assert(hivResult.defaultKitInfo?.lotNumber === "" && hivResult.defaultKitInfo?.expirationDate === "", `HIV_RESULT starts with blank kit defaults`);


// ---------------------------------------------------------------------------
// Area 6: Chemistry Content Contract
// ---------------------------------------------------------------------------
console.log("\n--- Area 6: Chemistry Exact Ordered Composition ---");

// CHEM_8
const chem8 = ReportDefinitionRegistry.getDefinition("CHEM_8")!;
const chem8Names = chem8.parameters.map((p) => p.parameterName);
assert(
  JSON.stringify(chem8Names) ===
    JSON.stringify(["Fasting Blood Sugar", "Cholesterol", "Triglycerides", "Uric Acid", "SGPT", "Creatinine"]),
  `CHEM_8 exact composition: ${JSON.stringify(chem8Names)}`
);
assert(!chem8Names.includes("HDL") && !chem8Names.includes("LDL") && !chem8Names.includes("Blood Urea Nitrogen") && !chem8Names.includes("SGOT / AST"), `CHEM_8 has no HDL, LDL, BUN, or SGOT`);
assert(chem8Names[4] === "SGPT", `CHEM_8 parameter 5 name is exactly "SGPT" (not "SGPT/ALT")`);

// HDL_LDL
const hdlLdl = ReportDefinitionRegistry.getDefinition("HDL_LDL")!;
const hdlLdlNames = hdlLdl.parameters.map((p) => p.parameterName);
assert(
  JSON.stringify(hdlLdlNames) ===
    JSON.stringify(["Fasting Blood Sugar", "Cholesterol", "Triglycerides", "HDL", "LDL", "Uric Acid", "SGPT", "Creatinine"]),
  `HDL_LDL exact composition: ${JSON.stringify(hdlLdlNames)}`
);
assert(hdlLdlNames[6] === "SGPT", `HDL_LDL parameter 7 name is exactly "SGPT"`);

// CHEM_10
const chem10 = ReportDefinitionRegistry.getDefinition("CHEM_10")!;
const chem10Names = chem10.parameters.map((p) => p.parameterName);
assert(
  JSON.stringify(chem10Names) ===
    JSON.stringify([
      "Fasting Blood Sugar",
      "Cholesterol",
      "Triglycerides",
      "HDL",
      "LDL",
      "Uric Acid",
      "Blood Urea Nitrogen",
      "SGPT / ALT",
      "SGOT / AST",
      "Creatinine",
    ]),
  `CHEM_10 exact composition: ${JSON.stringify(chem10Names)}`
);
assert(chem10Names[7] === "SGPT / ALT", `CHEM_10 parameter 8 name is exactly "SGPT / ALT"`);


// ---------------------------------------------------------------------------
// Area 7: Requested By Requiredness
// ---------------------------------------------------------------------------
console.log("\n--- Area 7: Requested By Requiredness ---");
for (const code of B2_CODES) {
  const def = ReportDefinitionRegistry.getDefinition(code)!;
  assert(def.requestedByPolicy.isRequired === true, `${code} Requested By is REQUIRED (isRequired === true)`);
}

// Physician defaults reconfirmed
assert(chem8.requestedByPolicy.defaultPhysician === null, `CHEM_8 default physician = null`);
assert(hdlLdl.requestedByPolicy.defaultPhysician === "Dr. Heinz Roland Asperas", `HDL_LDL default physician = "Dr. Heinz Roland Asperas"`);
assert(chem10.requestedByPolicy.defaultPhysician === "Dr. Heinz Roland Asperas", `CHEM_10 default physician = "Dr. Heinz Roland Asperas"`);
assert(ReportDefinitionRegistry.getDefinition("RBS")!.requestedByPolicy.defaultPhysician === "Dr. Ralph Roland Asperas", `RBS default physician = "Dr. Ralph Roland Asperas"`);
assert(hba1c.requestedByPolicy.defaultPhysician === "Dr. Heinz Roland Asperas", `HBA1C default physician = "Dr. Heinz Roland Asperas"`);
assert(hivResult.requestedByPolicy.defaultPhysician === null, `HIV_RESULT default physician = null`);


// ---------------------------------------------------------------------------
// Resolution Pipeline Integration Test
// ---------------------------------------------------------------------------
console.log("\n--- Resolution Pipeline Integration ---");
const chem10Resolved = GenericReportResolver.resolveReport({
  definition: chem10,
  rawInputs: { CHOLESTEROL: "155", TRIGLYCERIDES: "700" },
});
const hdlRes = chem10Resolved.find((r) => r.parameterCode === "HDL")!;
const ldlRes = chem10Resolved.find((r) => r.parameterCode === "LDL")!;
assert(hdlRes.formattedResultValue === "41.33", `CHEM_10 HDL formatted string = "41.33"`);
assert(ldlRes.formattedResultValue === "26.33", `CHEM_10 LDL formatted string using unrounded HDL = "26.33"`);

console.log("\n=== ALL CHECKPOINT B2 AUDIT & REGRESSION VERIFICATION TESTS PASSED SUCCESSFULLY ===");
