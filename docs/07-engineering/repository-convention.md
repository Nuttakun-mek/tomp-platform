# Repository Convention

## Structure

```text
apps/web
apps/driver
apps/organizer
packages/ui
packages/types
packages/config
packages/business
database
api
assets
docs
scripts
```

## Applications

Applications live under `apps`.

- `apps/web` is the Next.js web application.
- `apps/driver` is reserved for a future dedicated driver app.
- `apps/organizer` is reserved for a future dedicated organizer app.

## Packages

Shared packages live under `packages`.

- `packages/ui` contains shared UI primitives.
- `packages/types` contains shared domain and API types.
- `packages/config` contains shared configuration helpers.
- `packages/business` contains shared business canon, operational rules, and domain helpers when they become executable code.

## Database

Supabase artifacts live under `database`.

- `migrations` for schema changes.
- `policies` for RLS policy documentation.
- `seed` for seed data.

## API

API contracts, examples, and integration notes live under `api`.

## Documentation

Documentation is product infrastructure. Markdown files in `docs` should be updated in the same change as the system behavior they describe.

The imported Enterprise Handbook uses numbered source files. Where handbook numbering differs from the initial brief, handbook files are kept inside the closest existing section under a `handbook` directory unless the section is unique, such as `docs/03-domain` and `docs/10-codex`.

## Naming

- Use kebab-case for Markdown files.
- Use PascalCase for React components.
- Use camelCase for variables and functions.
- Use snake_case for database columns.
