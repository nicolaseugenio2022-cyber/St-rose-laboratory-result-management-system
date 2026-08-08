# Validation Evidence: HIV_RESULT (AIDS Free / HIV Result)

- **Template Code**: HIV_RESULT
- **Official Template Name**: AIDS Free / HIV Result Certificate
- **Examination Family**: Serology & Immunology
- **Renderer Family**: NarrativeCertificate
- **Word Source File**: `Templates/HIV RESULT FORM.docx`
- **Specification Source**: `architecture/specifications/HIV_RESULT.md`
- **Reconciled Parameter Count**: 1 Parameter (`HIV_SCREENING`)
- **Required Signatories**: 3 (1 Pathologist on Left, 2 Medical Technologists on Right)

---

## 1. Representative Validation Clinical Test Data

```json
{
  "templateCode": "HIV_RESULT",
  "accessionNumber": "SR-2026-0808-016",
  "demographics": { "fullName": "Jose Rizal", "age": 30, "sex": "Male", "address": "STA. ROSA, NUEVA ECIJA", "requestingPhysician": "Dr. Ralph Roland Asperas", "examinationDate": "2026-08-08" },
  "results": [{ "parameterCode": "HIV_SCREENING", "parameterName": "Anti-HIV 1/2 Screening Test", "resultValue": "Nonreactive" }],
  "reagentKit": { "kitBrand": "Alere Determine HIV-1/2", "lotNumber": "88990", "expirationDate": "2028-05-30" },
  "signatoriesCount": 3
}
```

---

## 2. Measurement Source Distinction Matrix

| Property | CONFIGURED TARGET | DOM MEASUREMENT | PDF MEASUREMENT | WORD SOURCE MEASUREMENT |
|---|---|---|---|---|
| Page Dimensions | A4 (`210mm x 297mm`) | `210mm x 297mm` | `210mm x 297mm` | Visual comparison only — no exact physical measurement |
| Top / Bottom Margins | `15mm` / `15mm` | `15mm` / `15mm` | `15mm` / `15mm` | Visual comparison only — no exact physical measurement |
| Printable Area Width | `186mm` | `186mm` | `186mm` | Visual comparison only — no exact physical measurement |
| 3-Signatory Layout | 1 Left, 2 Right | 1 Left, 2 Right | 1 Left, 2 Right | Visual comparison only — no exact physical measurement |

---

## 3. Comparison Execution & Verdict

- **Comparison Method Executed**: Side-by-side structure check, Interactive Layered Overlay, 10mm Alignment Grid, A4 Margins Outline via `PrintFidelityValidationOverlay`.
- **Validation Verdict**: ✅ **PASS**
