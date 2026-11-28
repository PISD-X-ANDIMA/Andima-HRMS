-- KPI Scorecard V6: Core KPI scored 1–100 (interview D4, 14 Oct 2026; scale confirmed by the squad that keeps the
-- daily KPI). Target is 85; below 80 is under performance, 80–85 acceptable, above 85 high performance (bands are
-- derived in the app from the overall score, nothing is stored).
--
-- Rollout rules
--   * Apply AFTER the app version that knows catalog V6 is deployed. Until then the old form still sends 1–5 raw
--     scores, and a V6 period (2026-11 onward) would store them as if they were 1–100.
--   * V3.1 and V5.1 scorecards keep their 1–5 scale. Nothing existing is rewritten: all 69 saved scorecards stay valid.
--   * Reversible before the first V6 scorecard is saved: delete the V6 rows below. After that, V6 scorecards exist
--     and must be kept.
--
-- Same five Core KPI per role and the same weights as V5.1; only the scale and the fixed target differ.

-- 1. Catalog version V6 from 2026-11, copied from V5.1 (catalog rows and the position-to-role mapping).
insert into public.d4_kpi_catalog_versions (source_version, effective_from)
values ('V6', '2026-11')
on conflict do nothing;

insert into public.d4_kpi_role_catalog (role_order, role_name, indicator_order, kpi_name, target, weight_percent, source_version)
select role_order, role_name, indicator_order, kpi_name, '85', weight_percent, 'V6'
from public.d4_kpi_role_catalog
where source_version = 'V5.1'
on conflict do nothing;

-- Only mappings whose position still exists in D3: five of the thirteen V5.1 mappings point at positions that were
-- removed from D3 and would break the foreign key. They are left as they are in V5.1.
insert into public.d4_position_kpi_roles (source_version, position_id, role_order)
select 'V6', r.position_id, r.role_order
from public.d4_position_kpi_roles r
where r.source_version = 'V5.1'
  and exists (select 1 from public.d3_positions p where p.id = r.position_id)
on conflict do nothing;

-- 2. The overall score column was numeric(3,2), which tops out at 9.99. Widening the precision keeps the scale
--    (two decimals) and every existing value; the CHECK now allows the 1–100 range. The per-version limit
--    (5 for V3.1/V5.1, 100 otherwise) is enforced by the trigger below.
alter table public.d4_kpi_assessments alter column overall_score type numeric(5,2);
alter table public.d4_kpi_assessments drop constraint d4_kpi_assessments_overall_score_check;
alter table public.d4_kpi_assessments add constraint d4_kpi_assessments_overall_score_check
  check (overall_score >= 1 and overall_score <= 100);

-- 3. Score calculation. Besides the per-version score limit this folds in the pending change from
--    20261006130000_d4_kpi_editable_core_name.sql (the Core KPI name is editable per scorecard; order and weight stay
--    locked to the catalog), because the form already allows editing the name and the current function would reject it.
--    Formula is unchanged: weighted = weight x raw score, total = sum of weighted (Excel rule), rounded to 2 decimals.
create or replace function public.d4_calculate_kpi_assessment() returns trigger
language plpgsql set search_path = public as $$
declare
  role_title text;
  indicator_count integer;
  total_weight integer;
  template_weight integer;
  max_score integer;
  line jsonb;
  raw_score integer;
  weighted_total numeric := 0;
  all_scored boolean := true;
  item integer;
begin
  max_score := case when new.definition_version in ('V3.1', 'V5.1') then 5 else 100 end;

  select min(role_name), count(*), sum(weight_percent)
    into role_title, indicator_count, total_weight
    from public.d4_kpi_role_catalog
    where source_version = new.definition_version and role_order = new.role_order;
  if indicator_count <> 5 or total_weight <> 100 or new.role_name is distinct from role_title then
    raise exception 'Jabatan KPI dan total bobot harus sesuai katalog %', new.definition_version;
  end if;

  for item in 1..5 loop
    select weight_percent into template_weight
      from public.d4_kpi_role_catalog
      where source_version = new.definition_version and role_order = new.role_order and indicator_order = item;
    line := new.lines -> (item - 1);
    if line->>'indicator_order' is distinct from item::text
       or coalesce(btrim(line->>'kpi_name'), '') = ''
       or line->>'weight_percent' is distinct from template_weight::text then
      raise exception 'Indikator % harus sesuai katalog KPI %', item, new.definition_version;
    end if;
    if line->>'raw_score' is null or line->>'raw_score' = '' then
      all_scored := false;
    else
      raw_score := (line->>'raw_score')::integer;
      if raw_score < 1 or raw_score > max_score then
        raise exception 'Skor indikator % harus antara 1 dan %', item, max_score;
      end if;
      weighted_total := weighted_total + template_weight * raw_score / 100.0;
    end if;
  end loop;

  if new.status = 'completed' and not all_scored then
    raise exception 'Seluruh lima indikator harus dinilai sebelum diselesaikan';
  end if;
  new.overall_score := case when all_scored then round(weighted_total, 2) else null end;
  return new;
end;
$$;
