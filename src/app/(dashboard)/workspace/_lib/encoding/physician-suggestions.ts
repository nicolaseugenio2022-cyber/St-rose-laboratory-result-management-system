import { ReportDefinitionRegistry } from "@/domain/definitions/report-definition-registry";

/**
 * The physicians every Requested By control offers, derived from the report definitions.
 *
 * `listAutoSuggestionsAction` learns physicians from what operators have actually typed, which
 * means a laboratory that has not yet completed a session offers nothing at all - the datalist
 * renders empty and the two doctors the practice actually requests from have to be typed in
 * full, every time, on every examination.
 *
 * The names are not introduced here. Every `ClinicalReportDefinition` already declares the
 * physician it defaults to in `requestedByPolicy.defaultPhysician`, and that set is exactly the
 * approved roster. Collecting it means the roster cannot drift from the definitions, and adding
 * a doctor to a definition adds them to every control's suggestions with no second list to keep
 * in step.
 *
 * This is a suggestion source only. The control stays a free-text combobox: the operator may
 * type any physician, and nothing here constrains, validates or rewrites what they enter.
 */
export function getDefinitionPhysicians(): string[] {
  const physicians = new Set<string>();
  for (const definition of ReportDefinitionRegistry.getAllDefinitions()) {
    const physician = definition.requestedByPolicy?.defaultPhysician?.trim();
    if (physician) physicians.add(physician);
  }
  return Array.from(physicians).sort((left, right) => left.localeCompare(right));
}

/**
 * The definition roster first, then anything learned from operator entries that is not already
 * in it. Case-insensitive de-duplication, so a learned "dr. ralph roland asperas" does not
 * appear a second time beside the definition's own spelling.
 */
export function mergePhysicianSuggestions(learned: readonly string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const candidate of [...getDefinitionPhysicians(), ...learned]) {
    const value = candidate?.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(value);
  }

  return merged;
}
