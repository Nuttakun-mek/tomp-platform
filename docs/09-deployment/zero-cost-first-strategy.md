# Zero-Cost-First Strategy

## Principle

TOMP should start on free or low-cost tiers, but core architectural decisions must not trap the product below its future operational needs.

## Initial Runtime

- Vercel for the Next.js application.
- Supabase free tier for Postgres, Auth, Storage, and Realtime experiments.
- GitHub repository for source control and documentation-as-code.

## Cost Controls

- Prefer Google Maps deep links over paid routing APIs for initial navigation.
- Use QR-based temporary access instead of provisioning full accounts for every driver.
- Store only GPS data needed for operational visibility and review.
- Avoid background jobs until the workflow proves they are necessary.
- Keep observability simple at launch.

## Scaling Path

- Upgrade Supabase plan when database size, connection needs, auth usage, or realtime workloads require it.
- Upgrade Vercel plan when traffic, build, collaboration, or runtime requirements require it.
- Extract services only after module boundaries and production load justify the complexity.

## Guardrails

- Free tier limits must be documented before production use.
- Operational audit and timeline integrity cannot be sacrificed to reduce cost.
- Security and access control are not optional launch items.
