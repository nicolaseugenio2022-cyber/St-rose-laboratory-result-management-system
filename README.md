# St. Rose Laboratory Result Management System

A modern Laboratory Result Management System developed for **St. Rose Diagnostic Laboratory** to streamline laboratory operations, manage personnel accounts, record laboratory results, and generate professional laboratory reports while faithfully preserving the laboratory's official report templates.

> **Project Status:** 🚧 Active Development

---

## Overview

This project is being developed to modernize the laboratory's workflow while maintaining the familiarity of the existing paper-based report templates.

The application focuses on:

- Laboratory personnel management
- Patient laboratory sessions
- Laboratory result encoding
- Report preview
- Browser printing
- PDF generation
- Accurate reproduction of official laboratory report templates

The report rendering engine is intentionally isolated from the application interface so future branding changes never affect laboratory report output.

---

## Current Progress

### ✅ Milestone 1 — Foundation

Completed:

- Next.js 15 App Router foundation
- Application Shell
- Responsive Layout
- Dashboard
- User Management
- Reusable UI Component Library
- Theme System
- Type-safe Forms
- Validation with Zod
- In-memory User Service
- Dashboard synchronization
- Clean Architecture foundation

---

## Planned Milestones

- Personnel Management
- Patient Registration
- Laboratory Sessions
- Test Result Encoding
- Report Preview Engine
- Print Engine
- PDF Generation
- Authentication & Authorization
- Audit Trail
- Database Integration
- Deployment

---

## Technology Stack

### Frontend

- Next.js 15
- React
- TypeScript
- Tailwind CSS

### UI

- React Hook Form
- Zod
- Lucide React
- clsx
- tailwind-merge

### Planned Backend

- Laravel
- PostgreSQL / Supabase

---

## Architecture

The project follows a modular feature-based architecture.

```
src/
├── app/
├── components/
│   ├── layout/
│   └── ui/
├── config/
├── features/
│   ├── dashboard/
│   └── users/
├── lib/
├── services/
├── types/
└── utils/
```

Core architectural principles:

- Feature-based organization
- Reusable UI components
- Service abstraction
- Type safety
- Separation of concerns
- Responsive design

---

## Design Philosophy

The application interface is designed to be:

- Clean
- Minimal
- Professional
- Healthcare-focused
- Easy to scan
- Consistent

Brand colors follow the official **St. Rose Diagnostic Laboratory** identity.

---

## Laboratory Report Rendering

The report rendering engine is intentionally independent from the application UI.

Each official Microsoft Word laboratory template remains the authoritative source for:

- Layout
- Typography
- Colors
- Borders
- Tables
- Signature placement
- Print formatting

Changes to the application theme will never affect report preview, browser printing, or PDF generation.

---

## Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Type checking:

```bash
npx tsc --noEmit
```

Lint:

```bash
npm run lint
```

Production build:

```bash
npm run build
```

---

## License

This repository contains a private client project developed for **St. Rose Diagnostic Laboratory**.

Unauthorized copying, redistribution, or commercial use is prohibited.