# Data Access Layer

## Read-Only Strategy

Sprint 4 introduces server-side read functions under `apps/web/lib/data`. These functions read Supabase when environment variables are configured and fall back to demo data otherwise.

No insert, update, or delete operations are exposed from the data layer yet.

## Demo Fallback

`apps/web/lib/demo/demo-kernel.ts` mirrors the demo seed IDs where practical. This allows all UI routes to render without a live Supabase database.

## Server-Side Supabase Boundary

`apps/web/lib/supabase/server.ts` creates a Supabase client with public anon credentials only. Service-role keys are not used in browser or server UI code.

## Why Writes Are Deferred

Writes require project-scoped RBAC, timeline conventions, publish/change rules, and safer server-only authorization boundaries. Those are intentionally deferred.

## Zero-Cost Pilot Support

The app can be reviewed and deployed as a static/server-rendered demo before any paid database usage is required. Supabase can be connected later without rewriting the UI.
