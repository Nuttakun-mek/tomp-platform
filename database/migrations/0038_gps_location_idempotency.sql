-- GPS pings may be retried by the mobile offline queue when a request times
-- out or the network reconnects. The client sends metadata.clientEventId for
-- every ping; this partial unique index makes retries idempotent without
-- changing the public shape of gps_locations.

create unique index if not exists gps_locations_client_event_id_unique
  on public.gps_locations (
    project_id,
    assignment_id,
    coalesce(driver_id, '00000000-0000-0000-0000-000000000000'::uuid),
    (metadata->>'clientEventId')
  )
  where metadata ? 'clientEventId'
    and nullif(metadata->>'clientEventId', '') is not null;

comment on index public.gps_locations_client_event_id_unique is
  'Idempotency guard for driver GPS pings retried from web/mobile clients.';
