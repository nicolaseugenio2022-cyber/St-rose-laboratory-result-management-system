# PROJECT.md

# St. Rose Laboratory Result Management System

---

# Project Vision

The St. Rose Laboratory Result Management System is a web-based application that digitizes the laboratory report preparation workflow of St. Rose Diagnostic Laboratory.

The application replaces the current Microsoft Word-based workflow with a secure, centralized system while faithfully preserving the laboratory's official printed reports.

The printed laboratory report remains the primary product of the system.

The application exists to simplify report preparation without redesigning the official laboratory documents.

---

# Current Project Status

## Active Milestone

**Milestone 1 — Production Foundation**

**Status:** ✅ COMPLETE (Frozen)

---

## Current Focus

Preparing for **Milestone 2 — Laboratory Domain Foundation**

---

# Authority Documents

The following documents are considered authoritative.

## PROJECT.md

Defines:

- Project vision
- Architecture
- Development roadmap
- Milestones
- Technology stack
- System-wide business rules

---

## LABORATORY_TEMPLATE_SPECIFICATION.md

Defines:

- Official laboratory templates
- Renderer behavior
- Template-specific business rules
- Client remarks
- Input controls
- Report Registry metadata
- Signatory requirements
- Template colors
- Cross-template behaviors

---

## AGENTS.md

Defines:

- AI development workflow
- Development rules
- Operational procedures
- AI implementation standards

---

# Development Principles

- Architecture First
- Milestone-Based Development
- Configuration Over Hardcoding
- Template-Driven Design
- Report-Centric Architecture
- Production-Ready Code
- Preserve Official Laboratory Workflow
- Preserve Official Report Layouts
- No Premature Features

---

# Milestone Completion Rules

A milestone is considered complete only when:

1. Acceptance criteria pass.
2. TypeScript compiles successfully.
3. ESLint reports zero errors.
4. Production build succeeds.
5. Manual verification passes.
6. Architecture is frozen.
7. No functionality from future milestones has been implemented.

---

# Development Roadmap

## ✅ Milestone 1 — Production Foundation (COMPLETE)

### Section 1 — Foundation

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- ESLint
- Shared domain types
- Validation schemas
- Service abstraction layer
- In-memory services

### Section 2 — Design System

- Atomic UI Components
- AppShell
- Sidebar
- Header
- Navigation
- Responsive Layout
- Branding System
- Theme Tokens

### Section 3 — Administrative Foundation

- Dashboard
- User Management
- Authentication
- Role Management
- Dashboard Metrics
- Duplicate Username Validation
- Reactive Service Synchronization

**Milestone Status:** Frozen

---

## Milestone 2 — Laboratory Domain Foundation

Purpose:

Establish the complete laboratory domain before implementing report rendering.

Scope:

- Patient Report Session
- Personnel Management
- Report Registry
- Laboratory Templates
- Reference Rules
- Signatory Configuration
- Auto Suggestions
- Domain Models
- Database Schema

Excluded:

- Preview
- Browser Print
- PDF Generation
- Report Rendering

---

## Milestone 3 — Laboratory Workflow

- Patient Report Session
- Dynamic Laboratory Forms
- Result Encoding
- Personnel Selection
- Validation
- Session Persistence

---

## Milestone 4 — Report Engine

- Renderer Families
- Report Registry Integration
- Preview
- Browser Print
- PDF Generation
- Multi-page Sessions

---

## Milestone 5 — Drafts & History

- Draft Auto Save
- Draft Recovery
- Completed Report History
- Editing
- Reprinting
- PDF Regeneration

---

## Milestone 6 — Production Hardening

- Security
- Performance
- Accessibility
- Monitoring
- Deployment
- Client Acceptance Testing

---

# Technology Stack

## Frontend

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

## Backend

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage

## Deployment

- Vercel

---

# User Roles

## Administrator

Responsible for:

- User Management
- Personnel Management
- Report Registry Management
- Pathologist Signature Management
- System Configuration

---

## Laboratory User

Responsible for:

- Patient Report Sessions
- Laboratory Result Encoding
- Personnel Selection
- Report Preview
- Printing
- PDF Generation
- Completed Report Management

---

# Confirmed Architecture

## Report-Centric Architecture

The laboratory report is the primary product of the system.

Every architectural decision exists to support faithful report reproduction.

---

## Patient Report Session

One Patient Report Session represents one laboratory visit.

Patient demographics are entered once and shared across every laboratory report in the session.

---

## Authentication

Authentication users are independent from laboratory personnel.

Authentication controls system access.

Personnel records exist solely for report generation.

---

## Personnel

Personnel are independent domain entities.

Supported personnel include:

- Pathologist
- Medical Technologist

Personnel are maintained centrally and selected during report preparation.

---

## Report Registry

The Report Registry is the single source of truth for every laboratory template.

The Report Registry determines:

- Renderer Family
- Parameters
- Reference Rules
- Input Types
- Signatories
- Remarks Support
- Template Metadata

Template-specific behavior is documented in **LABORATORY_TEMPLATE_SPECIFICATION.md**.

---

## Report Engine

The Report Engine reproduces the official Microsoft Word templates.

Preview, Browser Print, and PDF Generation originate from the same rendering engine.

Every selected laboratory examination generates one independent A4 page.

---

## Output Fidelity

The generated reports must faithfully reproduce the official laboratory templates.

No redesign or modernization is permitted.

---

## Application Branding

Application branding is independent of report branding.

Application UI follows the official St. Rose Laboratory system branding.

Laboratory reports preserve their own official template colors.

---

## Future Extensibility

Adding a new laboratory template should primarily require:

- Registering the template
- Defining Report Registry metadata
- Selecting an existing Renderer Family or creating a new one

Existing templates should never require modification.

---

# Current Objective

Begin **Milestone 2 — Laboratory Domain Foundation** while preserving the frozen architecture established during Milestone 1.