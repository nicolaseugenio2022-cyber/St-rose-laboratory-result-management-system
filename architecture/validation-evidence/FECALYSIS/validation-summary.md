# Validation Evidence: FECALYSIS (Fecalysis Examination)

- **Template Code**: FECALYSIS
- **Official Template Name**: Fecalysis Examination
- **Examination Family**: Clinical Microscopy
- **Renderer Family**: DiagnosticGrid
- **Word Source File**: `Templates/FECALYSIS.docx`
- **Specification Source**: `architecture/specifications/FECALYSIS.md`
- **Reconciled Parameter Count**: 11 Parameters (`COLOR`, `CONSISTENCY`, `BLOOD`, `MUCUS`, `PH`, `FAT_GLOBULES`, `PUS_CELLS`, `RED_CELLS`, `BACTERIA`, `PARASITE`, `OTHERS`)

---

## 1. Representative Validation Clinical Test Data

```json
{
  "templateCode": "FECALYSIS",
  "accessionNumber": "SR-2026-0808-011",
  "demographics": { "fullName": "Pedro Reyes", "age": 28, "sex": "Male", "address": "STA. ROSA, NUEVA ECIJA", "requestingPhysician": "Dr. Ralph Roland Asperas", "examinationDate": "2026-08-08" },
  "results": [
    { "parameterCode": "COLOR", "parameterName": "Color", "resultValue": "Brown" },
    { "parameterCode": "CONSISTENCY", "parameterName": "Consistency", "resultValue": "Formed" },
    { "parameterCode": "BLOOD", "parameterName": "Blood", "resultValue": "Negative" },
    { "parameterCode": "MUCUS", "parameterName": "Mucus", "resultValue": "Negative" },
    { "parameterCode": "PH", "parameterName": "pH", "resultValue": "Neutral" },
    { "parameterCode": "FAT_GLOBULES", "parameterName": "Fat Globules", "resultValue": "None" },
    { "parameterCode": "PUS_CELLS", "parameterName": "Pus Cells", "resultValue": "0-2 /hpf" },
    { "parameterCode": "RED_CELLS", "parameterName": "Red Cells", "resultValue": "0-2 /hpf" },
    { "parameterCode": "BACTERIA", "parameterName": "Bacteria", "resultValue": "Normal Flora" },
    { "parameterCode": "PARASITE", "parameterName": "Parasite / Ova Findings", "resultValue": "NO INTESTINAL PARASITES OR OVA SEEN" },
    { "parameterCode": "OTHERS", "parameterName": "Other Findings", "resultValue": "None" }
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
| Grid Columns Width | Left `93mm`, Right `93mm` | `93mm / 93mm` | `93mm / 93mm` | Visual comparison only — no exact physical measurement |

---

## 4. Differences Found & Final Verdict

- **Differences Found**: None. Parasite findings default text matches specification.
- **Validation Verdict**: ✅ **PASS**
