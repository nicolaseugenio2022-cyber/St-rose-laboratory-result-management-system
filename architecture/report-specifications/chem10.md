# Chemistry 10 (Chem 10) Specification

## Original Client Notes (Tagalog / Taglish)
> Sa chem din automatic na si Dr. Heinz Roland Asperas sa requested by pero yung pwede pa rin iedit or itype kung sino doctor na iba
> Automatic computed values:
> HDL = Cholesterol * 40 / 150
> LDL = Triglycerides / 5 + HDL - Cholesterol
> Standard 10 parameters (FBS, Cholesterol, Triglycerides, HDL, LDL, Uric Acid, Blood Urea Nitrogen, SGPT/ALT, SGOT/AST, Creatinine)

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `CHEM_10`
- **Report Title:** Clinical Chemistry (Chem 10)
- **Requirement Status:** Required Report
- **Examination Family:** Clinical Chemistry
- **Renderer Family:** Tabular

### Requested By & Demographic Policy
- **Requested By Default:** `Dr. Heinz Roland Asperas` (Editable initial value)
- **Requested By Policy:** Populates Dr. Heinz Roland Asperas if empty; editable by staff.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Omitted from report demographic header.

### Parameters & Input Controls
1. **Fasting Blood Sugar** (`FBS`): `70–110` `mg/dL` (`NumericText`)
2. **Cholesterol** (`CHOLESTEROL`): `< 200` `mg/dL` (`NumericText`)
3. **Triglycerides** (`TRIGLYCERIDES`): `35–165` `mg/dL` (`NumericText`)
4. **HDL** (`HDL`): `0–110` `mg/dL` (`Computed`: $Cholesterol \times 40 / 150$, 2 decimals half-up)
5. **LDL** (`LDL`): `< 150` `mg/dL` (`Computed`: $Triglycerides / 5 + HDL_{unrounded} - Cholesterol$, 2 decimals half-up)
6. **Uric Acid** (`URIC_ACID`): Male `3.4–7.0`, Female `2.4–5.7` `mg/dL` (`NumericText`)
7. **Blood Urea Nitrogen** (`BUN`): `10–45` `mg/dL` (`NumericText`)
8. **SGPT / ALT** (`SGPT_ALT`): `4–41` `U/L` (`NumericText`)
9. **SGOT / AST** (`SGOT_AST`): `4–41` `U/L` (`NumericText`)
10. **Creatinine** (`CREATININE`): `0.4–1.4` `mg/dL` (`NumericText`)

### Reagent Kit Information
- **Requires Kit Info:** No

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Output-Specific Behavior:** Auto-calculates read-only HDL and LDL from entered Cholesterol and Triglycerides.
