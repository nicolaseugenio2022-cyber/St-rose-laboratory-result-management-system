# ADR-007: Production PDF Generation Architecture

- **Status**: Proposed (Awaiting Client & User Approval)
- **Author**: Master Developer Col / AI Pair Programmer
- **Date**: 2026-08-08
- **Context**: St. Rose Laboratory Result Management System Phase 3 PDF Stream Architecture Evaluation

---

## 1. Executive Summary & Architectural Constraint

The St. Rose Laboratory Result Management System requires native PDF generation for 17 official medical laboratory report templates.

### Architectural Constraint (Frozen Specification Rule)
> "Native PDF generation SHALL consume the existing `SharedRenderingEngine`. No independent PDF layout implementation is permitted. The PDF generation technology shall be selected based on fidelity, maintainability, deployment environment, and long-term support."

This constraint guarantees that any updates to laboratory template styling, header logos, patient demographics tables, parameter layouts, reagent kit sections, or signatory signatures are automatically reflected in screen previews, browser printing, and exported PDF streams without duplicate layout maintenance.

---

## 2. Evaluation of PDF Generation Approaches

We evaluated four primary technology approaches against the 11 mandatory criteria established in the project specification:

### Approach A: html2canvas + jsPDF (Current Phase 3 MVP)
- **Mechanism**: Captures the DOM container rendered by `SharedRenderingEngine` into an HTML5 Canvas bitmap, converts canvas bitmap to PNG data URL, and embeds PNG into a jsPDF document stream.
- **Evaluation Criteria**:
  1. **Pixel-Perfect Reproduction**: High (1:1 visual match with DOM screen preview).
  2. **Vector vs. Raster**: **Rasterized** PNG canvas snapshot (not native vector text).
  3. **Searchable/Selectable Text**: **No** (text is baked into PNG images).
  4. **Print Quality**: Medium (300 DPI canvas scaling; slight blurriness on ultra-high resolution printers).
  5. **Multi-Page Support & Pagination**: Manual canvas height slicing per A4 page container.
  6. **Font Embedding**: N/A (fonts rendered into DOM canvas pixels).
  7. **Signature Rendering**: High (renders DOM `<img>` signature elements directly).
  8. **Performance**: Client-side execution (2–3 seconds per report).
  9. **Maintainability**: Low-medium (canvas rendering depends on browser DPI and screen resolution).
  10. **Next.js & Architecture Compatibility**: 100% client-side compatible; consumes `SharedRenderingEngine` DOM directly.
  11. **Single Source of Truth**: Compliant (consumes DOM rendered by `SharedRenderingEngine`).

### Approach B: Browser Print API + Native Print CSS (`@media print`)
- **Mechanism**: Utilizes browser native print engine (`window.print()`) combined with A4 page sizing CSS (`@page { size: A4 portrait; margin: 0; }`). Users save as PDF via browser print dialog.
- **Evaluation Criteria**:
  1. **Pixel-Perfect Reproduction**: Extremely High (uses browser CSS rendering engine).
  2. **Vector vs. Raster**: **Native Vector Text**.
  3. **Searchable/Selectable Text**: **Yes** (100% searchable text & selectable elements).
  4. **Print Quality**: Pristine (native vector PDF output at maximum printer resolution).
  5. **Multi-Page Support & Pagination**: Native CSS `@page` and `break-after: page`.
  6. **Font Embedding**: Embedded system/web fonts directly in PDF.
  7. **Signature Rendering**: Pristine (native crisp image embedding).
  8. **Performance**: Instantaneous (0 ms server overhead).
  9. **Maintainability**: Extremely High (pure CSS `@media print` rules).
  10. **Next.js & Architecture Compatibility**: 100% native browser compatible.
  11. **Single Source of Truth**: Compliant (directly prints `SharedRenderingEngine` DOM).

