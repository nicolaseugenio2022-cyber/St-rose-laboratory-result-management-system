# ESR

> **Specification Status**
>
> Maintained detailed specification. Authority is separated by concern:
> `architecture/report-specifications/Summary.md` governs the client requirements it explicitly
> records; this document governs the detail where `Summary.md` is silent. See
> `architecture/README.md`.
>
> This document is the authoritative behavioral specification for the Erythrocyte Sedimentation Rate (ESR) laboratory report.
>
> The original Microsoft Word templates are **historical source material** and are not present in
> the repository. Current visual authority is separated across `Summary.md` (explicit client
> acceptance requirements), this specification, `REPORT_RENDERING_ARCHITECTURE.md`,
> `PDF_VALIDATION_CHECKLIST.md`, and the approved deterministic rendering contracts and
> completed snapshots.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | ESR |
| Official Template Name | Erythrocyte Sedimentation Rate |
| Examination Family | Hematology |
| Renderer Family | SimpleResult |
| Source Word Template (historical; not in repository) | Templates/ESR.docx |
| Supports Remarks | Yes |
| Requires Kit Information | No |

---

# 2. Purpose

Records the patient's Erythrocyte Sedimentation Rate (ESR) result using the official St. Rose Hematology report.

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
| Status | Not collected | Omitted; not collected in the encoding UI |

---

# 4. Laboratory Parameters

Display order MUST remain exactly:

1. ESR

---

# 5. Input Types

| Parameter | Input Type |
|-----------|------------|
| ESR | NumericText |

---

# 6. Reference Values

## Male

0–15 mm/hr

---

## Female

0–20 mm/hr

---

## Children

0–13 mm/hr

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

- ESR is required.
- Only numeric values are accepted.
- Requested By remains editable.
- Address remains editable.
- Date remains editable.

---

# 11. Remarks

Supported.

No default remarks value. The field starts empty and remains editable.

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
- Single-result hematology table
- Reference values displayed
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
- Single numeric laboratory parameter.
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
- Preserve the approved report layout recorded in this specification and `REPORT_RENDERING_ARCHITECTURE.md`.

AI MUST NOT

- Introduce automatic computations.
- Modify reference values.
- Introduce additional parameters.

---

# 20. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Layout | This specification — historical origin: Word template, not in repository |
| Reference Values | This specification — historical origin: Word template, not in repository |
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
| 1.1 | SHADCN-06D | Reconciled to verified runtime (`src/domain/definitions/`): Status demographic policy; remarks supported with no default; renderer family Tabular to SimpleResult; visual-authority statement |