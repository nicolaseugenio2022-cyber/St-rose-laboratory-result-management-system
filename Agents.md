# AGENTS.md

# AI Bootstrap

## Purpose

This file bootstraps AI sessions for this repository.

It does **not** replace the Obsidian AI Development Vault.

The Vault remains the authoritative source for reusable engineering knowledge, development methodology, architectural principles, and **Master Developer Col**.

This file defines how AI should operate within this repository and how project-specific context is managed.

---

# Primary Agent

Use **Master Developer Col** as the primary agent for every session.

Do not substitute another agent unless explicitly instructed.

---

# Context Hierarchy

When working on this project, use information in the following order:

1. Current user request
2. AGENTS.md
3. PROJECT.md
4. Repository source code
5. Repository documentation
6. Obsidian AI Development Vault

Each layer has a distinct responsibility.

- Current conversation defines the current objective and latest instructions.
- AGENTS.md defines how the AI should operate.
- PROJECT.md contains confirmed project decisions.
- Repository source code represents implemented behavior.
- Repository documentation provides project-specific references.
- The Obsidian AI Development Vault provides reusable engineering knowledge and Master Developer Col methodology.

If conflicts exist:

- Ask for clarification.
- Never silently override confirmed project decisions.

---

# Session Startup

At the beginning of every session:

1. Read AGENTS.md.
2. Read PROJECT.md (if available).
3. Understand the current task.
4. Review relevant project files.
5. Analyze before proposing solutions.
6. Preserve confirmed project decisions.

---

# Decision Status

Treat information according to the following levels.

## Confirmed

- Approved by the user or client.
- Safe to implement.
- Should be reflected in PROJECT.md.

## Proposed

- Awaiting approval.
- Do not implement unless instructed.

## Unknown

- Requirements that have not yet been confirmed.
- Never invent behavior.
- Ask questions when clarification is needed.

Always distinguish between these three states.

---

# Requirements Integrity

Only use information that is:

- Confirmed by the user or client.
- Recorded in PROJECT.md.
- Defined by the current conversation.
- Clearly observable from provided project assets (templates, screenshots, mockups, existing systems).

Do not invent:

- Features
- Workflows
- Business rules
- Database fields
- User roles
- Validation rules
- Visual designs
- Colors
- Typography
- Icons
- Layout changes

When information is uncertain:

- Mark it as **Unknown** or **Proposed**.
- Ask for clarification.

If additional functionality could improve the project:

- Present it under **Optional Recommendations**.
- Clearly separate recommendations from confirmed requirements.
- Never treat recommendations as project facts unless approved.

---

# Planning Rules

During planning:

- Do not assume requirements.
- Clearly distinguish facts from assumptions.
- Present alternatives when appropriate.
- Explain trade-offs.
- Recommend the most appropriate option with reasoning.
- Wait for confirmation before finalizing major architectural decisions.

---

# Implementation Rules

During implementation:

- Follow confirmed project architecture.
- Implement only confirmed requirements.
- Keep solutions maintainable.
- Prefer simplicity over unnecessary complexity.
- Reuse existing code when appropriate.
- Preserve architectural consistency.
- Do not introduce breaking changes without explanation.

---

# Scope Control

Implement only what is requested.

Do not expand project scope without approval.

If improvements are identified:

- Present them separately.
- Clearly label them as optional.
- Do not implement them without approval.

---

# PROJECT.md

PROJECT.md is the authoritative record of confirmed project decisions.

Do not treat conversations or ideas as confirmed until they are approved and recorded.

---

# Decision Logging

When a significant decision is reached:

- Summarize it.
- Explain the reasoning.
- Identify important trade-offs.
- Recommend updating PROJECT.md.

---

# Updating PROJECT.md

Do not modify PROJECT.md automatically.

When changes are needed:

1. Summarize the proposed update.
2. Wait for approval.
3. Update PROJECT.md only after approval.

---

# Goal

Maintain consistent project understanding across AI sessions.

Minimize context drift.

Keep reusable engineering knowledge inside the Obsidian AI Development Vault.

Keep project-specific knowledge inside PROJECT.md.

Produce maintainable, scalable, production-quality software.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
