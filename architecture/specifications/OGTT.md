# OGTT

> **Specification Status**
>
> Draft
>
> This document is the authoritative behavioral specification for the Oral Glucose Tolerance Test (OGTT) laboratory report.
>
> The official Microsoft Word template remains the visual authority.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | OGTT |
| Official Template Name | Oral Glucose Tolerance Test |
| Examination Family | Clinical Chemistry |
| Renderer Family | Tabular |
| Source Word Template | Templates/OGTT.docx |
| Supports Remarks | No |
| Requires Kit Information | No |

---

# 2. Purpose

Records Oral Glucose Tolerance Test (OGTT) laboratory results at three collection intervals.

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

1. Fasting
2. 1st Hour
3. 2nd Hour

---

# 5. Input Types

| Parameter | Input Type |
|-----------|------------|
| Fasting | NumericText |
| 1st Hour | NumericText |
| 2nd Hour | NumericText |

---

# 6. Reference Values

## Fasting

<100 mg/dL

---

## 1st Hour

<200 mg/dL

---

## 2nd Hour

<140 mg/dL

---

# 7. Computations

None.

No client-approved automatic computations exist.

---

# 8. Default UI Values

| Field | Default | Editable |
|--------|----------|----------|
| Address | STA. ROSA, NUEVA ECIJA | Yes |
| Requested By | Dr. Heinz Roland Asperas | Yes |
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

- Fasting is required.
- 1st Hour is required.
- 2nd Hour is required.
- Numeric values only.
- Requested By remains editable.
- Address remains editable.
- Date remains editable.

---

# 11. Remarks

Not supported.

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
- Three-row OGTT table
- Green template theme
- Reference values displayed
- Signature block displayed

---

# 16. Preview / Print / PDF Contract

Preview, Browser Print, and PDF MUST produce identical output.

---

# 17. Client Notes

### Requested By

Automatically populate:

Dr. Heinz Roland Asperas

The user may edit and replace with another physician.

---

### New Layout

This specification represents the **new OGTT form**.

The renderer must reproduce this updated Word template instead of any previous OGTT layout.

---

### Reference Values

- Fasting: <100 mg/dL
- 1st Hour: <200 mg/dL
- 2nd Hour: <140 mg/dL

These values must appear exactly as printed in the official template.

---

# 18. Engineering Notes

- No automatic computations.
- Three timed glucose measurements.
- Default values are convenience values only.
- The updated green template replaces previous OGTT layouts.

---

# 19. AI Implementation Rules

AI MUST

- Preserve parameter order.
- Preserve reference values.
- Preserve the new OGTT layout.
- Auto-populate default Address.
- Auto-populate default Requested By.
- Allow editing of all default values.
- Preserve the official Word layout.

AI MUST NOT

- Introduce automatic computations.
- Modify reference values.
- Revert to the previous OGTT template.
- Introduce additional parameters.

---

# 20. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Layout | Official Word Template (New OGTT Form) |
| Reference Values | Word Template |
| Requested By | Word Template |
| Renderer Family | REPORT_REGISTRY_ARCHITECTURE.md |

---

# 21. Open Questions

None.

---

# 22. Validation Checklist

- [x] Parameters verified
- [x] Reference values verified
- [x] New template documented
- [x] Client comments preserved
- [x] Rendering documented
- [ ] Reviewed
- [ ] Frozen

---

# 23. Revision History

| Version | Date | Notes |
|----------|------|------|
| 2.0 | Updated | Reverse engineered from the new official OGTT Word template |