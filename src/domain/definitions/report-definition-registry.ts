/**
 * Clinical Report Definition Registry (Phase B Architecture)
 *
 * Central registry mapping report codes to declarative ClinicalReportDefinition objects
 * for all 17 supported clinical laboratory reports.
 */

import { ClinicalReportDefinition } from "@/domain/types/report-definition";
import {
  CHEM_8_DEFINITION,
  HDL_LDL_DEFINITION,
  CHEM_10_DEFINITION,
  RBS_DEFINITION,
  HBA1C_DEFINITION,
} from "./chemistry-definitions";
import {
  HBSAG_DEFINITION,
  RPR_DEFINITION,
  DENGUE_DUO_DEFINITION,
  PREG_TEST_DEFINITION,
  HIV_RESULT_DEFINITION,
} from "./serology-definitions";
import {
  CBC_DEFINITION,
  CT_BT_DEFINITION,
  ESR_DEFINITION,
} from "./hematology-definitions";
import {
  FECALYSIS_DEFINITION,
  URINALYSIS_DEFINITION,
} from "./microscopy-definitions";
import {
  BLOOD_TYPING_DEFINITION,
  OGTT_DEFINITION,
} from "./other-definitions";

const REPORT_DEFINITIONS: ReadonlyMap<string, ClinicalReportDefinition> = new Map([
  ["CHEM_8", CHEM_8_DEFINITION],
  ["HDL_LDL", HDL_LDL_DEFINITION],
  ["CHEM_10", CHEM_10_DEFINITION],
  ["RBS", RBS_DEFINITION],
  ["HBA1C", HBA1C_DEFINITION],
  ["HBSAG", HBSAG_DEFINITION],
  ["RPR", RPR_DEFINITION],
  ["DENGUE_DUO", DENGUE_DUO_DEFINITION],
  ["PREG_TEST", PREG_TEST_DEFINITION],
  ["HIV_RESULT", HIV_RESULT_DEFINITION],
  ["CBC", CBC_DEFINITION],
  ["BLOOD_TYPING", BLOOD_TYPING_DEFINITION],
  ["CT_BT", CT_BT_DEFINITION],
  ["ESR", ESR_DEFINITION],
  ["FECALYSIS", FECALYSIS_DEFINITION],
  ["OGTT", OGTT_DEFINITION],
  ["URINALYSIS", URINALYSIS_DEFINITION],
]);

export class ReportDefinitionRegistry {
  public static getDefinition(templateCode: string): ClinicalReportDefinition | null {
    return REPORT_DEFINITIONS.get(templateCode.toUpperCase()) || null;
  }

  public static hasDefinition(templateCode: string): boolean {
    return REPORT_DEFINITIONS.has(templateCode.toUpperCase());
  }

  public static getAllDefinitions(): ClinicalReportDefinition[] {
    return Array.from(REPORT_DEFINITIONS.values());
  }

  public static getRegisteredTemplateCodes(): string[] {
    return Array.from(REPORT_DEFINITIONS.keys());
  }
}
