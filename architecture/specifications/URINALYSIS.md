# URINALYSIS

> **Specification Status**
>
> Draft
>
> This document is the authoritative behavioral specification for the Urinalysis laboratory report.
>
> The official Microsoft Word template remains the visual authority.

---

# 1. Document Information

| Field | Value |
|--------|-------|
| Template Code | URINALYSIS |
| Official Template Name | Urinalysis |
| Examination Family | Clinical Microscopy |
| Renderer Family | DiagnosticGrid |
| Source Word Template | Templates/URINALYSIS.docx |
| Supports Remarks | Yes |
| Requires Kit Information | No |

---

# 2. Purpose

Records routine macroscopic and microscopic urinalysis findings.

---

# 3. Patient Demographics

| Field | Required | Behavior |
|--------|----------|----------|
| Name | Yes | Printed |
| Age | Yes | Printed |
| Sex | Yes | Dropdown |
| Date | Yes | Current date by default; editable |
| Address | Yes | Default value; editable |
| Requested By | Yes | Editable |
| Status | Optional | Printed |

---

# 4. Laboratory Parameters

Display order MUST remain exactly.

## Left Column

1. Color
2. Clarity
3. pH
4. Specific Gravity
5. Protein
6. Glucose

---

## Right Column

1. WBC
2. RBC
3. Epithelial Cells
4. Bacteria
5. Mucus Threads
6. Crystals

---

## Remarks

Displayed below both columns.

---

# 5. Input Types

| Parameter | Input Type |
|-----------|------------|
| Color | Combobox |
| Clarity | Combobox |
| pH | SingleSelect |
| Specific Gravity | SingleSelect |
| Protein | SingleSelect |
| Glucose | SingleSelect |
| WBC | FreeText |
| RBC | FreeText |
| Epithelial Cells | SingleSelect |
| Bacteria | SingleSelect |
| Mucus Threads | SingleSelect |
| Crystal Type | SingleSelect |
| Crystal Severity | SingleSelect |
| Other Findings | FreeText |
| Remarks | FreeText |

---

# 6. Dropdown Values

## Color

- Straw
- Pale Yellow
- Light Yellow
- Yellow
- Dark Yellow
- Amber
- Brown
- Red

Allow custom value entry.

---

## Clarity

- Clear
- Slightly Hazy
- Hazy
- Slightly Cloudy
- Cloudy
- Slightly Turbid
- Turbid

Allow custom value entry.

---

## pH

- 5.0
- 6.0
- 6.5
- 7.0
- 7.5
- 8.0
- 9.0

---

## Specific Gravity

- 1.000
- 1.005
- 1.010
- 1.015
- 1.020
- 1.025
- 1.030

---

## Protein

- Negative
- Trace
- 1+
- 2+
- 3+
- 4+

---

## Glucose

- Negative
- Trace
- 1+
- 2+
- 3+
- 4+

---

## Epithelial Cells

- Rare
- Few
- Moderate
- Many
- Plenty

---

## Bacteria

- Rare
- Few
- Moderate
- Many
- Plenty

---

## Mucus Threads

- Rare
- Few
- Moderate
- Many
- Plenty

---

## Crystal Type

- None
- Amorphous Urates
- Amorphous Phosphates

---

## Crystal Severity

- Rare
- Few
- Moderate
- Many
- Plenty

---

# 7. Free Text Rules

## WBC

Free-text.

Examples

- 0–2 /HPF
- >50 /HPF
- Too Numerous To Count /HPF
- WBC seen in clumps

System MUST NOT replace "/HPF".

---

## RBC

Free-text.

Examples

- 0–2 /HPF
- 4–6 /HPF
- >50 /HPF

---

## Other Findings

Free-text.

Examples

- Calcium Oxalate Crystals: Rare
- WBC seen in clumps
- Yeast cells observed

---

# 8. Crystal Behavior

If Crystal Type = None

Do not print any crystal finding.

---

If Crystal Type = Amorphous Urates

Print

```
Amorphous Urates: Moderate
```

