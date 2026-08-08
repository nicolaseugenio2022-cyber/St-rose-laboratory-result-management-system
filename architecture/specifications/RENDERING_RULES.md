# RENDERING_RULES.md

# Purpose

This document defines the universal rendering rules used by every laboratory report.

It specifies how reports are rendered regardless of template, renderer family, or output target.

This document does **not** define template-specific layouts, parameters, computations, or client behavior. Those are defined in:

- architecture/specifications/*.md

The rendering engine must follow this document together with:

- REPORT_RENDERING_ARCHITECTURE.md
- REPORT_REGISTRY_ARCHITECTURE.md
- Individual Template Specifications

---

# Rendering Invariants

The following invariants are mandatory.

## Single Source of Truth

All reports shall be rendered exclusively through the Shared Rendering Engine.

No report may implement its own independent rendering logic.

---

## Output Consistency

The rendered output must remain visually identical across:

- Screen Preview
- Browser Print
- PDF Export

Preview must be considered the canonical representation.

---

## Metadata Driven

Rendering decisions shall be driven entirely by metadata supplied by the Report Registry.

The renderer shall not hardcode behavior for specific templates.

---

## Renderer Families

Only the following renderer families exist.

### Tabular

Used for structured laboratory tables.

Examples:

- CBC
- CHEM_8
- CHEM_10
- HDL_LDL
- ESR
- CT_BT
- OGTT

---

### SimpleResult

Used for single-result laboratory reports.

Examples:

- Blood Typing
- Dengue Duo
- Pregnancy Test
- HBsAg
- RBS
- HbA1c
- RPR

---

### DiagnosticGrid

Used for microscopy reports.

Examples:

- Urinalysis
- Fecalysis

---

### NarrativeCertificate

Used for certificate-style reports.

Example:

- HIV Result

---

# Physical Paper Contract

Every report must target:

Paper Size

A4

Dimensions

210 mm × 297 mm

Orientation

Portrait

No template may exceed the printable page boundaries.

---

# Margins

Margins shall match the official Microsoft Word templates.

The rendering engine must preserve printable safe areas.

Margins shall not be dynamically altered.

---

# Typography

The renderer shall preserve:

- Font family
- Font size
- Font weight
- Text alignment
- Letter spacing
- Line spacing

No automatic font substitution is permitted.

---

# Color Preservation

Every template owns its official color palette.

The rendering engine must reproduce:

- Header colors
- Table colors
- Border colors
- Accent colors

exactly as defined by the official template.

---

# Header Rules

Every report must preserve:

- Laboratory logo
- Laboratory name
- Address
- Contact information

Images shall preserve aspect ratio.

Stretching is prohibited.

---

# Signature Rules

Signature images shall:

- Preserve transparency
- Preserve aspect ratio
- Never be stretched
- Never be distorted

Signature captions shall appear beneath the image.

---

# Dynamic Field Rules

Empty values shall render as blank.

The renderer must never print:

- null
- undefined
- NaN

---

Deselected parameters

Parameters removed by domain rules shall not occupy layout space.

---

Conditional sections

Optional sections shall render only when enabled by metadata.

Examples include:

- Remarks
- Reagent Kit Information
- Crystal Reporting
- Certificate Blocks

---

# Table Rendering

Tables shall preserve:

- Column order
- Row order
- Border styles
- Cell alignment
- Padding

Automatic column reordering is prohibited.

---

# Overflow Rules

Long text shall wrap naturally.

Content shall never overlap.

The renderer shall never shrink fonts automatically.

---

# Image Rules

Supported images include:

- Laboratory Logo
- Signature PNG

Aspect ratios shall always be preserved.

---

# Print Rules

Printed output shall exclude:

- Navigation
- Sidebar
- Toolbar
- Buttons
- Interactive controls
- Background application UI

Only the report shall be printed.

---

# Preview Rules

Preview must represent the printed document exactly.

Responsive layout behavior shall not alter report appearance.

---

# PDF Rules

Generated PDFs shall preserve:

- Fonts
- Colors
- Margins
- Images
- Signatures
- Table layout
- Page dimensions

---

# Error Handling

The renderer shall refuse report generation when required rendering assets are unavailable.

Examples include:

- Missing required signatory
- Missing renderer family
- Missing template metadata

Errors shall be reported before rendering.

---

# Performance

Rendering should reuse cached metadata whenever possible.

Repeated rendering of unchanged reports should avoid unnecessary recomputation.

---

# AI Implementation Rules

AI MUST

- Use the Shared Rendering Engine exclusively.
- Preserve official layouts.
- Preserve official colors.
- Preserve official typography.
- Preserve A4 dimensions.
- Preserve spacing.
- Preserve signature placement.
- Preserve image aspect ratios.
- Render only from metadata.

AI MUST NOT

- Hardcode template layouts.
- Duplicate renderer implementations.
- Alter page dimensions.
- Stretch images.
- Modify fonts automatically.
- Introduce responsive report layouts.

---

# Authority

If a conflict exists:

1. PROJECT.md
2. REPORT_RENDERING_ARCHITECTURE.md
3. REPORT_RENDERING_RULES.md
4. architecture/specifications/*.md

Template-specific specifications override this document only for template-specific behavior.

---

# Freeze Status

This document defines universal rendering contracts shared by every laboratory report.

It shall remain frozen unless client-approved rendering behavior changes.
