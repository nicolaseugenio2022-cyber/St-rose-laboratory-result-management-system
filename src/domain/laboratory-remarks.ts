/**
 * The laboratory's standing remark, and the one rule for applying it.
 *
 * Every examination this laboratory issues carries the same closing statement. It was previously
 * declared on CBC alone, as a literal inside one report definition, so sixteen other reports went
 * out with an empty REMARKS band. Stating it once here is what makes it a laboratory policy rather
 * than a property of one report.
 *
 * ## What "default" means here, precisely
 *
 * It is a starting value applied once, when a report is created, and never a rewrite:
 *
 *   - a report definition that declares its own `defaultRemarks` keeps it - the definition is more
 *     specific than the laboratory default and outranks it;
 *   - a remark the operator has typed is preserved exactly, including its spacing and casing;
 *   - the text is SUBSTITUTED for a blank at creation, never appended, so it cannot appear twice;
 *   - a remark the operator clears stays cleared. Encoding, Live Preview, completion, Print and PDF
 *     all show the stored value, blank included; nothing re-derives the default at display time;
 *   - a completed report renders the remark frozen into its own snapshot and is never restated by
 *     this rule. What a report said when it was issued is what it keeps saying.
 *
 * There is deliberately no display-time variant of this rule. A render-time substitution for a
 * blank made Live Preview disagree with the completed report, because completion freezes the
 * stored value, and silently restored a remark the operator had cleared.
 */
export const DEFAULT_LABORATORY_REMARK = "TEST/S RECHECKED; RESULT/S VERIFIED";

/**
 * The remark a newly created report starts with: the definition's own text when it declares one,
 * and the laboratory default otherwise. Whitespace-only is treated as absent - a definition
 * declaring `""` is declaring nothing, not declaring emptiness.
 */
export function initialLaboratoryRemarks(definitionDefaultRemarks: string | null | undefined): string {
  const declared = definitionDefaultRemarks?.trim();
  return declared ? definitionDefaultRemarks!.trim() : DEFAULT_LABORATORY_REMARK;
}
