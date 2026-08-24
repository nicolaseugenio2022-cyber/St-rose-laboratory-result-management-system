# ADR-009: Optional Manual Override and Corrected LDL Calculation

- **Status**: Accepted
- **Author**: Master Developer Col / AI Pair Programmer
- **Date**: 2026-08-24
- **Context**: St. Rose Laboratory Result Management System – Clinical Chemistry computed-parameter calculation mode and LDL operand order
- **Related**: `DECISIONS.md` DEC-028, DEC-017, DEC-027; `ADR-008`; `specifications/CHEM_10.md`; `specifications/HDL_LDL.md`

---

## 1. Problem

Two defects were confirmed in the shipped Clinical Chemistry pipeline.

**The LDL operand order was inverted.** The implementation computed
`Triglycerides ÷ 5 + HDL − Cholesterol`, which is the exact arithmetic negation of the approved
equation. Every calculated LDL therefore carried the wrong sign, and the repository's own
validation-evidence documents already recorded the corrected equation, contradicting the
specifications they validated.

**The operator had no way to enter a measured result.** HDL and LDL were declared `Computed` and
read-only. Because the corrected equation is the negation of the old one, and LDL enforces a
`StrictPositive` result policy, correcting the sign alone would make every existing completed
`CHEM_10` / `HDL_LDL` session fail validation on a Replacement Mode reopen, with no operator remedy.

## 2. Decision

Introduce an explicit per-parameter **calculation mode** and correct the equation in the same
publication candidate.

- HDL and LDL default to **Auto**; each may be switched independently to **Manual**.
- Auto LDL uses `LDL = Total Cholesterol − active HDL − (Triglycerides ÷ 5)`.
- The **active HDL** is the client-calculated HDL while HDL is Auto, and the operator-entered HDL
  while HDL is Manual. Auto supplies its exact unrounded value, never a formatted display value.
- Manual eligibility is declared on the formula binding (`supportsManualEntry`), so having a formula
  binding is never on its own enough to make a parameter editable.
- Operator intent persists at `report.encodingData.calculationModes`; per-result provenance is
  derived by the resolver and completion into `computationMetadata`.

## 3. Why they ship together

An intermediate release of either half alone is unsafe.

- Modes without the formula correction would let an operator select **Manual HDL** while Auto LDL
  silently recomputed HDL from Cholesterol and ignored the entered value.
- The formula correction without modes would strand the entire existing completed lipid population,
  as described above.

## 4. Clinical labelling

The standard Friedewald calculation uses directly **measured** Total Cholesterol, Triglycerides and
HDL, and its documented use is for Triglycerides **below 400 mg/dL**.

- **LDL Auto over Auto HDL is a client-defined composite calculation** and must not be described as
  standard Friedewald, because the HDL it consumes is client-calculated rather than measured.
- LDL Auto over a manually entered or measured HDL follows the standard-input equation, subject to
  its applicability limitations.
- No authoritative support was found for `HDL = Cholesterol × 40 ÷ 150`. The client requires this
  automatic behaviour, so it is retained and labelled **Client Formula** rather than removed.
- No nationwide-standard or Philippine-standard claim is made anywhere in the product or its
  documentation.

Supporting source: <https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/datafiles/p_trigly.htm>

## 5. Triglyceride cutoff

The client-approved policy intentionally retains **no automatic triglyceride cutoff**, and this
change does not introduce or remove one. **Manual LDL** is the available operator path when
automatic calculation is inappropriate. Introducing a cutoff remains a separate clinical decision.

## 6. Consequences

- A Manual value is never overwritten while Manual remains active, and carries no `formulaId`,
  `formulaExpression`, `unroundedValue` or intermediate metadata implying it was calculated.
- Manual entries are held to the binding's existing `StrictPositive` result policy, so zero,
  negative, malformed and non-finite entries are rejected. A valid out-of-reference value remains a
  real High or Low finding.
- Reference ranges, units, sex-specific boundaries and clinical thresholds are unchanged.
- Historical completed snapshots are never recomputed or backfilled; they remain authoritative.
- No Supabase schema change: both carriers are existing JSONB columns.
- DEC-017 stands unchanged. It excludes *unapproved* formulas, and this computation is now
  explicitly approved.
