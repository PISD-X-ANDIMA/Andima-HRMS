-- D4 owns only its records. Employee, position, competency, skill, and requirement
-- masters remain in the existing shared tables. All writes are append-only.
-- The current authentication bridge is public.d3_user_access and its role helpers.

create table public.d4_kpi_scorecards (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  position_id uuid not null references public.positions(id),
  position_title_snapshot text not null,
  period varchar(7) not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  definition_version varchar(16) not null check (definition_version = 'V5.1'),
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) = 5),
  actor_auth_user_id uuid not null default auth.uid() references auth.users(id),
  actor_employee_id uuid not null default public.d3_current_employee_uuid() references public.employees(id),
  created_at timestamptz not null default now()
);
create index d4_kpi_scorecards_employee_period_idx on public.d4_kpi_scorecards(employee_id, period, created_at desc);

create table public.d4_performance_evaluations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  position_id uuid not null references public.positions(id),
  position_title_snapshot text not null,
  period varchar(7) not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  evaluation_date date,
  evaluator_name_snapshot text not null default '',
  status varchar(16) not null check (status in ('draft', 'completed')),
  review_status varchar(32) not null check (review_status in ('Needs Review', 'On Track', 'Needs Attention')),
  overall_score numeric(3,2) check (overall_score between 1 and 5),
  aspects jsonb not null default '[]'::jsonb check (jsonb_typeof(aspects) = 'array'),
  general_notes text not null default '',
  evidence_reference text,
  actor_auth_user_id uuid not null default auth.uid() references auth.users(id),
  actor_employee_id uuid not null default public.d3_current_employee_uuid() references public.employees(id),
  created_at timestamptz not null default now(),
  unique (id, employee_id),
  check (status <> 'completed' or (
    evaluation_date is not null and length(btrim(evaluator_name_snapshot)) > 0
    and overall_score is not null and length(btrim(general_notes)) > 0
  ))
);
create index d4_performance_employee_period_idx on public.d4_performance_evaluations(employee_id, period, created_at desc);

create table public.d4_competency_assessments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  position_id uuid not null references public.positions(id),
  position_title_snapshot text not null,
  effective_date date not null,
  context varchar(24) not null check (context in ('current-position', 'role-change')),
  overall_status varchar(32) not null check (overall_status in ('Terpenuhi', 'Gap', 'Bukti Belum Cukup', 'Belum Ada Persyaratan')),
  findings jsonb not null check (jsonb_typeof(findings) = 'array'),
  actor_auth_user_id uuid not null default auth.uid() references auth.users(id),
  actor_employee_id uuid not null default public.d3_current_employee_uuid() references public.employees(id),
  created_at timestamptz not null default now(),
  unique (id, employee_id)
);
create index d4_competency_employee_date_idx on public.d4_competency_assessments(employee_id, effective_date desc, created_at desc);

create table public.d4_development_needs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  source_type varchar(24) not null check (source_type in ('competency_gap', 'role_change', 'performance_context')),
  position_requirement_id uuid references public.position_requirements(id),
  competency_assessment_id uuid,
  performance_evaluation_id uuid,
  objective text not null check (length(btrim(objective)) > 0),
  priority varchar(8) not null check (priority in ('Low', 'Medium', 'High')),
  actor_auth_user_id uuid not null default auth.uid() references auth.users(id),
  actor_employee_id uuid not null default public.d3_current_employee_uuid() references public.employees(id),
  created_at timestamptz not null default now(),
  unique (id, employee_id),
  foreign key (competency_assessment_id, employee_id)
    references public.d4_competency_assessments(id, employee_id),
  foreign key (performance_evaluation_id, employee_id)
    references public.d4_performance_evaluations(id, employee_id),
  check (
    (source_type = 'competency_gap' and position_requirement_id is not null and competency_assessment_id is null and performance_evaluation_id is null)
    or (source_type = 'role_change' and position_requirement_id is null and competency_assessment_id is not null and performance_evaluation_id is null)
    or (source_type = 'performance_context' and position_requirement_id is null and competency_assessment_id is null and performance_evaluation_id is not null)
  )
);
create index d4_development_needs_employee_idx on public.d4_development_needs(employee_id, created_at desc);
create index d4_development_needs_requirement_idx on public.d4_development_needs(position_requirement_id) where position_requirement_id is not null;
create index d4_development_needs_assessment_idx on public.d4_development_needs(competency_assessment_id) where competency_assessment_id is not null;
create index d4_development_needs_evaluation_idx on public.d4_development_needs(performance_evaluation_id) where performance_evaluation_id is not null;

