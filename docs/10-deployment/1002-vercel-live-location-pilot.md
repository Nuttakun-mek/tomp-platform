# Vercel Live Location Pilot Deployment

TOMP can run on Vercel for the internal pilot. For real driver GPS testing, an online HTTPS deployment is strongly recommended because mobile browsers generally allow geolocation only on HTTPS origins or localhost.

## Target Architecture

- Vercel: Next.js web app
- Supabase: Postgres, Auth, Realtime, Storage
- Driver phone: opens `/driver/[token]` and grants browser location permission
- Admin/operations user: opens `/mission-control` to see latest driver location

## Why Localhost Is Not Enough

`http://localhost:7000` is useful for development on the same machine. It is not enough for real driver testing because:

- driver phones cannot reach your laptop unless on the same network with special setup
- browser GPS permission requires HTTPS for public sites
- Supabase Auth redirect URLs need a stable public URL
- QR links need a URL that drivers can open from their own phones

## Recommended Vercel Settings

Connect GitHub repository:

```text
Nuttakun-mek/tomp-platform
```

Recommended project settings:

```text
Framework Preset: Next.js
Root Directory: apps/web
Install Command: cd ../.. && npm install
Build Command: cd ../.. && npm run build
Development Command: npm run dev -- -p 7000
```

If Vercel detects the monorepo automatically, keep the generated settings only if the build command still runs from the repository root.

## Environment Variables

Set these in Vercel Project Settings:

```text
NEXT_PUBLIC_SUPABASE_URL=https://nbvzqtxoxcghazrvbesx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_URL=https://nbvzqtxoxcghazrvbesx.supabase.co
SUPABASE_SECRET_KEY=<server-side-secret-key>
NEXT_PUBLIC_APP_URL=https://<your-vercel-domain>
DRIVER_ACCESS_TOKEN_SECRET=<long-random-secret>
```

Do not set `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` with a `NEXT_PUBLIC_` prefix.

## Supabase Setup

Apply migrations through:

```text
database/migrations/0011_driver_live_location_pilot.sql
```

Realtime must include:

```text
public.gps_locations
public.timeline_events
public.assignment_status_updates
public.driver_checkins
public.vehicle_checkins
```

For Auth, add the Vercel URL to Supabase Auth redirect URLs:

```text
https://<your-vercel-domain>/auth/callback
```

## Test Flow

1. Deploy to Vercel.
2. Open `/projects` and confirm data loads.
3. Generate or prepare a driver QR/token.
4. Open `/driver/[token]` on a phone.
5. Grant location permission.
6. Tap `เริ่มแชร์ตำแหน่ง`.
7. Open `/mission-control` from an admin browser.
8. Confirm the driver marker appears in `แผนที่ตำแหน่งคนขับ`.

For a specific project, open:

```text
/mission-control?projectId=<project-id>
```

Do not use `/driver/demo-token`; invalid tokens are intentionally rejected.

## Current Pilot Limitations

- This is browser-based foreground location sharing.
- It does not track when the browser is closed.
- It is not route optimization.
- It is not fleet maintenance.
- It is not a native mobile app.
- Production RBAC and RLS still need hardening before wider rollout.
