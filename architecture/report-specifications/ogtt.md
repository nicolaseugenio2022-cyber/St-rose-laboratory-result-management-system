# Oral Glucose Tolerance Test (OGTT) Specification

## Original Client Notes (Tagalog / Taglish)
> Fasting Blood Sugar: < 100 mg/dL
> 1 Hour: < 200 mg/dL
> 2 Hours: < 140 mg/dL
> Requested by: Dr. Heinz Roland Asperas by default, pero naeedit.

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `OGTT`
- **Report Title:** Oral Glucose Tolerance Test (OGTT)
- **Requirement Status:** Required Report
- **Examination Family:** Clinical Chemistry
- **Renderer Family:** Tabular

### Requested By & Demographic Policy
- **Requested By Default:** `Dr. Heinz Roland Asperas` (Editable initial value)
- **Requested By Policy:** Populates Dr. Heinz Roland Asperas if empty; editable by staff.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Omitted from report demographic header.

### Parameters & Reference Intervals
1. **Fasting Blood Sugar** (`FBS`): `< 100` `mg/dL` (`NumericText`)
2. **1 Hour** (`OGTT_1HR`): `< 200` `mg/dL` (`NumericText`)
3. **2 Hours** (`OGTT_2HR`): `< 140` `mg/dL` (`NumericText`)

### Reagent Kit Information
- **Requires Kit Info:** No

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Output-Specific Behavior:** Prints 3-stage timed glucose tolerance table.