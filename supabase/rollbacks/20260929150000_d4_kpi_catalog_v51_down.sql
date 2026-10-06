-- Rollback of supabase/migrations/20260929150000_d4_kpi_catalog_v51.sql (back to the V3.1-only catalog).
-- Kept outside supabase/migrations so it is never applied automatically. Run manually, only with PO approval.
--
-- Safe only while no KPI assessment was scored against V5.1. Check first; the result must be 0:
--   select count(*) from public.d4_kpi_assessments where definition_version = 'V5.1';
begin;

do $$
declare
  scored_v51 boolean := false;
begin
  -- Dynamic SQL: the column is gone after a completed rollback, so a static reference would not compile.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'd4_kpi_assessments' and column_name = 'definition_version') then
    execute 'select exists (select 1 from public.d4_kpi_assessments where definition_version = ''V5.1'')' into scored_v51;
  end if;
  if scored_v51 then
    raise exception 'Rollback dibatalkan: sudah ada penilaian KPI versi V5.1.';
  end if;
end $$;

-- 1. Score calculation back to the V3.1 function (copied from 20260929140000_d4_kpi_assessments_v31.sql).
--    Replaced before the column is dropped, so no insert ever runs a function that reads a missing column.
create or replace function public.d4_calculate_kpi_assessment() returns trigger
language plpgsql set search_path = public as $$
declare
  role_title text;
  indicator_count integer;
  total_weight integer;
  template_name text;
  template_weight integer;
  line jsonb;
  raw_score integer;
  weighted_total numeric := 0;
  all_scored boolean := true;
  item integer;
begin
  select min(role_name), count(*), sum(weight_percent)
    into role_title, indicator_count, total_weight
    from public.d4_kpi_role_catalog where role_order = new.role_order;
  if indicator_count <> 5 or total_weight <> 100 or new.role_name is distinct from role_title then
    raise exception 'Jabatan KPI dan total bobot harus sesuai katalog V3.1';
  end if;

  for item in 1..5 loop
    select kpi_name, weight_percent into template_name, template_weight
      from public.d4_kpi_role_catalog
      where role_order = new.role_order and indicator_order = item;
    line := new.lines -> (item - 1);
    if line->>'indicator_order' is distinct from item::text
       or line->>'kpi_name' is distinct from template_name
       or line->>'weight_percent' is distinct from template_weight::text then
      raise exception 'Indikator % harus sesuai katalog KPI V3.1', item;
    end if;
    if line->>'raw_score' is null or line->>'raw_score' = '' then
      all_scored := false;
    else
      raw_score := (line->>'raw_score')::integer;
      if raw_score < 1 or raw_score > 5 then
        raise exception 'Skor indikator % harus antara 1 dan 5', item;
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

-- 2. Assessments no longer record a catalog version.
alter table public.d4_kpi_assessments drop column if exists definition_version;

-- 3. Remove the V5.1 catalog rows.
delete from public.d4_kpi_role_catalog where source_version = 'V5.1';

-- 4. Restore the original V3.1 keys.
alter table public.d4_kpi_role_catalog drop constraint if exists d4_kpi_role_catalog_version_role_kpi_key;
alter table public.d4_kpi_role_catalog drop constraint if exists d4_kpi_role_catalog_source_version_role_name_kpi_name_key;
alter table public.d4_kpi_role_catalog drop constraint if exists d4_kpi_role_catalog_role_name_kpi_name_key;
alter table public.d4_kpi_role_catalog drop constraint if exists d4_kpi_role_catalog_pkey;
alter table public.d4_kpi_role_catalog add primary key (role_order, indicator_order);
alter table public.d4_kpi_role_catalog add constraint d4_kpi_role_catalog_role_name_kpi_name_key unique (role_name, kpi_name);

commit;
