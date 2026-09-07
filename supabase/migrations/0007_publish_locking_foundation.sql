-- Sprint 17: publish locking and change application foundation.

create table public.publish_locks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  locked_by_snapshot_id uuid references public.publish_snapshots(id) on delete set null,
  status text not null default 'locked',
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint publish_locks_status_check check (status in ('locked', 'released', 'archived')),
  constraint publish_locks_project_active_unique unique (project_id, status)
);

create index publish_locks_project_id_idx on public.publish_locks(project_id);
create trigger publish_locks_set_updated_at before update on public.publish_locks for each row execute function public.set_updated_at();
alter table public.publish_locks enable row level security;
grant select, insert, update on public.publish_locks to authenticated;
grant all on public.publish_locks to service_role;

create policy "project_members_select_publish_locks"
on public.publish_locks for select
to authenticated
using (exists (select 1 from public.project_members pm join public.profiles p on p.id = pm.profile_id where pm.project_id = publish_locks.project_id and pm.status = 'active' and p.auth_user_id = (select auth.uid())));

