# Validation Evidence: ESR (Erythrocyte Sedimentation Rate)

- **Template Code**: ESR
- **Official Template Name**: Erythrocyte Sedimentation Rate
- **Examination Family**: Hematology
- **Renderer Family**: Tabular
- **Word Source File**: `Templates/ESR.docx`
- **Specification Source**: `architecture/specifications/ESR.md`
- **Reconciled Parameter Count**: 1 Parameter (`ESR`)

---

## 1. Representative Validation Clinical Test Data

```json
{
  "templateCode": "ESR",
  "accessionNumber": "SR-2026-0808-004",
  "demographics": { "fullName": "Ana Reyes", "age": 29, "sex": "Female", "address": "STA. ROSA, NUEVA ECIJA", "requestingPhysician": "Dr. Ralph Roland Asperas", "examinationDate": "2026-08-08" },
  "results": [{ "parameterCode": "ESR", "parameterName": "Erythrocyte Sedimentation Rate", "resultValue": "12", "unit": "mm/hr", "ref": "0–20" }],
  "supportsRemarks": false,
  "signatoriesCount": 2
}
```

---

## 2. Measurement Source Distinction Matrix

| Property | CONFIGURED TARGET | DOM MEASUREMENT | PDF MEASUREMENT | WORD SOURCE MEASUREMENT |
|---|---|---|---|---|
| Page Dimensions | A4 (`210mm x 297mm`) | `210mm x 297mm` | `210mm x 297mm` | Visual comparison only — no exact physical measurement |
| Top / Bottom Margins | `15mm` / `15mm` | `15mm` / `15mm` | `15mm` / `15mm` | Visual comparison only — no exact physical measurement |
| Printable Area Width | `186mm` | `186mm` | `186mm` | Visual comparison only — no exact physical measurement |

---

## 3. Comparison Execution & Verdict

- **Comparison Method Executed**: Side-by-side structure check, Interactive Layered Overlay, 10mm Alignment Grid, A4 Margins Outline via `PrintFidelityValidationOverlay`.
- **Validation Verdict**: ✅ **PASS**
