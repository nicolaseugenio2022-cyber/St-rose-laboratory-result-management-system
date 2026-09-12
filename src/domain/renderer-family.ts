import type { RendererFamily } from "@/domain/types";

/**
 * The one mapping from a DECLARED renderer family to the PERSISTED one.
 *
 * WHY IT EXISTS. `ClinicalReportDefinition.rendererFamily` is typed `string`, so a definition may
 * declare a spelling the persisted `RendererFamily` union does not carry - `HIV_RESULT` declares
 * "Dedicated Certificate" while the database CHECK constraint and every stored row say
 * "NarrativeCertificate". Both resolve to the same rendered layout, so the difference is purely a
 * spelling, and it is reconciled here rather than at each boundary that has to cross it.
 *
 * FAIL CLOSED. An unrecognised declaration is a definition defect, not a validation failure: a
 * report frozen with a family no renderer can resolve would complete and then be unrenderable,
 * which is exactly the defect this module exists to prevent. It is therefore raised loudly instead
 * of being defaulted to anything.
 */
const PERSISTED_RENDERER_FAMILIES: Readonly<Record<string, RendererFamily>> = {
  Tabular: "Tabular",
  SimpleResult: "SimpleResult",
  DiagnosticGrid: "DiagnosticGrid",
  NarrativeCertificate: "NarrativeCertificate",
  "Dedicated Certificate": "NarrativeCertificate",
};

export function persistedRendererFamily(declaredRendererFamily: string): RendererFamily {
  const family = PERSISTED_RENDERER_FAMILIES[declaredRendererFamily];
  if (!family) {
    throw new Error(`Unsupported declared renderer family '${declaredRendererFamily}'.`);
  }
  return family;
}
