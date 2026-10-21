-- Penilaian Kinerja (FR-D4-001 v3.1): one record holds the five Core KPI, the evaluation notes (required) and evidence.
-- * d4_kpi_assessments is that record; d4_performance_evaluations stays read-only history for older evaluations.
-- * A Performance-context development need now points at the Penilaian Kinerja (kpi_assessment_id);
--   needs raised from an older evaluation keep performance_evaluation_id.
-- * definition_version is no longer limited to V3.1/V5.1: trigger d4_kpi_assessments_version already checks
--   it against d4_kpi_catalog_versions, and the old list would reject the next catalog.

alter table public.d4_kpi_assessments
  add column evidence_reference text check (length(evidence_reference) <= 500),
  drop constraint d4_kpi_assessments_definition_version_check,
  add constraint d4_kpi_assessments_id_employee_id_key unique (id, employee_id);
-- not valid: older scorecards saved without notes stay as they are; new ones need notes.
alter table public.d4_kpi_assessments add constraint d4_kpi_assessments_notes_required
  check (status <> 'completed' or length(btrim(general_notes)) > 0) not valid;

alter table public.d4_development_needs
  add column kpi_assessment_id uuid,
  add constraint d4_development_needs_kpi_assessment_fkey foreign key (kpi_assessment_id, employee_id)
    references public.d4_kpi_assessments(id, employee_id),
  drop constraint d4_development_needs_check,
  add constraint d4_development_needs_check check (
    (source_type = 'competency_gap' and position_requirement_id is not null and competency_assessment_id is null and performance_evaluation_id is null and kpi_assessment_id is null)
    or (source_type = 'role_change' and position_requirement_id is null and competency_assessment_id is not null and performance_evaluation_id is null and kpi_assessment_id is null)
    or (source_type = 'performance_context' and position_requirement_id is null and competency_assessment_id is null
        and (performance_evaluation_id is null) <> (kpi_assessment_id is null))
  );
create index d4_development_needs_kpi_assessment_idx on public.d4_development_needs(kpi_assessment_id) where kpi_assessment_id is not null;

create or replace function public.d4_create_development_need(
  p_employee_id uuid, p_source_type varchar, p_source_ref uuid,
  p_objective text, p_priority varchar, p_notes text
) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into public.d4_development_needs (
    employee_id, source_type, position_requirement_id,
    competency_assessment_id, kpi_assessment_id, objective, priority
  ) values (
    p_employee_id, p_source_type,
    case when p_source_type = 'competency_gap' then p_source_ref end,
    case when p_source_type = 'role_change' then p_source_ref end,
    case when p_source_type = 'performance_context' then p_source_ref end,
    p_objective, p_priority
  ) returning id into v_id;
  insert into public.d4_development_need_versions (development_need_id, revision, status, notes)
    values (v_id, 1, 'Identified', coalesce(p_notes, ''));
  return v_id;
end;
$$;
