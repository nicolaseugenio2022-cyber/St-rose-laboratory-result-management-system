# Blood Typing Specification

## Original Client Notes (Tagalog / Taglish)
> Sa ABO and Rh typing = dropdown din to
> Dropdown values:
> ABO Typing: A, B, AB, O
> Rh Typing: Positive, Negative

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `BLOOD_TYPING`
- **Report Title:** Blood Typing
- **Requirement Status:** Optional Report
- **Examination Family:** Serology & Blood Bank
- **Renderer Family:** SimpleResult

### Requested By & Demographic Policy
- **Requested By Default:** `None` (Staff Entry Required if needed)
- **Requested By Policy:** Starts blank; editable by staff.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Omitted from report demographic header.

### Parameters & Input Controls
1. **ABO Typing** (`ABO_TYPING`)
   - **Input Type:** `SingleSelect`
   - **Options:** `A`, `B`, `AB`, `O`
   - **Required:** Yes
2. **Rh Typing** (`RH_TYPING`)
   - **Input Type:** `SingleSelect`
   - **Options:** `Positive`, `Negative`
   - **Required:** Yes

### Reagent Kit Information
- **Requires Kit Info:** No

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Output-Specific Behavior:** Clean 2-row table displaying ABO Typing and Rh Typing qualitative choices.
