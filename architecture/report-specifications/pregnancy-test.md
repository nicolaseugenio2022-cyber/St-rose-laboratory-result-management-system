# Pregnancy Test Specification

## Original Client Notes (Tagalog / Taglish)
> Naeedit lot no. and exp date pero yan gamit now
> Result dropdown = negative, positive

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `PREG_TEST`
- **Report Title:** Pregnancy Test
- **Requirement Status:** Required Report
- **Examination Family:** Serology & Immunology
- **Renderer Family:** SimpleResult

### Requested By & Demographic Policy
- **Requested By Default:** `Dr. Ralph Roland Asperas` (Editable initial value)
- **Requested By Policy:** Populates Dr. Ralph Roland Asperas if empty; editable by staff.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Omitted from report demographic header.

### Parameters & Input Controls
1. **Pregnancy Test Result** (`PREG_RESULT`)
   - **Input Type:** `SingleSelect`
   - **Options:** `Negative`, `Positive`
   - **Required:** Yes

### Reagent Kit Information
- **Requires Kit Info:** Yes (Required for completion & printed on report)
- **Lot Number:** Required staff entry (Editable)
- **Expiration Date:** Required staff entry (Editable)

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Output-Specific Behavior:** Prints qualitative Negative/Positive result alongside required reagent kit metadata.