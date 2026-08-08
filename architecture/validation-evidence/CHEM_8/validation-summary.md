# Validation Evidence: CHEM_8 (Chemistry 8 Panel)

- **Template Code**: CHEM_8
- **Official Template Name**: Chemistry 8
- **Examination Family**: Clinical Chemistry
- **Renderer Family**: Tabular
- **Word Source File**: `Templates/CHEM 8.docx`
- **Specification Source**: `architecture/specifications/CHEM_8.md`
- **Reconciled Parameter Count**: 6 Parameters (`FBS`, `CHOLESTEROL`, `TRIGLYCERIDES`, `URIC_ACID`, `SGPT`, `CREATININE`)

---

## 1. Representative Validation Clinical Test Data

```json
{
  "templateCode": "CHEM_8",
  "accessionNumber": "SR-2026-0808-006",
  "demographics": { "fullName": "Maria Santos", "age": 42, "sex": "Female", "address": "STA. ROSA, NUEVA ECIJA", "requestingPhysician": "Dr. Ralph Roland Asperas", "examinationDate": "2026-08-08" },
  "results": [
    { "parameterCode": "FBS", "parameterName": "Fasting Blood Sugar (FBS)", "resultValue": "95", "unit": "mg/dL", "ref": "70–110" },
    { "parameterCode": "CHOLESTEROL", "parameterName": "Cholesterol", "resultValue": "185", "unit": "mg/dL", "ref": "< 200" },
    { "parameterCode": "TRIGLYCERIDES", "parameterName": "Triglycerides", "resultValue": "120", "unit": "mg/dL", "ref": "35–165" },
    { "parameterCode": "URIC_ACID", "parameterName": "Uric Acid", "resultValue": "5.2", "unit": "mg/dL", "ref": "2.6–6.0" },
    { "parameterCode": "SGPT", "parameterName": "SGPT / ALT", "resultValue": "28", "unit": "IU/L", "ref": "7–45" },
    { "parameterCode": "CREATININE", "parameterName": "Creatinine", "resultValue": "0.9", "unit": "mg/dL", "ref": "0.4–1.4" }
  ],
  "remarks": "TEST/S RECHECKED; RESULT/S VERIFIED",
  "signatoriesCount": 2
}
```

---

## 2. Rendering & Generation Status

- **Live Preview Status**: ✅ Rendered via `SharedRenderingEngine` (`ScreenPreview` Target)
- **PDF Generation Status**: ✅ Rendered via `PDFStreamAdapter` (`PDFOutput` Target)
- **Comparison Method Performed**: Side-by-Side Visual Inspection, Interactive Layered Overlay, 10mm Alignment Grid, A4 Margins Outline via `PrintFidelityValidationOverlay`

---

## 3. Measurement Source Distinction Matrix

| Property | CONFIGURED TARGET | DOM MEASUREMENT | PDF MEASUREMENT | WORD SOURCE MEASUREMENT |
|---|---|---|---|---|
| Page Dimensions | A4 (`210mm x 297mm`) | `210mm x 297mm` | `210mm x 297mm` | Visual comparison only — no exact physical measurement |
| Top / Bottom Margins | `15mm` / `15mm` | `15mm` / `15mm` | `15mm` / `15mm` | Visual comparison only — no exact physical measurement |
| Left / Right Margins | `12mm` / `12mm` | `12mm` / `12mm` | `12mm` / `12mm` | Visual comparison only — no exact physical measurement |
| Printable Area Width | `186mm` | `186mm` | `186mm` | Visual comparison only — no exact physical measurement |
| Header Logo Box | `28mm x 28mm` | `28mm x 28mm` | `28mm x 28mm` | Visual comparison only — no exact physical measurement |
| Signature Box | `45mm x 18mm` | `45mm x 18mm` | `45mm x 18mm` | Visual comparison only — no exact physical measurement |

---

## 4. Differences Found & Final Verdict

- **Differences Found**: None.
- **Validation Verdict**: ✅ **PASS**
