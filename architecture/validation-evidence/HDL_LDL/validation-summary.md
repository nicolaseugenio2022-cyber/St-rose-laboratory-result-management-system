# Validation Evidence: HDL_LDL (Lipid Profile HDL/LDL)

- **Template Code**: HDL_LDL
- **Official Template Name**: Lipid Profile (HDL/LDL)
- **Examination Family**: Clinical Chemistry
- **Renderer Family**: Tabular
- **Word Source File**: `Templates/HDL-LDL.docx`
- **Specification Source**: `architecture/specifications/HDL_LDL.md`
- **Reconciled Parameter Count**: 4 Parameters (`CHOLESTEROL`, `TRIGLYCERIDES`, `HDL`, `LDL`)

---

## 1. Representative Validation Clinical Test Data

```json
{
  "templateCode": "HDL_LDL",
  "accessionNumber": "SR-2026-0808-007",
  "demographics": { "fullName": "Maria Santos", "age": 42, "sex": "Female", "address": "STA. ROSA, NUEVA ECIJA", "requestingPhysician": "Dr. Ralph Roland Asperas", "examinationDate": "2026-08-08" },
  "results": [
    { "parameterCode": "CHOLESTEROL", "parameterName": "Cholesterol", "resultValue": "210", "unit": "mg/dL", "ref": "< 200" },
    { "parameterCode": "TRIGLYCERIDES", "parameterName": "Triglycerides", "resultValue": "150", "unit": "mg/dL", "ref": "35–165" },
    { "parameterCode": "HDL", "parameterName": "HDL Cholesterol", "resultValue": "45", "unit": "mg/dL", "ref": "35–80" },
    { "parameterCode": "LDL", "parameterName": "LDL Cholesterol", "resultValue": "135", "unit": "mg/dL", "ref": "< 150", "isComputed": true }
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

- **Differences Found**: None. Friedewald LDL computation `210 - 45 - (150/5) = 135` matches.
- **Validation Verdict**: ✅ **PASS**
