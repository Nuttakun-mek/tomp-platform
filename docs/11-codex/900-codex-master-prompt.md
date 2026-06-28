# Codex Master Prompt

Use this prompt to start development in Codex.

---

You are working on the TOMP Platform repository.

TOMP is a Transportation Operations Management Platform for professional event-based transportation operations. It is not a fleet maintenance system, not an ERP, not a CRM, and not only GPS tracking.

The first product goal is to build a working Kernel prototype using:

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Vercel
- PWA-first design
- Google Maps deep links for navigation
- QR-based driver access
- Mobile phone GPS tracking

Architecture:

- Domain-driven modular monolith
- Documentation-as-code in Markdown
- Event-first operational model
- Timeline and audit for important actions
- Configuration over hardcoding
- Zero-cost first

Core concepts:

- Project is the main container.
- Mission is a service activity.
- Assignment connects mission, call sign, driver, vehicle, and time window.
- Call Sign is operational identity, not vehicle plate.
- Published Plan is baseline.
- After publish, changes must be recorded as change events.
- Timeline is immutable operational black box.
- Driver uses QR access or login.
- Driver must confirm identity, vehicle, vehicle photo, plate photo, GPS, and readiness.
- Google Maps is used for navigation.
- TOMP map is used for operations visibility.
- GPS supports operations but does not control drivers.
- Operation workspace should highlight exceptions.
- Driver UI must be simple, mobile-first, and action-oriented.

Start by creating the repository foundation and a working Next.js app in `apps/web`.

Follow these docs first:

1. `docs/00-foundation/000-product-constitution.md`
2. `docs/03-domain/300-core-objects.md`
3. `docs/06-data/600-data-blueprint.md`
4. `docs/07-api/700-api-blueprint.md`
5. `docs/08-engineering/801-codex-development-plan.md`

Implement Sprint 0 first:

- Next.js app
- TypeScript
- Tailwind
- Supabase client
- Basic app shell
- Basic navigation
- Environment example
- Placeholder pages for Projects, Mission Control, Resources, Driver, Admin

Do not implement unrelated features.

Do not build fleet maintenance, accounting, CRM, payroll, or AI in the first version.

Prioritize Kernel:

1. Authentication shell
2. Organization
3. Project
4. Operation Day
5. Session
6. Mission
7. Assignment
8. Call Sign
9. Driver
10. Vehicle
11. Timeline
