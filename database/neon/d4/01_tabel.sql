-- 01_tabel.sql: tabel D4 dengan primary key, unique, check, dan default yang tidak butuh login
-- Sumber: Supabase "PISD x Andima Transportindo" (Postgres 17), diambil read-only 28 Nov 2026 dari keadaan live.
-- Jalankan setelah skrip D3 01 (tabel d3_* sudah ada). Relasi (foreign key) dan index ada di 03,
-- supaya data di 02 bisa dimuat tanpa memikirkan urutan.
-- Default auth.uid() dan d4_current_employee_uuid() sengaja dilepas; dipasang lagi di 90 setelah ada pengganti Supabase Auth.
-- Dua check yang di live berstatus NOT VALID (evidence_reference_required, notes_required) ada di 03,
-- karena data lama memang punya baris yang tidak memenuhinya.
-- Kalau ada tabel dengan nama yang sama di Neon, file ini gagal dan tidak mengubah apa pun.
--
-- position_requirements tidak berprefiks, tetapi di repo Andima hanya D4 yang membuat dan membacanya
-- (syarat kompetensi per posisi, 62 baris). Kalau squad lain sudah membuatnya di Neon, hapus blok tabel itu dari file ini.

begin;
set search_path = public;

create table public.position_requirements (
  id uuid default gen_random_uuid() not null,
  position_id uuid not null,
  competency_id uuid not null,
  min_proficiency_level integer default 1 not null,
  is_mandatory boolean default true,
  created_at timestamp with time zone default now(),
  constraint position_requirements_pkey primary key (id),
  constraint position_requirements_position_id_competency_id_key unique (position_id, competency_id),
  constraint position_requirements_min_proficiency_level_check check (((min_proficiency_level >= 1) and (min_proficiency_level <= 5)))
);

create table public.d4_kpi_catalog_versions (
  source_version text not null,
  effective_from character varying(7) not null,
  constraint d4_kpi_catalog_versions_pkey primary key (source_version),
  constraint d4_kpi_catalog_versions_effective_from_key unique (effective_from),
  constraint d4_kpi_catalog_versions_effective_from_check check (((effective_from)::text ~ '^\d{4}-(0[1-9]|1[0-2])$'::text))
);

create table public.d4_kpi_role_catalog (
  role_order integer not null,
  role_name text not null,
  indicator_order integer not null,
  kpi_name text not null,
  target text,
  weight_percent integer not null,
  source_version text default 'V3.1'::text not null,
  constraint d4_kpi_role_catalog_pkey primary key (source_version, role_order, indicator_order),
  constraint d4_kpi_role_catalog_version_role_kpi_key unique (source_version, role_name, kpi_name),
  constraint d4_kpi_role_catalog_indicator_order_check check (((indicator_order >= 1) and (indicator_order <= 5))),
  constraint d4_kpi_role_catalog_role_order_check check (((role_order >= 1) and (role_order <= 10))),
  constraint d4_kpi_role_catalog_weight_percent_check check (((weight_percent >= 1) and (weight_percent <= 100)))
);

create table public.d4_position_kpi_roles (
  source_version text not null,
  position_id uuid not null,
  role_order integer not null,
  constraint d4_position_kpi_roles_pkey primary key (source_version, position_id),
  constraint d4_position_kpi_roles_role_order_check check ((role_order > 0))
);

create table public.d4_competency_assessments (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  position_id uuid not null,
  position_title_snapshot text not null,
  effective_date date not null,
  context character varying(24) not null,
  overall_status character varying(32) not null,
  findings jsonb not null,
  actor_auth_user_id uuid not null,
  actor_employee_id uuid not null,
  created_at timestamp with time zone default now() not null,
  assessed_with text,
  constraint d4_competency_assessments_pkey primary key (id),
  constraint d4_competency_assessments_id_employee_id_key unique (id, employee_id),
  constraint d4_competency_assessments_assessed_with_check check (((length(btrim(assessed_with)) >= 1) and (length(btrim(assessed_with)) <= 200))),
  constraint d4_competency_assessments_context_check check (((context)::text = any ((array['current-position'::character varying, 'role-change'::character varying])::text[]))),
  constraint d4_competency_assessments_findings_check check ((jsonb_typeof(findings) = 'array'::text)),
  constraint d4_competency_assessments_overall_status_check check (((overall_status)::text = any ((array['Terpenuhi'::character varying, 'Gap'::character varying, 'Bukti Belum Cukup'::character varying, 'Belum Ada Persyaratan'::character varying])::text[])))
);

