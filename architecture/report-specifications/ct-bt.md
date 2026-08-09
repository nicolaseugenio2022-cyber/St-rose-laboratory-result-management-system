# Clotting Time & Bleeding Time (CT-BT) Specification

## Original Client Notes (Tagalog / Taglish)
> Bleeding Time: 1–4 mins
> Clotting Time: 2–6 mins
> Requested by: Dr. Ralph Roland Asperas by default, pero naeedit.

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `CT_BT`
- **Report Title:** Clotting Time & Bleeding Time
- **Requirement Status:** Required Report
- **Examination Family:** Hematology
- **Renderer Family:** SimpleResult

### Requested By & Demographic Policy
- **Requested By Default:** `Dr. Ralph Roland Asperas` (Editable initial value)
- **Requested By Policy:** Populates Dr. Ralph Roland Asperas if empty; editable by staff.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Omitted from report demographic header.

### Parameters & Reference Intervals
1. **Bleeding Time** (`BLEEDING_TIME`)
   - **Input Type:** `NumericText` / `FreeText`
   - **Reference Interval:** `1–4 mins`
   - **Required:** Yes
2. **Clotting Time** (`CLOTTING_TIME`)
   - **Input Type:** `NumericText` / `FreeText`
   - **Reference Interval:** `2–6 mins`
   - **Required:** Yes

### Reagent Kit Information
- **Requires Kit Info:** No

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Output-Specific Behavior:** Clean 2-parameter Bleeding and Clotting Time table.
