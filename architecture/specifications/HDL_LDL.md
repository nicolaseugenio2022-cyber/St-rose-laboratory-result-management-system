# HDL_LDL

> **Specification Status**
>
> Maintained detailed specification. Authority is separated by concern:
> `architecture/report-specifications/Summary.md` governs the client requirements it explicitly
> records; this document governs the detail where `Summary.md` is silent. See
> `architecture/README.md`.
>
> This document is the authoritative behavioral specification for the Lipid Profile (HDL/LDL) laboratory report.
>
> The original Microsoft Word templates are **historical source material** and are not present in
> the repository. Current visual authority is separated across `Summary.md` (explicit client
> acceptance requirements), this specification, `REPORT_RENDERING_ARCHITECTURE.md`,
> `PDF_VALIDATION_CHECKLIST.md`, and the approved deterministic rendering contracts and
> completed snapshots.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | HDL_LDL |
| Official Template Name | Lipid Profile Panel (HDL/LDL) |
| Examination Family | Clinical Chemistry |
| Renderer Family | Tabular |
| Source Word Template (historical; not in repository) | Templates/HDL_LDL.docx |
| Supports Remarks | Yes |
| Requires Kit Information | No |

---

# 2. Purpose

Records Lipid Profile (HDL/LDL) laboratory examination results using the official St. Rose Clinical Chemistry report.

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
| Status | Not collected | Omitted; not collected in the encoding UI |

---

# 4. Laboratory Parameters

Display order MUST remain exactly:

1. FBS
2. Cholesterol
3. Triglycerides
4. HDL
5. LDL
6. Uric Acid
7. SGPT
8. Creatinine

---

# 5. Input Types

| Parameter | Input Type |
|-----------|------------|
| Cholesterol | NumericText |
| Triglycerides | NumericText |
| HDL | Computed (Auto default; supports Manual entry mode) |
| LDL | Computed (Auto default; supports Manual entry mode) |
| Remarks | FreeText |

---

# 6. Reference Values

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

< 150 mg/dL

---

## FBS, Uric Acid, SGPT, Creatinine

These four are the shared clinical-chemistry parameters. Their reference values are the same as
documented in `CHEM_10.md` §6 and are not restated here.

---

# 7. Computations

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

## LDL Calculation

The official client instruction states:

> "Yung HDL and LDL nacocompute lang yung result."

Corrected operative formula approved under DEC-028 and ADR-009 (this operand order was not the
one recorded in the historical template, and was not supplied in this form by the clinic):

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

# 8. Default UI Values

| Field | Default | Editable |
|--------|----------|----------|
| Address | STA. ROSA, NUEVA ECIJA | Yes |
| Requested By | Dr. Heinz Roland Asperas | Yes |
| Remarks | (no default) | Yes |
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

Available

- Dr. Ralph Roland Asperas
- Dr. Heinz Roland Asperas

---

# 10. Validation Rules

- All Lipid Profile parameters are required.
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
- Tabular clinical chemistry layout
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

Corrected operative formula approved under DEC-028 and ADR-009 (not the operand order originally
provided by the clinic):

```
LDL = Total Cholesterol − active HDL − (Triglycerides ÷ 5)
```

> Operand order corrected under DEC-028 / ADR-009; the source template recorded
> `LDL = Triglycerides ÷ 5 + HDL − Cholesterol`.

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
- Preserve the approved report layout recorded in this specification and `REPORT_RENDERING_ARCHITECTURE.md`.

AI MUST NOT

- Allow direct entry of HDL or LDL while that parameter remains in Auto mode.
- Introduce additional computations.
- Modify approved formula.
- Modify reference values.

---

# 20. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Layout | This specification — historical origin: Word template, not in repository |
| Reference Values | This specification — historical origin: Word template, not in repository |
| Historical/source LDL formula wording | Client Word Comment |
| Corrected operative LDL formula and calculation-mode policy | DEC-028 / ADR-009 |
| Default Remarks | This specification — historical origin: Word template, not in repository |
| Renderer Family | REPORT_REGISTRY_ARCHITECTURE.md |

---

# 21. Open Questions

None.

---

# 22. Validation Checklist

- [x] Parameters verified
- [x] Reference values verified
- [x] Computation documented
- [x] Default values documented
- [x] Remarks documented
- [x] Rendering documented
- [ ] Reviewed
- [ ] Frozen

---

# 23. Revision History

| Version | Date | Notes |
|----------|------|------|
| 1.0 | Initial Draft | Reverse engineered from official Word template |
| 1.1 | DEC-028 / ADR-009 | LDL operand order corrected to `LDL = Total Cholesterol − active HDL − (Triglycerides ÷ 5)`; independent Auto/Manual calculation modes for formula-bound HDL and LDL; formula-source attribution corrected to separate the historical client wording from the approved operative contract |
| 1.2 | SHADCN-06D | Reconciled to verified runtime (`src/domain/definitions/`): Status demographic policy; removed unset TEST/S RECHECKED default; parameter set 4 to 8; default physician Dr. Heinz Roland Asperas; visual-authority statement |
