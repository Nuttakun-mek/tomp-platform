-- Thai internal pilot scenario seed.
-- Raw driver QR tokens are intentionally not stored. The token_hash value below is a non-production sample hash.

insert into public.organizations (id, name, organization_type, status, metadata)
values (
  '20000000-0000-4000-8000-000000000001',
  'TOMP ทีมปฏิบัติการตัวอย่าง',
  'operator',
  'active',
  '{"seed": true, "scenario": "thai_internal_pilot"}'::jsonb
) on conflict (id) do nothing;

insert into public.profiles (id, auth_user_id, organization_id, full_name, email, phone, status, metadata)
values (
  '20000000-0000-4000-8000-000000000002',
  null,
  '20000000-0000-4000-8000-000000000001',
  'ผู้จัดการปฏิบัติการ ตัวอย่าง',
  'thai.ops@example.com',
  '+6620000000',
  'active',
  '{"seed": true, "note": "Thai pilot profile without auth user"}'::jsonb
) on conflict (id) do nothing;

insert into public.projects (id, organization_id, owner_profile_id, project_code, project_name, start_date, end_date, timezone, status, visibility_level, service_level, metadata)
values (
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'TOMP-TH-PILOT-001',
  'งานรับส่งผู้ร่วมประชุม Pilot',
  '2026-07-20',
  '2026-07-20',
  'Asia/Bangkok',
  'planning',
  'internal',
  'standard',
  '{"seed": true, "scenario": "thai_internal_pilot"}'::jsonb
) on conflict (id) do nothing;

insert into public.project_days (id, project_id, operation_date, day_number, timezone, status, briefing_notes, metadata)
values (
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000003',
  '2026-07-20',
  1,
  'Asia/Bangkok',
  'draft',
  'Briefing: รับผู้ร่วมประชุมจากสนามบินไปยังศูนย์ประชุม',
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;

insert into public.sessions (id, project_id, project_day_id, session_name, session_type, start_time, end_time, status, metadata)
values (
  '20000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
  'รับผู้โดยสารรอบเช้า',
  'airport_pickup',
  '2026-07-20 01:00:00+00',
  '2026-07-20 04:00:00+00',
  'draft',
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;

insert into public.missions (id, project_id, project_day_id, session_id, mission_code, mission_name, mission_type, priority, status, planned_start_time, planned_end_time, instruction, service_commitment, metadata)
values (
  '20000000-0000-4000-8000-000000000006',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005',
  'MIS-TH-001',
  'รับผู้โดยสาร VIP จากสนามบิน',
  'airport_pickup',
  'high',
  'draft',
  '2026-07-20 01:30:00+00',
  '2026-07-20 02:30:00+00',
  'พบผู้โดยสารที่จุดนัดพบขาเข้า และส่งถึงประตูหลักศูนย์ประชุม',
  'รถต้องถึงจุดรับก่อนเวลาอย่างน้อย 15 นาที',
  '{"seed": true, "pickupLocation": "จุดรับผู้โดยสาร", "dropoffLocation": "ศูนย์ประชุม"}'::jsonb
) on conflict (id) do nothing;

insert into public.call_signs (id, project_id, call_sign, group_name, status, metadata)
values (
  '20000000-0000-4000-8000-000000000007',
  '20000000-0000-4000-8000-000000000003',
  'VIP-01',
  'รับผู้โดยสาร VIP',
  'active',
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;

insert into public.vehicles (id, organization_id, vendor_id, plate_number, vehicle_type, capacity, status, metadata)
values (
  '20000000-0000-4000-8000-000000000008',
  '20000000-0000-4000-8000-000000000001',
  null,
  'กท 2026',
  'รถตู้ VIP',
  8,
  'available',
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;

insert into public.drivers (id, organization_id, vendor_id, full_name, phone, license_type, languages, status, metadata)
values (
  '20000000-0000-4000-8000-000000000009',
  '20000000-0000-4000-8000-000000000001',
  null,
  'สมชาย ใจดี',
  '+66810000000',
  'public_transport',
  array['th'],
  'available',
  '{"seed": true}'::jsonb
) on conflict (id) do nothing;

insert into public.assignments (id, project_id, mission_id, call_sign_id, vehicle_id, driver_id, status, start_time, end_time, current_version, metadata)
values (
  '20000000-0000-4000-8000-000000000010',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000006',
  '20000000-0000-4000-8000-000000000007',
  '20000000-0000-4000-8000-000000000008',
  '20000000-0000-4000-8000-000000000009',
  'draft',
  '2026-07-20 01:30:00+00',
  '2026-07-20 02:30:00+00',
  1,
  '{"seed": true, "pickupLocation": "จุดรับผู้โดยสาร", "dropoffLocation": "ศูนย์ประชุม", "coordinatorPhone": "+6620000000", "operationPhone": "+6621111111"}'::jsonb
) on conflict (id) do nothing;

insert into public.driver_access_tokens (id, project_id, assignment_id, driver_id, token_hash, access_scope, status, expires_at, metadata)
values (
  '20000000-0000-4000-8000-000000000011',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000010',
  '20000000-0000-4000-8000-000000000009',
  '95c4f706e9e9b8d17a4a0b6990f2482bd0889a9d2c0224b3ac7e07d0ef2e227b',
  'assignment',
  'active',
  '2026-07-21 00:00:00+00',
  '{"seed": true, "raw_token_stored": false, "note": "sample hash for pilot scenario only"}'::jsonb
) on conflict (id) do nothing;

insert into public.timeline_events (id, project_id, object_type, object_id, event_type, actor_id, source, before_data, after_data, reason, metadata)
values
  (
    '20000000-0000-4000-8000-000000000012',
    '20000000-0000-4000-8000-000000000003',
    'project',
    '20000000-0000-4000-8000-000000000003',
    'thai_pilot_seed_created',
    null,
    'system',
    null,
    '{"project_code": "TOMP-TH-PILOT-001"}'::jsonb,
    'สร้างข้อมูลตัวอย่างสำหรับ Thai internal pilot',
    '{"seed": true}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000013',
    '20000000-0000-4000-8000-000000000003',
    'assignment',
    '20000000-0000-4000-8000-000000000010',
    'assignment_prepared',
    null,
    'operation_user',
    null,
    '{"call_sign": "VIP-01", "driver": "สมชาย ใจดี"}'::jsonb,
    'เตรียม Assignment สำหรับส่ง QR ให้คนขับ',
    '{"seed": true}'::jsonb
  )
on conflict (id) do nothing;
