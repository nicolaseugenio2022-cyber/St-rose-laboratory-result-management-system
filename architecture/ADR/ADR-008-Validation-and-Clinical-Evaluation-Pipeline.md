# ADR-008: Shared Validation & Clinical Evaluation Pipeline Architecture

- **Status**: Accepted (Architecturally Frozen)
- **Author**: Master Developer Col / AI Pair Programmer
- **Date**: 2026-08-08
- **Context**: St. Rose Laboratory Result Management System — Guided Workspace Shared Validation Architecture Evaluation

---

## 1. Executive Summary & Problem Statement

In early prototypes, unparsable or malformed numeric inputs (e.g. `"abc"` or `"12.3.4"`) were evaluated against numeric reference ranges by `ReferenceEvaluationService`, returning `NaN` which fell back to `"Abnormal"`.

This conflated two fundamentally distinct concepts:
1. **Syntactic Input Validation**: Determining whether entered text is syntactically valid (parsable number, allowed string option, valid format).
2. **Clinical Reference Evaluation**: Determining whether a valid numeric result falls within or outside medical reference ranges (`Normal` vs. `Abnormal`).

### Core Invariants Established
> **INVARIANT 1**: Clinical reference range interpretation MUST ONLY occur after input syntax validation succeeds.
> **INVARIANT 2**: Invalid non-numeric or malformed input MUST NEVER display clinical `ABNORMAL` badges or flags.
> **INVARIANT 3**: Empty fields MUST remain in `PENDING` (`NoEvaluation`) status.

---

## 2. Alternatives Considered

We evaluated two architectural approaches to resolve input validation while preserving system stability:

### Approach A: Single State Discriminator Model (Model A — Selected)
- **Mechanism**: Extend the existing `EvaluationOutcome` type definition to explicitly include `"Invalid"` (`"Normal" | "Abnormal" | "Informational" | "NoEvaluation" | "Invalid"`).
- **Execution Pipeline**:
  ```text
  User Input
       ↓
  Input Validation (Syntactic Check)
       ↓
  EvaluationOutcome
       ├── Invalid (Syntax Error, Red Validation UI)
       ├── NoEvaluation (Empty Input, Pending State)
       ├── Normal (Valid Numeric Value within Reference Range)
       ├── Abnormal (Valid Numeric Value outside Reference Range)
       └── Informational (Informational Text / Value)
  ```
- **Evaluation Criteria**:
  1. **Domain Purity**: Pragmatic (combines validation state and clinical outcome into a single outcome discriminator).
  2. **API & Contract Stability**: **100% Backward Compatible**. Preserves existing domain contracts, renderer interfaces, DTOs, database schemas, and PDF report generators.
  3. **UI Control Ergonomics**: High (controls evaluate a single `outcome` variable).
  4. **Maintainability**: High (single pipeline enforced inside `ReferenceEvaluationService`).

### Approach B: Separated Dual Domain Model (Model B)
- **Mechanism**: Introduce two separate domain types:
  ```typescript
  export type ValidationState = "Empty" | "Valid" | "Invalid";
  export type ClinicalOutcome = "Normal" | "Abnormal" | "Informational" | "NoEvaluation";
  ```
- **Evaluation Criteria**:
  1. **Domain Purity**: Strict (explicitly separates syntactic input validity from medical interpretation).
  2. **API & Contract Stability**: Low (requires refactoring `ResultItemDomain`, database schemas, DTOs, renderer props, and PDF generation interfaces across the entire codebase).
  3. **UI Control Ergonomics**: Requires checking two separate variables (`validity` then `outcome`).

---

## 3. Architectural Decision

We selected **Model A (Single State Discriminator Model)** as the frozen architecture for the current milestone.

### Rationale
1. **Preservation of System Architecture**: Model A accomplishes 100% of the required validation decoupling and UI safeguards without breaking existing domain models, Supabase persistence schemas, or renderer contracts.
2. **Guaranteed Execution Pipeline**: `ReferenceEvaluationService.evaluateResult` performs syntactic numeric parsing (`isValidNumericString`) before clinical evaluation. Non-numeric strings return `"Invalid"` immediately, guaranteeing that invalid inputs never reach clinical evaluation.
3. **Pragmatic Simplicity**: Provides clean visual separation (`INVALID` red error border vs `ABNORMAL` clinical flag) with minimal cognitive load for developers and zero database schema churn.

---

## 4. Architectural Invariants & Renderer Coverage

The shared validation pipeline applies universally across all 4 renderer families:
- **`TabularRenderer`**: Rendered as red `INVALID` validation tags instead of `HIGH`/`ABNORMAL`.
- **`SimpleResultRenderer`**: Rendered as red `INVALID INPUT` tags instead of clinical result badges.
- **`DiagnosticGridRenderer`**: Rendered as red validation text.
- **`NarrativeCertificateRenderer`**: Rendered as `INVALID INPUT VALUE` warning blocks, disabling Non-reactive/Reactive checkboxes.

---

## 5. Non-Goals

This architectural decision represents an intentional, pragmatic trade-off rather than an oversight regarding domain purity:

- **Redefining Domain Scope**: This decision does NOT redefine `EvaluationOutcome` as a purely clinical domain concept.
- **Unified Presentation State**: Within the Guided Workspace, `EvaluationOutcome` serves as the unified presentation state consumed across the shared rendering pipeline.
- **Intentional Model Consolidation**: The type intentionally consolidates both clinical outcomes (`Normal`, `Abnormal`, `Informational`) and the syntactic validation outcome (`Invalid`). This design choice was selected specifically to preserve architectural simplicity and maintain 100% backward compatibility with existing domain contracts, renderer interfaces, DTOs, database schemas, and PDF report streams.
- **Avoidance of Schema Churn**: Consolidating validation state into `EvaluationOutcome` avoids unnecessary database schema refactoring and multi-interface churn while completely resolving the original UX issue of mislabelling malformed inputs as abnormal clinical results.
- **Extensibility Safeguard**: If future milestones introduce multi-stage validation workflows (e.g. draft entry → MedTech verification → Pathologist sign-off), richer audit log semantics, or independent validation error objects, this decision may be revisited in favor of separate `ValidationState` and `ClinicalOutcome` domain models.

---

## 6. Future Revisit Criteria

This architecture is **frozen** for the current milestone. Migration to **Model B (`ValidationState` + `ClinicalOutcome`)** will only be considered if future project requirements explicitly mandate:
1. Multi-stage validation workflows (e.g. draft entry → MedTech verification → Pathologist sign-off).
2. Complex cross-field validation rules requiring independent validation error objects.
3. Separate persistent database columns for validation audit trails.