### Approach C: Headless Chrome (Puppeteer / Playwright) Server-Side PDF Stream (Recommended Long-Term)
- **Mechanism**: Next.js API Route (`/api/reports/pdf`) spawns a lightweight headless Chromium instance (via `puppeteer-core` or `@sparticuz/chromium`), navigates to a dedicated headless rendering route (`/render/pdf?sessionId=...`), renders `SharedRenderingEngine`, and generates a native PDF stream via `page.pdf({ format: 'A4', printBackground: true })`.
- **Evaluation Criteria**:
  1. **Pixel-Perfect Reproduction**: Pristine 100% match to official Word templates.
  2. **Vector vs. Raster**: **Native Vector Text**.
  3. **Searchable/Selectable Text**: **Yes** (100% searchable PDF text stream).
  4. **Print Quality**: Pristine 1200 DPI vector output.
  5. **Multi-Page Support & Pagination**: Precise CSS `@page` page breaks.
  6. **Font Embedding**: TrueType / OpenType font embedding directly in PDF stream.
  7. **Signature Rendering**: High-fidelity PNG signature embedding.
  8. **Performance**: High (server-side caching & headless browser pool).
  9. **Maintainability**: High (decoupled server route executing same `SharedRenderingEngine`).
  10. **Next.js & Architecture Compatibility**: 100% serverless / Next.js API Route compatible.
  11. **Single Source of Truth**: 100% Compliant (consumes `SharedRenderingEngine` server component).

### Approach D: `@react-pdf/renderer`
- **Mechanism**: Uses JSX components (`<Document>`, `<Page>`, `<View>`, `<Text>`) to build PDF primitives.
- **Evaluation Criteria & Fit Analysis**:
  - **Single Source of Truth**: **VIOLATED**. `@react-pdf/renderer` cannot render standard HTML/CSS DOM elements or consume `SharedRenderingEngine` JSX (`div`, `table`, `span`, CSS modules, Tailwind). It requires writing an entire parallel layout hierarchy using primitive PDF primitives.
  - **Verdict**: **REJECTED**. Violates the frozen architectural constraint prohibiting independent PDF layout implementations.

---

## 3. Comparative Evaluation Matrix

| Criterion | html2canvas + jsPDF (Phase 3 MVP) | Browser Print API | Puppeteer Headless Stream (Production Target) | react-pdf |
|---|---|---|---|---|
| **Architectural Compliance** | ✅ Compliant | ✅ Compliant | ✅ **100% Compliant** | ❌ **Violates Rule** |
| **Vector Text** | ❌ Raster PNG | ✅ Vector | ✅ **Vector** | ✅ Vector |
| **Searchable Text** | ❌ No | ✅ Yes | ✅ **Yes** | ✅ Yes |
| **Print & Typography Quality** | ⚠️ Medium | ✅ Pristine | ✅ **Pristine (1200 DPI)** | ✅ Pristine |
| **Multi-Page Pagination** | ⚠️ Manual Crop | ✅ CSS Native | ✅ **CSS Native (`@page`)** | ⚠️ Custom Layout |
| **Single Source of Truth** | ✅ Yes | ✅ Yes | ✅ **Yes** | ❌ No |
| **Server Automated Export** | ❌ Client Only | ❌ Manual Dialog | ✅ **API Endpoint Stream** | ✅ API Endpoint |

---

## 4. Architectural Recommendation & Decision

1. **Short-Term (Phase 3 MVP)**:
   - Retain current `html2canvas + jsPDF` adapter in `src/rendering/adapters/pdf-stream-adapter.ts` for immediate interactive preview and testing.

2. **Long-Term Production Architecture**:
   - Adopt **Puppeteer Headless Stream** (`/api/reports/pdf`) as the primary production backend stream exporter for background PDF generation, record archiving, and client automated downloads.
   - Retain **Browser Print API + Print CSS** (`window.print()`) inside `SharedRenderingEngine` as the zero-latency client-side printing fallback.

---

## 5. Status & Next Steps

This ADR is submitted for client review. No code replacement will occur until explicit approval of this ADR.
