/**
 * Checkpoint B1 Verification Script — Architectural Declarative Validation & Regression
 *
 * Verifies:
 * 1. StrictPositive dependency validation (0 -> invalid, negative -> invalid, positive -> accepted).
 * 2. StrictPositive computed result validation (0 -> invalid, negative -> invalid, positive -> accepted).
 * 3. AnyFinite computed result validation (0 -> accepted, negative finite -> accepted). [Architecture Test]
 * 4. HDL/LDL remain StrictPositive and retain all approved behavior.
 * 5. LDL still uses unrounded HDL.
 * 6. No triglyceride cutoff.
 * 7. Legacy result fallback works via getResultDisplayValue.
 */

import { calculateHdl, calculateLdl } from "../src/domain/chemistry/formulas";
import { formatHalfUp, formatWithSuffix } from "../src/services/formatter-registry";
import { FormulaRegistry } from "../src/services/formula-registry";
import { GenericReportResolver } from "../src/services/generic-report-resolver";
import { ClinicalReportDefinition } from "../src/domain/types/report-definition";
import { ILaboratoryResult, getResultDisplayValue } from "../src/domain/models/interfaces";
import { validEntryOnly } from "../src/domain/definitions/evaluation-policies";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

console.log("=== CHECKPOINT B1 VERIFICATION STARTED ===");

// ---------------------------------------------------------------------------
// Test 1: StrictPositive Dependency Validation (0 -> invalid, negative -> invalid, positive -> accepted)
// ---------------------------------------------------------------------------
console.log("\n--- Test 1: StrictPositive Dependency Validation ---");

const strictPositiveDef: ClinicalReportDefinition = {
  templateCode: "STRICT_POS_TEST",
  templateTitle: "Strict Positive Test",
  examinationFamily: "Clinical Chemistry",
  rendererFamily: "Tabular",
  requestedByPolicy: { isEditable: true, isRequired: true },
  statusPolicy: { demographicCollection: false, type: "Omitted" },
  requiresKitInfo: false,
  supportsRemarks: true,
  parameters: [
    {
      parameterCode: "CHOLESTEROL",
      parameterName: "Cholesterol",
      inputType: "NumericText",
      isRequired: true,
      isSelectable: true,
      displayOrder: 1,
      evaluationPolicy: validEntryOnly(),
    },
    {
      parameterCode: "HDL",
      parameterName: "HDL",
      inputType: "Computed",
      isRequired: true,
      isSelectable: true,
      displayOrder: 2,
      evaluationPolicy: validEntryOnly(),
      formulaBinding: {
        formulaId: "hdl-client-formula",
        dependencies: ["CHOLESTEROL"],
        precision: 2,
        dependencyValidationPolicy: "StrictPositive",
        resultValidationPolicy: "StrictPositive",
      },
    },
  ],
};

const depZero = GenericReportResolver.resolveReport({ definition: strictPositiveDef, rawInputs: { CHOLESTEROL: "0" } }).find((r) => r.parameterCode === "HDL")!;
assert(depZero.isValid === false, `StrictPositive dependency = 0 must be invalid`);
assert(depZero.evaluationOutcome === "Invalid", `StrictPositive dependency = 0 outcome must be Invalid`);

const depNeg = GenericReportResolver.resolveReport({ definition: strictPositiveDef, rawInputs: { CHOLESTEROL: "-150" } }).find((r) => r.parameterCode === "HDL")!;
assert(depNeg.isValid === false, `StrictPositive dependency < 0 must be invalid`);
assert(depNeg.evaluationOutcome === "Invalid", `StrictPositive dependency < 0 outcome must be Invalid`);

const depPos = GenericReportResolver.resolveReport({ definition: strictPositiveDef, rawInputs: { CHOLESTEROL: "150" } }).find((r) => r.parameterCode === "HDL")!;
assert(depPos.isValid === true, `StrictPositive dependency > 0 must be accepted`);
assert(depPos.formattedResultValue === "40.00", `StrictPositive dependency > 0 produces formatted result "40.00"`);


// ---------------------------------------------------------------------------
// Test 2: StrictPositive Computed Result Validation (0 -> invalid, negative -> invalid, positive -> accepted)
// ---------------------------------------------------------------------------
console.log("\n--- Test 2: StrictPositive Computed Result Validation ---");

