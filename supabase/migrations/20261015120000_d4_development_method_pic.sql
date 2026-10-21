-- Development requirement: optional method (Training, Coaching, ...) and PIC (who follows it up).
-- Both are nullable so existing requirements stay valid.

alter table public.d4_development_needs
  add column method text check (length(method) <= 120),
  add column pic text check (length(pic) <= 120);

drop function public.d4_create_development_need(uuid, varchar, uuid, text, varchar, text);

create function public.d4_create_development_need(
  p_employee_id uuid, p_source_type varchar, p_source_ref uuid,
  p_objective text, p_priority varchar, p_notes text,
  p_method text default null, p_pic text default null
) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
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
$$;

revoke all on function public.d4_create_development_need(uuid, varchar, uuid, text, varchar, text, text, text) from public, anon;
grant execute on function public.d4_create_development_need(uuid, varchar, uuid, text, varchar, text, text, text) to authenticated;
