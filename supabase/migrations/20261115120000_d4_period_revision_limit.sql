-- Interview 13 Nov 2026 (0:52:35): a period's assessment may be revised at most once.
-- A revision is a new row for the same employee and period, so each table keeps at most two rows per employee and
-- period. Mirrors MAX_PERIOD_REVISIONS / assertPeriodRevision in modules/d4/shared/rules.ts and holds the rule for
-- writes that bypass the app (direct PostgREST inserts). Rows already stored are not touched, even where a period
-- has more than two. Apply only with PO approval; not applied by the D4 team.

create or replace function public.d4_period_revision_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_saved integer;
begin
  execute format('select count(*) from %I.%I where employee_id = $1 and period = $2', tg_table_schema, tg_table_name)
    into v_saved
    using new.employee_id, new.period;
  if v_saved >= 2 then
    raise exception 'Penilaian periode % sudah pernah direvisi; batasnya satu revisi per periode.', new.period using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists d4_kpi_assessments_revision_limit on public.d4_kpi_assessments;
create trigger d4_kpi_assessments_revision_limit
  before insert on public.d4_kpi_assessments
  for each row execute function public.d4_period_revision_limit();

drop trigger if exists d4_performance_evaluations_revision_limit on public.d4_performance_evaluations;
create trigger d4_performance_evaluations_revision_limit
  before insert on public.d4_performance_evaluations
  for each row execute function public.d4_period_revision_limit();
