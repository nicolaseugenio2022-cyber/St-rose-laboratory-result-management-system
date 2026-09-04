# HIV_RESULT

> **Specification Status**
>
> Maintained detailed specification. Authority is separated by concern:
> `architecture/report-specifications/Summary.md` governs the client requirements it explicitly
> records; this document governs the detail where `Summary.md` is silent. See
> `architecture/README.md`.
>
> This document is the authoritative behavioral specification for the HIV Result (AIDS Free Certificate) laboratory report.
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
| Template Code | HIV_RESULT |
| Official Template Name | AIDS Free Certificate |
| Examination Family | Serology & Immunology |
| Renderer Family | Dedicated Certificate |
| Source Word Template (historical; not in repository) | Templates/HIV_RESULT.docx |
| Supports Remarks | Yes |
| Requires Kit Information | Yes |

---

# 2. Purpose

Produces the official AIDS Free Certificate and HIV Screening Result required by the laboratory.

Unlike other laboratory reports, this template contains:

- Certification paragraph
- HIV screening result
- Laboratory information
- Three-signatory approval

---

# 3. Patient Demographics

Unlike all other templates, this report uses a **different demographic layout**.

Fields displayed:

| Field | Required |
|--------|----------|
| Order Date | Yes |
| Order Time | Yes |
| Name | Yes |
| Age | Yes |
| Sex | Yes |
| Referring Doctor | Yes |
| Company | No |

The demographic layout MUST follow the official HIV certificate exactly.

It MUST NOT reuse the standard laboratory demographics header.

---

# 4. Laboratory Parameters

Display order MUST remain exactly:

1. Anti HIV-1/2 (Screening)

---

# 5. Input Types

| Parameter | Input Type |
|-----------|------------|
| Anti HIV-1/2 Result | SingleSelect |

---

# 6. Reference Evaluation

Qualitative examination.

No numeric reference values.

---

# 7. Computations

None.

No automatic computations.

---

# 8. Default UI Values

| Field | Default | Editable |
|--------|----------|----------|
| Company | (no default) | Yes |
| Date | Current Date | Yes |
| Time | Current Time | Yes |

No default referring physician is defined by the template.

---

# 9. Dropdown Values

## Result

- Nonreactive
- Reactive

---

## Sex

- Male
- Female

---

# 10. Validation Rules

- HIV Result is required.
- Company is optional; it is omitted from the certificate when blank.
- Order Date is required.
- Order Time is required.
- Referring Doctor is required.
- Only approved qualitative values are accepted.

---

# 11. Remarks

Supported.

No default remarks value. The field starts empty and remains editable.

---

# 12. Reagent Kit Information

Required.

Fields

- Lot Number
- Expiration Date

---

# 13. Signatories

Unlike all other templates.

Required:

| Role | Quantity |
|------|----------|
| Pathologist | 1 |
| Medical Technologist | 2 |

Display Order

Bottom Left

Performed By

Medical Technologist

Bottom Right

Verified By

Medical Technologist

Bottom Center

Pathologist

This exact arrangement MUST be preserved.

---

# 14. Certificate Section

The report begins with the official certificate.

Heading

```
AIDS FREE CERTIFICATE
```

Certificate body

Contains the certification paragraph exactly as recorded in `src/domain/definitions/hiv-certificate-static-content.ts`, which is the approved static-content contract for this certificate.

Checkbox wording

```
[X] Non-reactive or Negative

[ ] Reactive or Positive
```

The application automatically checks the appropriate option based on the selected result.

---

# 15. Conditional Rules

If Result = Nonreactive

Automatically check

```
[X] Non-reactive or Negative
```

If Result = Reactive

Automatically check

```
[X] Reactive or Positive
```

The opposite option remains unchecked.

---

# 16. Rendering Rules

Renderer Family

Dedicated Certificate

Characteristics

- Single A4 page
- Portrait orientation
- Certificate header
- Narrative paragraph
- HIV laboratory section
- Kit information
- Three-signatory footer

---

# 17. Preview / Print / PDF Contract

Preview, Browser Print, and PDF MUST produce identical output.

The certificate layout must exactly match this specification and the approved deterministic certificate rendering contract.

---

# 18. Client Notes

### Different Patient Demographics

Client requested that this report may also be grouped under the Serology menu.

However,

**the patient demographics layout MUST NOT be the same as the other laboratory reports.**

The HIV certificate keeps its own dedicated demographic section exactly as specified in §3 of this document.

---

### Company

Default

```
St. Rose Diagnostic Laboratory
```

Editable.

---

### HIV Result

Allowed values

- Nonreactive
- Reactive

---

### Certificate Checkbox

The checkbox selection is automatic based on the laboratory result.

---

### Kit Information

Display

- Lot Number
- Expiration Date

Editable every examination.

---

# 19. Engineering Notes

- Uses NarrativeCertificate renderer.
- Does not share the standard demographics header.
- Uses three signatories.
- Uses automatic certificate checkbox selection.
- Kit information is mandatory.

---

# 20. AI Implementation Rules

AI MUST

- Preserve the official AIDS Free Certificate layout.
- Preserve the narrative paragraph.
- Preserve the separate HIV demographics layout.
- Preserve three-signatory layout.
- Automatically check the correct certificate option.
- Require kit information.
- Preserve the approved certificate spacing recorded in this specification and `REPORT_RENDERING_ARCHITECTURE.md`.

AI MUST NOT

- Reuse the normal laboratory report header.
- Reduce signatories to two.
- Change certificate wording.
- Replace the narrative layout with a table.
- Modify the approved layout.

---

# 21. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Certificate Layout | This specification — historical origin: Word template, not in repository |
| Separate Demographics Layout | Client Word Comment |
| Checkbox Behavior | This specification — historical origin: Word template, not in repository |
| Three Signatories | This specification — historical origin: Word template, not in repository |
| Renderer Family | REPORT_REGISTRY_ARCHITECTURE.md |

---

# 22. Open Questions

None.

---

# 23. Validation Checklist

- [x] Certificate preserved
- [x] Separate demographics documented
- [x] Three signatories documented
- [x] Checkbox behavior documented
- [x] Kit information documented
- [x] Rendering documented
- [ ] Reviewed
- [ ] Frozen

---

# 24. Revision History

| Version | Date | Notes |
|----------|------|------|
| 1.0 | Initial Draft | Reverse engineered from official Word template |
| 1.1 | SHADCN-06D | Reconciled to verified runtime (`src/domain/definitions/`): Company optional with no default; remarks supported with no default; renderer family NarrativeCertificate to Dedicated Certificate; visual-authority statement |