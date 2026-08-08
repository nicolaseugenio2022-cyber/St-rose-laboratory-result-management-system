# CT_BT

> **Specification Status**
>
> Draft
>
> This document is the authoritative behavioral specification for the Clotting Time & Bleeding Time laboratory report.
>
> The official Microsoft Word template remains the visual authority.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | CT_BT |
| Official Template Name | Clotting Time & Bleeding Time |
| Examination Family | Hematology |
| Renderer Family | Tabular |
| Source Word Template | Templates/CT_BT.docx |
| Supports Remarks | No |
| Requires Kit Information | No |

---

# 2. Purpose

Records Bleeding Time (BT) and Clotting Time (CT) laboratory examination results using the official St. Rose Hematology report.

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

1. Bleeding Time
2. Clotting Time

---

# 5. Input Types

| Parameter | Input Type |
|-----------|------------|
| Bleeding Time | NumericText |
| Clotting Time | NumericText |

---

# 6. Reference Values

## Bleeding Time

1–4 Minutes

---

## Clotting Time

2–6 Minutes

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

- Bleeding Time is required.
- Clotting Time is required.
- Only numeric values are accepted.
- Date remains editable.
- Requested By remains editable.
- Address remains editable.

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
- Two-row hematology table
- Normal ranges displayed
- No remarks section
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

---

# 18. Engineering Notes

- No automatic computations.
- No remarks section.
- Default values are convenience values only.
- Reference values are printed exactly as shown.

---

# 19. AI Implementation Rules

AI MUST

- Preserve parameter order.
- Preserve reference values.
- Auto-populate default Address.
- Auto-populate default Requested By.
- Allow editing of default values.
- Preserve the official Word layout.

AI MUST NOT

- Introduce remarks.
- Introduce automatic computations.
- Modify reference values.
- Introduce additional parameters.

---

# 20. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Layout | Word Template |
| Reference Values | Word Template |
| Renderer Family | REPORT_REGISTRY_ARCHITECTURE.md |
| Examination Family | REPORT_REGISTRY_ARCHITECTURE.md |

---

# 21. Open Questions

None.

---

# 22. Validation Checklist

- [x] Parameters verified
- [x] Reference values verified
- [x] Client comments preserved
- [x] Rendering documented
- [ ] Reviewed
- [ ] Frozen

---

# 23. Revision History

| Version | Date | Notes |
|----------|------|------|
| 1.0 | Initial Draft | Reverse engineered from official Word template |
