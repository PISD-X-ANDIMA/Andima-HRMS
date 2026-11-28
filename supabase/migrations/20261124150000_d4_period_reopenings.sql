-- Open and closed assessment periods (lecturer review, 24 Nov 2026): a Performance Review is saved only in an open period,
-- and its evaluation date is the day it is saved. Mirrors periodState / assertPeriodOpen in modules/d4/shared/rules.ts and
-- holds both rules for writes that bypass the app (direct PostgREST inserts).
-- * Open by default: the running month and the month before it, in WIB. Nothing before 2026-09 (FIRST_PERIOD).
-- * An older period is open while HR has reopened it: d4_period_reopenings, insert-only. The newest row of a period
--   decides, so a row with an earlier open_until closes it again. Every row names the reason and the HR account.
-- * New rows of d4_kpi_assessments and d4_performance_evaluations get evaluation_date = today (WIB).
-- Rows already stored are not touched, including scorecards of periods that are now closed.
--
-- Rollout: independent of other pending D4 migrations; the app reads the table only when it exists (PGRST205 fallback).
-- Apply only with PO approval; not applied by the D4 team.
-- Rollback: drop the two triggers, then the functions d4_require_open_period and d4_period_is_open, then the table.

create table if not exists public.d4_period_reopenings (
  id uuid primary key default gen_random_uuid(),
  period varchar(7) not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and period >= '2026-09'),
  open_until date not null,
  reason text not null check (length(btrim(reason)) between 5 and 500),
  actor_employee_id uuid not null default public.d4_current_employee_uuid(),
  created_at timestamptz not null default now(),
  constraint d4_period_reopenings_until_after_start check (open_until >= to_date(period || '-01', 'YYYY-MM-DD'))
);
create index if not exists d4_period_reopenings_period_idx on public.d4_period_reopenings (period, created_at desc);

alter table public.d4_period_reopenings enable row level security;
revoke all on table public.d4_period_reopenings from anon, authenticated;
grant select, insert on table public.d4_period_reopenings to authenticated;

-- Every D4 role reads it: the Performance Review form lists the open periods for whoever opens it.
drop policy if exists d4_period_reopenings_read on public.d4_period_reopenings;
create policy d4_period_reopenings_read on public.d4_period_reopenings for select to authenticated
  using (public.d4_current_role() is not null);

-- Only HR reopens, under its own name.
drop policy if exists d4_period_reopenings_insert on public.d4_period_reopenings;
create policy d4_period_reopenings_insert on public.d4_period_reopenings for insert to authenticated
  with check (public.d4_current_role() = 'HR' and actor_employee_id = public.d4_current_employee_uuid());

-- p_today is a parameter so the rule can be tested on any day; the triggers pass nothing and get today in WIB.
create or replace function public.d4_period_is_open(p_period text, p_today date default (now() at time zone 'Asia/Jakarta')::date)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_period > to_char(p_today, 'YYYY-MM') then false
    when p_period < '2026-09' then false
    when p_period >= to_char(date_trunc('month', p_today) - interval '1 month', 'YYYY-MM') then true
    else coalesce((
      select r.open_until >= p_today from public.d4_period_reopenings r
      where r.period = p_period order by r.created_at desc, r.id desc limit 1
    ), false)
  end
$$;
revoke all on function public.d4_period_is_open(text, date) from public;
grant execute on function public.d4_period_is_open(text, date) to authenticated, service_role;

create or replace function public.d4_require_open_period()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not public.d4_period_is_open(new.period) then
    raise exception 'Periode % sudah ditutup atau belum dimulai. Penilaian hanya bisa disimpan di periode yang terbuka.', new.period
      using errcode = 'P0001';
  end if;
  new.evaluation_date := (now() at time zone 'Asia/Jakarta')::date;
  return new;
end;
$$;

-- "open_period" sorts before "revision_limit", so a closed period is reported before the revision rule, as in the API.
drop trigger if exists d4_kpi_assessments_open_period on public.d4_kpi_assessments;
create trigger d4_kpi_assessments_open_period
  before insert on public.d4_kpi_assessments
  for each row execute function public.d4_require_open_period();

drop trigger if exists d4_performance_evaluations_open_period on public.d4_performance_evaluations;
create trigger d4_performance_evaluations_open_period
  before insert on public.d4_performance_evaluations
  for each row execute function public.d4_require_open_period();
