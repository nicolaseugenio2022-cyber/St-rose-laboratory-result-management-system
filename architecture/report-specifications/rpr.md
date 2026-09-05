# Rapid Plasma Reagin (RPR) Specification

> **Preserved historical record.** This document is part of the client-note and implementation-source
> archive under `architecture/report-specifications/`. It is **not** the maintained specification:
> the maintained detailed specification is `architecture/specifications/<TEMPLATE_CODE>.md`, and
> `architecture/report-specifications/Summary.md` remains authoritative for the client requirements it
> explicitly records. See `architecture/README.md`.

## Original Client Notes (Tagalog / Taglish)
> Naeedit lot no. and exp date pero yan gamit now
> Result dropdown = nonreactive, reactive

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `RPR`
- **Report Title:** Rapid Plasma Reagin (RPR)
- **Requirement Status:** Required Report
- **Examination Family:** Serology & Immunology
- **Renderer Family:** SimpleResult

### Requested By & Demographic Policy
- **Requested By Default:** `Dr. Ralph Roland Asperas` (Editable initial value)
- **Requested By Policy:** Populates Dr. Ralph Roland Asperas if empty; editable by staff.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Omitted from report demographic header.

### Parameters & Input Controls
1. **RPR Qualitative Result** (`RPR_RESULT`)
   - **Input Type:** `SingleSelect`
   - **Options:** `Nonreactive`, `Reactive`
   - **Required:** Yes

### Reagent Kit Information
- **Requires Kit Info:** Yes (Required for completion & printed on report)
- **Lot Number:** Required staff entry (Editable)
- **Expiration Date:** Required staff entry (Editable)

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Output-Specific Behavior:** Prints qualitative Nonreactive/Reactive result alongside required reagent kit lot and expiration date.
