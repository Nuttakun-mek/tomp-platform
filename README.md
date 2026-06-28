# TOMP Enterprise Platform

TOMP is a Transportation Operations Management Platform for planning, coordinating, executing, monitoring, and improving event-based transportation operations.

TOMP is not fleet management, ERP, or CRM. It is an operations platform for event transportation teams that need one shared baseline, clear execution visibility, and a complete record of operational change.

## Operating Model

TOMP focuses on five stages:

- Plan: define projects, missions, resources, assignments, access, and the published operating baseline.
- Prepare: validate readiness, driver access, vehicles, call signs, and time windows before operation.
- Operate: coordinate live transportation work using assignments, timeline, GPS visibility, and field updates.
- Adapt: record every post-publish change as an auditable change event.
- Improve: review timelines, exceptions, and operational outcomes after the event.

## Core Concepts

- Project is the container for an event or operational engagement.
- Mission is the service activity to be executed.
- Assignment connects a mission, driver, vehicle, call sign, and time window.
- Call Sign is operational identity. It is not the vehicle plate.
- Published Plan is the operational baseline.
- Change Events record every change after publish.
- Timeline and audit records are mandatory.
- Google Maps is used for navigation. TOMP is used for operations management.
- GPS supports operational visibility but does not control drivers.
- QR access is primary for temporary drivers.
- Operation users authenticate with login.
- Coordinator and organizer access can be scoped.
- The system starts zero-cost-first, but the architecture must scale.

## Technology Direction

- Next.js, TypeScript, and Tailwind CSS for the web application.
- Supabase for Postgres, Auth, Storage, Edge Functions, and Realtime where appropriate.
- Vercel for application hosting.
- PWA-first user experience for field and operations workflows.
- Google Maps deep links for driver navigation.
- Driver mobile GPS tracking for live visibility.
- QR-based driver access for temporary or external drivers.
- Modular monolith architecture to keep delivery fast while preserving clear domain boundaries.
- Documentation-as-code in Markdown.

## Repository Layout

```text
apps/
  web/                 Next.js PWA-first web app
packages/
  ui/                  Shared UI primitives
  types/               Shared TypeScript domain types
  config/              Shared project configuration
database/              Supabase schema, migrations, seeds, and policies
api/                   API contracts and integration notes
assets/                Brand, product, map, and documentation assets
docs/                  Documentation-as-code knowledge base
scripts/               Local automation and maintenance scripts
```

## Documentation Index

- [Product Constitution](docs/00-foundation/product-constitution.md)
- [Numbered Product Constitution](docs/00-foundation/000-product-constitution.md)
- [Architecture Principles](docs/00-foundation/architecture-principles.md)
- [Vision and Philosophy](docs/00-foundation/001-vision-and-philosophy.md)
- [Business Canon](docs/01-business/business-canon.md)
- [Business Rules](docs/01-business/105-business-rules.md)
- [Decision Library](docs/01-business/106-decision-library.md)
- [Domain Core Objects](docs/03-domain/300-core-objects.md)
- [Roadmap](docs/03-product/roadmap.md)
- [Product Workspaces](docs/03-product/handbook/400-product-workspaces.md)
- [Mission Control](docs/03-product/handbook/401-mission-control.md)
- [Driver Card](docs/03-product/handbook/402-driver-card.md)
- [Data Blueprint](docs/05-data/handbook/600-data-blueprint.md)
- [API Blueprint](docs/06-api/handbook/700-api-blueprint.md)
- [ADR Index](docs/07-engineering/adr/index.md)
- [Coding Convention](docs/07-engineering/coding-convention.md)
- [Repository Convention](docs/07-engineering/repository-convention.md)
- [Zero-Cost-First Strategy](docs/09-deployment/zero-cost-first-strategy.md)
- [Handbook Completeness Review](docs/00-foundation/handbook-completeness-review.md)

## Local Development

```bash
npm install
npm run dev
```

The first application lives in `apps/web`.