const hdlLdlDef: ClinicalReportDefinition = {
  templateCode: "CHEM_10",
  templateTitle: "Chemistry 10",
  examinationFamily: "Clinical Chemistry",
  rendererFamily: "Tabular",
  requestedByPolicy: { isEditable: true, isRequired: true },
  statusPolicy: { demographicCollection: false, type: "Omitted" },
  requiresKitInfo: false,
  supportsRemarks: true,
  parameters: [
    { parameterCode: "CHOLESTEROL", parameterName: "Cholesterol", inputType: "NumericText", isRequired: true, isSelectable: true, displayOrder: 1, evaluationPolicy: validEntryOnly() },
    { parameterCode: "TRIGLYCERIDES", parameterName: "Triglycerides", inputType: "NumericText", isRequired: true, isSelectable: true, displayOrder: 2, evaluationPolicy: validEntryOnly() },
    {
      parameterCode: "HDL",
      parameterName: "HDL",
      inputType: "Computed",
      isRequired: true,
      isSelectable: true,
      displayOrder: 3,
      evaluationPolicy: validEntryOnly(),
      formulaBinding: {
        formulaId: "hdl-client-formula",
        dependencies: ["CHOLESTEROL"],
        precision: 2,
        dependencyValidationPolicy: "StrictPositive",
        resultValidationPolicy: "StrictPositive",
      },
    },
    {
      parameterCode: "LDL",
      parameterName: "LDL",
      inputType: "Computed",
      isRequired: true,
      isSelectable: true,
      displayOrder: 4,
      evaluationPolicy: validEntryOnly(),
      formulaBinding: {
        formulaId: "ldl-client-formula",
        dependencies: ["TRIGLYCERIDES", "CHOLESTEROL"],
        precision: 2,
        dependencyValidationPolicy: "StrictPositive",
        resultValidationPolicy: "StrictPositive",
      },
    },
  ],
};

// Computed result = 0 (Triglycerides=550, Cholesterol=150 -> LDL = 550/5 + 40 - 150 = 0)
const resLdlZero = GenericReportResolver.resolveReport({ definition: hdlLdlDef, rawInputs: { CHOLESTEROL: "150", TRIGLYCERIDES: "550" } }).find((r) => r.parameterCode === "LDL")!;
assert(resLdlZero.isValid === false, `StrictPositive computed result = 0 must set isValid = false`);
assert(resLdlZero.formattedResultValue === "", `StrictPositive computed result = 0 must produce blank formatted result ""`);
assert(resLdlZero.evaluationOutcome === "Invalid", `StrictPositive computed result = 0 must have outcome "Invalid"`);

// Computed result < 0 (Triglycerides=100, Cholesterol=150 -> LDL = -90)
const resLdlNeg = GenericReportResolver.resolveReport({ definition: hdlLdlDef, rawInputs: { CHOLESTEROL: "150", TRIGLYCERIDES: "100" } }).find((r) => r.parameterCode === "LDL")!;
assert(resLdlNeg.isValid === false, `StrictPositive computed result < 0 must set isValid = false`);
assert(resLdlNeg.formattedResultValue === "", `StrictPositive computed result < 0 must produce blank formatted result ""`);

// Computed result > 0 (Triglycerides=700, Cholesterol=150 -> LDL = 30)
const resLdlPos = GenericReportResolver.resolveReport({ definition: hdlLdlDef, rawInputs: { CHOLESTEROL: "150", TRIGLYCERIDES: "700" } }).find((r) => r.parameterCode === "LDL")!;
assert(resLdlPos.isValid === true, `StrictPositive computed result > 0 must be accepted`);
assert(resLdlPos.formattedResultValue === "30.00", `StrictPositive computed result > 0 produces "30.00"`);


// ---------------------------------------------------------------------------
// Test 3: AnyFinite Computed Result Validation (0 -> accepted, negative -> accepted) [Architecture Test]
// ---------------------------------------------------------------------------
console.log("\n--- Test 3: AnyFinite Computed Result Validation (Architecture Test) ---");

const anyFiniteDef: ClinicalReportDefinition = {
  templateCode: "ANY_FINITE_TEST",
  templateTitle: "Any Finite Architecture Test",
  examinationFamily: "Clinical Chemistry",
  rendererFamily: "Tabular",
  requestedByPolicy: { isEditable: true, isRequired: true },
  statusPolicy: { demographicCollection: false, type: "Omitted" },
  requiresKitInfo: false,
  supportsRemarks: true,
  parameters: [
    { parameterCode: "CHOLESTEROL", parameterName: "Cholesterol", inputType: "NumericText", isRequired: true, isSelectable: true, displayOrder: 1, evaluationPolicy: validEntryOnly() },
    { parameterCode: "TRIGLYCERIDES", parameterName: "Triglycerides", inputType: "NumericText", isRequired: true, isSelectable: true, displayOrder: 2, evaluationPolicy: validEntryOnly() },
    {
      parameterCode: "LDL_ANY_FINITE",
      parameterName: "LDL Any Finite",
      inputType: "Computed",
      isRequired: true,
      isSelectable: true,
      displayOrder: 3,
      evaluationPolicy: validEntryOnly(),
      formulaBinding: {
        formulaId: "ldl-client-formula",
        dependencies: ["TRIGLYCERIDES", "CHOLESTEROL"],
        precision: 2,
        dependencyValidationPolicy: "StrictPositive",
        resultValidationPolicy: "AnyFinite", // Declarative policy allowing any finite value
      },
    },
  ],
};

