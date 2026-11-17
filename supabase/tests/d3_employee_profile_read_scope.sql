begin;

select plan(9);

create temp table d3_profile_scope_fixture on commit drop as
with employee_account as (
  select registration.auth_user_id, registration.id as b2_register_id
  from public.b2_register as registration
  join public.d3_b2_employee_sources as source on source.b2_register_id = registration.id
  where registration.app_role = 'EMPLOYEE'::public.d3_app_role
    and registration.is_active is true
    and registration.auth_user_id is not null
  limit 1
), manager_scope as (
  select
    manager.auth_user_id,
    subordinate_source.b2_register_id as subordinate_b2_register_id,
    outside_source.b2_register_id as outside_b2_register_id
  from public.d3_user_access as manager_access
  join public.b2_register as manager on manager.auth_user_id = manager_access.auth_user_id
  join public.d3_employee_reporting as reporting
    on reporting.manager_employee_id = manager_access.employee_id
   and reporting.is_active is true
   and reporting.effective_from <= current_date
   and (reporting.effective_to is null or reporting.effective_to >= current_date)
  join public.d3_b2_employee_sources as subordinate_source
    on subordinate_source.employee_id = reporting.subordinate_employee_id
  join lateral (
    select candidate.b2_register_id
    from public.d3_b2_employee_sources as candidate
    where candidate.employee_id <> manager_access.employee_id
      and candidate.employee_id <> reporting.subordinate_employee_id
      and not exists (
        select 1
        from public.d3_employee_reporting as other_reporting
        where other_reporting.manager_employee_id = manager_access.employee_id
          and other_reporting.subordinate_employee_id = candidate.employee_id
          and other_reporting.is_active is true
          and other_reporting.effective_from <= current_date
          and (other_reporting.effective_to is null or other_reporting.effective_to >= current_date)
      )
    limit 1
  ) as outside_source on true
  where manager.app_role = 'MANAGER'::public.d3_app_role
    and manager.is_active is true
    and manager.auth_user_id is not null
  limit 1
), hr_account as (
  select registration.auth_user_id
  from public.b2_register as registration
  where registration.app_role = 'HR'::public.d3_app_role
    and registration.is_active is true
    and registration.auth_user_id is not null
  limit 1
)
select
  (select auth_user_id from employee_account) as employee_auth_user_id,
  (select b2_register_id from employee_account) as employee_b2_register_id,
  (select auth_user_id from manager_scope) as manager_auth_user_id,
  (select subordinate_b2_register_id from manager_scope) as manager_subordinate_b2_register_id,
  (select outside_b2_register_id from manager_scope) as manager_outside_b2_register_id,
  (select auth_user_id from hr_account) as hr_auth_user_id,
  (select count(*) from public.b2_register) as total_b2_registers,
  (select count(*) from public.d3_b2_employee_sources) as total_sources;

select ok(
  (select employee_auth_user_id is not null and employee_b2_register_id is not null from d3_profile_scope_fixture),
  'an active mapped Employee fixture exists'
);
select ok(
  (select manager_auth_user_id is not null and manager_subordinate_b2_register_id is not null and manager_outside_b2_register_id is not null from d3_profile_scope_fixture),
  'a Manager fixture has both a direct report and an out-of-scope employee'
);
select ok(
  (select hr_auth_user_id is not null from d3_profile_scope_fixture),
  'an active HR fixture exists'
);

grant select on d3_profile_scope_fixture to authenticated;

create temp table d3_profile_scope_results (
  actor text primary key,
  own_b2_visible boolean,
  other_b2_visible boolean,
  own_source_visible boolean,
  other_source_visible boolean,
  visible_b2_count bigint,
  visible_source_count bigint
) on commit drop;

grant select, insert on d3_profile_scope_results to authenticated;

select set_config(
  'request.jwt.claim.sub',
  coalesce((select employee_auth_user_id::text from d3_profile_scope_fixture), '00000000-0000-0000-0000-000000000000'),
  true
);
set local role authenticated;
insert into d3_profile_scope_results (actor, own_b2_visible, other_b2_visible, own_source_visible, other_source_visible)
select
  'employee',
  exists (select 1 from public.b2_register where id = fixture.employee_b2_register_id),
  exists (select 1 from public.b2_register where id <> fixture.employee_b2_register_id),
  exists (select 1 from public.d3_b2_employee_sources where b2_register_id = fixture.employee_b2_register_id),
  exists (select 1 from public.d3_b2_employee_sources where b2_register_id <> fixture.employee_b2_register_id)
from d3_profile_scope_fixture as fixture;
reset role;

select set_config(
  'request.jwt.claim.sub',
  coalesce((select manager_auth_user_id::text from d3_profile_scope_fixture), '00000000-0000-0000-0000-000000000000'),
  true
);
set local role authenticated;
insert into d3_profile_scope_results (actor, own_b2_visible, other_b2_visible, own_source_visible, other_source_visible)
select
  'manager',
  exists (select 1 from public.b2_register where id = fixture.manager_subordinate_b2_register_id),
  exists (select 1 from public.b2_register where id = fixture.manager_outside_b2_register_id),
  exists (select 1 from public.d3_b2_employee_sources where b2_register_id = fixture.manager_subordinate_b2_register_id),
  exists (select 1 from public.d3_b2_employee_sources where b2_register_id = fixture.manager_outside_b2_register_id)
from d3_profile_scope_fixture as fixture;
reset role;

select set_config(
  'request.jwt.claim.sub',
  coalesce((select hr_auth_user_id::text from d3_profile_scope_fixture), '00000000-0000-0000-0000-000000000000'),
  true
);
set local role authenticated;
insert into d3_profile_scope_results (actor, visible_b2_count, visible_source_count)
select 'hr', count(*)::bigint, (select count(*)::bigint from public.d3_b2_employee_sources)
from public.b2_register;
reset role;

select ok(
  (select own_b2_visible and not other_b2_visible and own_source_visible and not other_source_visible from d3_profile_scope_results where actor = 'employee'),
  'Employee can read only their own B2 profile and mapping'
);
select ok(
  (select own_b2_visible and not other_b2_visible and own_source_visible and not other_source_visible from d3_profile_scope_results where actor = 'manager'),
  'Manager can read a direct report but not an out-of-scope employee'
);
select is(
  (select visible_b2_count from d3_profile_scope_results where actor = 'hr'),
  (select total_b2_registers from d3_profile_scope_fixture),
  'HR can read every B2 profile'
);
select is(
  (select visible_source_count from d3_profile_scope_results where actor = 'hr'),
  (select total_sources from d3_profile_scope_fixture),
  'HR can read every B2 employee mapping'
);
select ok(
  not has_table_privilege('anon', 'public.b2_register', 'select'),
  'anon has no SELECT privilege on B2 profiles'
);
select ok(
  not has_table_privilege('anon', 'public.d3_b2_employee_sources', 'select'),
  'anon has no SELECT privilege on B2 employee mappings'
);

select * from finish();
rollback;
