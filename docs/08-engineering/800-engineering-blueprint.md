# Engineering Blueprint

## Architecture

Use domain-driven modular monolith.

Recommended top-level app:

- apps/web

Shared packages:

- packages/ui
- packages/types
- packages/config
- packages/business

## Development Standards

- TypeScript strict mode.
- ESLint and Prettier.
- Component-based UI.
- Domain services separated from UI.
- No business rules embedded directly inside React components.
- Use server actions/API routes where appropriate.
- Centralized permission checks.

## Suggested App Modules

- auth
- organizations
- users
- projects
- planning
- missions
- assignments
- resources
- driver
- coordinator
- organizer
- mission-control
- timeline
- incidents
- recovery
- knowledge
- administration

## Environment

- Local development
- Preview deployment
- Production deployment

## Initial Dependencies

- next
- react
- typescript
- tailwindcss
- @supabase/supabase-js
- zod
- react-hook-form
- lucide-react or equivalent icon set
- qrcode generation library
- date-fns or equivalent