create table public.d4_development_need_versions (
  id uuid primary key default gen_random_uuid(),
  development_need_id uuid not null references public.d4_development_needs(id),
  revision integer not null check (revision >= 1),
  status varchar(16) not null check (status in ('Identified', 'Planned', 'In Progress', 'Completed')),
  notes text not null default '',
  actor_auth_user_id uuid not null default auth.uid() references auth.users(id),
  actor_employee_id uuid not null default public.d3_current_employee_uuid() references public.employees(id),
  created_at timestamptz not null default now(),
  unique (development_need_id, revision)
);
create index d4_development_versions_need_idx on public.d4_development_need_versions(development_need_id, revision desc);

create table public.d4_training_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  development_need_id uuid not null,
  activity text not null check (length(btrim(activity)) > 0),
  activity_date date not null,
  actor_auth_user_id uuid not null default auth.uid() references auth.users(id),
  actor_employee_id uuid not null default public.d3_current_employee_uuid() references public.employees(id),
  created_at timestamptz not null default now(),
  foreign key (development_need_id, employee_id)
    references public.d4_development_needs(id, employee_id)
);
create index d4_training_records_employee_idx on public.d4_training_records(employee_id, activity_date desc);
create index d4_training_records_need_idx on public.d4_training_records(development_need_id);

create table public.d4_training_versions (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.d4_training_records(id),
  revision integer not null check (revision >= 1),
  status varchar(16) not null check (status in ('Planned', 'In Progress', 'Completed', 'Cancelled')),
  result text not null default '',
  notes text not null default '',
  actor_auth_user_id uuid not null default auth.uid() references auth.users(id),
  actor_employee_id uuid not null default public.d3_current_employee_uuid() references public.employees(id),
  created_at timestamptz not null default now(),
  unique (training_id, revision),
  check (status <> 'Completed' or length(btrim(result)) > 0)
);
create index d4_training_versions_training_idx on public.d4_training_versions(training_id, revision desc);

-- Public is an exposed schema. No anonymous access, authenticated users are
-- limited further by RLS. UPDATE and DELETE are not granted to keep history.
revoke all on public.d4_kpi_scorecards, public.d4_performance_evaluations,
  public.d4_competency_assessments, public.d4_development_needs,
  public.d4_development_need_versions, public.d4_training_records,
  public.d4_training_versions from anon, authenticated;
grant select, insert on public.d4_kpi_scorecards, public.d4_performance_evaluations,
  public.d4_competency_assessments, public.d4_development_needs,
  public.d4_development_need_versions, public.d4_training_records,
  public.d4_training_versions to authenticated;

alter table public.d4_kpi_scorecards enable row level security;
alter table public.d4_performance_evaluations enable row level security;
alter table public.d4_competency_assessments enable row level security;
alter table public.d4_development_needs enable row level security;
alter table public.d4_development_need_versions enable row level security;
alter table public.d4_training_records enable row level security;
alter table public.d4_training_versions enable row level security;

create policy "D4 KPI read permitted employee" on public.d4_kpi_scorecards
  for select to authenticated using (
    (select public.d3_current_role()) in ('HR', 'MANAGER')
    or employee_id = (select public.d3_current_employee_uuid())
  );
create policy "D4 KPI insert HR manager" on public.d4_kpi_scorecards
  for insert to authenticated with check (
    (select public.d3_current_role()) in ('HR', 'MANAGER')
    and actor_auth_user_id = (select auth.uid())
    and actor_employee_id = (select public.d3_current_employee_uuid())
  );

create policy "D4 performance read permitted employee" on public.d4_performance_evaluations
  for select to authenticated using (
    (select public.d3_current_role()) in ('HR', 'MANAGER')
    or employee_id = (select public.d3_current_employee_uuid())
  );
create policy "D4 performance insert HR manager" on public.d4_performance_evaluations
  for insert to authenticated with check (
    (select public.d3_current_role()) in ('HR', 'MANAGER')
    and actor_auth_user_id = (select auth.uid())
    and actor_employee_id = (select public.d3_current_employee_uuid())
  );

