# HIV 1 & 2 Rapid Test Specification

## Original Client Notes (Tagalog / Taglish)
> Dedicated Certificate Layout format
> Complete custom demographics: Name, Age, Sex, Date & Time of Examination, Company Name, Address
> 3 Signatory Blocks required (Examiner, Verifier, Pathologist)
> Reagent Lot No. & Expiration Date required
> Result dropdown: Nonreactive, Reactive

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `HIV_RESULT`
- **Report Title:** HIV 1 & 2 Rapid Test Certificate
- **Requirement Status:** Required Report
- **Examination Family:** Serology & Immunology
- **Renderer Family:** Dedicated Certificate (Custom Layout)

### Requested By & Demographic Policy
- **Requested By Default:** `None` (Staff Entry Required if applicable)
- **Requested By Policy:** Editable by staff.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Omitted from certificate document header.

### Parameters & Input Controls
1. **HIV Qualitative Result** (`HIV_RESULT`)
   - **Input Type:** `SingleSelect`
   - **Options:** `Nonreactive`, `Reactive`
   - **Required:** Yes

### Reagent Kit Information
- **Requires Kit Info:** Yes (Required for completion & printed on report)
- **Lot Number:** Required staff entry (Editable)
- **Expiration Date:** Required staff entry (Editable)

### Certificate-Specific Header & Footer Metadata
- **Date & Time of Examination:** Staff entry string
- **Company Name:** Optional staff entry string
- **Signatories Required:** 3 Signatories (Examiner MedTech, Verifier MedTech, Pathologist)

### Versioned Static Certificate Content
- **Printed Report Title:** `HIV 1 & 2 RAPID TEST CERTIFICATE`
- **Static Content Version:** `hiv-certificate-v1`
- **Static Certificate Heading:** `AIDS FREE CERTIFICATE`
- **Content Ownership:** Exact certificate wording and labels are captured once in the declarative `HIV_RESULT` render contract, transcribed from `Templates/render/HIVRESULTFORM.png`. The PNG is provenance/QA evidence only and is not a production rendering asset or runtime data source.
- **Certification Narrative Binding:** `This is to certify that ` + Patient Name + ` of ` + Patient Address + ` was examined for Acquired Immune Deficiency Syndrome (AIDS) based on laboratory test for HIV-1/2.`
- **Draft Address Source:** Current stored session Address, including an edited or intentionally blank value.
- **Completed Address Source:** `CompletedSessionSnapshot.demographics.address` exactly as frozen at completion.
- **No Rendering Default:** Rendering never hardcodes Sta. Rosa or reapplies the new-session Address default.

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Output-Specific Behavior:** Renders dedicated HIV certificate format with full custom layout rules.
