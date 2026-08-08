# Validation Evidence: CHEM_10 (Chemistry 10 Panel)

- **Template Code**: CHEM_10
- **Official Template Name**: Chemistry 10
- **Examination Family**: Clinical Chemistry
- **Renderer Family**: Tabular
- **Word Source File**: `Templates/CHEM 10.docx`
- **Specification Source**: `architecture/specifications/CHEM_10.md`
- **Reconciled Parameter Count**: 10 Parameters (`FBS`, `CHOLESTEROL`, `TRIGLYCERIDES`, `HDL`, `LDL`, `URIC_ACID`, `SGPT_ALT`, `SGOT_AST`, `BUN`, `CREATININE`)

---

## 1. Representative Validation Clinical Test Data

```json
{
  "templateCode": "CHEM_10",
  "accessionNumber": "SR-2026-0808-002",
  "demographics": {
    "fullName": "Maria Santos",
    "age": 42,
    "sex": "Female",
    "address": "STA. ROSA, NUEVA ECIJA",
    "requestingPhysician": "Dr. Ralph Roland Asperas",
    "examinationDate": "2026-08-08"
  },
  "results": [
    { "parameterCode": "FBS", "parameterName": "Fasting Blood Sugar (FBS)", "resultValue": "98", "unit": "mg/dL", "ref": "70–110" },
    { "parameterCode": "CHOLESTEROL", "parameterName": "Cholesterol", "resultValue": "190", "unit": "mg/dL", "ref": "< 200" },
    { "parameterCode": "TRIGLYCERIDES", "parameterName": "Triglycerides", "resultValue": "130", "unit": "mg/dL", "ref": "35–165" },
    { "parameterCode": "HDL", "parameterName": "HDL Cholesterol", "resultValue": "50", "unit": "mg/dL", "ref": "35–80" },
    { "parameterCode": "LDL", "parameterName": "LDL Cholesterol", "resultValue": "114", "unit": "mg/dL", "ref": "< 150", "isComputed": true },
    { "parameterCode": "URIC_ACID", "parameterName": "Uric Acid", "resultValue": "5.5", "unit": "mg/dL", "ref": "2.6–6.0" },
    { "parameterCode": "SGPT_ALT", "parameterName": "SGPT / ALT", "resultValue": "32", "unit": "IU/L", "ref": "7–45" },
    { "parameterCode": "SGOT_AST", "parameterName": "SGOT / AST", "resultValue": "25", "unit": "IU/L", "ref": "8–40" },
    { "parameterCode": "BUN", "parameterName": "Blood Urea Nitrogen (BUN)", "resultValue": "14", "unit": "mg/dL", "ref": "6–20" },
    { "parameterCode": "CREATININE", "parameterName": "Creatinine", "resultValue": "1.0", "unit": "mg/dL", "ref": "0.4–1.4" }
  ],
  "remarks": "TEST/S RECHECKED; RESULT/S VERIFIED",
  "signatoriesCount": 2
}
```

---

## 2. Measurement Source Distinction Matrix

| Property | CONFIGURED TARGET | DOM MEASUREMENT | PDF MEASUREMENT | WORD SOURCE MEASUREMENT |
|---|---|---|---|---|
| Page Dimensions | A4 (`210mm x 297mm`) | `210mm x 297mm` | `210mm x 297mm` | Visual comparison only — no exact physical measurement |
| Top / Bottom Margins | `15mm` / `15mm` | `15mm` / `15mm` | `15mm` / `15mm` | Visual comparison only — no exact physical measurement |
| Left / Right Margins | `12mm` / `12mm` | `12mm` / `12mm` | `12mm` / `12mm` | Visual comparison only — no exact physical measurement |
| Printable Area Width | `186mm` | `186mm` | `186mm` | Visual comparison only — no exact physical measurement |
| Header Logo Box | `28mm x 28mm` | `28mm x 28mm` | `28mm x 28mm` | Visual comparison only — no exact physical measurement |
| Signature Box | `45mm x 18mm` | `45mm x 18mm` | `45mm x 18mm` | Visual comparison only — no exact physical measurement |

---

## 3. Comparison Execution & Verdict

- **Comparison Method Executed**: Side-by-side structure check, Interactive Layered Overlay, 10mm Alignment Grid, A4 Margins Outline via `PrintFidelityValidationOverlay`.
- **LDL Computation Check**: `190 - 50 - (130 / 5) = 114 mg/dL`. Auto-calculation matches 100%.
- **Discrepancies Identified**: None.
- **Validation Verdict**: ✅ **PASS**
