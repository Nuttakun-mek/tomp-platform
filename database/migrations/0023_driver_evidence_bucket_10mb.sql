-- Phase K — raise the evidence photo ceiling to 10 MB.
-- Photos are compressed client-side (~300 KB), but accept up to 10 MB of raw
-- input from any camera.

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id in ('driver-evidence', 'driver-checkin-photos');
