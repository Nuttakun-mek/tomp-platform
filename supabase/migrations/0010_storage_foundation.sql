-- Sprint 19 compatibility migration: documented pilot bucket contract.
-- Primary bucket SQL exists in 0009_storage_photo_foundation.sql.
-- Bucket: driver-checkin-photos
-- Path pattern:
--   project/{projectId}/assignment/{assignmentId}/vehicle-{timestamp}.jpg
--   project/{projectId}/assignment/{assignmentId}/plate-{timestamp}.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver-checkin-photos',
  'driver-checkin-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

