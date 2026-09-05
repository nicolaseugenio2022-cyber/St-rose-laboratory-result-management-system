# Random Blood Sugar (RBS) Specification

> **Preserved historical record.** This document is part of the client-note and implementation-source
> archive under `architecture/report-specifications/`. It is **not** the maintained specification:
> the maintained detailed specification is `architecture/specifications/<TEMPLATE_CODE>.md`, and
> `architecture/report-specifications/Summary.md` remains authoritative for the client requirements it
> explicitly records. See `architecture/README.md`.

## Original Client Notes (Tagalog / Taglish)
> Kahit isama na lang to sa chem, rare naman kasi to.
> Random blood sugar yan

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `RBS`
- **Report Title:** Random Blood Sugar (RBS)
- **Requirement Status:** Required Report
- **Examination Family:** Clinical Chemistry
- **Renderer Family:** Tabular / SimpleResult

### Requested By & Demographic Policy
- **Requested By Default:** `Dr. Ralph Roland Asperas` (Editable initial value)
- **Requested By Policy:** Populates Dr. Ralph Roland Asperas if empty; editable by staff.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Omitted from report demographic header.

### Parameters & Reference Intervals
1. **Random Blood Sugar** (`RBS_RESULT`)
   - **Input Type:** `NumericText`
   - **Unit:** `mg/dL`
   - **Reference Interval:** `90–145 mg/dL`
   - **Required:** Yes

### Reagent Kit Information
- **Requires Kit Info:** No

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Output-Specific Behavior:** Prints single numeric Random Blood Sugar result with normal reference interval `90–145 mg/dL`.
