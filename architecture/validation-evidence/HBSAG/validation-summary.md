# Validation Evidence: HBSAG (Hepatitis B Screening)

- **Template Code**: HBSAG
- **Official Template Name**: Hepatitis B (HBsAg) Screening Test
- **Examination Family**: Serology & Immunology
- **Renderer Family**: SimpleResult
- **Word Source File**: `Templates/HBSAG.docx`
- **Specification Source**: `architecture/specifications/HBSAG.md`
- **Reconciled Parameter Count**: 1 Parameter (`HBSAG`)
- **Requires Kit Information**: Yes (`kitBrand`, `lotNumber`, `expirationDate`)

---

## 1. Representative Validation Clinical Test Data

```json
{
  "templateCode": "HBSAG",
  "accessionNumber": "SR-2026-0808-012",
  "demographics": { "fullName": "Juan Dela Cruz", "age": 35, "sex": "Male", "address": "STA. ROSA, NUEVA ECIJA", "requestingPhysician": "Dr. Ralph Roland Asperas", "examinationDate": "2026-08-08" },
  "results": [{ "parameterCode": "HBSAG", "parameterName": "HBsAg Result", "resultValue": "Nonreactive" }],
  "reagentKit": { "kitBrand": "SD Bioline HBsAg WB", "lotNumber": "98765", "expirationDate": "2027-10-30" },
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
