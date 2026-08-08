# Validation Evidence: OGTT (Oral Glucose Tolerance Test)

- **Template Code**: OGTT
- **Official Template Name**: Oral Glucose Tolerance Test
- **Examination Family**: Clinical Chemistry
- **Renderer Family**: Tabular
- **Word Source File**: `Templates/OGTT NEW FORM.docx`
- **Specification Source**: `architecture/specifications/OGTT.md`
- **Reconciled Parameter Count**: 3 Parameters (`FASTING`, `FIRST_HOUR`, `SECOND_HOUR`)

---

## 1. Representative Validation Clinical Test Data

```json
{
  "templateCode": "OGTT",
  "accessionNumber": "SR-2026-0808-008",
  "demographics": { "fullName": "Pedro Reyes", "age": 28, "sex": "Male", "address": "STA. ROSA, NUEVA ECIJA", "requestingPhysician": "Dr. Ralph Roland Asperas", "examinationDate": "2026-08-08" },
  "results": [
    { "parameterCode": "FASTING", "parameterName": "Fasting", "resultValue": "92", "unit": "mg/dL", "ref": "70–110" },
    { "parameterCode": "FIRST_HOUR", "parameterName": "1st Hour", "resultValue": "145", "unit": "mg/dL", "ref": "< 200" },
    { "parameterCode": "SECOND_HOUR", "parameterName": "2nd Hour", "resultValue": "120", "unit": "mg/dL", "ref": "< 140" }
  ],
  "supportsRemarks": false,
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