create table public.d4_performance_evaluations (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  position_id uuid not null,
  position_title_snapshot text not null,
  period character varying(7) not null,
  evaluation_date date,
  evaluator_name_snapshot text default ''::text not null,
  status character varying(16) not null,
  review_status character varying(32) not null,
  overall_score numeric(3,2),
  aspects jsonb default '[]'::jsonb not null,
  general_notes text default ''::text not null,
  evidence_reference text,
  actor_auth_user_id uuid not null,
  actor_employee_id uuid not null,
  created_at timestamp with time zone default now() not null,
  constraint d4_performance_evaluations_pkey primary key (id),
  constraint d4_performance_evaluations_id_employee_id_key unique (id, employee_id),
  constraint d4_performance_evaluations_aspects_check check ((jsonb_typeof(aspects) = 'array'::text)),
  constraint d4_performance_evaluations_check check ((((status)::text <> 'completed'::text) or ((evaluation_date is not null) and (length(btrim(evaluator_name_snapshot)) > 0) and (length(btrim(general_notes)) > 0)))),
  constraint d4_performance_evaluations_overall_score_check check (((overall_score >= (1)::numeric) and (overall_score <= (5)::numeric))),
  constraint d4_performance_evaluations_period_check check (((period)::text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text)),
  constraint d4_performance_evaluations_review_status_check check (((review_status)::text = any ((array['Needs Review'::character varying, 'On Track'::character varying, 'Needs Attention'::character varying])::text[]))),
  constraint d4_performance_evaluations_status_check check (((status)::text = any ((array['draft'::character varying, 'completed'::character varying])::text[])))
);

create table public.d4_kpi_assessments (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  role_order integer not null,
  role_name text not null,
  period character varying(7) not null,
  evaluation_date date,
  evaluator_name text default ''::text not null,
  status character varying(16) not null,
  lines jsonb not null,
  overall_score numeric(5,2),
  general_notes text default ''::text not null,
  actor_auth_user_id uuid not null,
  actor_employee_id uuid not null,
  created_at timestamp with time zone default now() not null,
  definition_version text default 'V5.1'::text not null,
  evidence_reference text,
  constraint d4_kpi_assessments_pkey primary key (id),
  constraint d4_kpi_assessments_id_employee_id_key unique (id, employee_id),
  constraint d4_kpi_assessments_check check ((((status)::text <> 'completed'::text) or ((evaluation_date is not null) and (length(btrim(evaluator_name)) > 0) and (overall_score is not null)))),
  constraint d4_kpi_assessments_evidence_reference_check check ((length(evidence_reference) <= 500)),
  constraint d4_kpi_assessments_lines_check check (((jsonb_typeof(lines) = 'array'::text) and (jsonb_array_length(lines) >= 1))),
  constraint d4_kpi_assessments_overall_score_check check (((overall_score >= (1)::numeric) and (overall_score <= (100)::numeric))),
  constraint d4_kpi_assessments_period_check check (((period)::text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text)),
  constraint d4_kpi_assessments_role_order_check check ((role_order > 0)),
  constraint d4_kpi_assessments_status_check check (((status)::text = any ((array['draft'::character varying, 'completed'::character varying])::text[])))
);

create table public.d4_kpi_daily_entries (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  entry_date date not null,
  period character varying(7) not null,
  definition_version text not null,
  role_order integer not null,
  role_name text not null,
  status character varying(16) default 'completed'::character varying not null,
  lines jsonb not null,
  overall_score numeric(5,2),
  actor_auth_user_id uuid not null,
  created_at timestamp with time zone default now() not null,
  constraint d4_kpi_daily_entries_pkey primary key (id),
  constraint d4_kpi_daily_entries_check check (((period)::text = to_char((entry_date)::timestamp with time zone, 'YYYY-MM'::text))),
  constraint d4_kpi_daily_entries_lines_check check (((jsonb_typeof(lines) = 'array'::text) and (jsonb_array_length(lines) >= 1))),
  constraint d4_kpi_daily_entries_overall_score_check check (((overall_score >= (1)::numeric) and (overall_score <= (100)::numeric))),
  constraint d4_kpi_daily_entries_role_order_check check ((role_order > 0)),
  constraint d4_kpi_daily_entries_status_check check (((status)::text = 'completed'::text))
);

