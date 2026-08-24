# CHEM_10

> **Specification Status**
>
> Draft
>
> This document is the authoritative behavioral specification for the Chemistry 10 laboratory report.
>
> The official Microsoft Word template remains the visual authority.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | CHEM_10 |
| Official Template Name | Chemistry 10 |
| Examination Family | Clinical Chemistry |
| Renderer Family | Tabular |
| Source Word Template | Templates/CHEM_10.docx |
| Supports Remarks | Yes |
| Requires Kit Information | No |

---

# 2. Purpose

Records Chemistry 10 laboratory examination results using the official St. Rose Clinical Chemistry report.

---

# 3. Patient Demographics

| Field | Required | Behavior |
|--------|----------|----------|
| Name | Yes | Printed |
| Age | Yes | Printed |
| Sex | Yes | Dropdown |
| Date | Yes | Current date by default; editable |
| Address | Yes | Default value; editable |
| Requested By | Yes | Default physician; editable |
| Status | Optional | Printed |

---

# 4. Laboratory Parameters

Display order MUST remain exactly:

1. FBS
2. Cholesterol
3. Triglycerides
4. HDL
5. LDL
6. Uric Acid
7. SGPT/ALT
8. SGOT/AST
9. BUN
10. Creatinine

---

# 5. Input Types

| Parameter | Input Type |
|-----------|------------|
| FBS | NumericText |
| Cholesterol | NumericText |
| Triglycerides | NumericText |
| HDL | Computed (Auto default; supports Manual entry mode) |
| LDL | Computed (Auto default; supports Manual entry mode) |
| Uric Acid | NumericText |
| SGPT/ALT | NumericText |
| SGOT/AST | NumericText |
| BUN | NumericText |
| Creatinine | NumericText |
| Remarks | FreeText |

---

# 6. Reference Values

## FBS

70–110 mg/dL

---

## Cholesterol

< 200 mg/dL

---

## Triglycerides

35–165 mg/dL

---

## HDL

0–110 mg/dL

---

## LDL

<150 mg/dL

---

## Uric Acid

Female

2.4–5.7 mg/dL

Male

3.4–7.0 mg/dL

---

## SGPT/ALT

4–41 IU/L

---

## SGOT/AST

4–41 IU/L

---

## BUN

10–45 mg/dL

---

## Creatinine

0.4–1.4 mg/dL

---

# 7. Computations

## LDL Calculation

The official client instruction states:

> "Yung HDL and LDL nacocompute lang yung result."

Formula (corrected under DEC-028 / ADR-009):

```
LDL = Total Cholesterol − active HDL − (Triglycerides ÷ 5)
```

> The source template recorded the operand order as
> `LDL = Triglycerides ÷ 5 + HDL − Cholesterol`. That order was verified against CDC and
> NHLBI / Philippine Heart Association references and corrected under DEC-028 / ADR-009.

### Inputs

- Triglycerides
- HDL (the active HDL: calculated while HDL is Auto, entered while HDL is Manual)
- Cholesterol

### Output

- LDL

### Behavior

- LDL is automatically computed while it is in Auto mode.
- LDL remains read-only while Auto.
- The operator may switch LDL to Manual and enter the result directly.

---

## Calculation Mode

Both HDL and LDL default to **Auto** and may be switched to **Manual** by the operator, independently
of one another.

- **HDL Auto** applies the client-defined calculation `Cholesterol × 40 ÷ 150`. Its provenance is
  recorded as **Client Formula**. HDL is read-only while Auto.
- **HDL Manual** is a directly operator-entered HDL result. Its persisted provenance
  value is **Manual**, and a Manual result carries no formula metadata. The entered value may have
  come from a direct measurement, but the system neither requires that nor records it as the
  provenance.
- **LDL Auto** applies `LDL = Total Cholesterol − active HDL − (Triglycerides ÷ 5)`, where the *active HDL* is
  the calculated HDL while HDL is Auto, and the operator-entered HDL while HDL is Manual.
- **LDL Manual** is a directly operator-entered LDL result. Its persisted provenance
  value is **Manual**, and a Manual result carries no formula metadata. The entered value may have
  come from a direct measurement, but the system neither requires that nor records it as the
  provenance.
- Switching Auto → Manual clears the calculated value immediately. A calculated value is never
  carried over or presented as a measured one.
- Switching Manual → Auto is confirmed first, then discards the manual value and recalculates.
- A Manual value is never overwritten by recalculation while Manual remains active.
- Manual HDL and LDL accept only a finite value greater than 0. A valid value outside the reference
  range remains a real High or Low finding, not a validation error.
- Reference ranges, units and clinical thresholds are unchanged by calculation mode.

## Applicability Limitation

- The standard Friedewald calculation uses directly **measured** Total Cholesterol, Triglycerides and
  HDL.
- Its documented use is for Triglycerides **below 400 mg/dL**.
- The current client-approved application intentionally retains **no automatic triglyceride cutoff**.
- **Manual LDL** is the available operator path when automatic calculation is inappropriate.
- **LDL Auto using client-calculated Auto HDL is a client-defined composite calculation and must not
  be described as standard Friedewald.**
- LDL Auto using a manually entered or measured HDL follows the standard-input equation, subject to
  its applicability limitations.

Supporting source: CDC NHANES triglyceride documentation
<https://wwwn.cdc.gov/nchs/data/nhanes/public/2017/datafiles/p_trigly.htm>

