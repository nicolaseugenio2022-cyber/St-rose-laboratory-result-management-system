# Validation Evidence: PREG_TEST (Pregnancy Test)

- **Template Code**: PREG_TEST
- **Official Template Name**: Pregnancy Test (Urine)
- **Examination Family**: Serology & Immunology
- **Renderer Family**: SimpleResult
- **Word Source File**: `Templates/PREGNANCY TEST.docx`
- **Specification Source**: `architecture/specifications/PREG_TEST.md`
- **Reconciled Parameter Count**: 1 Parameter (`PREG_TEST`)
- **Requires Kit Information**: Yes (`kitBrand`, `lotNumber`, `expirationDate`)

---

## 1. Representative Validation Clinical Test Data

```json
{
  "templateCode": "PREG_TEST",
  "accessionNumber": "SR-2026-0808-014",
  "demographics": { "fullName": "Ana Reyes", "age": 29, "sex": "Female", "address": "STA. ROSA, NUEVA ECIJA", "requestingPhysician": "Dr. Ralph Roland Asperas", "examinationDate": "2026-08-08" },
  "results": [{ "parameterCode": "PREG_TEST", "parameterName": "Pregnancy Test Result", "resultValue": "Negative" }],
  "reagentKit": { "kitBrand": "RightSign hCG Cassette", "lotNumber": "33445", "expirationDate": "2027-11-20" },
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
| Printable Area Width | `186mm` | `186mm` | `186mm` | Visual comparison only — no exact physical measurement |

---

## 4. Differences Found & Final Verdict

- **Differences Found**: None.
- **Validation Verdict**: ✅ **PASS**