create table public.d4_development_needs (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  source_type character varying(24) not null,
  position_requirement_id uuid,
  competency_assessment_id uuid,
  performance_evaluation_id uuid,
  objective text not null,
  priority character varying(8) not null,
  actor_auth_user_id uuid not null,
  actor_employee_id uuid not null,
  created_at timestamp with time zone default now() not null,
  kpi_assessment_id uuid,
  method text,
  pic text,
  constraint d4_development_needs_pkey primary key (id),
  constraint d4_development_needs_id_employee_id_key unique (id, employee_id),
  constraint d4_development_needs_check check (((((source_type)::text = 'competency_gap'::text) and (position_requirement_id is not null) and (competency_assessment_id is null) and (performance_evaluation_id is null) and (kpi_assessment_id is null)) or (((source_type)::text = 'role_change'::text) and (position_requirement_id is null) and (competency_assessment_id is not null) and (performance_evaluation_id is null) and (kpi_assessment_id is null)) or (((source_type)::text = 'performance_context'::text) and (position_requirement_id is null) and (competency_assessment_id is null) and ((performance_evaluation_id is null) <> (kpi_assessment_id is null))))),
  constraint d4_development_needs_method_check check ((length(method) <= 120)),
  constraint d4_development_needs_objective_check check ((length(btrim(objective)) > 0)),
  constraint d4_development_needs_pic_check check ((length(pic) <= 120)),
  constraint d4_development_needs_priority_check check (((priority)::text = any ((array['Low'::character varying, 'Medium'::character varying, 'High'::character varying])::text[]))),
  constraint d4_development_needs_source_type_check check (((source_type)::text = any ((array['competency_gap'::character varying, 'role_change'::character varying, 'performance_context'::character varying])::text[])))
);

create table public.d4_development_need_versions (
  id uuid default gen_random_uuid() not null,
  development_need_id uuid not null,
  revision integer not null,
  status character varying(16) not null,
  notes text default ''::text not null,
  actor_auth_user_id uuid not null,
  actor_employee_id uuid not null,
  created_at timestamp with time zone default now() not null,
  priority character varying(8),
  method text,
  pic text,
  reassessment character varying(20),
  constraint d4_development_need_versions_pkey primary key (id),
  constraint d4_development_need_versions_development_need_id_revision_key unique (development_need_id, revision),
  constraint d4_development_need_versions_method_check check ((length(method) <= 120)),
  constraint d4_development_need_versions_pic_check check ((length(pic) <= 120)),
  constraint d4_development_need_versions_priority_check check (((priority)::text = any ((array['Low'::character varying, 'Medium'::character varying, 'High'::character varying])::text[]))),
  constraint d4_development_need_versions_reassessment_check check (((reassessment)::text = any ((array['Retraining'::character varying, 'Meets requirement'::character varying])::text[]))),
  constraint d4_development_need_versions_revision_check check ((revision >= 1)),
  constraint d4_development_need_versions_status_check check (((status)::text = any ((array['Identified'::character varying, 'Planned'::character varying, 'In Progress'::character varying, 'Completed'::character varying])::text[]))),
  constraint d4_development_versions_reassessment_status check (((reassessment is null) or (((reassessment)::text = 'Retraining'::text) and ((status)::text = 'Planned'::text)) or (((reassessment)::text = 'Meets requirement'::text) and ((status)::text = 'Completed'::text))))
);

create table public.d4_training_records (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  development_need_id uuid not null,
  activity text not null,
  activity_date date not null,
  actor_auth_user_id uuid not null,
  actor_employee_id uuid not null,
  created_at timestamp with time zone default now() not null,
  constraint d4_training_records_pkey primary key (id),
  constraint d4_training_records_activity_check check ((length(btrim(activity)) > 0))
);

create table public.d4_training_versions (
  id uuid default gen_random_uuid() not null,
  training_id uuid not null,
  revision integer not null,
  status character varying(16) not null,
  result text default ''::text not null,
  notes text default ''::text not null,
  actor_auth_user_id uuid not null,
  actor_employee_id uuid not null,
  created_at timestamp with time zone default now() not null,
  follow_up character varying(16),
  constraint d4_training_versions_pkey primary key (id),
  constraint d4_training_versions_training_id_revision_key unique (training_id, revision),
  constraint d4_training_versions_check check ((((status)::text <> 'Completed'::text) or (length(btrim(result)) > 0))),
  constraint d4_training_versions_follow_up_check check (((follow_up)::text = any ((array['Retraining'::character varying, 'Other follow-up'::character varying])::text[]))),
  constraint d4_training_versions_follow_up_not_passed check (((follow_up is null) or (((status)::text = 'Completed'::text) and (result = 'Not Passed'::text)))),
  constraint d4_training_versions_follow_up_notes check ((((follow_up)::text is distinct from 'Other follow-up'::text) or (length(btrim(notes)) > 0))),
  constraint d4_training_versions_revision_check check ((revision >= 1)),
  constraint d4_training_versions_status_check check (((status)::text = any ((array['Planned'::character varying, 'In Progress'::character varying, 'Completed'::character varying, 'Cancelled'::character varying])::text[])))
);

commit;
