# Validation Evidence: HBA1C (HbA1c Report)

- **Template Code**: HBA1C
- **Official Template Name**: HbA1c Report
- **Examination Family**: Clinical Chemistry
- **Renderer Family**: SimpleResult
- **Word Source File**: `Templates/HBA1C.docx`
- **Specification Source**: `architecture/specifications/HBA1C.md`
- **Reconciled Parameter Count**: 1 Parameter (`HBA1C`)
- **Requires Kit Information**: Yes (`kitBrand`, `lotNumber`, `expirationDate`)

---

## 1. Representative Validation Clinical Test Data

```json
{
  "templateCode": "HBA1C",
  "accessionNumber": "SR-2026-0808-010",
  "demographics": { "fullName": "Maria Santos", "age": 42, "sex": "Female", "address": "STA. ROSA, NUEVA ECIJA", "requestingPhysician": "Dr. Ralph Roland Asperas", "examinationDate": "2026-08-08" },
  "results": [{ "parameterCode": "HBA1C", "parameterName": "HbA1c Concentration", "resultValue": "5.4", "unit": "%", "ref": "< 5.7" }],
  "reagentKit": { "kitBrand": "Roche Cobas", "lotNumber": "54321", "expirationDate": "2027-12-31" },
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
| Reagent Kit Section | Printed below result | Printed below result | Printed below result | Visual comparison only — no exact physical measurement |

---

## 4. Differences Found & Final Verdict

- **Differences Found**: None. Reagent kit info block renders cleanly below result card.
- **Validation Verdict**: ✅ **PASS**
