# Erythrocyte Sedimentation Rate (ESR) Specification

## Original Client Notes (Tagalog / Taglish)
> ESR result = numeric mm/hr
> Reference interval:
> Male: 0–15 mm/hr
> Female: 0–20 mm/hr
> Children: 0–13 mm/hr

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `ESR`
- **Report Title:** Erythrocyte Sedimentation Rate (ESR)
- **Requirement Status:** Required Report
- **Examination Family:** Hematology
- **Renderer Family:** SimpleResult

### Requested By & Demographic Policy
- **Requested By Default:** `Dr. Ralph Roland Asperas` (Editable initial value)
- **Requested By Policy:** Populates Dr. Ralph Roland Asperas if empty; editable by staff.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Omitted from report demographic header.

### Parameters & Reference Intervals
1. **ESR Result** (`ESR_RESULT`)
   - **Input Type:** `NumericText`
   - **Unit:** `mm/hr`
   - **Reference Intervals:**
     - Male: `0–15 mm/hr`
     - Female: `0–20 mm/hr`
     - Children: `0–13 mm/hr`
   - **Required:** Yes

### Reagent Kit Information
- **Requires Kit Info:** No

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Output-Specific Behavior:** Prints single numeric ESR result with sex/age-dependent reference intervals.