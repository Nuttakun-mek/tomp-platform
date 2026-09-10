-- 0035_project_scoped_resources.sql
-- Drivers and vehicles belong to a project, with a central library to draw from.
--
-- Both tables were scoped to the organisation, which in a single-org product
-- means every project shared one list. That is wrong in a way that shows up
-- during an operation, not just in the data: `drivers.status` is a single
-- column, so a driver marked 'assigned' on last week's event still reads as
-- assigned on this week's, and every project's dropdown carries everyone who has
-- ever worked for the company.
--
-- So: `project_id` null means the central library — the master record of a
-- person or a vehicle. `project_id` set means a project's own working copy,
-- taken from the library or typed fresh. Copies rather than references, because
-- the point is that one project's status, notes and edits do not reach another.
--
-- Existing rows keep `project_id` null and so become the library. Nothing is
-- moved and nothing is lost.

alter table public.drivers
  add column if not exists project_id uuid references public.projects(id) on delete cascade,
  add column if not exists source_driver_id uuid references public.drivers(id) on delete set null;

alter table public.vehicles
  add column if not exists project_id uuid references public.projects(id) on delete cascade,
  add column if not exists source_vehicle_id uuid references public.vehicles(id) on delete set null;

create index if not exists drivers_project_id_idx on public.drivers(project_id);
create index if not exists vehicles_project_id_idx on public.vehicles(project_id);

-- Importing the same person twice into one project is always a mistake, and one
-- that is invisible afterwards: two identical names in a dropdown.
create unique index if not exists drivers_one_copy_per_project_idx
  on public.drivers(project_id, source_driver_id)
  where project_id is not null and source_driver_id is not null and deleted_at is null;

create unique index if not exists vehicles_one_copy_per_project_idx
  on public.vehicles(project_id, source_vehicle_id)
  where project_id is not null and source_vehicle_id is not null and deleted_at is null;

comment on column public.drivers.project_id is
  'Null = central library record. Set = this project''s own copy, isolated from other projects.';
comment on column public.vehicles.project_id is
  'Null = central library record. Set = this project''s own copy, isolated from other projects.';
