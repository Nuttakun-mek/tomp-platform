-- 0044_airport_transfer_project_scoping.sql
-- docs/11-codex/985 Part A: one shared project instead of a second,
-- Airport-Transfer-only project table. A case now belongs to a real TOMP
-- project the same way a driver assignment does.

alter table public.airport_transfer_cases
  add column project_id uuid references public.projects(id) on delete cascade;

drop index if exists airport_transfer_cases_tomp_project_idx;
alter table public.airport_transfer_cases drop column external_tomp_project_id;

create index airport_transfer_cases_project_idx on public.airport_transfer_cases(project_id);

-- Decided (user, 2026-09-18): a project delete must actually clear a
-- client's data, not leave passenger names/phones behind under an orphaned
-- SET NULL row nobody will ever query for. See docs/11-codex/985.
alter table public.airport_transfer_audit_logs
  drop constraint airport_transfer_audit_logs_case_id_fkey;
alter table public.airport_transfer_audit_logs
  add constraint airport_transfer_audit_logs_case_id_fkey
    foreign key (case_id) references public.airport_transfer_cases(id) on delete cascade;

alter table public.airport_transfer_import_rows
  drop constraint airport_transfer_import_rows_imported_case_id_fkey;
alter table public.airport_transfer_import_rows
  add constraint airport_transfer_import_rows_imported_case_id_fkey
    foreign key (imported_case_id) references public.airport_transfer_cases(id) on delete cascade;

-- Airport Transfer's 5 roles enter the shared roles table so
-- project_members.role_id (a real FK, not a bare text column) can hold them.
-- No role_permissions rows yet — access.ts (Task 5) checks these directly.
insert into public.roles (role_key, role_name, description) values
  ('airport_admin', 'Airport Transfer Admin', 'Manages all Airport Transfer cases and settings for the projects they hold this role on.'),
  ('airport_dispatcher', 'Airport Transfer Dispatcher', 'Creates and edits Airport Transfer cases for the projects they hold this role on.'),
  ('airport_coordinator', 'Airport Transfer Coordinator', 'Updates operational status on Airport Transfer cases; cannot edit case core fields.'),
  ('airport_driver', 'Airport Transfer Driver', 'Completes only the checklist steps assigned to the driver role.'),
  ('airport_viewer', 'Airport Transfer Viewer', 'Read-only access to Airport Transfer cases.')
on conflict (role_key) do nothing;

-- Backfill: one project absorbs the 7 pre-existing live cases, tagged for
-- Airport Transfer only (none of these ever touched TOMP's own side).
--
-- Guarded on there being anything to backfill at all: a database built
-- 0001 -> latest from empty (CI's schema-verify job, a fresh dev/staging
-- database) has zero airport_transfer_cases rows and, before any seed data
-- runs, zero organizations — the unconditional version of this block raised
-- "no organizations row exists" on exactly that path, since it assumed a
-- pre-existing production database with real cases in it. Nothing to
-- backfill means nothing to do; the legacy project and its org lookup only
-- matter when there is at least one orphaned case to reassign.
do $$
declare
  v_org_id uuid;
  v_project_id uuid;
  v_orphan_count integer;
begin
  select count(*) into v_orphan_count from public.airport_transfer_cases where project_id is null;
  if v_orphan_count = 0 then
    return;
  end if;

  select id into v_org_id from public.organizations order by created_at asc limit 1;

  if v_org_id is null then
    raise exception 'no organizations row exists; cannot backfill airport_transfer_cases.project_id';
  end if;

  insert into public.projects
    (organization_id, project_code, project_name, start_date, end_date, timezone, visibility_level, service_level, status, metadata)
  values
    (v_org_id, 'APT-LEGACY-0001', 'เคสก่อนเริ่มใช้ระบบโครงการ', current_date, current_date + interval '1 year',
     'Asia/Bangkok', 'internal', 'standard', 'operating', jsonb_build_object('legacyAirportTransferBackfill', true))
  returning id into v_project_id;

  insert into public.project_systems (project_id, system_key) values (v_project_id, 'airport_transfer');

  update public.airport_transfer_cases set project_id = v_project_id where project_id is null;
end $$;
