# Glycated Hemoglobin (HbA1c) Specification

## Original Client Notes (Tagalog / Taglish)
> Palagay din ng:
> Lot Number: F20712509AD
> Expiration Date: 2028-04-26
> Yung result matic may % number lang napapalitan
> HbA1c talaga format nya hindi all caps

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `HBA1C`
- **Report Title:** Glycated Hemoglobin (HbA1c)
- **Casing Rule:** Must use exact mixed-case `HbA1c` title (never all caps `HBA1C`).
- **Requirement Status:** Required Report
- **Examination Family:** Clinical Chemistry
- **Renderer Family:** SimpleResult

### Requested By & Demographic Policy
- **Requested By Default:** `Dr. Heinz Roland Asperas` (Editable initial value)
- **Requested By Policy:** Populates Dr. Heinz Roland Asperas when empty; editable by staff.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Omitted from report demographic header.

### Parameters & Input Controls
1. **HbA1c Result** (`HBA1C_RESULT`)
   - **Input Type:** `NumericText` (Staff enter numeric portion only)
   - **Fixed Display Suffix:** `%` (Appended generically for display and PDF)
   - **Reference Interval:** `< 6.5 %` (Normal)
   - **Required:** Yes

### Reagent Kit Information
- **Requires Kit Info:** Yes (Required field for completion & printed on report)
- **Current Initial Lot Number:** `F20712509AD` (Pre-filled initial value)
- **Current Initial Expiration Date:** `2028-04-26` (Pre-filled initial value)
- **Kit Field Editability:** Editable by staff.
  - *Authority Evidence:* Preserved specification `architecture/specifications/HBA1C.md` (Sections 12 & 17) explicitly documents the client instruction: *"Reagent Kit Information Display: Lot Number F20712509AD, Expiration Date 2028-04-26 — Both remain editable."*

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Output-Specific Behavior:** Prints numeric HbA1c result with `%` suffix, normal value `<6.5%`, and required staff-editable reagent kit metadata.
