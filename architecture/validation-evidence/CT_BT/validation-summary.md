# Validation Evidence: CT_BT (Clotting Time & Bleeding Time)

- **Template Code**: CT_BT
- **Official Template Name**: Clotting Time & Bleeding Time
- **Examination Family**: Hematology
- **Renderer Family**: Tabular
- **Word Source File**: `Templates/CT BT.docx`
- **Specification Source**: `architecture/specifications/CT_BT.md`
- **Reconciled Parameter Count**: 2 Parameters (`BLEEDING_TIME`, `CLOTTING_TIME`)

---

## 1. Representative Validation Clinical Test Data

```json
{
  "templateCode": "CT_BT",
  "accessionNumber": "SR-2026-0808-005",
  "demographics": { "fullName": "Juan Dela Cruz", "age": 35, "sex": "Male", "address": "STA. ROSA, NUEVA ECIJA", "requestingPhysician": "Dr. Ralph Roland Asperas", "examinationDate": "2026-08-08" },
  "results": [
    { "parameterCode": "BLEEDING_TIME", "parameterName": "Bleeding Time", "resultValue": "2.5", "unit": "minutes", "ref": "1–5" },
    { "parameterCode": "CLOTTING_TIME", "parameterName": "Clotting Time", "resultValue": "4.0", "unit": "minutes", "ref": "2–6" }
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
