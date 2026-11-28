-- 04_fungsi_trigger.sql: fungsi D4 yang tidak butuh login, dan trigger cek versi katalog KPI
-- Jalankan setelah 03. Trigger dibuat sesudah data dimuat (02), supaya baris lama tidak divalidasi ulang.
-- d4_create_development_need dan d4_create_training_record bisa dibuat sekarang, tetapi baru bisa dipakai
-- setelah 90: keduanya mengandalkan default actor_auth_user_id dan actor_employee_id yang dipasang di sana.

begin;
set search_path = public;

CREATE OR REPLACE FUNCTION public.d4_kpi_version_for(period text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select source_version from public.d4_kpi_catalog_versions
  where effective_from <= period order by effective_from desc limit 1
$function$;

CREATE OR REPLACE FUNCTION public.d4_check_kpi_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare expected text := public.d4_kpi_version_for(new.period);
begin
  if new.definition_version is distinct from expected then
    raise exception 'Scorecard periode % harus memakai katalog KPI %', new.period, coalesce(expected, '(belum ada katalog yang berlaku)');
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.d4_create_development_need(p_employee_id uuid, p_source_type character varying, p_source_ref uuid, p_objective text, p_priority character varying, p_notes text, p_method text DEFAULT NULL::text, p_pic text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid;
begin
  insert into public.d4_development_needs (
    employee_id, source_type, position_requirement_id,
    competency_assessment_id, kpi_assessment_id, objective, priority, method, pic
  ) values (
    p_employee_id, p_source_type,
    case when p_source_type = 'competency_gap' then p_source_ref end,
    case when p_source_type = 'role_change' then p_source_ref end,
    case when p_source_type = 'performance_context' then p_source_ref end,
    p_objective, p_priority, nullif(btrim(p_method), ''), nullif(btrim(p_pic), '')
  ) returning id into v_id;
  insert into public.d4_development_need_versions (development_need_id, revision, status, notes)
    values (v_id, 1, 'Identified', coalesce(p_notes, ''));
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.d4_create_training_record(p_employee_id uuid, p_development_need_id uuid, p_activity text, p_activity_date date, p_status character varying, p_result text, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid;
begin
  insert into public.d4_training_records (employee_id, development_need_id, activity, activity_date)
    values (p_employee_id, p_development_need_id, p_activity, p_activity_date)
    returning id into v_id;
  insert into public.d4_training_versions (training_id, revision, status, result, notes)
    values (v_id, 1, p_status, coalesce(p_result, ''), coalesce(p_notes, ''));
  return v_id;
end;
$function$;

CREATE TRIGGER d4_kpi_assessments_version BEFORE INSERT ON public.d4_kpi_assessments FOR EACH ROW EXECUTE FUNCTION d4_check_kpi_version();
CREATE TRIGGER d4_kpi_daily_entries_version BEFORE INSERT ON public.d4_kpi_daily_entries FOR EACH ROW EXECUTE FUNCTION d4_check_kpi_version();

commit;