(or selected severity)

---

If Crystal Type = Amorphous Phosphates

Print

```
Amorphous Phosphates: Rare
```

(or selected severity)

---

If another crystal or microscopic finding is observed

Record it under **Other Findings**.

Examples

```
Calcium Oxalate Crystals: Rare
```

```
WBC seen in clumps
```

The client prefers additional crystal findings to appear in **Other Findings** instead of expanding the main report layout.

---

# 9. Validation Rules

- All required parameters must be completed.
- WBC and RBC remain unrestricted free-text.
- "/HPF" formatting must be preserved.
- Crystal Type controls Crystal Severity visibility.
- If Crystal Type = None, Crystal Severity is hidden.

---

# 10. Remarks

Supported.

Default

```
TEST/S RECHECKED; RESULT/S VERIFIED
```

Editable.

---

# 11. Reagent Kit Information

Not required.

---

# 12. Signatories

| Role | Quantity |
|------|----------|
| Pathologist | 1 |
| Medical Technologist | 1 |

---

# 13. Rendering Rules

Renderer Family

DiagnosticGrid

Characteristics

- Single A4 page
- Portrait orientation
- Two-column microscopic layout
- Green template
- Remarks section
- Signature section

---

# 14. Preview / Print / PDF Contract

Preview, Browser Print, and PDF MUST produce identical output.

---

# 15. Client Notes

### Design

Client requested that the Urinalysis report be visually consistent with the other laboratory reports.

---

### Color

Dropdown plus manual entry.

---

### Clarity

Dropdown plus manual entry.

---

### WBC and RBC

Remain free-text.

Examples

- 0–2 /HPF
- >50 /HPF
- TOO NUMEROUS TO COUNT /HPF

The application must never remove "/HPF".

---

### Epithelial Cells

Dropdown

- Rare
- Few
- Moderate
- Many
- Plenty

---

### Bacteria

Dropdown

- Rare
- Few
- Moderate
- Many
- Plenty

---

### Mucus Threads

Dropdown

- Rare
- Few
- Moderate
- Many
- Plenty

---

### Crystal Reporting

If no crystals are present

Leave blank.

If present

Choose

- Amorphous Urates
- Amorphous Phosphates

Then choose severity.

---

### Other Crystal Findings

Additional microscopic findings should be written under **Other Findings**.

Examples

- Calcium Oxalate Crystals: Rare
- WBC seen in clumps

The client prefers this instead of adding more rows to the report.

---

# 16. Engineering Notes

- DiagnosticGrid renderer.
- WBC/RBC remain free-text.
- Crystal reporting is conditional.
- Additional microscopic findings belong in Other Findings.
- Report design should match the style of the other laboratory reports.

---

# 17. AI Implementation Rules

AI MUST

- Preserve the official Word layout.
- Preserve the two-column arrangement.
- Preserve "/HPF".
- Support custom Color and Clarity.
- Support conditional crystal reporting.
- Support Other Findings.
- Preserve Remarks.
- Preserve the green report theme.

AI MUST NOT

- Force numeric validation on WBC/RBC.
- Remove "/HPF".
- Display crystal severity when no crystal is selected.
- Add additional crystal rows.
- Modify the approved layout.

---

# 18. Authority Traceability

| Requirement | Source |
|-------------|--------|
| Layout | Word Template |
| Crystal Behavior | Client Word Comment |
| Dropdown Lists | Client Word Comment |
| Other Findings | Client Word Comment |
| Renderer Family | REPORT_REGISTRY_ARCHITECTURE.md |

---

# 19. Open Questions

None.

---

# 20. Validation Checklist

- [x] Parameters verified
- [x] Dropdowns verified
- [x] Crystal behavior documented
- [x] WBC/RBC behavior documented
- [x] Other Findings documented
- [x] Client comments preserved
- [ ] Reviewed
- [ ] Frozen

---

# 21. Revision History

| Version | Date | Notes |
|----------|------|------|
| 1.0 | Initial Draft | Reverse engineered from official Word template |