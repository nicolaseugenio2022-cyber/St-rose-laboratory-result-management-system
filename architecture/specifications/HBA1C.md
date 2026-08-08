# HBA1C

> **Specification Status**
>
> Draft
>
> This document is the authoritative behavioral specification for the HbA1c laboratory report.
>
> The official Microsoft Word template remains the visual authority.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | HBA1C |
| Official Template Name | HbA1c |
| Examination Family | Clinical Chemistry |
| Renderer Family | SimpleResult |
| Source Word Template | Templates/HBA1C.docx |
| Supports Remarks | No |
| Requires Kit Information | Yes |

---

# 2. Purpose

Records the patient's Glycated Hemoglobin (HbA1c) laboratory result.

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

1. HbA1c

---

# 5. Input Types

| Parameter | Input Type |
|-----------|------------|
| HbA1c | NumericText |

---

# 6. Reference Values

## HbA1c

< 6.5 %

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

- HbA1c is required.
- Numeric values only.
- Automatically append `%` when displaying the result.
- Users enter only the numeric value.
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

- The displayed result format is:

```
7.2%
```

The user only encodes:

```
7.2
```

The `%` symbol is appended automatically during rendering.

---

# 15. Rendering Rules

Renderer Family

SimpleResult

Characteristics

- Single A4 page
- Portrait orientation
- Large centered result
- Reference value displayed
- Reagent kit information displayed
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

### Reagent Kit Information

Display:

Lot Number

F20712509AD

Expiration Date

2028-04-26

Both remain editable.

---

### Result Formatting

The result automatically displays the `%` symbol.

Example

```
Input:
7.2

Printed:
7.2%
```

---

### Test Name

The printed label must be:

```
HbA1c
```

Do **NOT** render as:

- HBA1C
- HBA1c
- HBA1C REPORT

The casing from the Word template must be preserved.

---

# 18. Engineering Notes

- No automatic laboratory computations.
- `%` is a presentation suffix only.
- Users enter only the numeric value.
- Kit information is mandatory.
- Default values are convenience values only.

---

# 19. AI Implementation Rules

AI MUST

- Preserve the official test name (`HbA1c`).
- Preserve the official layout.
- Automatically append `%` when displaying results.
- Store only the numeric value.
- Require reagent kit information.
- Auto-populate default Address.
- Auto-populate default Requested By.
- Allow editing of all default values.

AI MUST NOT

- Require the user to type `%`.
- Change the capitalization of `HbA1c`.
- Introduce automatic computations.
- Modify the approved layout.

---

# 20. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Layout | Word Template |
| Result Formatting | Client Word Comment |
| Kit Information | Client Word Comment |
| Requested By | Client Word Comment |
| Test Name Capitalization | Word Template |
| Renderer Family | REPORT_REGISTRY_ARCHITECTURE.md |

---

# 21. Open Questions

None.

---

# 22. Validation Checklist

- [x] Parameter verified
- [x] Reference value verified
- [x] Result formatting documented
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