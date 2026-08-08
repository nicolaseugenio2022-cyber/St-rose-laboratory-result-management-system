# Validation Evidence: DENGUE_DUO (Dengue Duo Rapid Test)

- **Template Code**: DENGUE_DUO
- **Official Template Name**: Dengue Duo Rapid Test
- **Examination Family**: Serology & Immunology
- **Renderer Family**: SimpleResult
- **Word Source File**: `Templates/DENGUE DUO.docx`
- **Specification Source**: `architecture/specifications/DENGUE_DUO.md`
- **Reconciled Parameter Count**: 3 Parameters (`DENGUE_NS1`, `IGG`, `IGM`)
- **Requires Kit Information**: Yes (`kitBrand`, `lotNumber`, `expirationDate`)

---

## 1. Representative Validation Clinical Test Data

```json
{
  "templateCode": "DENGUE_DUO",
  "accessionNumber": "SR-2026-0808-015",
  "demographics": { "fullName": "Pedro Reyes", "age": 28, "sex": "Male", "address": "STA. ROSA, NUEVA ECIJA", "requestingPhysician": "Dr. Ralph Roland Asperas", "examinationDate": "2026-08-08" },
  "results": [
    { "parameterCode": "DENGUE_NS1", "parameterName": "Dengue NS1 Antigen", "resultValue": "Negative" },
    { "parameterCode": "IGG", "parameterName": "Dengue IgG", "resultValue": "Negative" },
    { "parameterCode": "IGM", "parameterName": "Dengue IgM", "resultValue": "Negative" }
  ],
  "reagentKit": { "kitBrand": "SD Bioline Dengue Duo", "lotNumber": "66778", "expirationDate": "2027-09-15" },
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

- **Differences Found**: None. Multi-parameter rapid test card section renders cleanly.
- **Validation Verdict**: ✅ **PASS**
