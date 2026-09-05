# Chemistry 10 (Chem 10) Specification

> **Preserved historical record.** This document is part of the client-note and implementation-source
> archive under `architecture/report-specifications/`. It is **not** the maintained specification:
> the maintained detailed specification is `architecture/specifications/<TEMPLATE_CODE>.md`, and
> `architecture/report-specifications/Summary.md` remains authoritative for the client requirements it
> explicitly records. See `architecture/README.md`.

## Original Client Notes (Tagalog / Taglish)
> Sa chem din automatic na si Dr. Heinz Roland Asperas sa requested by pero yung pwede pa rin iedit or itype kung sino doctor na iba
> Automatic computed values:
> HDL = Cholesterol * 40 / 150
> LDL = Triglycerides / 5 + HDL - Cholesterol
> Standard 10 parameters (FBS, Cholesterol, Triglycerides, HDL, LDL, Uric Acid, Blood Urea Nitrogen, SGPT/ALT, SGOT/AST, Creatinine)

**Correction — not part of the historical note above.**

- The Original Client Notes are retained verbatim above for traceability.
- The operative approved contract under DEC-028 / ADR-009 is:
  `LDL = Total Cholesterol − active HDL − (Triglycerides ÷ 5)`
- Active HDL is the client-calculated HDL while HDL is in Auto mode, and the operator-entered
  HDL while HDL is in Manual mode.
- The application's combined Auto/Manual policy must not be represented as standard Friedewald
  behaviour.

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
4. **HDL** (`HDL`): `0–110` `mg/dL` (`Computed`, formula-bound; defaults to Auto and independently supports operator-selected Manual entry: $Cholesterol \times 40 / 150$, 2 decimals half-up)
5. **LDL** (`LDL`): `< 150` `mg/dL` (`Computed`, formula-bound; defaults to Auto and independently supports operator-selected Manual entry: $Cholesterol - HDL_{active} - Triglycerides / 5$, 2 decimals half-up)
6. **Uric Acid** (`URIC_ACID`): Male `3.4–7.0`, Female `2.4–5.7` `mg/dL` (`NumericText`)
7. **Blood Urea Nitrogen** (`BUN`): `10–45` `mg/dL` (`NumericText`)
8. **SGPT / ALT** (`SGPT_ALT`): `4–41` `U/L` (`NumericText`)
9. **SGOT / AST** (`SGOT_AST`): `4–41` `U/L` (`NumericText`)
10. **Creatinine** (`CREATININE`): `0.4–1.4` `mg/dL` (`NumericText`)

Manual is an entry mode only: HDL and LDL each keep the declared `Computed` control type in both
Auto and Manual mode.

### Reagent Kit Information
- **Requires Kit Info:** No

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Output-Specific Behavior:**
  - While HDL is in Auto, it is read-only and calculated from Cholesterol.
  - While LDL is in Auto, it is read-only and calculated from Total Cholesterol, Triglycerides and
    the active HDL.
  - Active HDL is the exact unrounded calculated HDL while HDL is in Auto, or the parsed positive
    operator-entered HDL while HDL is in Manual.
  - While either parameter is in Manual, that parameter is editable under the approved validation
    contract.
  - Auto → Manual immediately clears the current calculated result, enters Manual mode, and
    permits operator entry under the existing validation contract.
  - Manual → Auto requires confirmation before the Manual value is discarded: confirming discards
    the Manual result and recalculates in Auto, while cancelling preserves Manual mode and the
    entered value.
  - Both directions apply independently to HDL and to LDL.
