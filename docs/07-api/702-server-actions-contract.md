# Server Actions Contract

## Action Result Format

All server action placeholders return:

```ts
{
  success: boolean;
  data?: unknown;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}
```

## Validation Rules

- Project, mission, assignment, driver, and vehicle inputs must be validated with Zod schemas from `@tomp/types/schemas`.
- Form input must not be trusted directly.
- Server actions are placeholders until Supabase write access and RBAC are ready.

## Timeline Event Expectation

Future successful writes should append timeline events:

- `PROJECT_CREATED`
- `MISSION_CREATED`
- `ASSIGNMENT_CREATED`
- `DRIVER_CREATED`
- `VEHICLE_CREATED`
- `ASSIGNMENT_STATUS_CHANGED`

Timeline events are immutable and should not expose edit or delete UI.

## Future API Route Option

If server actions become too limiting for integrations, the same result contract can be moved behind route handlers without changing form-level expectations.
