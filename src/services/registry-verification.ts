import { ReportRegistryService } from "./report-registry-service";
import { ReferenceEvaluationService } from "./reference-evaluation-service";

/**
 * Phase 2 Report Registry Verification Script
 * Validates metadata hydration, 17 templates coverage, renderer families, and evaluation outcomes.
 */
export async function verifyReportRegistryPhase2(): Promise<{
  totalTemplatesCount: number;
  all17TemplatesSupported: boolean;
  hivSignatoriesCorrect: boolean;
  referenceEvaluationValid: boolean;
  rendererFamilyCounts: Record<string, number>;
}> {
  const registryService = new ReportRegistryService();
  const evaluator = new ReferenceEvaluationService();

  const activeTemplates = await registryService.getAllActiveTemplates();
  const totalTemplatesCount = activeTemplates.length;

  const confirmedCodes = [
    "BLOOD_TYPING", "CBC", "CHEM_8", "CHEM_10", "CT_BT", "DENGUE_DUO", 
    "ESR", "FECALYSIS", "HBA1C", "HDL_LDL", "HIV_RESULT", "OGTT", 
    "PREG_TEST", "RBS", "RPR", "URINALYSIS", "HBSAG"
  ];

  const presentCodes = activeTemplates.map((t) => t.templateCode);
  const all17TemplatesSupported = confirmedCodes.every((code) => presentCodes.includes(code));

  // Verify HIV signatories requirement (1 Pathologist + 2 MedTechs)
  const hivSpec = await registryService.getTemplateByCode("HIV_RESULT");
  const hivSignatoriesCorrect = 
    hivSpec !== null && 
    hivSpec.signatoryRequirement.requiredPathologistsCount === 1 && 
    hivSpec.signatoryRequirement.requiredMedtechsCount === 2;

  // Verify Reference Evaluator for numeric range and expected values
  const numericEval = evaluator.evaluateResult("140", { evaluationType: "NumericRange", minValue: 120, maxValue: 160 });
  const expectedEval = evaluator.evaluateResult("NON-REACTIVE", { evaluationType: "ExpectedValue", expectedValue: "NON-REACTIVE" });
  const referenceEvaluationValid = numericEval === "Normal" && expectedEval === "Normal";

  // Calculate renderer family distribution
  const rendererFamilyCounts: Record<string, number> = {};
  for (const t of activeTemplates) {
    rendererFamilyCounts[t.rendererFamily] = (rendererFamilyCounts[t.rendererFamily] || 0) + 1;
  }

  return {
    totalTemplatesCount,
    all17TemplatesSupported,
    hivSignatoriesCorrect,
    referenceEvaluationValid,
    rendererFamilyCounts,
  };
}
