-- Decision 13 Nov 2026: a development requirement's progress has one writer, Training Tracking.
-- The app no longer lets HR pick a requirement status; it follows the requirement's trainings and only reaches
-- Completed with evidence. This trigger holds the same rule for writes that bypass the app (direct PostgREST inserts).
-- Mirrors statusFromTrainings / trainingSyncRevision in modules/d4/shared/rules.ts:
--   * a new requirement starts Identified;
--   * an unchanged status is always allowed (Priority/Method/PIC edits, also on a Completed requirement);
--   * Completed only with reassessment 'Meets requirement' (a passed training, or the gap met in the skill data;
--     that comparison stays on the server, it is not ported to SQL);
--   * Planned with reassessment 'Retraining' reopens a round;
--   * otherwise the status must match the trainings of the current round (after the last Retraining), Cancelled
--     ones excluded: none -> Identified, only Planned -> Planned, anything else -> In Progress.
-- Existing revisions are not touched. Apply only with PO approval; not applied by the D4 team.

create or replace function public.d4_development_status_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_previous varchar(16);
  v_since timestamptz;
  v_active integer;
  v_planned_only boolean;
  v_expected varchar(16);
begin
  select status into v_previous
    from public.d4_development_need_versions
   where development_need_id = new.development_need_id
   order by revision desc
   limit 1;

  if v_previous is null then
    if new.status <> 'Identified' then
      raise exception 'Development requirement baru selalu dimulai dengan status Identified.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.status = v_previous then
    return new;
  end if;

  if new.status = 'Completed' then
    if new.reassessment is distinct from 'Meets requirement' then
      raise exception 'Requirement hanya Completed lewat Meets requirement: training Passed atau gap terpenuhi (Close as Met).' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.reassessment = 'Retraining' then
    return new;
  end if;

  select max(created_at) into v_since
    from public.d4_development_need_versions
   where development_need_id = new.development_need_id and reassessment = 'Retraining';

  with latest as (
    select distinct on (v.training_id) v.status, v.created_at
      from public.d4_training_versions v
      join public.d4_training_records t on t.id = v.training_id
     where t.development_need_id = new.development_need_id
     order by v.training_id, v.revision desc
  )
  select count(*), coalesce(bool_and(status = 'Planned'), false)
    into v_active, v_planned_only
    from latest
   where status <> 'Cancelled' and (v_since is null or created_at > v_since);

  v_expected := case when v_active = 0 then 'Identified' when v_planned_only then 'Planned' else 'In Progress' end;
  if new.status <> v_expected then
    raise exception 'Status requirement mengikuti Training Tracking: menurut training-nya statusnya %, bukan %.', v_expected, new.status using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists d4_development_status_guard on public.d4_development_need_versions;
create trigger d4_development_status_guard
  before insert on public.d4_development_need_versions
  for each row execute function public.d4_development_status_guard();
