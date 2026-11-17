-- Minimal, disposable schema for validating BUG-D3-002 RLS locally.
-- This is intentionally not a production migration: the main repository is
-- missing its historical database baseline, so this fixture creates only the
-- objects required by the profile-scope migrations and pgTAP test.

-- The bare Supabase Postgres image ships GraphQL DDL event triggers that are
-- initialized by `supabase start`. This harness intentionally starts only
-- Postgres, so disable them in this disposable database before creating its
-- minimal schema.
do $$
declare
  trigger_name text;
begin
  foreach trigger_name in array array[
    'graphql_watch_ddl',
    'graphql_watch_drop',
    'issue_graphql_placeholder',
    'issue_pg_cron_access',
    'issue_pg_graphql_access',
    'issue_pg_net_access',
    'pgrst_ddl_watch',
    'pgrst_drop_watch'
  ]
  loop
    if exists (select 1 from pg_event_trigger where evtname = trigger_name) then
      execute format('alter event trigger %I disable', trigger_name);
    end if;
  end loop;
end;
$$;

create extension if not exists pgtap;

create schema if not exists private;

do $$
begin
  create type public.d3_app_role as enum ('EMPLOYEE', 'HR', 'MANAGER');
exception
  when duplicate_object then null;
end;
$$;

create table public.d3_employee (
  id uuid primary key,
  full_name text not null
);

create table public.b2_register (
  id uuid primary key,
  auth_user_id uuid not null unique,
  app_role public.d3_app_role not null,
  is_active boolean not null default true
);

create table public.d3_user_access (
  auth_user_id uuid primary key,
  employee_id uuid not null unique references public.d3_employee(id),
  app_role public.d3_app_role not null
);

create table public.d3_employee_reporting (
  manager_employee_id uuid not null references public.d3_employee(id),
  subordinate_employee_id uuid not null references public.d3_employee(id),
  effective_from date not null default current_date,
  effective_to date,
  is_active boolean not null default true,
  primary key (manager_employee_id, subordinate_employee_id),
  check (manager_employee_id <> subordinate_employee_id),
  check (effective_to is null or effective_to >= effective_from)
);

create index d3_employee_reporting_active_manager_idx
  on public.d3_employee_reporting (manager_employee_id, subordinate_employee_id)
  where is_active;

create table public.d3_b2_employee_sources (
  b2_register_id uuid primary key references public.b2_register(id),
  employee_id uuid not null unique references public.d3_employee(id)
);

create or replace function public.d3_current_role()
returns public.d3_app_role
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select access.app_role
  from public.d3_user_access as access
  where access.auth_user_id = (select auth.uid())
  limit 1
$$;

create or replace function public.d3_current_legacy_employee_uuid()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select access.employee_id
  from public.d3_user_access as access
  where access.auth_user_id = (select auth.uid())
  limit 1
$$;

revoke all on function public.d3_current_role() from public;
revoke all on function public.d3_current_legacy_employee_uuid() from public;
grant execute on function public.d3_current_role() to authenticated;
grant execute on function public.d3_current_legacy_employee_uuid() to authenticated;

revoke all on table public.b2_register from public, anon;
revoke all on table public.d3_b2_employee_sources from public, anon;
grant select on table public.b2_register to authenticated;
grant select on table public.d3_b2_employee_sources to authenticated;

alter table public.b2_register enable row level security;
alter table public.d3_b2_employee_sources enable row level security;

insert into public.d3_employee (id, full_name) values
  ('00000000-0000-0000-0000-000000000101', 'Employee Satu'),
  ('00000000-0000-0000-0000-000000000102', 'Manager Satu'),
  ('00000000-0000-0000-0000-000000000103', 'Bawahan Manager'),
  ('00000000-0000-0000-0000-000000000104', 'Di Luar Scope'),
  ('00000000-0000-0000-0000-000000000105', 'HR Satu');

insert into public.b2_register (id, auth_user_id, app_role) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'EMPLOYEE'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000002', 'MANAGER'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000003', 'EMPLOYEE'),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000004', 'EMPLOYEE'),
  ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000005', 'HR');

insert into public.d3_user_access (auth_user_id, employee_id, app_role) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'EMPLOYEE'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000102', 'MANAGER'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000103', 'EMPLOYEE'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000104', 'EMPLOYEE'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000105', 'HR');

insert into public.d3_employee_reporting (manager_employee_id, subordinate_employee_id) values
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000103');

insert into public.d3_b2_employee_sources (b2_register_id, employee_id) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000103'),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000104'),
  ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000105');
