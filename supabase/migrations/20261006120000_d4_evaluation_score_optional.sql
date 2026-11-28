-- Performance evaluations become written records only: scoring lives in the KPI Scorecard.
-- A completed evaluation no longer needs overall_score; the column and its 1–5 range check stay
-- so older evaluations keep their value.
alter table public.d4_performance_evaluations
  drop constraint if exists d4_performance_evaluations_check;

alter table public.d4_performance_evaluations
  add constraint d4_performance_evaluations_check check (
    status <> 'completed' or (
      evaluation_date is not null
      and length(btrim(evaluator_name_snapshot)) > 0
      and length(btrim(general_notes)) > 0
    )
  );
