-- 01_tabel.sql: schema, tipe enum, tabel, primary key, unique, check
-- Sumber: Supabase "PISD x Andima Transportindo" (Postgres 17.6), diekspor read-only 2026-11-27.
-- Belum ada relasi (foreign key) dan index tambahan: itu di 03, supaya data di 02 bisa dimuat bebas urutan.
-- Jalankan sekali di database Neon yang masih kosong dari tabel d3_*. Kalau ada nama yang bentrok, file ini gagal dan tidak mengubah apa pun.

begin;
set search_path = public;

create schema if not exists private;

-- Tipe enum dibuat hanya kalau belum ada. d3_app_role sudah dibuat MID di Neon untuk b2_register.app_role;
-- kalau sudah ada tapi isinya beda dengan versi D3, file ini berhenti (tidak ada yang berubah).
do $$
begin
  if to_regtype('public.d3_app_role') is null then
    create type public.d3_app_role as enum ('EMPLOYEE', 'HR', 'MANAGER', 'STAFF', 'MANAGEMENT');
  elsif (select array_agg(enumlabel::text order by enumsortorder) from pg_enum where enumtypid = 'public.d3_app_role'::regtype)
        is distinct from array['EMPLOYEE', 'HR', 'MANAGER', 'STAFF', 'MANAGEMENT']::text[] then
    raise exception 'Tipe public.d3_app_role sudah ada tapi isinya beda dengan versi D3';
  end if;
end $$;
do $$
begin
  if to_regtype('public.d3_ticket_priority') is null then
    create type public.d3_ticket_priority as enum ('LOW', 'NORMAL', 'HIGH');
  elsif (select array_agg(enumlabel::text order by enumsortorder) from pg_enum where enumtypid = 'public.d3_ticket_priority'::regtype)
        is distinct from array['LOW', 'NORMAL', 'HIGH']::text[] then
    raise exception 'Tipe public.d3_ticket_priority sudah ada tapi isinya beda dengan versi D3';
  end if;
