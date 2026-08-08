# RPR

> **Specification Status**
>
> Draft
>
> This document is the authoritative behavioral specification for the Syphilis / RPR (Screening) laboratory report.
>
> The official Microsoft Word template remains the visual authority.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | RPR |
| Official Template Name | Syphilis / RPR (Screening) |
| Examination Family | Serology & Immunology |
| Renderer Family | SimpleResult |
| Source Word Template | Templates/RPR.docx |
| Supports Remarks | No |
| Requires Kit Information | Yes |

---

# 2. Purpose

Records the qualitative Rapid Plasma Reagin (RPR) screening result for Syphilis.

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

1. Syphilis / RPR (Screening)

---

# 5. Input Types

| Parameter | Input Type |
|-----------|------------|
| Result | SingleSelect |

---

# 6. Reference Evaluation

Qualitative examination.

No numeric reference ranges.

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

Editable to another physician.

---

## Result

- Nonreactive
- Reactive

---

# 10. Validation Rules

- Result is required.
- Only approved dropdown values may be selected.
- Requested By remains editable.
- Address remains editable.
- Date remains editable.

---

# 11. Remarks

Not supported.

---

# 12. Reagent Kit Information

Required.

Fields

- Lot Number
- Expiration Date

Both remain editable.

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

SimpleResult

Characteristics

- Single A4 page
- Portrait orientation
- Large centered qualitative result
- Reagent kit information displayed below the result
- Signature block displayed

---

# 16. Preview / Print / PDF Contract

Preview, Browser Print, and PDF MUST produce identical output.

---

# 17. Client Notes

### Requested By

Automatically populate:

Dr. Ralph Roland Asperas

The user may edit and replace with another physician.

---

### Reagent Kit Information

Display:

- Lot Number
- Expiration Date

The values shown in the template are sample values only.

Users must be able to edit both fields for every examination.

---

### Result Dropdown

Allowed values:

- Nonreactive
- Reactive

---

# 18. Engineering Notes

- No automatic computations.
- Qualitative examination.
- Reagent kit information is mandatory.
- Default values are convenience values only.

---

# 19. AI Implementation Rules

AI MUST

- Preserve the official Word layout.
- Require reagent kit information.
- Preserve qualitative dropdown values.
- Auto-populate default Address.
- Auto-populate default Requested By.
- Allow editing of all default values.

AI MUST NOT

- Introduce numeric reference values.
- Introduce automatic computations.
- Allow arbitrary result values outside the approved dropdown.
- Modify the approved layout.

---

# 20. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Layout | Word Template |
| Result Dropdown | Client Word Comment |
| Reagent Kit Information | Client Word Comment |
| Requested By | Word Template |
| Renderer Family | REPORT_REGISTRY_ARCHITECTURE.md |

---

# 21. Open Questions

None.

---

# 22. Validation Checklist

- [x] Parameter verified
- [x] Dropdown values verified
- [x] Kit information documented
- [x] Client comments preserved
- [x] Rendering documented
- [ ] Reviewed
- [ ] Frozen

---

# 23. Revision History

| Version | Date | Notes |
|----------|------|------|
| 1.0 | Initial Draft | Reverse engineered from official Word template |