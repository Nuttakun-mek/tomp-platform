# Database Schema Draft

This is an initial schema guide for Supabase/PostgreSQL. It is not final migration SQL.

## users

- id uuid primary key
- auth_user_id uuid
- full_name text
- email text
- phone text
- status text
- metadata jsonb
- created_at timestamptz
- updated_at timestamptz

## organizations

- id uuid primary key
- name text
- organization_type text
- status text
- metadata jsonb

## projects

- id uuid primary key
- project_code text unique
- project_name text
- customer_id uuid
- start_date date
- end_date date
- timezone text
- status text
- visibility_level text
- service_level text
- metadata jsonb

## project_days

- id uuid primary key
- project_id uuid
- operation_date date
- day_number integer
- status text
- briefing_notes text
- closing_notes text

## sessions

- id uuid primary key
- project_id uuid
- project_day_id uuid
- session_name text
- session_type text
- start_time timestamptz
- end_time timestamptz
- status text

## missions

- id uuid primary key
- project_id uuid
- project_day_id uuid
- session_id uuid
- mission_code text
- mission_name text
- mission_type text
- priority text
- status text
- planned_start_time timestamptz
- planned_end_time timestamptz
- pickup_venue_id uuid
- dropoff_venue_id uuid
- instruction text
- metadata jsonb

## call_signs

- id uuid primary key
- project_id uuid
- call_sign text
- group_name text
- status text
- metadata jsonb

## assignments

- id uuid primary key
- project_id uuid
- mission_id uuid
- call_sign_id uuid
- vehicle_id uuid
- driver_id uuid
- status text
- start_time timestamptz
- end_time timestamptz
- commitment_id uuid
- current_version integer
- metadata jsonb

## assignment_versions

- id uuid primary key
- assignment_id uuid
- version_number integer
- change_reason text
- before_data jsonb
- after_data jsonb
- created_by uuid
- created_at timestamptz

## vehicles

- id uuid primary key
- vendor_id uuid
- plate_number text
- vehicle_type text
- capacity integer
- status text
- metadata jsonb

## drivers

- id uuid primary key
- vendor_id uuid
- full_name text
- phone text
- license_type text
- languages text[]
- status text
- metadata jsonb

## timeline_events

- id uuid primary key
- project_id uuid
- object_type text
- object_id uuid
- event_type text
- actor_id uuid
- source text
- before_data jsonb
- after_data jsonb
- reason text
- created_at timestamptz

## gps_locations

- id uuid primary key
- project_id uuid
- assignment_id uuid
- driver_id uuid
- vehicle_id uuid
- latitude numeric
- longitude numeric
- accuracy numeric
- recorded_at timestamptz
- source text
