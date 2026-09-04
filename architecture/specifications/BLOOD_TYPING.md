# BLOOD_TYPING

> **Specification Status**
>
> Maintained detailed specification. Authority is separated by concern:
> `architecture/report-specifications/Summary.md` governs the client requirements it explicitly
> records; this document governs the detail where `Summary.md` is silent. See
> `architecture/README.md`.
>
> This document is the authoritative engineering specification for the Blood Typing laboratory report.
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
| Template Code | BLOOD_TYPING |
| Official Template Name | Blood Typing |
| Examination Family | Blood Bank |
| Renderer Family | SimpleResult |
| Source Word Template (historical; not in repository) | Templates/BLOOD_TYPING.docx |
| Current Version | 1.0 |
| Last Reviewed | Pending |

---

# 2. Purpose

Records the patient's ABO Blood Group and Rh Factor using a simple single-page laboratory report.

---

# 3. Authority

## Visual Authority

Visual authority for this report is separated across this specification, `REPORT_RENDERING_ARCHITECTURE.md` and `PDF_VALIDATION_CHECKLIST.md`, which define:

- Header layout
- Typography
- Logo placement
- Borders
- Signature placement
- Spacing
- Colors
- A4 page layout

---

## Behavioral Authority

This specification defines:

- Parameters
- Dropdown values
- Validation
- Remarks
- Signatories
- Rendering behavior

---

# 4. Patient Demographics

| Field | Required | Notes |
|--------|----------|------|
| Name | Yes | Printed in header |
| Age | Yes | Printed in header |
| Date | Yes | Examination date |
| Address | Yes | Printed in header |
| Sex | Yes | Male / Female |
| Requested By | Optional | Physician |
| Status | Not collected | Omitted; not collected in the encoding UI |

---

# 5. Laboratory Parameters

| Display Name | Parameter Code | Input Type | Unit | Required | Selectable |
|--------------|---------------|-----------|------|----------|------------|
| Blood Type | ABO_TYPING | SingleSelect | — | Yes | No |
| Rh Factor | RH_TYPING | SingleSelect | — | Yes | No |

Display order MUST remain exactly as shown.

---

# 6. Input Controls

## Blood Type

Input Type

SingleSelect

---

## Rh Factor

Input Type

SingleSelect

---

# 7. Dropdown Values

## Blood Type

Allowed values

- A
- B
- AB
- O

---

## Rh Factor

Allowed values

- Positive
- Negative

---

# 8. Reference Evaluation

No abnormal evaluation is performed.

No reference ranges are displayed.

---

# 9. Computations

None.

No client-approved computations exist.

---

# 10. Validation Rules

Blood Type is required.

Rh Factor is required.

Only approved dropdown values may be stored.

Manual typing is not permitted.

---

# 11. Remarks

Supports free-form remarks.

No default remarks are defined.

---

# 12. Reagent Kit Information

Not required.

---

# 13. Signatories

Required Signatories

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

- Single-page report
- Portrait orientation
- One A4 page
- Large centered result panel
- Blood Type displayed prominently
- Rh Factor displayed prominently
- Signature block below result
- Patient demographics above result

---

# 16. Preview / Print / PDF Contract

Preview, Browser Print, and PDF MUST produce identical output.

Any layout difference is an architectural defect.

---

# 17. Client Notes

The original Word template contained the following approved client instructions, recorded here as the approved requirement:

> Ang result here is yung "B" at positive.

> May dropdown sa positive na:
> "Positive"
> and
> "Negative"

> Sa "B" naman:
> "A"
> "B"
> "AB"
> "O"

These instructions define the required dropdown behavior.

---

# 18. Engineering Notes

The report consists of exactly two laboratory values:

- ABO Blood Group
- Rh Factor

Both values are selected using fixed dropdown controls.

No calculations are performed.

No abnormal evaluation exists.

No reference range exists.

---

# 19. AI Implementation Rules

AI MUST

- Preserve the approved report layout recorded in this specification and `REPORT_RENDERING_ARCHITECTURE.md`.
- Use only approved dropdown values.
- Preserve display order.
- Render exactly one A4 page.

AI MUST NOT

- Introduce free-text entry.
- Introduce computations.
- Introduce reference ranges.
- Introduce additional parameters.

---

# 20. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Layout | This specification — historical origin: Word template, not in repository |
| Dropdown values | Client Notes |
| Signatories | This specification — historical origin: Word template, not in repository |
| Renderer Family | REPORT_REGISTRY_ARCHITECTURE.md |
| Examination Family | REPORT_REGISTRY_ARCHITECTURE.md |

---

# 21. Open Questions

None.

---

# 22. Validation Checklist

- [x] Parameters verified
- [x] Dropdown values verified
- [x] Computations verified
- [x] Client notes preserved
- [x] Rendering documented
- [x] Signatories documented
- [ ] Reviewed
- [ ] Frozen

---

# 23. Revision History

| Version | Date | Notes |
|----------|------|------|
| 1.0 | Initial Draft | Reverse engineered from official Word template |
| 1.1 | SHADCN-06D | Reconciled to verified runtime (`src/domain/definitions/`): Status demographic policy; parameter codes ABO_TYPING / RH_TYPING; visual-authority statement |