# Repository Convention

## Structure

```text
apps/web
packages/ui
packages/types
packages/config
database
api
assets
docs
scripts
```

## Applications

Applications live under `apps`.

- `apps/web` is the Next.js web application.

## Packages

Shared packages live under `packages`.

- `packages/ui` contains shared UI primitives.
- `packages/types` contains shared domain and API types.
- `packages/config` contains shared configuration helpers.

## Database

Supabase artifacts live under `database`.

- `migrations` for schema changes.
- `policies` for RLS policy documentation.
- `seed` for seed data.

## API

API contracts, examples, and integration notes live under `api`.

## Documentation

Documentation is product infrastructure. Markdown files in `docs` should be updated in the same change as the system behavior they describe.

## Naming

- Use kebab-case for Markdown files.
- Use PascalCase for React components.
- Use camelCase for variables and functions.
- Use snake_case for database columns.
