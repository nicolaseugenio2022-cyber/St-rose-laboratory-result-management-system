# DENGUE_DUO

> **Specification Status**
>
> Draft
>
> This document is the authoritative behavioral specification for the Dengue Duo laboratory report.
>
> The official Microsoft Word template remains the visual authority.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | DENGUE_DUO |
| Official Template Name | Dengue Duo Rapid Test |
| Examination Family | Serology & Immunology |
| Renderer Family | SimpleResult |
| Source Word Template | Templates/DENGUE_DUO.docx |
| Supports Remarks | No |
| Requires Kit Information | Yes |

---

# 2. Purpose

Records Dengue NS1 Antigen, IgG, and IgM rapid test results.

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

1. Dengue NS1
2. IgG
3. IgM

---

# 5. Input Types

| Parameter | Input Type |
|-----------|------------|
| Dengue NS1 | SingleSelect |
| IgG | SingleSelect |
| IgM | SingleSelect |

---

# 6. Reference Evaluation

No numeric reference ranges.

Qualitative result only.

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

## Dengue NS1

- Positive
- Negative

---

## IgG

- Positive
- Negative

---

## IgM

- Positive
- Negative

---

# 10. Validation Rules

- Dengue NS1 is required.
- IgG is required.
- IgM is required.
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

Fields:

- Lot Number
- Expiration Date

Both fields are editable.

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
- Centered qualitative result layout
- Reagent kit information displayed below results
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

Current template values:

Lot Number

202512015

Expiration Date

2028-11

Both values should remain editable.

---

### Result Dropdown

Allowed values:

- Positive
- Negative

Applies to:

- Dengue NS1
- IgG
- IgM

---

# 18. Engineering Notes

- No automatic computations.
- Three qualitative result fields.
- Kit information is mandatory.
- Default values are convenience values only.

---

# 19. AI Implementation Rules

AI MUST

- Preserve parameter order.
- Require reagent kit information.
- Preserve qualitative dropdown values.
- Auto-populate default Address.
- Auto-populate default Requested By.
- Allow editing of default values.
- Preserve the official Word layout.

AI MUST NOT

- Introduce numeric reference ranges.
- Introduce automatic computations.
- Allow arbitrary result values outside the approved dropdown.
- Modify the approved layout.

---

# 20. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Layout | Word Template |
| Dropdown Values | Client Word Comment |
| Kit Information | Client Word Comment |
| Requested By | Client Word Comment |
| Renderer Family | REPORT_REGISTRY_ARCHITECTURE.md |

---

# 21. Open Questions

None.

---

# 22. Validation Checklist

- [x] Parameters verified
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