end $$;
do $$
begin
  if to_regtype('public.d3_ticket_status') is null then
    create type public.d3_ticket_status as enum ('PENDING', 'TODO', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');
  elsif (select array_agg(enumlabel::text order by enumsortorder) from pg_enum where enumtypid = 'public.d3_ticket_status'::regtype)
        is distinct from array['PENDING', 'TODO', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']::text[] then
    raise exception 'Tipe public.d3_ticket_status sudah ada tapi isinya beda dengan versi D3';
  end if;
end $$;

create table private.d3_idle_logout_policy (
  policy_key text default 'default'::text not null,
  idle_timeout_seconds integer not null,
  warning_seconds integer not null
);
alter table private.d3_idle_logout_policy add constraint d3_idle_logout_policy_pkey PRIMARY KEY (policy_key);
alter table private.d3_idle_logout_policy add constraint d3_idle_logout_policy_check CHECK ((warning_seconds < idle_timeout_seconds));
alter table private.d3_idle_logout_policy add constraint d3_idle_logout_policy_idle_timeout_seconds_check CHECK (((idle_timeout_seconds >= 60) AND (idle_timeout_seconds <= 86400)));
alter table private.d3_idle_logout_policy add constraint d3_idle_logout_policy_policy_key_check CHECK ((policy_key = 'default'::text));
alter table private.d3_idle_logout_policy add constraint d3_idle_logout_policy_warning_seconds_check CHECK (((warning_seconds >= 1) AND (warning_seconds <= 3600)));

create table private.d3_idle_sessions (
  session_id uuid not null,
  auth_user_id uuid not null,
  b2_register_id uuid not null,
  employee_id uuid not null,
  work_location text not null,
  time_zone text not null,
  started_at timestamp with time zone default now() not null,
  last_activity_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone not null
);
alter table private.d3_idle_sessions add constraint d3_idle_sessions_pkey PRIMARY KEY (session_id);
alter table private.d3_idle_sessions add constraint d3_idle_sessions_check CHECK ((expires_at > started_at));

create table private.d3_work_location_timezones (
  work_location text not null,
  time_zone text not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table private.d3_work_location_timezones add constraint d3_work_location_timezones_pkey PRIMARY KEY (work_location);
alter table private.d3_work_location_timezones add constraint d3_work_location_timezones_time_zone_check CHECK ((time_zone = ANY (ARRAY['Asia/Jakarta'::text, 'Asia/Makassar'::text, 'Asia/Jayapura'::text])));
alter table private.d3_work_location_timezones add constraint d3_work_location_timezones_work_location_check CHECK ((work_location = upper(btrim(work_location))));
alter table private.d3_work_location_timezones add constraint d3_work_location_timezones_work_location_check1 CHECK ((char_length(work_location) > 0));

create table public.d3_attendance_audit_log (
  id uuid default gen_random_uuid() not null,
  attendance_id uuid,
  correction_id bigint,
  closing_id uuid,
  target_b2_register_id uuid,
  actor_b2_register_id uuid,
  action text not null,
  details jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);
alter table public.d3_attendance_audit_log add constraint d3_attendance_audit_log_pkey PRIMARY KEY (id);

create table public.d3_attendance_closings (
  id uuid default gen_random_uuid() not null,
  period_start date not null,
  period_end date not null,
  status text default 'CLOSED'::text not null,
  closed_by_b2_register_id uuid not null,
  closed_at timestamp with time zone default now() not null,
  reopened_by_b2_register_id uuid,
  reopened_at timestamp with time zone,
  reason text,
  created_at timestamp with time zone default now() not null
);
alter table public.d3_attendance_closings add constraint d3_attendance_closings_pkey PRIMARY KEY (id);
alter table public.d3_attendance_closings add constraint d3_attendance_closings_period_unique UNIQUE (period_start, period_end);
alter table public.d3_attendance_closings add constraint d3_attendance_closings_period_check CHECK ((period_start <= period_end));
alter table public.d3_attendance_closings add constraint d3_attendance_closings_status_check CHECK ((status = ANY (ARRAY['OPEN'::text, 'CLOSED'::text])));

create table public.d3_attendance_corrections (
  id bigint generated by default as identity not null,
  created_at timestamp with time zone default now() not null,
  attendance_id uuid default gen_random_uuid(),
  requested_by_b2_register_id uuid,
  correction_type character varying,
  proposed_clock_in timestamp with time zone,
  proposed_clock_out timestamp with time zone,
  reason text,
  status character varying,
  reviewed_by_b2_register_id uuid,
  review_note text
);
alter table public.d3_attendance_corrections add constraint d3_attendance_corrections_pkey PRIMARY KEY (id);

create table public.d3_attendances (
  id uuid default gen_random_uuid() not null,
  date date default CURRENT_DATE not null,
  clock_in timestamp with time zone not null,
  clock_out timestamp with time zone,
  status character varying(20) default 'PRESENT'::character varying,
  notes text,
  created_at timestamp with time zone default now(),
  clock_in_latitude numeric(9,6),
  clock_in_longitude numeric(9,6),
  clock_in_accuracy_meters numeric(8,2),
  clock_out_latitude numeric(9,6),
  clock_out_longitude numeric(9,6),
  clock_out_accuracy_meters numeric(8,2),
  b2_register_id uuid not null
);
alter table public.d3_attendances add constraint attendances_pkey PRIMARY KEY (id);
alter table public.d3_attendances add constraint d3_attendances_b2_register_id_date_key UNIQUE (b2_register_id, date);
alter table public.d3_attendances add constraint attendances_status_check CHECK (((status)::text = ANY ((ARRAY['PRESENT'::character varying, 'LATE'::character varying, 'ABSENT'::character varying, 'ON_LEAVE'::character varying])::text[])));
alter table public.d3_attendances add constraint d3_attendances_clock_in_coordinate_pair CHECK ((((clock_in_latitude IS NULL) AND (clock_in_longitude IS NULL)) OR ((clock_in_latitude IS NOT NULL) AND (clock_in_longitude IS NOT NULL))));
alter table public.d3_attendances add constraint d3_attendances_clock_in_coordinate_range CHECK ((((clock_in_latitude IS NULL) OR ((clock_in_latitude >= ('-90'::integer)::numeric) AND (clock_in_latitude <= (90)::numeric))) AND ((clock_in_longitude IS NULL) OR ((clock_in_longitude >= ('-180'::integer)::numeric) AND (clock_in_longitude <= (180)::numeric))) AND ((clock_in_accuracy_meters IS NULL) OR (clock_in_accuracy_meters >= (0)::numeric))));
alter table public.d3_attendances add constraint d3_attendances_clock_out_coordinate_pair CHECK ((((clock_out_latitude IS NULL) AND (clock_out_longitude IS NULL)) OR ((clock_out_latitude IS NOT NULL) AND (clock_out_longitude IS NOT NULL))));
alter table public.d3_attendances add constraint d3_attendances_clock_out_coordinate_range CHECK ((((clock_out_latitude IS NULL) OR ((clock_out_latitude >= ('-90'::integer)::numeric) AND (clock_out_latitude <= (90)::numeric))) AND ((clock_out_longitude IS NULL) OR ((clock_out_longitude >= ('-180'::integer)::numeric) AND (clock_out_longitude <= (180)::numeric))) AND ((clock_out_accuracy_meters IS NULL) OR (clock_out_accuracy_meters >= (0)::numeric))));

create table public.d3_b2_employee_sources (
  b2_register_id uuid not null,
  employee_id uuid not null,
  link_kind text not null,
  linked_at timestamp with time zone default now() not null
);
alter table public.d3_b2_employee_sources add constraint d3_b2_employee_sources_pkey PRIMARY KEY (b2_register_id);
alter table public.d3_b2_employee_sources add constraint d3_b2_employee_sources_employee_id_key UNIQUE (employee_id);
alter table public.d3_b2_employee_sources add constraint d3_b2_employee_sources_link_kind_check CHECK ((link_kind = ANY (ARRAY['CREATED'::text, 'MATCHED'::text])));

create table public.d3_competencies (
  id uuid default gen_random_uuid() not null,
  code character varying(20) not null,
  name character varying(100) not null,
  category character varying(50) default 'Technical'::character varying,
  created_at timestamp with time zone default now()
);
alter table public.d3_competencies add constraint competencies_pkey PRIMARY KEY (id);
alter table public.d3_competencies add constraint competencies_code_key UNIQUE (code);

create table public.d3_d1_department_mappings (
  source_department_key text not null,
  source_department_name character varying not null,
  department_id uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.d3_d1_department_mappings add constraint d3_d1_department_mappings_pkey PRIMARY KEY (source_department_key);
alter table public.d3_d1_department_mappings add constraint d3_d1_department_mappings_department_id_key UNIQUE (department_id);
alter table public.d3_d1_department_mappings add constraint d3_d1_department_mappings_source_department_key_check CHECK (((source_department_key = lower(btrim(source_department_key))) AND (source_department_key <> ''::text)));

create table public.d3_d1_position_mappings (
  d1_position_id uuid not null,
  position_id uuid not null,
  source_job_code character varying,
  source_position_name character varying not null,
  source_department_key text not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.d3_d1_position_mappings add constraint d3_d1_position_mappings_pkey PRIMARY KEY (d1_position_id);
alter table public.d3_d1_position_mappings add constraint d3_d1_position_mappings_position_id_key UNIQUE (position_id);
alter table public.d3_d1_position_mappings add constraint d3_d1_position_mappings_source_department_key_check CHECK ((source_department_key = lower(btrim(source_department_key))));

create table public.d3_departments (
  id uuid default gen_random_uuid() not null,
  code character varying(20) not null,
  name character varying(100) not null,
  created_at timestamp with time zone default now()
);
alter table public.d3_departments add constraint departments_pkey PRIMARY KEY (id);
alter table public.d3_departments add constraint departments_code_key UNIQUE (code);

create table public.d3_employee (
  id uuid default gen_random_uuid() not null,
  employee_id character varying(50) not null,
  full_name character varying(255) not null,
  email character varying(255) not null,
  phone character varying(20),
  identity_type character varying(20) default 'KTP'::character varying,
  identity_number character varying(100),
  join_date date not null,
  employment_status character varying(30) default 'PROBATION'::character varying not null,
  position_id uuid not null,
  department_id uuid not null,
  work_location character varying(100) default 'HQ'::character varying not null,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
alter table public.d3_employee add constraint employees_pkey PRIMARY KEY (id);
alter table public.d3_employee add constraint employees_email_key UNIQUE (email);
alter table public.d3_employee add constraint employees_employee_id_key UNIQUE (employee_id);
alter table public.d3_employee add constraint employees_employment_status_check CHECK (((employment_status)::text = ANY ((ARRAY['PERMANENT'::character varying, 'CONTRACT'::character varying, 'PROBATION'::character varying, 'INTERN'::character varying, 'RESIGNED'::character varying, 'TERMINATED'::character varying])::text[])));

create table public.d3_employee_audit_log (
  id uuid default gen_random_uuid() not null,
  employee_record_id uuid not null,
  action text not null,
  actor_auth_user_id uuid,
  actor_employee_id uuid,
  changed_fields text[] default '{}'::text[] not null,
  created_at timestamp with time zone default now() not null
);
alter table public.d3_employee_audit_log add constraint d3_employee_audit_log_pkey PRIMARY KEY (id);
alter table public.d3_employee_audit_log add constraint d3_employee_audit_log_action_check CHECK ((action = ANY (ARRAY['CREATE'::text, 'UPDATE'::text, 'STATUS_CHANGE'::text, 'DELETE'::text])));

create table public.d3_employee_certifications (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  title character varying(255) not null,
  issuing_organization character varying(255) not null,
  issue_date date not null,
  expiry_date date,
  credential_id character varying(100),
  created_at timestamp with time zone default now(),
  document_url text
);
alter table public.d3_employee_certifications add constraint employee_certifications_pkey PRIMARY KEY (id);
alter table public.d3_employee_certifications add constraint d3_employee_certifications_document_url_check CHECK (((document_url IS NULL) OR (document_url ~ '^/certificates/[A-Za-z0-9._/-]+$'::text))) NOT VALID;

create table public.d3_employee_directory_hidden (
  employee_id uuid not null,
  hidden_at timestamp with time zone default now() not null,
  hidden_by uuid,
  reason text default 'Hidden from Employee Directory'::text not null
);
alter table public.d3_employee_directory_hidden add constraint d3_employee_directory_hidden_pkey PRIMARY KEY (employee_id);
alter table public.d3_employee_directory_hidden add constraint d3_employee_directory_hidden_reason_not_blank CHECK ((length(btrim(reason)) > 0));
comment on table public.d3_employee_directory_hidden is 'D3-only, reversible exclusions from the Employee Directory. It does not disable an employee.';

create table public.d3_employee_feedback (
  id bigint generated always as identity not null,
  employee_id uuid not null,
  given_by uuid not null,
  date date not null,
  feedback_text text not null,
  created_at timestamp with time zone default now() not null,
  title text not null,
  feedback_type text not null,
  category text not null,
  follow_up_text text,
  target_date date,
  follow_up_status text not null,
  progress_note text,
  updated_at timestamp with time zone default now() not null
);
alter table public.d3_employee_feedback add constraint d3_employee_feedback_pkey PRIMARY KEY (id);
alter table public.d3_employee_feedback add constraint d3_employee_feedback_category_check CHECK ((category = ANY (ARRAY['DISCIPLINE'::text, 'TEAMWORK'::text, 'COMMUNICATION'::text, 'WORKPLACE_SAFETY'::text, 'QUALITY'::text, 'SERVICE'::text, 'OTHER'::text])));
alter table public.d3_employee_feedback add constraint d3_employee_feedback_follow_up_status_check CHECK ((follow_up_status = ANY (ARRAY['NEW'::text, 'READ'::text, 'IN_PROGRESS'::text, 'COMPLETED'::text])));
alter table public.d3_employee_feedback add constraint d3_employee_feedback_text_not_blank_check CHECK ((feedback_text !~ '^[[:space:]]*$'::text));
alter table public.d3_employee_feedback add constraint d3_employee_feedback_type_check CHECK ((feedback_type = ANY (ARRAY['APPRECIATION'::text, 'IMPROVEMENT'::text, 'PERFORMANCE_NOTE'::text])));
alter table public.d3_employee_feedback add constraint d3_feedback_title_length CHECK ((char_length(title) <= 120)) NOT VALID;

create table public.d3_employee_reporting (
  id uuid default gen_random_uuid() not null,
  manager_employee_id uuid not null,
  subordinate_employee_id uuid not null,
  effective_from date default CURRENT_DATE not null,
  effective_to date,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.d3_employee_reporting add constraint d3_employee_reporting_pkey PRIMARY KEY (id);
alter table public.d3_employee_reporting add constraint d3_employee_reporting_not_self_reference_check CHECK ((manager_employee_id <> subordinate_employee_id));
alter table public.d3_employee_reporting add constraint d3_employee_reporting_valid_period_check CHECK (((effective_to IS NULL) OR (effective_to >= effective_from)));

create table public.d3_employee_rewards (
  id bigint generated always as identity not null,
  employee_id uuid not null,
  reward_name character varying not null,
  date date not null,
  description text not null,
  created_at timestamp with time zone default now() not null,
  reward_type text not null,
  title text not null,
  reason text not null,
  proposed_by uuid,
  status text not null,
  visibility text not null,
  approval_reason text,
  approved_by uuid,
  approved_at timestamp with time zone,
  evidence_path text,
  updated_at timestamp with time zone default now() not null,
  is_legacy boolean default false not null
);
alter table public.d3_employee_rewards add constraint d3_employee_rewards_pkey PRIMARY KEY (id);
alter table public.d3_employee_rewards add constraint d3_employee_rewards_description_not_blank_check CHECK ((description !~ '^[[:space:]]*$'::text));
alter table public.d3_employee_rewards add constraint d3_employee_rewards_name_not_blank_check CHECK (((reward_name)::text !~ '^[[:space:]]*$'::text));
alter table public.d3_employee_rewards add constraint d3_employee_rewards_status_check CHECK ((status = ANY (ARRAY['SUBMITTED'::text, 'APPROVED'::text, 'PUBLISHED'::text, 'REJECTED'::text])));
alter table public.d3_employee_rewards add constraint d3_employee_rewards_type_check CHECK ((reward_type = ANY (ARRAY['EMPLOYEE_OF_THE_MONTH'::text, 'SAFETY_CHAMPION'::text, 'SERVICE_EXCELLENCE'::text, 'BEST_ATTENDANCE'::text, 'SPECIAL_CONTRIBUTION'::text, 'OTHER'::text])));
alter table public.d3_employee_rewards add constraint d3_employee_rewards_visibility_check CHECK ((visibility = ANY (ARRAY['PRIVATE'::text, 'PUBLIC'::text])));
alter table public.d3_employee_rewards add constraint d3_reward_name_length CHECK (((reward_name IS NULL) OR (char_length((reward_name)::text) <= 120))) NOT VALID;
alter table public.d3_employee_rewards add constraint d3_reward_title_length CHECK ((char_length(title) <= 120)) NOT VALID;

create table public.d3_employee_skills (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  competency_id uuid not null,
  proficiency_level integer default 1 not null,
  evidence_notes text,
  updated_at timestamp with time zone default now()
);
alter table public.d3_employee_skills add constraint employee_skills_pkey PRIMARY KEY (id);
alter table public.d3_employee_skills add constraint employee_skills_employee_id_competency_id_key UNIQUE (employee_id, competency_id);
alter table public.d3_employee_skills add constraint employee_skills_proficiency_level_check CHECK (((proficiency_level >= 1) AND (proficiency_level <= 5)));

create table public.d3_employee_sync_events (
  id uuid default gen_random_uuid() not null,
  b2_register_id uuid not null,
  employee_id uuid,
  event_kind text not null,
  message text not null,
  created_at timestamp with time zone default now() not null
);
alter table public.d3_employee_sync_events add constraint d3_employee_sync_events_pkey PRIMARY KEY (id);
alter table public.d3_employee_sync_events add constraint d3_employee_sync_events_b2_register_id_event_kind_key UNIQUE (b2_register_id, event_kind);
alter table public.d3_employee_sync_events add constraint d3_employee_sync_events_event_kind_check CHECK ((event_kind = ANY (ARRAY['CREATED'::text, 'MATCHED'::text, 'WAITING_MASTER'::text, 'AMBIGUOUS_IDENTIFIER'::text, 'SYNC_ERROR'::text])));

create table public.d3_face_biometric_events (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  auth_user_id uuid not null,
  event_type text not null,
  similarity numeric(5,4) not null,
  liveness_score numeric(5,4),
  anti_spoof_score numeric(5,4),
  verified_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null
);
alter table public.d3_face_biometric_events add constraint d3_face_biometric_events_pkey PRIMARY KEY (id);
alter table public.d3_face_biometric_events add constraint d3_face_biometric_events_event_type_check CHECK ((event_type = ANY (ARRAY['CLOCK_IN'::text, 'CLOCK_OUT'::text])));
alter table public.d3_face_biometric_events add constraint d3_face_biometric_events_similarity_check CHECK (((similarity >= ('-1'::integer)::numeric) AND (similarity <= (1)::numeric)));

create table public.d3_face_biometric_templates (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  auth_user_id uuid not null,
  embedding_model text not null,
  embedding_version integer default 1 not null,
  descriptors jsonb not null,
  enrollment_quality jsonb default '{}'::jsonb not null,
  enrolled_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  sample_paths jsonb default '[]'::jsonb not null
);
alter table public.d3_face_biometric_templates add constraint d3_face_biometric_templates_pkey PRIMARY KEY (id);
alter table public.d3_face_biometric_templates add constraint d3_face_biometric_templates_auth_user_id_key UNIQUE (auth_user_id);
alter table public.d3_face_biometric_templates add constraint d3_face_biometric_templates_employee_id_key UNIQUE (employee_id);
alter table public.d3_face_biometric_templates add constraint d3_face_biometric_templates_descriptors_check CHECK (((jsonb_typeof(descriptors) = 'array'::text) AND ((jsonb_array_length(descriptors) >= 5) AND (jsonb_array_length(descriptors) <= 30))));
alter table public.d3_face_biometric_templates add constraint d3_face_biometric_templates_embedding_model_check CHECK (((char_length(TRIM(BOTH FROM embedding_model)) >= 3) AND (char_length(TRIM(BOTH FROM embedding_model)) <= 120)));
alter table public.d3_face_biometric_templates add constraint d3_face_biometric_templates_embedding_version_check CHECK ((embedding_version >= 1));
alter table public.d3_face_biometric_templates add constraint d3_face_biometric_templates_sample_paths_check CHECK (((jsonb_typeof(sample_paths) = 'array'::text) AND ((jsonb_array_length(sample_paths) >= 0) AND (jsonb_array_length(sample_paths) <= 5))));

create table public.d3_feedback_reward_audit_log (
  id uuid default gen_random_uuid() not null,
  entity_type text not null,
  entity_id bigint not null,
  target_employee_id uuid not null,
  action text not null,
  actor_auth_user_id uuid,
  actor_employee_id uuid,
  created_at timestamp with time zone default now() not null,
  before_data jsonb,
  after_data jsonb,
  reason text
);
alter table public.d3_feedback_reward_audit_log add constraint d3_feedback_reward_audit_log_pkey PRIMARY KEY (id);
alter table public.d3_feedback_reward_audit_log add constraint d3_feedback_reward_audit_log_action_check CHECK ((action = ANY (ARRAY['CREATE'::text, 'UPDATE'::text, 'STATUS_CHANGE'::text, 'SUBMIT'::text, 'APPROVE'::text, 'REJECT'::text, 'PUBLISH'::text])));
alter table public.d3_feedback_reward_audit_log add constraint d3_feedback_reward_audit_log_entity_type_check CHECK ((entity_type = ANY (ARRAY['FEEDBACK'::text, 'REWARD'::text])));

create table public.d3_feedback_reward_notifications (
  id uuid default gen_random_uuid() not null,
  recipient_employee_id uuid not null,
  entity_type text not null,
  entity_id bigint not null,
  event_type text not null,
  message text not null,
  metadata jsonb default '{}'::jsonb not null,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);
alter table public.d3_feedback_reward_notifications add constraint d3_feedback_reward_notifications_pkey PRIMARY KEY (id);
alter table public.d3_feedback_reward_notifications add constraint d3_feedback_reward_notifications_entity_type_check CHECK ((entity_type = ANY (ARRAY['FEEDBACK'::text, 'REWARD'::text])));

create table public.d3_positions (
  id uuid default gen_random_uuid() not null,
  code character varying(20) not null,
  title character varying(100) not null,
  department_id uuid,
  created_at timestamp with time zone default now(),
  is_global boolean default false not null
);
alter table public.d3_positions add constraint positions_pkey PRIMARY KEY (id);
alter table public.d3_positions add constraint positions_code_key UNIQUE (code);

create table public.d3_ticket_attachments (
  id uuid default gen_random_uuid() not null,
  ticket_id uuid not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  byte_size bigint,
  created_at timestamp with time zone default now() not null
);
alter table public.d3_ticket_attachments add constraint d3_ticket_attachments_pkey PRIMARY KEY (id);
alter table public.d3_ticket_attachments add constraint d3_ticket_attachments_storage_path_key UNIQUE (storage_path);
alter table public.d3_ticket_attachments add constraint d3_ticket_attachments_byte_size_check CHECK (((byte_size IS NULL) OR (byte_size >= 0)));
alter table public.d3_ticket_attachments add constraint d3_ticket_attachments_file_name_check CHECK (((char_length(TRIM(BOTH FROM file_name)) >= 1) AND (char_length(TRIM(BOTH FROM file_name)) <= 255)));

create table public.d3_ticket_followups (
  id uuid default gen_random_uuid() not null,
  ticket_id uuid not null,
  actor_employee_id uuid not null,
  note text not null,
  follow_up_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);
alter table public.d3_ticket_followups add constraint d3_ticket_followups_pkey PRIMARY KEY (id);
alter table public.d3_ticket_followups add constraint d3_ticket_followups_note_check CHECK (((char_length(TRIM(BOTH FROM note)) >= 3) AND (char_length(TRIM(BOTH FROM note)) <= 2000)));

create table public.d3_ticket_history (
  id uuid default gen_random_uuid() not null,
  ticket_id uuid not null,
  actor_employee_id uuid not null,
  event_type text not null,
  from_status public.d3_ticket_status,
  to_status public.d3_ticket_status,
  note text,
  created_at timestamp with time zone default now() not null
);
alter table public.d3_ticket_history add constraint d3_ticket_history_pkey PRIMARY KEY (id);
alter table public.d3_ticket_history add constraint d3_ticket_history_event_type_check CHECK ((event_type = ANY (ARRAY['CREATED'::text, 'STATUS_CHANGED'::text, 'FOLLOW_UP_ADDED'::text, 'PRIORITY_CHANGED'::text, 'DUE_DATE_CHANGED'::text])));

create table public.d3_tickets (
  id uuid default gen_random_uuid() not null,
  ticket_code text default ('TKT-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))) not null,
  employee_id uuid not null,
  title text not null,
  category text not null,
  description text not null,
  occurred_at timestamp with time zone,
  status public.d3_ticket_status default 'PENDING'::public.d3_ticket_status not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  reporter_name text,
  reporter_employee_code text,
  reporter_department text,
  priority public.d3_ticket_priority default 'NORMAL'::public.d3_ticket_priority not null,
  due_at timestamp with time zone
);
alter table public.d3_tickets add constraint d3_tickets_pkey PRIMARY KEY (id);
alter table public.d3_tickets add constraint d3_tickets_ticket_code_key UNIQUE (ticket_code);
alter table public.d3_tickets add constraint d3_tickets_category_check CHECK (((char_length(TRIM(BOTH FROM category)) >= 2) AND (char_length(TRIM(BOTH FROM category)) <= 80)));
alter table public.d3_tickets add constraint d3_tickets_description_check CHECK (((char_length(TRIM(BOTH FROM description)) >= 10) AND (char_length(TRIM(BOTH FROM description)) <= 4000)));
alter table public.d3_tickets add constraint d3_tickets_title_check CHECK (((char_length(TRIM(BOTH FROM title)) >= 3) AND (char_length(TRIM(BOTH FROM title)) <= 160)));

create table public.d3_user_access (
  auth_user_id uuid not null,
  employee_id uuid not null,
  app_role public.d3_app_role not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
alter table public.d3_user_access add constraint d3_user_access_pkey PRIMARY KEY (auth_user_id);

commit;
