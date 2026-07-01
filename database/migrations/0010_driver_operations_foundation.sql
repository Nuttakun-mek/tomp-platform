-- TOMP Sprint: Driver Operations Foundation
-- Prepared for future Driver App while apps/web remains the current primary interface.
-- Background GPS that works while the device is locked or the app is suspended requires a future mobile app.

create table if not exists driver_assignment_packets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  assignment_id uuid not null references assignments(id) on delete cascade,
  driver_id uuid references drivers(id) on delete set null,
  packet_version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists driver_notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  assignment_id uuid references assignments(id) on delete cascade,
  driver_id uuid references drivers(id) on delete set null,
  notification_type text not null,
  priority text not null default 'normal',
  title text not null,
  body text not null,
  action_label text,
  action_url text,
  status text not null default 'unread',
  sent_at timestamptz,
  read_at timestamptz,
  actioned_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists route_change_instructions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  assignment_id uuid not null references assignments(id) on delete cascade,
  requested_by uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  old_route jsonb,
  new_route jsonb not null default '{}'::jsonb,
  reason text not null,
  impact_summary text,
  status text not null default 'pending',
  sent_to_driver_at timestamptz,
  acknowledged_by_driver_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists driver_location_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  assignment_id uuid not null references assignments(id) on delete cascade,
  driver_id uuid references drivers(id) on delete set null,
  vehicle_id uuid references vehicles(id) on delete set null,
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  consent_given_at timestamptz,
  status text not null default 'offline',
  last_ping_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists driver_contact_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  assignment_id uuid references assignments(id) on delete cascade,
  driver_id uuid references drivers(id) on delete set null,
  contact_type text not null,
  target_role text not null,
  target_phone text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists driver_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  assignment_id uuid references assignments(id) on delete cascade,
  driver_id uuid references drivers(id) on delete set null,
  acknowledgement_type text not null,
  object_type text not null,
  object_id uuid,
  acknowledged_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_driver_assignment_packets_project on driver_assignment_packets(project_id);
create index if not exists idx_driver_assignment_packets_assignment on driver_assignment_packets(assignment_id);
create index if not exists idx_driver_assignment_packets_driver on driver_assignment_packets(driver_id);

create index if not exists idx_driver_notifications_project on driver_notifications(project_id);
create index if not exists idx_driver_notifications_assignment on driver_notifications(assignment_id);
create index if not exists idx_driver_notifications_driver on driver_notifications(driver_id);
create index if not exists idx_driver_notifications_status on driver_notifications(status);
create index if not exists idx_driver_notifications_sent_at on driver_notifications(sent_at);

create index if not exists idx_route_change_instructions_project on route_change_instructions(project_id);
create index if not exists idx_route_change_instructions_assignment on route_change_instructions(assignment_id);
create index if not exists idx_route_change_instructions_status on route_change_instructions(status);

create index if not exists idx_driver_location_sessions_project on driver_location_sessions(project_id);
create index if not exists idx_driver_location_sessions_assignment on driver_location_sessions(assignment_id);
create index if not exists idx_driver_location_sessions_driver on driver_location_sessions(driver_id);
create index if not exists idx_driver_location_sessions_status on driver_location_sessions(status);
create index if not exists idx_driver_location_sessions_last_ping_at on driver_location_sessions(last_ping_at);

create index if not exists idx_driver_contact_events_project on driver_contact_events(project_id);
create index if not exists idx_driver_contact_events_assignment on driver_contact_events(assignment_id);
create index if not exists idx_driver_contact_events_driver on driver_contact_events(driver_id);

create index if not exists idx_driver_acknowledgements_project on driver_acknowledgements(project_id);
create index if not exists idx_driver_acknowledgements_assignment on driver_acknowledgements(assignment_id);
create index if not exists idx_driver_acknowledgements_driver on driver_acknowledgements(driver_id);

comment on table driver_assignment_packets is 'Future Driver App assignment packet store. Web remains primary interface during internal pilot.';
comment on table driver_notifications is 'Driver notification model for Web Driver and future mobile app.';
comment on table route_change_instructions is 'Route change delivery model; not route optimization.';
comment on table driver_location_sessions is 'Location session readiness. Reliable background GPS requires a future mobile app.';
comment on table driver_contact_events is 'Contact attempt audit for coordinator/control communication.';
comment on table driver_acknowledgements is 'Driver acknowledgement record for assignment, route change, and notifications.';
