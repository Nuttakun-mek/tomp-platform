# Sprint 4-7 Acceptance Matrix

| Sprint | Requirement | File path | Status | Notes | Verification method |
| --- | --- | --- | --- | --- | --- |
| 4 | Supabase server client | `apps/web/lib/supabase/server.ts` | Done | Anon-key server boundary with demo fallback | Typecheck/build |
| 4 | Read-only data layer | `apps/web/lib/data/*` | Done | No writes | Typecheck/build |
| 4 | Demo fallback | `apps/web/lib/demo/demo-kernel.ts` | Done | Seed-aligned IDs | Build/routes |
| 5 | Server action placeholders | `apps/web/app/actions/*` | Done | Zod validation, no DB write | Typecheck |
| 5 | Action result utility | `apps/web/lib/actions/action-result.ts` | Done | Shared result format | Typecheck |
| 6 | Readiness pure functions | `apps/web/lib/domain/*` | Done | Testable pure logic | Typecheck |
| 6 | Readiness UI | `apps/web/components/readiness/*` | Done | Demo/fallback risk display | Build |
| 7 | Driver token utilities | `apps/web/lib/driver-access/*` | Done | Placeholder only | Typecheck |
| 7 | QR placeholder | `apps/web/components/driver/driver-access-qr-placeholder.tsx` | Done | No production token claim | Build |
| 7 | Driver token route | `apps/web/app/driver/[token]/page.tsx` | Done | Warning shown | Build |
