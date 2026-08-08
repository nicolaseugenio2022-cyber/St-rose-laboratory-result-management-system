# FECALYSIS

> **Specification Status**
>
> Draft
>
> This document is the authoritative behavioral specification for the Fecalysis laboratory report.
>
> The official Microsoft Word template remains the visual authority.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | FECALYSIS |
| Official Template Name | Fecalysis Examination |
| Examination Family | Clinical Microscopy |
| Renderer Family | DiagnosticGrid |
| Source Word Template | Templates/FECALYSIS.docx |
| Supports Remarks | No |
| Requires Kit Information | No |

---

# 2. Purpose

Records the physical and microscopic findings of a stool examination.

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

1. Color
2. Consistency
3. Blood
4. Mucus
5. pH
6. Fat Globules
7. Pus Cells
8. Red Cells
9. Bacteria
10. Parasite
11. Others

---

# 5. Input Types

| Parameter | Input Type |
|-----------|------------|
| Color | Combobox |
| Consistency | Combobox |
| Blood | FreeText |
| Mucus | FreeText |
| pH | FreeText |
| Fat Globules | FreeText |
| Pus Cells | NumericText |
| Red Cells | NumericText |
| Bacteria | FreeText |
| Parasite | FreeText |
| Others | FreeText |

---

# 6. Reference Evaluation

No numeric reference ranges.

Interpretation is based on laboratory findings.

---

# 7. Computations

None.

No client-approved automatic computations exist.

---

# 8. Default UI Values

| Field | Default | Editable |
|--------|----------|----------|
| Address | STA. ROSA, NUEVA ECIJA | Yes |
| Requested By | Dr. Ma. Floricel Dedace-Lagrazon | Yes |
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

- Dr. Ma. Floricel Dedace-Lagrazon

Editable to another physician.

---

## Color

- Brown
- Yellowish Brown
- Dark Brown
- Black
- Green
- Greenish Brown
- Red
- Reddish Brown

Custom value allowed.

---

## Consistency

- Soft
- Loose
- Semi-Formed
- Formed
- Mushy
- Watery

Custom value allowed.

---

# 10. Validation Rules

- Color is required.
- Consistency is required.
- Remaining fields are optional.
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

- Blank laboratory findings should remain blank.
- Empty fields should not display unnecessary placeholder values in the rendered report.

---

# 15. Rendering Rules

Renderer Family

DiagnosticGrid

Characteristics

- Single A4 page
- Portrait orientation
- Diagnostic microscopy layout
- Horizontal writing fields
- Signature block displayed

---

# 16. Preview / Print / PDF Contract

Preview, Browser Print, and PDF MUST produce identical output.

---

# 17. Client Notes

### Requested By

Automatically populate:

Dr. Ma. Floricel Dedace-Lagrazon

The user may edit and replace with another physician.

---

### Color Dropdown

Available values:

- Brown
- Yellowish Brown
- Dark Brown
- Black
- Green
- Greenish Brown
- Red
- Reddish Brown

Custom entry is allowed.

---

### Consistency Dropdown

Available values:

- Soft
- Loose
- Semi-Formed
- Formed
- Mushy
- Watery

Custom entry is allowed.

---

### Pus Cells

Example format:

```
0-2 /HPF
```

User may edit.

---

### Red Cells

Example format:

```
0-1 /HPF
```

User may edit.

---

### Bacteria

Example value:

```
4+
```

User may edit.

---

### Parasite

Default value:

```
NO INTESTINAL PARASITES OR OVA SEEN
```

Automatically populated but editable.

---

### Blank Fields

Client request:

Blank findings should remain blank in the rendered report whenever no value is entered.

---

### UI Styling

The client requested that the visual design follow the same overall style as the other laboratory templates.

---

# 18. Engineering Notes

- No automatic computations.
- Comboboxes support predefined values and custom entries.
- Parasite defaults to the standard laboratory statement.
- Empty findings should not generate placeholder output.

---

# 19. AI Implementation Rules

AI MUST

- Preserve parameter order.
- Preserve diagnostic grid layout.
- Auto-populate default Address.
- Auto-populate default Requested By.
- Auto-populate default Parasite value.
- Allow editing of all default values.
- Support custom combobox entries.
- Preserve blank fields when no value exists.
- Preserve the official Word layout.

AI MUST NOT

- Introduce automatic computations.
- Force values into optional findings.
- Remove custom combobox support.
- Modify approved dropdown values.

---

# 20. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Layout | Word Template |
| Dropdown Values | Client Word Comment |
| Parasite Default | Client Word Comment |
| Blank Field Behavior | Client Word Comment |
| Renderer Family | REPORT_REGISTRY_ARCHITECTURE.md |

---

# 21. Open Questions

None.

---

# 22. Validation Checklist

- [x] Parameters verified
- [x] Dropdown values verified
- [x] Default parasite documented
- [x] Client comments preserved
- [x] Rendering documented
- [ ] Reviewed
- [ ] Frozen

---

# 23. Revision History

| Version | Date | Notes |
|----------|------|------|
| 1.0 | Initial Draft | Reverse engineered from official Word template |