# HDL_LDL

> **Specification Status**
>
> Draft
>
> This document is the authoritative behavioral specification for the Lipid Profile (HDL/LDL) laboratory report.
>
> The official Microsoft Word template remains the visual authority.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | HDL_LDL |
| Official Template Name | Lipid Profile Panel (HDL/LDL) |
| Examination Family | Clinical Chemistry |
| Renderer Family | Tabular |
| Source Word Template | Templates/HDL_LDL.docx |
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
| Status | Optional | Printed |

---

# 4. Laboratory Parameters

Display order MUST remain exactly:

1. Cholesterol
2. Triglycerides
3. HDL
4. LDL

---

# 5. Input Types

| Parameter | Input Type |
|-----------|------------|
| Cholesterol | NumericText |
| Triglycerides | NumericText |
| HDL | NumericText |
| LDL | Computed |
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

# 7. Computations

## LDL Calculation

The official client instruction states:

> "Yung HDL and LDL nacocompute lang yung result."

Formula documented in the template:

```
LDL = Triglycerides ÷ 5 + HDL − Cholesterol
```

### Inputs

- Triglycerides
- HDL
- Cholesterol

### Output

- LDL

### Behavior

- LDL is automatically computed.
- LDL remains read-only.
- Users do not manually encode LDL.

---

# 8. Default UI Values

| Field | Default | Editable |
|--------|----------|----------|
| Address | STA. ROSA, NUEVA ECIJA | Yes |
| Requested By | Dr. Ralph Roland Asperas | Yes |
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

- Dr. Ralph Roland Asperas

Available

- Dr. Ralph Roland Asperas
- Dr. Heinz Roland Asperas

---

# 10. Validation Rules

- All Lipid Profile parameters are required.
- LDL is computed automatically and read-only.
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

- LDL is automatically calculated after required inputs are available.
- Manual editing of LDL is not permitted.

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

Formula provided:

```
LDL = Triglycerides ÷ 5 + HDL − Cholesterol
```

---

# 18. Engineering Notes

- LDL is the only computed parameter.
- All remaining parameters are manually encoded.
- Default values are convenience values only.
- Reference values are printed exactly as shown.

---

# 19. AI Implementation Rules

AI MUST

- Preserve parameter order.
- Preserve reference values.
- Automatically compute LDL.
- Keep LDL read-only.
- Auto-populate default Address.
- Auto-populate default Requested By.
- Auto-populate default Remarks.
- Allow editing of default values except LDL.
- Preserve the official Word layout.

AI MUST NOT

- Allow manual LDL encoding.
- Introduce additional computations.
- Modify approved formula.
- Modify reference values.

---

# 20. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Layout | Word Template |
| Reference Values | Word Template |
| LDL Formula | Client Word Comment |
| Default Remarks | Word Template |
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
