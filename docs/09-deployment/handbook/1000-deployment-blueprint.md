# Deployment Blueprint

## Initial Hosting

- Vercel for frontend
- Supabase for database, auth, storage, realtime

## Environments

1. Local
2. Preview
3. Production

## Environment Variables

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_APP_URL

## Release Strategy

### Alpha

Internal use only.

Scope:

- Project
- Mission
- Assignment
- Driver QR
- Timeline

### Pilot

Use with one real project.

Scope:

- 5 to 10 vehicles
- 1 operation team
- 1 organizer viewer
- Basic GPS
- Basic report

### Production v1

Use with multiple projects.

Scope:

- Permission model
- Notification
- Recovery
- Export
- Audit

## Backup

- Supabase automated backup where available
- Export critical data after pilot
- Document restore procedure

## Rollback

Every deployment must have:

- Previous deployment link
- Database migration rollback notes
- Feature flag disable option

## Monitoring

Initial:

- Vercel deployment status
- Supabase logs
- Application error logs

Future:

- Error tracking
- Performance monitoring
- Realtime queue monitoring
