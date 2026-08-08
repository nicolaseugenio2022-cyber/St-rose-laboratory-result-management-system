# BLOOD_TYPING

> **Specification Status**
>
> Draft
>
> This document is the authoritative engineering specification for the Blood Typing laboratory report.
>
> The official Microsoft Word template remains the visual authority.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | BLOOD_TYPING |
| Official Template Name | Blood Typing |
| Examination Family | Blood Bank |
| Renderer Family | SimpleResult |
| Source Word Template | Templates/BLOOD_TYPING.docx |
| Current Version | 1.0 |
| Last Reviewed | Pending |

---

# 2. Purpose

Records the patient's ABO Blood Group and Rh Factor using a simple single-page laboratory report.

---

# 3. Authority

## Visual Authority

The official Microsoft Word template defines:

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
| Status | Optional | Patient status |

---

# 5. Laboratory Parameters

| Display Name | Parameter Code | Input Type | Unit | Required | Selectable |
|--------------|---------------|-----------|------|----------|------------|
| Blood Type | BLOOD_GROUP | SingleSelect | — | Yes | No |
| Rh Factor | RH_FACTOR | SingleSelect | — | Yes | No |

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

The original Word template contains the following approved client instructions:

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

- Preserve the Word template layout.
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
| Layout | Word Template |
| Dropdown values | Client Notes |
| Signatories | Word Template |
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