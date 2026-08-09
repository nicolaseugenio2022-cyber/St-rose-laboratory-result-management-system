# Complete Blood Count (CBC) Specification

## Original Client Notes (Tagalog / Taglish)
> Values Table:
> Hemoglobin: Male 130–160 g/L, Female 120–140 g/L
> Hematocrit: Male 0.40–0.52, Female 0.37–0.42
> RBC count: Male 4.5–6.0 x 10^12/L, Female 4.0–5.5 x 10^12/L
> WBC count: 5.0–10.0 x 10^9/L
> Platelet Count: 150–450 x 10^9/L
> Differential Count: Neutrophil 0.50–0.70, Lymphocyte 0.25–0.40, Eosinophil 0.01–0.04, Monocyte 0.03–0.08, Basophil 0.00–0.01
>
> Drop down (sa lahat ng tests naman to): Sex, Date, Address, Requested by (Dr. Ralph Roland Asperas / Dr. Heinz Roland Asperas)
> Sa CBC automatic na si Dr. Ralph Roland Asperas sa requested by pero yung pwede pa rin iedit or itype kung sino doctor na iba.
> Sa may remarks matic na yung “TEST/S RECHECKED; RESULT/S VERIFIED” pero naeedit pa rin.
> IBAHIN NA LANG FONT STYLE UNIFORM WITH OTHER TESTS.

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `CBC`
- **Report Title:** Complete Blood Count (CBC)
- **Requirement Status:** Required Report
- **Examination Family:** Hematology
- **Renderer Family:** Tabular

### Requested By & Demographic Policy
- **Requested By Default:** `Dr. Ralph Roland Asperas` (Editable initial value)
- **Requested By Policy:** Populates Dr. Ralph Roland Asperas if empty; editable by staff.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Static report header label preserved as report content contract (independent from demographic collection).
- **Abnormal Indicator Policy:** Never permitted (suppressed entirely on print/PDF).

### Parameters & Reference Intervals
1. **Hemoglobin** (`HEMOGLOBIN`): Male `130–160`, Female `120–140` `g/L` (Precision: 0)
2. **Hematocrit** (`HEMATOCRIT`): Male `0.40–0.52`, Female `0.37–0.42` (Precision: 2)
3. **RBC Count** (`RBC_COUNT`): Male `4.5–6.0`, Female `4.0–5.5` `x 10^12/L` (Precision: 1)
4. **WBC Count** (`WBC_COUNT`): `5.0–10.0` `x 10^9/L` (Precision: 1)
5. **Platelet Count** (`PLATELET_COUNT`): `150–450` `x 10^9/L` (Precision: 0)
6. **Neutrophil** (`NEUTROPHIL`): `0.50–0.70` (Precision: 2)
7. **Lymphocyte** (`LYMPHOCYTE`): `0.25–0.40` (Precision: 2)
8. **Eosinophil** (`EOSINOPHIL`): `0.01–0.04` (Precision: 2)
9. **Monocyte** (`MONOCYTE`): `0.03–0.08` (Precision: 2)
10. **Basophil** (`BASOPHIL`): `0.00–0.01` (Precision: 2)

### Reagent Kit Information
- **Requires Kit Info:** No

### Remarks & Output Rules
- **Remarks Default:** `TEST/S RECHECKED; RESULT/S VERIFIED` (Editable by staff)
- **Output-Specific Behavior:** Omit report title header on document; suppress abnormal indicators (* / H / L) entirely.
