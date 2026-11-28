-- Core KPI from D1 (24 Nov 2026). From period 2026-11 a position's KPI come from D1's d1_kpi_definitions, reached
-- through D3's d3_d1_position_mappings, instead of the copy of the client workbook D4 kept as catalog V6.
-- Decisions (Delta, 24 Nov 2026):
--   * D1's KPI count is accepted as long as the weights add up to 100. Of the 25 active D1 positions, 11 have four
--     KPI and IT three, so the "exactly five" rule from the client workbook is dropped (checks, trigger and policy below).
--   * A position D1 has not mapped yet keeps its D4 role until it is mapped. On 24 Nov that is General Director,
--     Billing and Cash Associate (17 employees). Their scores are not offered to D1.
--   * From 2026-11 on. Saved scorecards and daily entries keep their own lines. A period compile only uses the days
--     of the latest KPI set (modules/d4/kpi/daily.ts), so days scored on the old set drop out of it.
-- D4 only reads D1's definitions. A D1 position counts once it is Active, a D3 position is actively mapped to it,
-- and its active KPI weigh 100 in total. Its role number is 1000 + the digits of its job code (JP011 -> 1011), so it
-- stays the same when D1 adds positions; 1..10 remain the D4 roles.
-- The scoring trigger writes each line's D1 KPI id into the saved line (d1_kpi_id), so D1 can join a score to its
-- definition even after the name is edited in the scorecard or renamed in D1.
-- Part 2: d4_kpi_scores_for_d1, the per-KPI daily and period scores D1 asked for, in the shape of d1_kpi_scores.
--
-- Rollout: deploy the app first (it reads these views and falls back to the tables while they are missing), then
-- apply this file. Rollback is at the end.

-- 1. D1 positions D4 can score with, one row per active KPI.
create view public.d4_kpi_d1_catalog as
with positions as (
  select jp.id, jp.job_code, jp.nama_posisi, 1000 + substring(jp.job_code from '[0-9]+')::integer as role_order
  from public.d1_job_positions jp
  where jp.status_posisi = 'Active' and jp.job_code ~ '[0-9]'
    and (select sum(k.kpi_weight) from public.d1_kpi_definitions k
         where k.position_id = jp.id and k.is_active and k.deleted_at is null) = 100
)
select p.id as d1_position_id, p.job_code::text as d1_job_code, p.role_order, p.nama_posisi::text as role_name,
  -- D1 keeps the workbook order in metadata for the KPI it copied from V5.1; the others follow creation order.
  row_number() over (partition by p.id order by
    case when k.metadata->>'indicator_order' ~ '^[0-9]+$' then (k.metadata->>'indicator_order')::integer end nulls last,
    k.created_at, k.id)::integer as indicator_order,
  k.kpi_name::text as kpi_name, k.kpi_target::text as target, k.kpi_weight as weight_percent, k.id as d1_kpi_id
from positions p
join public.d1_kpi_definitions k on k.position_id = p.id and k.is_active and k.deleted_at is null;

-- 2. D3 position -> D1 role. D1 maps one D3 position to one D1 position (integration note, 10 Nov); distinct on keeps
--    the answer stable if that ever changes.
create view public.d4_kpi_d1_position_roles as
select distinct on (m.position_id) m.position_id, c.role_order
from public.d3_d1_position_mappings m
join (select distinct d1_position_id, role_order from public.d4_kpi_d1_catalog) c on c.d1_position_id = m.d1_position_id
where m.is_active
order by m.position_id, c.role_order;

-- 3. What the app and the triggers read: the D4 catalog plus the D1 roles in every version from 2026-11 on.
create view public.d4_kpi_catalog_rows as
select role_order, role_name, indicator_order, kpi_name, target, weight_percent, source_version,
  'D4'::text as kpi_source, null::text as d1_job_code, null::uuid as d1_kpi_id
from public.d4_kpi_role_catalog
union all
select c.role_order, c.role_name, c.indicator_order, c.kpi_name, c.target, c.weight_percent, v.source_version,
  'D1', c.d1_job_code, c.d1_kpi_id
from public.d4_kpi_d1_catalog c
join public.d4_kpi_catalog_versions v on v.effective_from >= '2026-11';