create policy "D4 competency read permitted employee" on public.d4_competency_assessments
  for select to authenticated using (
    (select public.d3_current_role()) in ('HR', 'MANAGER')
    or employee_id = (select public.d3_current_employee_uuid())
  );
create policy "D4 competency insert HR manager" on public.d4_competency_assessments
  for insert to authenticated with check (
    (select public.d3_current_role()) in ('HR', 'MANAGER')
    and actor_auth_user_id = (select auth.uid())
    and actor_employee_id = (select public.d3_current_employee_uuid())
  );

create policy "D4 development read permitted employee" on public.d4_development_needs
  for select to authenticated using (
    (select public.d3_current_role()) in ('HR', 'MANAGER')
    or employee_id = (select public.d3_current_employee_uuid())
  );
create policy "D4 development insert HR manager" on public.d4_development_needs
  for insert to authenticated with check (
    (select public.d3_current_role()) in ('HR', 'MANAGER')
    and actor_auth_user_id = (select auth.uid())
    and actor_employee_id = (select public.d3_current_employee_uuid())
  );
create policy "D4 development history read permitted employee" on public.d4_development_need_versions
  for select to authenticated using (
    exists (select 1 from public.d4_development_needs n where n.id = development_need_id)
  );
create policy "D4 development history insert HR manager" on public.d4_development_need_versions
  for insert to authenticated with check (
    (select public.d3_current_role()) in ('HR', 'MANAGER')
    and actor_auth_user_id = (select auth.uid())
    and actor_employee_id = (select public.d3_current_employee_uuid())
    and exists (select 1 from public.d4_development_needs n where n.id = development_need_id)
  );

create policy "D4 training read permitted employee" on public.d4_training_records
  for select to authenticated using (
    (select public.d3_current_role()) in ('HR', 'MANAGER')
    or employee_id = (select public.d3_current_employee_uuid())
  );
create policy "D4 training insert HR manager" on public.d4_training_records
  for insert to authenticated with check (
    (select public.d3_current_role()) in ('HR', 'MANAGER')
    and actor_auth_user_id = (select auth.uid())
    and actor_employee_id = (select public.d3_current_employee_uuid())
  );
create policy "D4 training history read permitted employee" on public.d4_training_versions
  for select to authenticated using (
    exists (select 1 from public.d4_training_records t where t.id = training_id)
  );
create policy "D4 training history insert HR manager" on public.d4_training_versions
  for insert to authenticated with check (
    (select public.d3_current_role()) in ('HR', 'MANAGER')
    and actor_auth_user_id = (select auth.uid())
    and actor_employee_id = (select public.d3_current_employee_uuid())
    and exists (select 1 from public.d4_training_records t where t.id = training_id)
  );

-- Parent and first version are one transaction. These functions run with the
-- caller's privileges; both INSERT policies are still enforced.
create function public.d4_create_development_need(
  p_employee_id uuid, p_source_type varchar, p_source_ref uuid,
  p_objective text, p_priority varchar, p_notes text
) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into public.d4_development_needs (
    employee_id, source_type, position_requirement_id,
    competency_assessment_id, performance_evaluation_id, objective, priority
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
revoke all on function public.d4_create_development_need(uuid, varchar, uuid, text, varchar, text) from public, anon;
grant execute on function public.d4_create_development_need(uuid, varchar, uuid, text, varchar, text) to authenticated;

create function public.d4_create_training_record(
  p_employee_id uuid, p_development_need_id uuid, p_activity text,
  p_activity_date date, p_status varchar, p_result text, p_notes text
) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into public.d4_training_records (employee_id, development_need_id, activity, activity_date)
    values (p_employee_id, p_development_need_id, p_activity, p_activity_date)
    returning id into v_id;
  insert into public.d4_training_versions (training_id, revision, status, result, notes)
    values (v_id, 1, p_status, coalesce(p_result, ''), coalesce(p_notes, ''));
  return v_id;
end;
$$;
revoke all on function public.d4_create_training_record(uuid, uuid, text, date, varchar, text, text) from public, anon;
grant execute on function public.d4_create_training_record(uuid, uuid, text, date, varchar, text, text) to authenticated;