// AnyFinite result = 0 (Triglycerides=550, Cholesterol=150)
const anyFiniteZero = GenericReportResolver.resolveReport({ definition: anyFiniteDef, rawInputs: { CHOLESTEROL: "150", TRIGLYCERIDES: "550" } }).find((r) => r.parameterCode === "LDL_ANY_FINITE")!;
assert(anyFiniteZero.isValid === true, `AnyFinite computed result = 0 must be accepted`);
assert(anyFiniteZero.formattedResultValue === "0.00", `AnyFinite computed result = 0 formats to "0.00"`);

// AnyFinite result < 0 (Triglycerides=100, Cholesterol=150 -> LDL = -90)
const anyFiniteNeg = GenericReportResolver.resolveReport({ definition: anyFiniteDef, rawInputs: { CHOLESTEROL: "150", TRIGLYCERIDES: "100" } }).find((r) => r.parameterCode === "LDL_ANY_FINITE")!;
assert(anyFiniteNeg.isValid === true, `AnyFinite computed result < 0 must be accepted`);
assert(anyFiniteNeg.formattedResultValue === "-90.00", `AnyFinite computed result < 0 formats to "-90.00"`);


// ---------------------------------------------------------------------------
// Test 4: Unrounded HDL feeding LDL Formula
// ---------------------------------------------------------------------------
console.log("\n--- Test 4: Unrounded HDL Intermediate in LDL ---");
const hdlUnrounded = calculateHdl(155); // 155 * 40 / 150 = 41.333333333333336
assert(hdlUnrounded !== 41.33, `Unrounded HDL in memory is exact float 41.333333333333336`);

const ldlUnrounded = calculateLdl(700, hdlUnrounded, 155); // 700/5 + 41.333333333333336 - 155 = 26.333333333333336
const expectedUnroundedLdl = 140 + (155 * 40 / 150) - 155;
assert(ldlUnrounded === expectedUnroundedLdl, `LDL evaluates using exact unrounded HDL intermediate`);

const validResolverResult = GenericReportResolver.resolveReport({
  definition: hdlLdlDef,
  rawInputs: { CHOLESTEROL: "155", TRIGLYCERIDES: "700" },
});
const ldlValid = validResolverResult.find((r) => r.parameterCode === "LDL")!;
assert(ldlValid.formattedResultValue === "26.33", `GenericReportResolver formats computed LDL to 2 decimals half-up: "26.33"`);
assert(ldlValid.rawResultValue === String(expectedUnroundedLdl), `GenericReportResolver stores unrounded string in rawResultValue`);


// ---------------------------------------------------------------------------
// Test 5: No Triglyceride Cutoff
// ---------------------------------------------------------------------------
console.log("\n--- Test 5: No Triglyceride Cutoff ---");
const highTriglyceridesResult = GenericReportResolver.resolveReport({
  definition: hdlLdlDef,
  rawInputs: { CHOLESTEROL: "150", TRIGLYCERIDES: "900" },
});
const ldlHighTrig = highTriglyceridesResult.find((r) => r.parameterCode === "LDL")!;
assert(ldlHighTrig.isValid === true, `High Triglycerides (900 mg/dL) calculates cleanly without a cutoff`);
assert(ldlHighTrig.formattedResultValue === "70.00", `High Triglycerides computed LDL formatted as "70.00"`);


// ---------------------------------------------------------------------------
// Test 6: Legacy Result Backward Compatibility
// ---------------------------------------------------------------------------
console.log("\n--- Test 6: Legacy Result Backward Compatibility ---");
const legacyResult: ILaboratoryResult = {
  id: "res-legacy-1",
  reportId: "rep-1",
  parameterCode: "CHOLESTEROL",
  parameterName: "Cholesterol",
  resultValue: "180 mg/dL",
  evaluationOutcome: "Normal",
  displayOrder: 1,
};
assert(getResultDisplayValue(legacyResult) === "180 mg/dL", `getResultDisplayValue reads legacy resultValue`);

const newResult: ILaboratoryResult = {
  id: "res-new-1",
  reportId: "rep-1",
  parameterCode: "HDL",
  parameterName: "HDL",
  resultValue: "40.00",
  rawResultValue: "40",
  formattedResultValue: "40.00",
  evaluationOutcome: "Normal",
  computationMetadata: { formulaId: "hdl-client-formula" },
  displayOrder: 2,
};
assert(getResultDisplayValue(newResult) === "40.00", `getResultDisplayValue reads formattedResultValue when present`);

console.log("\n=== ALL B1 VERIFICATION TESTS PASSED SUCCESSFULLY ===");
