# Codex Development Plan

## Goal

Create a working TOMP Kernel prototype.

## First Kernel Scope

1. Authentication shell
2. Organization model
3. Project CRUD
4. Operation day and session CRUD
5. Mission CRUD
6. Assignment CRUD
7. Call sign management
8. Driver and vehicle records
9. Timeline event creation
10. Driver QR access placeholder

## Sprint 0: Repository Foundation

Tasks:

- Initialize Next.js app in apps/web
- Configure TypeScript
- Configure Tailwind CSS
- Configure shared packages
- Configure Supabase client
- Create environment example
- Create app layout
- Create basic navigation
- Create README and docs links

## Sprint 1: Project and Mission

Tasks:

- Create database migration for projects, project_days, sessions, missions
- Create project list
- Create project detail
- Create mission list
- Create mission form
- Create timeline event helper

## Sprint 2: Assignment Kernel

Tasks:

- Create call_signs, vehicles, drivers, assignments
- Create assignment planner
- Link mission to assignment
- Show assignment status
- Create basic conflict validation

## Sprint 3: Driver Access

Tasks:

- Generate QR token
- Create driver access page
- Create driver card
- Add vehicle photo placeholder
- Add plate photo placeholder
- Add status buttons
- Add Google Maps link

## Sprint 4: Mission Control

Tasks:

- Readiness board
- Fleet board
- Timeline feed
- Exception list
- Basic notification model

## Acceptance

The prototype is accepted when one project can be created, missions can be planned, assignments can be created, a driver can open a QR access page, update status, and timeline records all major actions.
