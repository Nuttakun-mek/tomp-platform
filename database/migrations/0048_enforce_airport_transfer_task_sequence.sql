-- Repair legacy gaps: once the first pending step is found, later completed
-- steps are reopened so every case returns to a valid sequential state.
with first_pending as (
  select case_id, min(sequence) as sequence
  from public.airport_transfer_tasks
  where status = 'pending'
  group by case_id
)
update public.airport_transfer_tasks as task
set status = 'pending', completed_at = null, completed_by = null
from first_pending
where task.case_id = first_pending.case_id
  and task.sequence > first_pending.sequence
  and task.status = 'completed';

create or replace function public.enforce_airport_transfer_task_sequence()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' and exists (
    select 1
    from public.airport_transfer_tasks earlier
    where earlier.case_id = new.case_id
      and earlier.sequence < new.sequence
      and earlier.status = 'pending'
  ) then
    raise exception 'Complete earlier Airport Transfer checklist steps first'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_airport_transfer_task_sequence() from public, anon, authenticated;

drop trigger if exists enforce_airport_transfer_task_sequence_trigger on public.airport_transfer_tasks;
create trigger enforce_airport_transfer_task_sequence_trigger
before update of status on public.airport_transfer_tasks
for each row execute function public.enforce_airport_transfer_task_sequence();
