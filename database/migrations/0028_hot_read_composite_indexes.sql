-- 0028_hot_read_composite_indexes.sql
-- ---------------------------------------------------------------------------
-- 957 P2-1. The mission-control reads filter by project_id and take the most
-- recent N rows. These tables only had a single-column project_id index, so the
-- planner scanned every project row and sorted. Add the composite the ORDER BY
-- needs so the read is an index range scan + limit.
--
--   assignment_status_updates : where project_id = ? order by created_at desc limit 200
--   driver_issue_reports      : where project_id = ? order by created_at desc limit 60
--   driver_notifications      : where project_id = ? order by sent_at    desc limit 60
--
-- Small tables today; plain (non-concurrent) index build inside the migration
-- transaction is fine. timeline_events and gps_locations already have their
-- composite (project_id, created_at desc) / (project_id, recorded_at) from
-- 0001 / 0011.
-- ---------------------------------------------------------------------------

create index if not exists assignment_status_updates_project_created_idx
  on public.assignment_status_updates (project_id, created_at desc);

create index if not exists driver_issue_reports_project_created_idx
  on public.driver_issue_reports (project_id, created_at desc);

create index if not exists driver_notifications_project_sent_idx
  on public.driver_notifications (project_id, sent_at desc);
