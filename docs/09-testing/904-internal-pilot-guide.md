# Internal Pilot Guide

## Setup

1. Configure `.env.local`.
2. Apply migrations `0001` through `0010` plus pilot additive migrations.
3. Run `database/seed/0001_demo_kernel.sql`.
4. Start the app with `npm run dev -- -p 7000`.

## Pilot Flow

1. Open `/projects`.
2. Review the demo project.
3. Create a mission.
4. Create an assignment.
5. Publish the project when readiness permits.
6. Create a change request for post-publish changes.
7. Generate a driver QR token.
8. Open the driver link.
9. Driver confirms readiness and uploads vehicle/plate photos.
10. Monitor Mission Control and timeline.

## Known Limitations

Production auth hardening, QR revocation UI, storage gallery, realtime resilience, and automated RLS tests remain future work.

## Rollback Notes

Disable pilot use by removing app environment variables, revoking Supabase keys, or taking the Vercel deployment offline.