create view public.d4_kpi_position_roles as
select v.source_version, r.position_id, r.role_order, 'D1'::text as kpi_source
from public.d4_kpi_d1_position_roles r
join public.d4_kpi_catalog_versions v on v.effective_from >= '2026-11'
union all
select k.source_version, k.position_id, k.role_order, 'D4'
from public.d4_position_kpi_roles k
join public.d4_kpi_catalog_versions v on v.source_version = k.source_version
where v.effective_from < '2026-11'
   or not exists (select 1 from public.d4_kpi_d1_position_roles r where r.position_id = k.position_id);

-- The views run with their owner's rights: d3_d1_position_mappings has RLS on and no read policy, so a signed-in
-- user could not see the mapping otherwise. They only expose KPI definitions and role numbers, like the tables they
-- replace (readable by every signed-in account).
revoke all on public.d4_kpi_d1_catalog, public.d4_kpi_d1_position_roles, public.d4_kpi_catalog_rows,
  public.d4_kpi_position_roles from anon, public;
grant select on public.d4_kpi_d1_catalog, public.d4_kpi_d1_position_roles, public.d4_kpi_catalog_rows,
  public.d4_kpi_position_roles to authenticated;

-- 4. Any number of lines, as long as they match the catalog and weigh 100.
alter table public.d4_kpi_assessments drop constraint d4_kpi_assessments_lines_check,
  add constraint d4_kpi_assessments_lines_check check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) >= 1);
alter table public.d4_kpi_assessments drop constraint d4_kpi_assessments_role_order_check,
  add constraint d4_kpi_assessments_role_order_check check (role_order > 0);
alter table public.d4_kpi_daily_entries drop constraint d4_kpi_daily_entries_lines_check,
  add constraint d4_kpi_daily_entries_lines_check check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) >= 1);

-- Same formula as 20261017130000 (weighted = weight x raw score / 100, total rounded to 2 decimals), read from the
-- combined catalog and looped over the role's own number of indicators.
create or replace function public.d4_calculate_kpi_assessment() returns trigger
language plpgsql set search_path = public as $$
declare
  role_title text;
  indicator_count integer;
  total_weight integer;
  max_score integer;
  template record;
  line jsonb;
  raw_score integer;
  weighted_total numeric := 0;
  all_scored boolean := true;
begin
  max_score := case when new.definition_version in ('V3.1', 'V5.1') then 5 else 100 end;

  select min(role_name), count(*), sum(weight_percent)
    into role_title, indicator_count, total_weight
    from public.d4_kpi_catalog_rows
    where source_version = new.definition_version and role_order = new.role_order;
  if indicator_count = 0 or total_weight <> 100 or new.role_name is distinct from role_title
     or jsonb_array_length(new.lines) <> indicator_count then
    raise exception 'Jabatan KPI dan total bobot harus sesuai katalog %', new.definition_version;
  end if;

  for template in
    select indicator_order, weight_percent, d1_kpi_id from public.d4_kpi_catalog_rows
    where source_version = new.definition_version and role_order = new.role_order order by indicator_order
  loop
    line := new.lines -> (template.indicator_order - 1);
    if line->>'indicator_order' is distinct from template.indicator_order::text
       or coalesce(btrim(line->>'kpi_name'), '') = ''
       or line->>'weight_percent' is distinct from template.weight_percent::text then
      raise exception 'Indikator % harus sesuai katalog KPI %', template.indicator_order, new.definition_version;
    end if;
    if template.d1_kpi_id is not null then
      new.lines := jsonb_set(new.lines, array[(template.indicator_order - 1)::text, 'd1_kpi_id'], to_jsonb(template.d1_kpi_id));
    end if;
    if line->>'raw_score' is null or line->>'raw_score' = '' then
      all_scored := false;
    else
      raw_score := (line->>'raw_score')::integer;
      if raw_score < 1 or raw_score > max_score then
        raise exception 'Skor indikator % harus antara 1 dan %', template.indicator_order, max_score;
      end if;
      weighted_total := weighted_total + template.weight_percent * raw_score / 100.0;
    end if;
  end loop;

  if new.status = 'completed' and not all_scored then
    raise exception 'Seluruh indikator harus dinilai sebelum diselesaikan';
  end if;
  new.overall_score := case when all_scored then round(weighted_total, 2) else null end;
  return new;
end;
$$;

-- The Daily KPI insert policy compares role_order with this, so it has to see the D1 roles too.
create or replace function public.d4_current_kpi_role(version text) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select k.role_order
  from public.b2_register r
  join public.d4_kpi_position_roles k on k.position_id = r.position_id and k.source_version = version
  where r.id = auth.uid() and coalesce(r.is_active, true) and r.full_name is not null
