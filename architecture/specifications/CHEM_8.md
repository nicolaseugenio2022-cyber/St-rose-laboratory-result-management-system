# CHEM_8

> **Specification Status**
>
> Draft
>
> This document is the authoritative behavioral specification for the Chemistry 8 laboratory report.
>
> The official Microsoft Word template remains the visual authority.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | CHEM_8 |
| Official Template Name | Chemistry 8 |
| Examination Family | Clinical Chemistry |
| Renderer Family | Tabular |
| Source Word Template | Templates/CHEM_8.docx |
| Supports Remarks | Yes |
| Requires Kit Information | No |

---

# 2. Purpose

Records Chemistry 8 laboratory examination results using the official St. Rose Clinical Chemistry report.

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
4. Uric Acid
5. SGPT
6. Creatinine

---

# 5. Input Types

All laboratory parameters use:

- NumericText

Remarks:

- FreeText

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

## Uric Acid

Female

2.4–5.7 mg/dL

Male

3.4–7.0 mg/dL

---

## SGPT

4–41 IU/L

---

## Creatinine

0.4–1.4 mg/dL

---

# 7. Computations

None.

No client-approved automatic computations exist.

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

- All Chemistry 8 parameters are required.
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

None.

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

No additional client-specific behavioral comments are present in this template.

The following default application behaviors still apply:

- Sex uses a dropdown.
- Date supports calendar selection or manual typing.
- Address automatically defaults to **STA. ROSA, NUEVA ECIJA** but remains editable.
- Requested By defaults to **Dr. Ralph Roland Asperas** but remains editable.
- Default remarks automatically populate but remain editable.

---

# 18. Engineering Notes

- No automatic laboratory computations.
- Default values are convenience values only.
- Default values never lock the field.
- Reference values are printed exactly as shown.

---

# 19. AI Implementation Rules

AI MUST

- Preserve parameter order.
- Preserve reference values.
- Auto-populate default Address.
- Auto-populate default Requested By.
- Auto-populate default Remarks.
- Allow editing of all default values.
- Preserve the official Word layout.

AI MUST NOT

- Introduce new parameters.
- Introduce automatic computations.
- Modify reference values.
- Hardcode physician names outside configured defaults.

---

# 20. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Layout | Word Template |
| Reference Values | Word Template |
| Default Remarks | Word Template |
| Renderer Family | REPORT_REGISTRY_ARCHITECTURE.md |
| Examination Family | REPORT_REGISTRY_ARCHITECTURE.md |

---

# 21. Open Questions

None.

---

# 22. Validation Checklist

- [x] Parameters verified
- [x] Reference values verified
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