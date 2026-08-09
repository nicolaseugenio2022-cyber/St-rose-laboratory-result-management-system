# Routine Urinalysis Specification

## Original Client Notes (Tagalog / Taglish)
> Color dropdown = Straw, Pale Yellow, Light Yellow, Yellow, Dark Yellow, Amber, Brown, Red (+edit option)
> Clarity = Clear, Slightly Hazy, Hazy, Slightly Cloudy, Cloudy, Slightly Turbid, Turbid (+edit)
> pH = 5.0, 6.0, 6.5, 7.0, 7.5, 8.0, 9.0
> Specific Gravity = 1.000, 1.005, 1.010, 1.015, 1.020, 1.025, 1.030
> Protein = Negative, Trace, 1+, 2+, 3+, 4+
> Glucose = Negative, Trace, 1+, 2+, 3+, 4+
> Sa WBC at RBC = as is yung “/HPF” hindi sya napapalitan yung number lang example ng result “0-2” “>50” “TOO NUMEROUS TO COUNT/HPF”
> Epithelial cells, bacteria, and mucus threads = Rare, Few, Moderate, Many, Plenty
> Yung sa may amorphous urates kahit nagiging blank na lang sya if walang urates or phosphates na Nakita pero sa space na yon ang reporting is either:
> Amorphous Urates: Or Amorphous Phosphates: Tapos ang dropdown ay: Rare, Few, Moderate, Many, Plenty
> Then if may other crystals sa result: sa ilalim sya ng glucose, example: “Calcium Oxalate Crystals: Rare” or “WBC seen in clumps”

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `URINALYSIS`
- **Report Title:** Routine Urinalysis
- **Requirement Status:** Required Report
- **Examination Family:** Clinical Microscopy
- **Renderer Family:** DiagnosticGrid

### Requested By & Demographic Policy
- **Requested By Default:** `None` (Staff Entry Required)
- **Requested By Policy:** Starts blank; editable by staff.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Omitted from report demographic header.

### Physical & Chemical Examination Parameters
1. **Color** (`COLOR`): Combobox (`Straw`, `Pale Yellow`, `Light Yellow`, `Yellow`, `Dark Yellow`, `Amber`, `Brown`, `Red` + editable free text)
2. **Transparency / Clarity** (`TRANSPARENCY`): Combobox (`Clear`, `Slightly Hazy`, `Hazy`, `Slightly Cloudy`, `Cloudy`, `Slightly Turbid`, `Turbid` + editable free text)
3. **pH** (`PH`): Combobox / SingleSelect (`5.0`, `6.0`, `6.5`, `7.0`, `7.5`, `8.0`, `9.0`)
4. **Specific Gravity** (`SP_GRAVITY`): Combobox / SingleSelect (`1.000`, `1.005`, `1.010`, `1.015`, `1.020`, `1.025`, `1.030`)
5. **Protein** (`PROTEIN`): Combobox / SingleSelect (`Negative`, `Trace`, `1+`, `2+`, `3+`, `4+`)
6. **Glucose** (`GLUCOSE`): Combobox / SingleSelect (`Negative`, `Trace`, `1+`, `2+`, `3+`, `4+`)

### Microscopic Examination Parameters
7. **Pus Cells / WBC** (`WBC`): Unrestricted single-line result-text field (`FreeText`, NOT restricted to numeric-only input). Staff enter editable result portion only (e.g. `0-2`, `>50`, `TOO NUMEROUS TO COUNT`). Appends fixed ` /HPF` suffix for display and PDF. Normalizer deduplicates `/HPF` if legacy stored values already contain it.
8. **Red Cells / RBC** (`RBC`): Unrestricted single-line result-text field (`FreeText`, NOT restricted to numeric-only input). Staff enter editable result portion only (e.g. `0-1`, `>50`, `TOO NUMEROUS TO COUNT`). Appends fixed ` /HPF` suffix for display and PDF. Normalizer deduplicates `/HPF` if legacy stored values already contain it.
9. **Epithelial Cells** (`EPITHELIAL_CELLS`): SingleSelect (`Rare`, `Few`, `Moderate`, `Many`, `Plenty`)
10. **Bacteria** (`BACTERIA`): SingleSelect (`Rare`, `Few`, `Moderate`, `Many`, `Plenty`)
11. **Mucus Threads** (`MUCUS_THREADS`): SingleSelect (`Rare`, `Few`, `Moderate`, `Many`, `Plenty`)

### Conditional Primary Crystal Field
12. **Amorphous Urates / Phosphates** (`AMORPHOUS_CRYSTAL`):
    - Selection control: Choice between `Amorphous Urates` or `Amorphous Phosphates` label with result options `Rare`, `Few`, `Moderate`, `Many`, `Plenty`.
    - If unselected/blank, row is omitted from printed output without leaving empty lines.

### Repeatable Additional Findings Group
13. **Additional Findings** (`ADDITIONAL_FINDINGS`):
    - Supports multiple repeatable entries (e.g. `Calcium Oxalate Crystals: Rare`, `WBC seen in clumps`).
    - Staff can add, remove, and reorder entries.
    - Only populated findings are printed on the report.

### Reagent Kit Information
- **Requires Kit Info:** No

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Fixed Suffix Rule:** WBC and RBC store editable value portion only and display `/HPF` suffix exactly once in preview and PDF without duplication.
