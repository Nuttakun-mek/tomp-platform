# Multi-Platform Architecture Foundation

## Current Decision

`apps/web` remains the primary working application for TOMP internal pilot. It owns the current operator workspace, Mission Control, project planning, assignment board, and Web Driver page.

`apps/mobile-driver` is a prepared shell only. It exists so future mobile work has a clear boundary, but no full mobile UI is implemented in this batch.

## Package Boundaries

- `packages/types`: shared domain types and Zod schemas.
- `packages/driver-core`: pure driver workflow logic with no React, browser, Supabase, or Next.js imports.
- `packages/api-client`: future typed API boundary for Web and mobile clients.
- `packages/ui`: future shared UI primitives when cross-platform UI needs are clearer.
- `packages/config`: shared configuration constants.
- `packages/business`: broader business rules that are not driver-specific.

## What Stays In Web

- Current production pilot UI.
- Server actions and Supabase wiring.
- Mission Control and project workspaces.
- Web Driver page until the mobile app is built.

## What Moves To Shared Packages

- Driver assignment packet contracts.
- Driver status and readiness rules.
- Route instruction summaries and Google Maps URL generation.
- Notification priority and action labeling.
- GPS payload and health evaluation.
- Driver contact selection.

## What Must Not Be Duplicated

- Driver lifecycle status mapping.
- Assignment packet shape.
- Notification contract.
- GPS payload contract.
- Route change instruction contract.
- Contact escalation model.

## Future Path

When a Driver App is approved, use React Native + Expo and consume `@tomp/types`, `@tomp/driver-core`, and `@tomp/api-client`. Background GPS and reliable notifications should be implemented there, not forced into the Web App.
