# Chemistry 8 (Chem 8) Specification

## Original Client Notes (Tagalog / Taglish)
> Dropdown:
> FBS: 70–110 mg/dL
> Cholesterol: < 200 mg/dL
> Triglycerides: 35–165 mg/dL
> Uric Acid: Male 3.4–7.0 mg/dL, Female 2.4–5.7 mg/dL
> SGPT/ALT: 4–41 U/L
> Creatinine: 0.4–1.4 mg/dL
> Requested by: WALANG AUTOMATIC NA DR. RALPH AS PERAS DITO. (Staff enter physician)

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `CHEM_8`
- **Report Title:** Clinical Chemistry (Chem 8)
- **Requirement Status:** Required Report
- **Examination Family:** Clinical Chemistry
- **Renderer Family:** Tabular

### Requested By & Demographic Policy
- **Requested By Default:** `None` (Staff Entry Required)
- **Requested By Policy:** Starts blank; staff must enter physician.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Omitted from report demographic header.

### Parameters & Reference Intervals
1. **Fasting Blood Sugar** (`FBS`): `70–110` `mg/dL`
2. **Cholesterol** (`CHOLESTEROL`): `< 200` `mg/dL`
3. **Triglycerides** (`TRIGLYCERIDES`): `35–165` `mg/dL`
4. **Uric Acid** (`URIC_ACID`): Male `3.4–7.0`, Female `2.4–5.7` `mg/dL`
5. **SGPT / ALT** (`SGPT_ALT`): `4–41` `U/L`
6. **Creatinine** (`CREATININE`): `0.4–1.4` `mg/dL`

### Reagent Kit Information
- **Requires Kit Info:** No

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Output-Specific Behavior:** Standard tabular clinical chemistry layout with 6 parameters (no computed HDL/LDL).
