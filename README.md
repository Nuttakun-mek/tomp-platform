# TOMP Enterprise Handbook

Version: 0.1  
Date: 2026-06-28  
Purpose: Master package for Codex, product design, engineering, UX, database, API, testing, and deployment.

## What is TOMP?

TOMP stands for **Transportation Operations Management Platform**.

TOMP is not a general fleet-management system, not an ERP, not a CRM, and not only a GPS tracking tool. TOMP is a **Transportation Operations Standard Platform** designed to support professional event-based transportation operations from planning to execution, recovery, reporting, and knowledge capture.

## North Star

TOMP exists to make transportation operations predictable, scalable, and easier to operate while preserving the company's professional service standards.

## Primary Business Objectives

1. Reduce repeated phone calls and scattered communication.
2. Reduce manual work and dependency on highly skilled operators.
3. Improve readiness before operations start.
4. Make live operations visible and actionable.
5. Enable faster recovery when plans change.
6. Capture operational knowledge inside the company.
7. Allow the same team to manage more projects without reducing service quality.
8. Start with zero or near-zero technology cost and scale progressively.

## Product Philosophy

TOMP follows this operating cycle:

```text
Plan -> Prepare -> Publish -> Operate -> Recover -> Review -> Learn -> Improve
```

## Core Design Philosophy

**Full Vision, Progressive Delivery**

The architecture must be designed for long-term growth, but the product must be released in controlled phases. The company has the full vision, but features are opened progressively based on value, readiness, and cost discipline.

## Recommended First Technology Stack

- Frontend: Next.js, TypeScript, Tailwind CSS
- App Strategy: PWA-first
- Hosting: Vercel
- Backend/Data: Supabase
- Database: PostgreSQL
- Realtime: Supabase Realtime
- Storage: Supabase Storage
- Authentication: Supabase Auth, Google login, email/password, QR access
- Maps: Google Maps deep links for navigation; free map layer for operations tracking
- Architecture: Domain-driven modular monolith

## Repository Structure

```text
docs/           Enterprise handbook and specifications
apps/           Future application shells
packages/       Shared packages
database/       Schema, migrations, seed data
api/            API contracts and examples
assets/         Visual and reference assets
scripts/        Automation scripts
```

## Codex Usage

Start with:

1. `docs/11-codex/900-codex-master-prompt.md`
2. `docs/00-foundation/000-product-constitution.md`
3. `docs/03-domain/300-core-objects.md`
4. `docs/06-data/600-data-blueprint.md`
5. `docs/07-api/700-api-blueprint.md`

Then create the first working kernel: authentication, organization, project, mission, assignment, call sign, vehicle, driver, timeline.
