-- The People Dashboard's seven top numbers for squad MID (interview 13 Nov 2026, 0:29:57: MID only needs the tiles at
-- the top, not the detail list; MID asked the same day for one SQL View per system that its Next.js app reads).
-- Four tiles in the client's order (Employees, Need training, Training in progress, Performance Review complete, 0:32:14)
-- and the three performance categories. One row per period that has D4 data; MID picks the period it shows.
--
-- The counts follow the dashboard code (modules/d4/web/features/dashboard): every active B2 account with a name and a
-- login, the newest revision of each requirement and training, and the newest scorecard per employee and period whose
-- lines weigh 100% (any number of lines since 20261124130000: D1 positions have three to five KPI). Categories exist
-- only on the 1-100 scale: < 80 Under, 80-85 Average, > 85 High.
-- Aggregates only, no names or ids: any signed-in account may read it, anon may not.
create or replace view public.d4_mid_hrms_summary as
with employees as (
  select r.id
  from public.b2_register r
  where coalesce(r.is_active, true) and r.full_name is not null
    and exists (select 1 from auth.users u where u.id = r.id)
),
periods as (
  select period from public.d4_kpi_assessments
  union select period from public.d4_performance_evaluations
  union select period from public.d4_kpi_daily_entries
),
latest_needs as (
  select distinct on (v.development_need_id) n.employee_id, v.status
  from public.d4_development_need_versions v
  join public.d4_development_needs n on n.id = v.development_need_id
  order by v.development_need_id, v.revision desc
),
latest_trainings as (
  select distinct on (v.training_id) t.employee_id, v.status
  from public.d4_training_versions v
  join public.d4_training_records t on t.id = v.training_id
  order by v.training_id, v.revision desc
),
scorecards as (
  select distinct on (a.employee_id, a.period) a.employee_id, a.period, a.overall_score, a.definition_version, a.lines
  from public.d4_kpi_assessments a
  join employees e on e.id = a.employee_id
  order by a.employee_id, a.period, a.created_at desc
),
reviewed as (
  select s.period, s.overall_score,
    s.definition_version not in ('V3.1', 'V5.1') as scale_100
  from scorecards s
  where (select sum((line->>'weight_percent')::numeric) from jsonb_array_elements(s.lines) line) = 100
)
select
  p.period,
  (select count(*) from employees) as total_employees,
  (select count(distinct n.employee_id) from latest_needs n join employees e on e.id = n.employee_id
    where n.status <> 'Completed') as need_training,
  (select count(distinct t.employee_id) from latest_trainings t join employees e on e.id = t.employee_id
    where t.status = 'In Progress') as training_in_progress,
  (select count(*) from reviewed r where r.period = p.period) as performance_review_complete,
  (select count(*) from reviewed r where r.period = p.period and r.scale_100 and r.overall_score < 80) as under_performance,
  (select count(*) from reviewed r where r.period = p.period and r.scale_100 and r.overall_score between 80 and 85) as average_performance,
  (select count(*) from reviewed r where r.period = p.period and r.scale_100 and r.overall_score > 85) as high_performance
from periods p;

comment on view public.d4_mid_hrms_summary is
  'D4 People Dashboard top numbers per period for MID: total_employees, need_training, training_in_progress, performance_review_complete, under/average/high_performance.';

revoke all on public.d4_mid_hrms_summary from anon, public;
grant select on public.d4_mid_hrms_summary to authenticated;