$$;

-- 5. For D1: one row per KPI of the newest daily entry of each day and of the newest completed Performance Review of
--    each period, scale 1–100 only. Columns follow d1_kpi_scores (employee_ref = Employee ID, position_id = D1
--    position, kpi_id = d1_kpi_definitions.id, period = first day of the month). Lines saved before this file have no
--    d1_kpi_id; they are matched by name to the D1 KPI of the employee's mapped position, which covers the V6 entries
--    of the positions whose D1 KPI are the V5.1 ones.
--    Owner's rights (the mapping is unreadable otherwise), so the filter repeats D4's read rule: HR, managers and
--    management see everyone, an employee only their own rows; a backend with the service key sees everything.
create view public.d4_kpi_scores_for_d1 as
with daily as (
  select distinct on (d.employee_id, d.entry_date)
    'daily'::text as source, d.id, d.employee_id, d.period, d.entry_date, d.overall_score, d.lines, d.definition_version,
    null::text as note, d.created_at
  from public.d4_kpi_daily_entries d
  order by d.employee_id, d.entry_date, d.created_at desc
),
review as (
  select distinct on (a.employee_id, a.period)
    'period'::text as source, a.id, a.employee_id, a.period, null::date as entry_date, a.overall_score, a.lines,
    a.definition_version, a.general_notes as note, a.created_at
  from public.d4_kpi_assessments a
  where a.status = 'completed'
  order by a.employee_id, a.period, a.created_at desc
),
records as (select * from daily union all select * from review)
-- id and created_at carry d1_kpi_scores' names so D1 can read this view in place of its table; id is stable per KPI line.
select md5(r.id::text || ':' || kpi.id::text)::uuid as id, r.source, b.employee_id as employee_ref, b.full_name as employee_name, b.employment_status,
  kpi.position_id, kpi.id as kpi_id, (line->>'raw_score')::integer as score,
  to_date(r.period || '-01', 'YYYY-MM-DD') as period, r.entry_date, r.overall_score,
  case when r.overall_score > 85 then 'High' when r.overall_score >= 80 then 'Average' else 'Under' end as status,
  r.note, r.created_at, r.id as d4_record_id
from records r
join public.b2_register b on b.id = r.employee_id
cross join lateral jsonb_array_elements(r.lines) line
cross join lateral (
  select k.id, k.position_id from public.d1_kpi_definitions k
  where k.id::text = line->>'d1_kpi_id'
  union all
  select k.id, k.position_id
  from public.d3_d1_position_mappings m
  join public.d1_kpi_definitions k on k.position_id = m.d1_position_id and k.is_active and k.deleted_at is null
  where line->>'d1_kpi_id' is null and m.position_id = b.position_id and m.is_active
    and lower(btrim(k.kpi_name)) = lower(btrim(line->>'kpi_name'))
  limit 1
) kpi
where r.definition_version not in ('V3.1', 'V5.1')
  and line->>'raw_score' ~ '^[0-9]+$'
  and ((select public.d4_current_role()) = any (array['HR', 'MANAGER', 'MANAGEMENT']::public.d3_app_role[])
    or r.employee_id = (select public.d4_current_employee_uuid())
    or (select auth.role()) = 'service_role');

comment on view public.d4_kpi_scores_for_d1 is
  'D4 KPI scores per D1 KPI for D1, same columns as d1_kpi_scores plus source daily|period, entry_date, overall_score, status, d4_record_id: id, employee_ref, employee_name, employment_status, position_id (D1), kpi_id (d1_kpi_definitions), score 1-100, period (first day), entry_date (daily), overall_score, status High/Average/Under, note, created_at, d4_record_id.';

revoke all on public.d4_kpi_scores_for_d1 from anon, public;
grant select on public.d4_kpi_scores_for_d1 to authenticated;

-- Rollback (in this order):
--   drop view public.d4_kpi_scores_for_d1;
--   re-run the function bodies of d4_current_kpi_role (20261108130000) and d4_calculate_kpi_assessment (20261017130000);
--   drop view public.d4_kpi_position_roles, public.d4_kpi_catalog_rows, public.d4_kpi_d1_position_roles, public.d4_kpi_d1_catalog;
--   restore the three checks (lines = 5, role_order 1..10) only if no scorecard or daily entry with another count was saved.
