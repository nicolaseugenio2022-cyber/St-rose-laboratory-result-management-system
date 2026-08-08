# Validation Evidence: CBC (Complete Blood Count)

- **Template Code**: CBC
- **Official Template Name**: Complete Blood Count
- **Examination Family**: Hematology
- **Renderer Family**: Tabular
- **Word Source File**: `Templates/CBC.docx`
- **Specification Source**: `architecture/specifications/CBC.md`
- **Reconciled Parameter Count**: 10 Parameters (`HEMOGLOBIN`, `HEMATOCRIT`, `RBC`, `WBC`, `PLATELET`, `NEUTROPHIL`, `LYMPHOCYTE`, `EOSINOPHIL`, `MONOCYTE`, `BASOPHIL`)

---

## 1. Representative Validation Clinical Test Data

```json
{
  "templateCode": "CBC",
  "accessionNumber": "SR-2026-0808-001",
  "demographics": {
    "fullName": "Juan Dela Cruz",
    "age": 35,
    "sex": "Male",
    "address": "STA. ROSA, NUEVA ECIJA",
    "requestingPhysician": "Dr. Ralph Roland Asperas",
    "examinationDate": "2026-08-08"
  },
  "results": [
    { "parameterCode": "HEMOGLOBIN", "parameterName": "Hemoglobin", "resultValue": "145", "unit": "g/L", "ref": "130–160" },
    { "parameterCode": "HEMATOCRIT", "parameterName": "Hematocrit", "resultValue": "0.42", "unit": "L/L", "ref": "0.40–0.52" },
    { "parameterCode": "RBC", "parameterName": "RBC Count", "resultValue": "4.8", "unit": "x10^12/L", "ref": "4.5–6.0" },
    { "parameterCode": "WBC", "parameterName": "WBC Count", "resultValue": "6.5", "unit": "x10^9/L", "ref": "5.0–10.0" },
    { "parameterCode": "PLATELET", "parameterName": "Platelet Count", "resultValue": "250", "unit": "x10^9/L", "ref": "150–450" },
    { "parameterCode": "NEUTROPHIL", "parameterName": "Neutrophil", "resultValue": "0.60", "unit": null, "ref": "0.50–0.70" },
    { "parameterCode": "LYMPHOCYTE", "parameterName": "Lymphocyte", "resultValue": "0.30", "unit": null, "ref": "0.25–0.40" },
    { "parameterCode": "EOSINOPHIL", "parameterName": "Eosinophil", "resultValue": "0.02", "unit": null, "ref": "0.01–0.04" },
    { "parameterCode": "MONOCYTE", "parameterName": "Monocyte", "resultValue": "0.05", "unit": null, "ref": "0.03–0.08" },
    { "parameterCode": "BASOPHIL", "parameterName": "Basophil", "resultValue": "0.01", "unit": null, "ref": "0.00–0.01" }
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
- **Discrepancies Identified**: None.
- **Validation Verdict**: ✅ **PASS**
