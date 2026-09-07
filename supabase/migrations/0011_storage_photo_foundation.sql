-- Sprint 19: Supabase Storage foundation for driver and vehicle evidence photos.
-- Bucket and policies are zero-cost-first and project scoped. Validate in a real Supabase project before production.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver-evidence',
  'driver-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "driver_evidence_authenticated_read"
on storage.objects for select
to authenticated
using (bucket_id = 'driver-evidence');

create policy "driver_evidence_authenticated_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'driver-evidence');

create policy "driver_evidence_authenticated_update"
on storage.objects for update
to authenticated
using (bucket_id = 'driver-evidence')
with check (bucket_id = 'driver-evidence');

