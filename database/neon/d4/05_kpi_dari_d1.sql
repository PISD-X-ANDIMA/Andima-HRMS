-- 05_kpi_dari_d1.sql: view katalog KPI yang membaca tabel D1, dan trigger hitung skor KPI
-- Mulai periode 2026-11, katalog KPI D4 diambil dari D1 (d1_job_positions, d1_kpi_definitions) lewat pemetaan posisi D3
-- (d3_d1_position_mappings). Jadi file ini baru bisa dijalankan setelah tabel D1 ada di Neon dan skrip D3 01 sudah jalan.
-- Sebelum file ini jalan, scorecard KPI dan Daily KPI tidak bisa disimpan: trigger hitung skor membaca d4_kpi_catalog_rows.

begin;
set search_path = public;

do $$
begin
  if to_regclass('public.d1_job_positions') is null or to_regclass('public.d1_kpi_definitions') is null then
    raise exception 'Tabel D1 (d1_job_positions, d1_kpi_definitions) belum ada di Neon. Jalankan file ini setelah D1 migrasi.';
  end if;
  if to_regclass('public.d3_d1_position_mappings') is null then
    raise exception 'Tabel d3_d1_position_mappings belum ada. Jalankan skrip D3 01 dulu.';
  end if;
end $$;

CREATE VIEW public.d4_kpi_d1_catalog AS
 WITH positions AS (
         SELECT jp.id,
            jp.job_code,
            jp.nama_posisi,
            1000 + "substring"(jp.job_code::text, '[0-9]+'::text)::integer AS role_order
           FROM d1_job_positions jp
          WHERE jp.status_posisi::text = 'Active'::text AND jp.job_code::text ~ '[0-9]'::text AND (( SELECT sum(k_1.kpi_weight) AS sum
                   FROM d1_kpi_definitions k_1
                  WHERE k_1.position_id = jp.id AND k_1.is_active AND k_1.deleted_at IS NULL)) = 100
        )
 SELECT p.id AS d1_position_id,
    p.job_code::text AS d1_job_code,
    p.role_order,
    p.nama_posisi::text AS role_name,
    row_number() OVER (PARTITION BY p.id ORDER BY (
        CASE
            WHEN (k.metadata ->> 'indicator_order'::text) ~ '^[0-9]+$'::text THEN (k.metadata ->> 'indicator_order'::text)::integer
            ELSE NULL::integer
        END), k.created_at, k.id)::integer AS indicator_order,
    k.kpi_name::text AS kpi_name,
    k.kpi_target::text AS target,
    k.kpi_weight AS weight_percent,
    k.id AS d1_kpi_id
   FROM positions p
     JOIN d1_kpi_definitions k ON k.position_id = p.id AND k.is_active AND k.deleted_at IS NULL;

CREATE VIEW public.d4_kpi_d1_position_roles AS
 SELECT DISTINCT ON (m.position_id) m.position_id,
    c.role_order
   FROM d3_d1_position_mappings m
     JOIN ( SELECT DISTINCT d4_kpi_d1_catalog.d1_position_id,
            d4_kpi_d1_catalog.role_order
           FROM d4_kpi_d1_catalog) c ON c.d1_position_id = m.d1_position_id
  WHERE m.is_active
  ORDER BY m.position_id, c.role_order;

CREATE VIEW public.d4_kpi_catalog_rows AS
 SELECT d4_kpi_role_catalog.role_order,
    d4_kpi_role_catalog.role_name,
    d4_kpi_role_catalog.indicator_order,
    d4_kpi_role_catalog.kpi_name,
    d4_kpi_role_catalog.target,
    d4_kpi_role_catalog.weight_percent,
    d4_kpi_role_catalog.source_version,
    'D4'::text AS kpi_source,
    NULL::text AS d1_job_code,
    NULL::uuid AS d1_kpi_id
   FROM d4_kpi_role_catalog
UNION ALL
 SELECT c.role_order,
    c.role_name,
    c.indicator_order,
    c.kpi_name,
    c.target,
    c.weight_percent,
    v.source_version,
    'D1'::text AS kpi_source,
    c.d1_job_code,
    c.d1_kpi_id
   FROM d4_kpi_d1_catalog c
     JOIN d4_kpi_catalog_versions v ON v.effective_from::text >= '2026-11'::text;

CREATE VIEW public.d4_kpi_position_roles AS
 SELECT v.source_version,
    r.position_id,
    r.role_order,
    'D1'::text AS kpi_source
   FROM d4_kpi_d1_position_roles r
     JOIN d4_kpi_catalog_versions v ON v.effective_from::text >= '2026-11'::text
UNION ALL
 SELECT k.source_version,
    k.position_id,
    k.role_order,
    'D4'::text AS kpi_source
   FROM d4_position_kpi_roles k
     JOIN d4_kpi_catalog_versions v ON v.source_version = k.source_version
  WHERE v.effective_from::text < '2026-11'::text OR NOT (EXISTS ( SELECT 1
           FROM d4_kpi_d1_position_roles r
          WHERE r.position_id = k.position_id));

-- Isi fungsi sama dengan live; hanya indentasinya dirapikan (di live indentasinya bertumpuk).
CREATE OR REPLACE FUNCTION public.d4_calculate_kpi_assessment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE TRIGGER d4_kpi_assessments_calculate BEFORE INSERT ON public.d4_kpi_assessments FOR EACH ROW EXECUTE FUNCTION d4_calculate_kpi_assessment();
CREATE TRIGGER d4_kpi_daily_entries_calculate BEFORE INSERT ON public.d4_kpi_daily_entries FOR EACH ROW EXECUTE FUNCTION d4_calculate_kpi_assessment();

commit;