See `DECISIONS.md` DEC-028 and `ADR/ADR-009-Optional-Manual-Override-and-LDL-Calculation.md`.

# 8. Default UI Values

| Field | Default | Editable |
|--------|----------|----------|
| Address | STA. ROSA, NUEVA ECIJA | Yes |
| Requested By | Dr. Heinz Roland Asperas | Yes |
| Remarks | TEST/S RECHECKED; RESULT/S VERIFIED | Yes |
| Date | Current Date | Yes |
| Sex | None | Required |

---

# 9. Dropdown Values

## Sex

- Male
- Female

---

## Requested By

Default

- Dr. Heinz Roland Asperas

Editable to another physician.

---

# 10. Validation Rules

- All Chemistry 10 parameters are required.
- HDL calculates automatically and remains read-only while HDL is in Auto.
- LDL calculates automatically and remains read-only while LDL is in Auto.
- HDL becomes operator-entered only while HDL is in Manual; LDL becomes operator-entered only
  while LDL is in Manual.
- A Manual HDL value and a Manual LDL value must each be finite and strictly greater than 0.
- A positive Manual value outside its reference range remains a valid clinical Low/High outcome
  under the existing evaluation rules.
- Only numeric values are accepted.
- Remarks remain editable.
- Requested By remains editable.
- Address remains editable.
- Date remains editable.

---

# 11. Remarks

Supports remarks.

Default value:

TEST/S RECHECKED; RESULT/S VERIFIED

The default remarks MUST automatically populate but remain editable.

---

# 12. Reagent Kit Information

Not required.

---

# 13. Signatories

| Role | Quantity |
|------|----------|
| Pathologist | 1 |
| Medical Technologist | 1 |

Display Order

Left

- Pathologist

Right

- Medical Technologist

---

# 14. Conditional Rules

- HDL is automatically calculated from Cholesterol while HDL is in Auto mode.
- LDL is automatically calculated after required inputs are available while LDL is in Auto mode.
- Manual editing of HDL is permitted only after the operator switches HDL to Manual.
- Manual editing of LDL is permitted only after the operator switches LDL to Manual.

---

# 15. Rendering Rules

Renderer Family

Tabular

Characteristics

- Single A4 page
- Portrait orientation
- Clinical Chemistry table layout
- Reference values displayed
- Remarks section displayed
- Signature block displayed

---

# 16. Preview / Print / PDF Contract

Preview, Browser Print, and PDF MUST produce identical output.

---

# 17. Client Notes

### Automatic Calculation

> "Yung HDL and LDL nacocompute lang yung result."

Corrected operative formula approved under DEC-028 and ADR-009. The historical source formula is
quoted separately below for traceability; this operand order was not supplied in that form by the
clinic:

```
LDL = Total Cholesterol − active HDL − (Triglycerides ÷ 5)
```

> The source template recorded the operand order as
> `LDL = Triglycerides ÷ 5 + HDL − Cholesterol`. That order was verified against CDC and
> NHLBI / Philippine Heart Association references and corrected under DEC-028 / ADR-009.

---

### Requested By

Default physician:

Dr. Heinz Roland Asperas

User may edit and replace with another physician.

---

### Abbreviations

FBS = Fasting Blood Sugar

BUN = Blood Urea Nitrogen

---

# 18. Engineering Notes

- HDL and LDL are formula-bound Computed parameters.
- Both default to Auto mode and both support operator-selected Manual mode.
- All other result parameters remain operator-entered according to their existing specifications.
- Default values are convenience values only.
- Reference values are printed exactly as shown.

---

# 19. AI Implementation Rules

AI MUST

- Preserve parameter order.
- Preserve reference values.
- Automatically compute HDL and LDL while each is in Auto mode.
- Keep each of HDL and LDL read-only while it is in Auto mode, and editable only after the
  operator switches that parameter to Manual mode.
- Allow the operator to switch either parameter back to Auto, which recalculates it.
- Auto-populate default Address.
- Auto-populate default Requested By.
- Auto-populate default Remarks.
- Allow editing of default values; direct entry of HDL or LDL is permitted only once the
  operator has switched that parameter to Manual mode.
- Preserve the official Word layout.

AI MUST NOT

- Allow direct entry of HDL or LDL while that parameter remains in Auto mode.
- Introduce additional computations.
- Modify approved formula.
- Modify reference values.

---

# 20. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Layout | Word Template |
| Reference Values | Word Template |
| Historical/source LDL formula wording | Client Word Comment |
| Corrected operative LDL formula and calculation-mode policy | DEC-028 / ADR-009 |
| Default Physician | Client Word Comment |
| Remarks | Word Template |
| Renderer Family | REPORT_REGISTRY_ARCHITECTURE.md |

---

# 21. Open Questions

None.

---

# 22. Validation Checklist

- [x] Parameters verified
- [x] Reference values verified
- [x] Client comments preserved
- [x] Computation documented
- [x] Default values documented
- [x] Rendering documented
- [ ] Reviewed
- [ ] Frozen

---

# 23. Revision History

| Version | Date | Notes |
|----------|------|------|
| 1.0 | Initial Draft | Reverse engineered from official Word template |
| 1.1 | DEC-028 / ADR-009 | LDL operand order corrected to `LDL = Total Cholesterol − active HDL − (Triglycerides ÷ 5)`; independent Auto/Manual calculation modes for formula-bound HDL and LDL; formula-source attribution corrected to separate the historical client wording from the approved operative contract |
