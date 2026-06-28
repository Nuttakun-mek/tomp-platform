# Data Blueprint v1.0

## Data Groups

### Master Data

- customers
- organizations
- vendors
- vehicles
- drivers
- venues
- users
- roles
- permissions

### Operational Data

- projects
- project_days
- sessions
- missions
- mission_groups
- assignments
- assignment_versions
- call_signs
- commitments
- project_members

### Transaction Data

- timeline_events
- status_updates
- gps_locations
- driver_checkins
- vehicle_checkins
- notifications
- change_requests
- incidents
- recoveries
- approvals
- comments

### Knowledge Data

- knowledge_items
- project_lessons
- venue_notes
- vendor_performance
- driver_performance
- customer_preferences

### Configuration Data

- configurations
- mission_types
- vehicle_types
- status_definitions
- checklist_templates
- notification_templates
- print_templates
- qr_templates

## Core Tables for First Build

1. users
2. organizations
3. roles
4. permissions
5. user_roles
6. projects
7. project_days
8. sessions
9. missions
10. assignments
11. assignment_versions
12. call_signs
13. vehicles
14. drivers
15. vendors
16. coordinators
17. commitments
18. driver_checkins
19. vehicle_checkins
20. gps_locations
21. timeline_events
22. notifications

## Global Columns

Most core tables should include:

- id
- created_at
- updated_at
- created_by
- updated_by
- archived_at
- deleted_at
- metadata

## Data Rules

- Use UUID as primary key.
- Use business code separately.
- Store time in UTC.
- Display time in project timezone.
- Use soft delete.
- Use timeline event for significant change.
- Use versioning for assignment changes.
- Keep published snapshot.
