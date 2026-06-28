insert into public.organizations (
  id,
  name,
  organization_type,
  status,
  metadata
) values (
  '10000000-0000-4000-8000-000000000001',
  'TOMP Demo Operations',
  'operator',
  'active',
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;

insert into public.profiles (
  id,
  auth_user_id,
  organization_id,
  full_name,
  email,
  phone,
  status,
  metadata
) values (
  '10000000-0000-4000-8000-000000000002',
  null,
  '10000000-0000-4000-8000-000000000001',
  'Demo Operations User',
  'demo.ops@example.com',
  '+66000000000',
  'active',
  '{"seed": true, "note": "Placeholder profile without auth user"}'::jsonb
) on conflict (id) do nothing;

insert into public.projects (
  id,
  organization_id,
  owner_profile_id,
  project_code,
  project_name,
  start_date,
  end_date,
  timezone,
  status,
  visibility_level,
  service_level,
  metadata
) values (
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'TOMP-DEMO-001',
  'Demo Event Transportation',
  '2026-07-15',
  '2026-07-15',
  'Asia/Bangkok',
  'planning',
  'internal',
  'standard',
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;

insert into public.project_days (
  id,
  project_id,
  operation_date,
  day_number,
  timezone,
  status,
  briefing_notes,
  metadata
) values (
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000003',
  '2026-07-15',
  1,
  'Asia/Bangkok',
  'draft',
  'Demo briefing placeholder.',
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;

insert into public.sessions (
  id,
  project_id,
  project_day_id,
  session_name,
  session_type,
  start_time,
  end_time,
  status,
  metadata
) values (
  '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  'Morning Arrivals',
  'airport_pickup',
  '2026-07-15 01:00:00+00',
  '2026-07-15 05:00:00+00',
  'draft',
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;

insert into public.missions (
  id,
  project_id,
  project_day_id,
  session_id,
  mission_code,
  mission_name,
  mission_type,
  priority,
  status,
  planned_start_time,
  planned_end_time,
  instruction,
  service_commitment,
  metadata
) values (
  '10000000-0000-4000-8000-000000000006',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005',
  'MIS-DEMO-001',
  'Airport pickup wave 1',
  'airport_pickup',
  'normal',
  'draft',
  '2026-07-15 01:30:00+00',
  '2026-07-15 02:30:00+00',
  'Meet guests at arrivals and transfer to venue.',
  'Pickup within planned service window.',
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;

insert into public.call_signs (
  id,
  project_id,
  call_sign,
  group_name,
  status,
  metadata
) values (
  '10000000-0000-4000-8000-000000000007',
  '10000000-0000-4000-8000-000000000003',
  'A-01',
  'Arrivals',
  'active',
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;

insert into public.vehicles (
  id,
  organization_id,
  vendor_id,
  plate_number,
  vehicle_type,
  capacity,
  status,
  metadata
) values (
  '10000000-0000-4000-8000-000000000008',
  '10000000-0000-4000-8000-000000000001',
  null,
  'DEMO-1001',
  'van',
  8,
  'available',
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;

insert into public.drivers (
  id,
  organization_id,
  vendor_id,
  full_name,
  phone,
  license_type,
  languages,
  status,
  metadata
) values (
  '10000000-0000-4000-8000-000000000009',
  '10000000-0000-4000-8000-000000000001',
  null,
  'Demo Driver',
  '+66111111111',
  'public_transport',
  array['th', 'en'],
  'available',
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;

insert into public.assignments (
  id,
  project_id,
  mission_id,
  call_sign_id,
  vehicle_id,
  driver_id,
  status,
  start_time,
  end_time,
  current_version,
  metadata
) values (
  '10000000-0000-4000-8000-000000000010',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000006',
  '10000000-0000-4000-8000-000000000007',
  '10000000-0000-4000-8000-000000000008',
  '10000000-0000-4000-8000-000000000009',
  'draft',
  '2026-07-15 01:30:00+00',
  '2026-07-15 02:30:00+00',
  1,
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;

insert into public.assignment_versions (
  id,
  assignment_id,
  version_number,
  change_reason,
  before_data,
  after_data,
  created_by
) values (
  '10000000-0000-4000-8000-000000000011',
  '10000000-0000-4000-8000-000000000010',
  1,
  'Initial seed assignment version',
  null,
  '{"status": "draft", "call_sign": "A-01"}'::jsonb,
  null
) on conflict (id) do nothing;

insert into public.timeline_events (
  id,
  project_id,
  object_type,
  object_id,
  event_type,
  actor_id,
  source,
  before_data,
  after_data,
  reason,
  metadata
) values (
  '10000000-0000-4000-8000-000000000012',
  '10000000-0000-4000-8000-000000000003',
  'project',
  '10000000-0000-4000-8000-000000000003',
  'demo_seed_created',
  null,
  'system',
  null,
  '{"project_code": "TOMP-DEMO-001"}'::jsonb,
  'Demo kernel seed loaded',
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;
