# RBS

> **Specification Status**
>
> Draft
>
> This document is the authoritative behavioral specification for the Random Blood Sugar (RBS) laboratory report.
>
> The official Microsoft Word template remains the visual authority.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | RBS |
| Official Template Name | Random Blood Sugar |
| Examination Family | Clinical Chemistry |
| Renderer Family | SimpleResult |
| Source Word Template | Templates/RBS.docx |
| Supports Remarks | No |
| Requires Kit Information | No |

---

# 2. Purpose

Records the patient's Random Blood Sugar (RBS) laboratory examination.

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

1. RBS

---

# 5. Input Types

| Parameter | Input Type |
|-----------|------------|
| RBS | NumericText |

---

# 6. Reference Values

## RBS

90–145 mg/dL

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

# 10. Validation Rules

- RBS is required.
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

SimpleResult

Characteristics

- Single A4 page
- Portrait orientation
- Single-result Clinical Chemistry layout
- Reference value displayed
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

### Chemistry Workflow

Client request:

Although RBS has its own report template, it should also be accessible from the shared **Clinical Chemistry** workflow/menu because it is rarely requested as a completely standalone examination.

The shared Chemistry menu includes:

- CHEM_8
- HDL_LDL
- CHEM_10
- RBS

---

### Test Name

RBS stands for:

**Random Blood Sugar**

---

# 18. Engineering Notes

- No automatic computations.
- Single numeric laboratory parameter.
- Shares the Clinical Chemistry workflow/menu.
- Default values are convenience values only.

---

# 19. AI Implementation Rules

AI MUST

- Preserve parameter order.
- Preserve reference values.
- Auto-populate default Address.
- Auto-populate default Requested By.
- Include RBS in the shared Clinical Chemistry workflow.
- Allow editing of all default values.
- Preserve the official Word layout.

AI MUST NOT

- Introduce automatic computations.
- Modify reference values.
- Treat RBS as unrelated to the shared Chemistry workflow.
- Introduce additional parameters.

---

# 20. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Layout | Word Template |
| Chemistry Workflow | Client Word Comment |
| Reference Values | Word Template |
| Requested By | Word Template |
| Renderer Family | REPORT_REGISTRY_ARCHITECTURE.md |

---

# 21. Open Questions

None.

---

# 22. Validation Checklist

- [x] Parameter verified
- [x] Reference value verified
- [x] Shared Chemistry workflow documented
- [x] Client comments preserved
- [x] Rendering documented
- [ ] Reviewed
- [ ] Frozen

---

# 23. Revision History

| Version | Date | Notes |
|----------|------|------|
| 1.0 | Initial Draft | Reverse engineered from official Word template |