# Routine Fecalysis Specification

## Original Client Notes (Tagalog / Taglish)
> Pakiiba na lang po design yung same lang with other tests
> Drop down:
> Color: Brown, Yellowish Brown, Dark Brown, Black, Green, Greenish Brown, Red, Reddish Brown (+edit option/natatype)
> Consistency: Soft, Loose, Semi-Formed, Formed, Mushy, Watery
> Yung “/HPF” as is na yun di na napapalitan
> Bacteria: 4+ as is na pero naeedit pa rin
> Parasite: Automatic yung nakalagay pero naeedit
> Yung mga Blank baka pwedeng di na sya lalables sa result if blank naman

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `FECALYSIS`
- **Report Title:** Routine Fecalysis
- **Requirement Status:** Required Report
- **Examination Family:** Clinical Microscopy
- **Renderer Family:** Tabular

### Requested By & Demographic Policy
- **Requested By Default:** `Dr. Ma. Floricel Dedace-Lagrazon` (Editable initial value)
- **Requested By Policy:** Populates Dr. Ma. Floricel Dedace-Lagrazon when empty; editable by staff.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Omitted from report demographic header.

### Parameters & Input Controls
1. **Color** (`COLOR`): Required Combobox (`Brown`, `Yellowish Brown`, `Dark Brown`, `Black`, `Green`, `Greenish Brown`, `Red`, `Reddish Brown` + editable free text)
2. **Consistency** (`CONSISTENCY`): Required Combobox (`Soft`, `Loose`, `Semi-Formed`, `Formed`, `Mushy`, `Watery` + editable free text)
3. **Pus Cells** (`PUS_CELLS`): Unrestricted single-line result text (`FreeText`). Raw input stores value portion only (e.g. `0-2`, `>50`). Appends fixed ` /HPF` suffix for display/PDF.
4. **Red Cells** (`RED_CELLS`): Unrestricted single-line result text (`FreeText`). Raw input stores value portion only (e.g. `0-1`, `>50`). Appends fixed ` /HPF` suffix for display/PDF.
5. **Bacteria** (`BACTERIA`): Unrestricted editable result text field (`FreeText`, NOT a dropdown/combobox). Pre-filled initial default value: `4+`; staff may replace or edit.
6. **Parasites / Ova** (`PARASITES`): Unrestricted editable result text field (`FreeText`). Pre-filled automatic default value: `NO INTESTINAL PARASITES OR OVA SEEN`; staff may replace or edit.

### Report Output & Blank Omission Policy
- **Explicit Blank Omission Rule:** Optional blank Fecalysis findings do not produce rows or placeholder values in Live Preview or PDF. Only populated findings are rendered on the output report.

### Reagent Kit Information
- **Requires Kit Info:** No

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Fixed Suffix Rule:** Pus Cells and Red Cells store only the entered value portion and render the ` /HPF` suffix exactly once in preview and PDF without double-appending.
