# Dengue Duo Test Specification

## Original Client Notes (Tagalog / Taglish)
> Sa dengue duo automatic na si Dr. Ralph Roland Asperas sa requested by pero yung pwede pa rin iedit or itype kung sino doctor na iba
> Yung lot number naiiedit sana pero for now ito yung nakalagay:
> Lot Number: 202512015
> Expiration Date: 2028-11
> Drop down result = negative, positive

---

## Normalized Technical Specification (Final Gemini Implementation Contract Authority)

### General Information
- **Report Code:** `DENGUE_DUO`
- **Report Title:** Dengue Duo Test
- **Requirement Status:** Required Report
- **Examination Family:** Serology & Immunology
- **Renderer Family:** SimpleResult

### Requested By & Demographic Policy
- **Requested By Default:** `Dr. Ralph Roland Asperas` (Editable initial value)
- **Requested By Policy:** Populates Dr. Ralph Roland Asperas when empty; editable by staff.
- **Patient Status Collection Policy:** Omitted / Not collected for Encoding UI (New Confirmed Client Decision).
- **Patient Status Output Policy:** Omitted from report demographic header.

### Parameters & Input Controls
1. **Dengue NS1 Ag** (`DENGUE_NS1`)
   - **Input Type:** `SingleSelect`
   - **Options:** `Negative`, `Positive`
   - **Required:** Yes
2. **Dengue IgG** (`DENGUE_IGG`)
   - **Input Type:** `SingleSelect`
   - **Options:** `Negative`, `Positive`
   - **Required:** Yes
3. **Dengue IgM** (`DENGUE_IGM`)
   - **Input Type:** `SingleSelect`
   - **Options:** `Negative`, `Positive`
   - **Required:** Yes

### Reagent Kit Information
- **Requires Kit Info:** Yes (Required field for completion & printed on report)
- **Kit Field Editability:** Fully editable by staff (not an immutable constant)
- **Current Initial Lot Number:** `202512015` (Pre-filled initial value; staff may edit or replace)
- **Current Initial Expiration Date:** `2028-11` (Pre-filled initial value; staff may edit or replace)

### Remarks & Output Rules
- **Remarks:** Supported, default empty.
- **Output-Specific Behavior:** Prints NS1, IgG, IgM results alongside required, staff-editable kit lot number and expiration date.
