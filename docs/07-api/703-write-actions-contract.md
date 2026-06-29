# Write Actions Contract

Sprint 9 enables server-side write actions for the core TOMP kernel.

## Actions

| Action | Schema | Table | Timeline Event |
| --- | --- | --- | --- |
| `createProjectAction` | `createProjectSchema` | `projects` | `PROJECT_CREATED` |
| `createMissionAction` | `createMissionSchema` | `missions` | `MISSION_CREATED` |
| `createAssignmentAction` | `createAssignmentSchema` | `assignments` | `ASSIGNMENT_CREATED` |
| `createDriverAction` | `createDriverSchema` | `drivers` | `DRIVER_CREATED` when project metadata is present |
| `createVehicleAction` | `createVehicleSchema` | `vehicles` | `VEHICLE_CREATED` when project metadata is present |

## Output

All actions return `ActionResult`:

```ts
{
  success: boolean;
  data?: unknown;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  warning?: string;
}
```

## Failure Behavior

Validation failures return `fieldErrors`. Missing Supabase write environment returns an explicit development error. Database failures return a database error message. A successful write with a failed timeline insert returns success with a warning because the object has already been inserted.

## Security Assumptions

Writes are server-side only. `SUPABASE_SERVICE_ROLE_KEY` is optional for local/server use and must never be exposed through `NEXT_PUBLIC_*`. Development can use anon-key writes only under local RLS policies.

## Deferred

Transactions, full project-scoped permission enforcement, production auth, publish locking, and operational approval workflows remain deferred.

