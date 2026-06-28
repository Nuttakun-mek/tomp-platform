# Coding Convention

## Language

- TypeScript is required for application and package code.
- Prefer explicit domain types for Project, Mission, Assignment, Call Sign, and Change Event concepts.
- Avoid untyped operational payloads.

## Frontend

- Use Next.js App Router.
- Use Tailwind CSS for styling.
- Keep UI components accessible, responsive, and mobile-first.
- Build field workflows as PWA-first experiences.

## Domain Code

- Keep domain language consistent with the documentation canon.
- Do not rename operational concepts casually.
- Record post-publish operational changes through change event flows.
- Keep Google Maps integration as link generation, not embedded route ownership.

## Data Access

- Supabase client usage should be wrapped where it improves consistency.
- RLS policies are part of the feature, not an afterthought.
- Migration files must be reviewed like application code.

## Testing

- Add unit tests for pure domain logic.
- Add integration tests for access and data flows.
- Add end-to-end tests for critical planning, publishing, QR access, and operation workflows.
