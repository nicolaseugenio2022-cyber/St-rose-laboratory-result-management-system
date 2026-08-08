# CBC

> **Specification Status**
>
> Draft
>
> This document is the authoritative behavioral specification for the Complete Blood Count (CBC) laboratory report.
>
> The official Microsoft Word template remains the visual authority.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | CBC |
| Official Template Name | Complete Blood Count |
| Examination Family | Hematology |
| Renderer Family | Tabular |
| Source Word Template | Templates/CBC.docx |
| Supports Remarks | Yes |
| Requires Kit Information | No |

---

# 2. Purpose

Records Complete Blood Count (CBC) laboratory examination results using the official St. Rose tabular hematology report.

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

1. Hemoglobin
2. Hematocrit
3. RBC Count
4. WBC Count
5. Platelet Count
6. Differential Count
   - Neutrophil
   - Lymphocyte
   - Eosinophil
   - Monocyte
   - Basophil

---

# 5. Input Types

All laboratory parameters use:

- NumericText

Remarks:

- FreeText

---

# 6. Reference Values

## Hemoglobin

Male

130–160 g/L

Female

120–140 g/L

---

## Hematocrit

Male

0.40–0.52

Female

0.37–0.42

---

## RBC Count

Male

4.5–6.0 ×10¹²/L

Female

4.0–5.5 ×10¹²/L

---

## WBC Count

5.0–10.0 ×10⁹/L

---

## Platelet Count

150–450 ×10⁹/L

---

## Differential Count

Neutrophil

0.50–0.70

Lymphocyte

0.25–0.40

Eosinophil

0.01–0.04

Monocyte

0.03–0.08

Basophil

0.00–0.01

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

- All CBC parameters are required.
- Only numeric values are accepted.
- Remarks remain editable.
- Requested By remains editable.
- Date remains editable.
- Address remains editable.

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
- CBC parameter table
- Reference values shown
- Remarks section displayed
- Signature block displayed

---

# 16. Preview / Print / PDF Contract

Preview, Browser Print, and PDF MUST produce identical output.

---

# 17. Client Notes

The following client instructions originate from the official Word template.

### General

- Sex uses a dropdown.
- Date supports calendar selection or manual typing.
- Address automatically defaults to **STA. ROSA, NUEVA ECIJA** but remains editable.
- Requested By defaults to **Dr. Ralph Roland Asperas** but remains editable.
- Additional physician:
  - Dr. Heinz Roland Asperas

### CBC Specific

Requested By automatically defaults to:

Dr. Ralph Roland Asperas

The user may change the physician if needed.

### Remarks

Automatically populate:

TEST/S RECHECKED; RESULT/S VERIFIED

The user may edit the remarks.

### Visual Note

Use a font style consistent with the other laboratory reports.

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
| Client Notes | Word Template |
| Default Physician | Word Template |
| Default Remarks | Word Template |
| Renderer Family | REPORT_REGISTRY_ARCHITECTURE.md |

---

# 21. Open Questions

None.

---

# 22. Validation Checklist

- [x] Parameters verified
- [x] Reference values verified
- [x] Client comments preserved
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
