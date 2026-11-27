-- 90_ditunda_auth.sql: JANGAN DIJALANKAN SEKARANG
-- Bagian D3 yang bergantung pada login Supabase (auth.uid(), auth.users, request.jwt.claims).
-- Jalankan setelah kelas memutuskan pengganti Supabase Auth, dan setelah 05.
-- Perlu disesuaikan dulu: auth.uid() diganti fungsi login versi Neon, dan role anon, authenticated, public belum tentu ada di Neon.
-- PERLU PERSETUJUAN MID: d3_update_b2_employee_employment_status, d3_update_b2_employee_profile MENULIS ke b2_register (edit profil/status pegawai dari web D3).
-- Isi: 35 fungsi, 10 trigger, 5 relasi ke auth.users, RLS untuk 31 tabel, 69 policy.
-- Bukan milik D3 dan tidak dibuat di sini: trigger trigger_sync_issue_board_employee di public.d3_employee (fungsi public.sync_b1_issue_board_from_employee).

begin;
set search_path = public;

-- Fungsi (urutan: yang dipanggil lebih dulu)
CREATE OR REPLACE FUNCTION public.d3_current_role()
 RETURNS d3_app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(
    (
      select registration.app_role
      from public.b2_register registration
      where registration.auth_user_id = auth.uid()
        and registration.is_active = true
      limit 1
    ),
    'EMPLOYEE'::public.d3_app_role
  )
$function$;

CREATE OR REPLACE FUNCTION public.d3_active_d1_position_options()
 RETURNS TABLE(position_id uuid, position_code character varying, position_title character varying, department_id uuid, department_code character varying, department_name character varying)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$select p.id,p.code,p.title,d.id,d.code,d.name from public.d3_positions p join public.d3_departments d on d.id=p.department_id where d.code in('FAT','HCC','COM')and auth.uid()is not null and public.d3_current_role()='HR'::public.d3_app_role order by d.name,p.title$function$;

CREATE OR REPLACE FUNCTION public.d3_audit_employee_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor_employee_id uuid;
  v_action text;
  v_employee_record_id uuid;
  v_changed_fields text[] := '{}'::text[];
begin
  select dua.employee_id
    into v_actor_employee_id
  from public.d3_user_access dua
  where dua.auth_user_id = auth.uid()
  limit 1;

  if tg_op = 'INSERT' then
    v_action := 'CREATE';
    v_employee_record_id := new.id;
    v_changed_fields := array[
      'employee_id','full_name','email','phone','identity_type','identity_number',
      'join_date','employment_status','position_id','department_id','work_location','avatar_url'
    ];
  elsif tg_op = 'UPDATE' then
    v_employee_record_id := new.id;
    if old.employment_status is distinct from new.employment_status then
      v_action := 'STATUS_CHANGE';
    else
      v_action := 'UPDATE';
    end if;

    select coalesce(array_agg(k order by k), '{}'::text[])
      into v_changed_fields
    from (
      select n.key as k
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
      where n.value is distinct from o.value
        and n.key <> 'updated_at'
    ) changed;
  else
    v_action := 'DELETE';
    v_employee_record_id := old.id;
  end if;

  insert into public.d3_employee_audit_log (
    employee_record_id,
    action,
    actor_auth_user_id,
    actor_employee_id,
    changed_fields
  )
  values (
    v_employee_record_id,
    v_action,
    auth.uid(),
    v_actor_employee_id,
    v_changed_fields
  );

  return coalesce(new, old);
end;
$function$;

CREATE OR REPLACE FUNCTION private.d3_current_access_role()
 RETURNS d3_app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select access.app_role
  from public.d3_user_access access
  where access.auth_user_id = auth.uid()
  limit 1
$function$;

CREATE OR REPLACE FUNCTION private.d3_current_access_employee_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select access.employee_id
  from public.d3_user_access access
  where access.auth_user_id = auth.uid()
  limit 1
$function$;

CREATE OR REPLACE FUNCTION private.d3_is_current_b2_employee(p_b2_register_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select exists (select 1 from public.d3_b2_employee_sources source where source.b2_register_id = p_b2_register_id and source.employee_id = private.d3_current_access_employee_id())
$function$;

CREATE OR REPLACE FUNCTION private.d3_is_direct_manager_of(p_employee_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce((select private.d3_current_access_role()), 'EMPLOYEE'::public.d3_app_role) = 'MANAGER'::public.d3_app_role
    and exists (
      select 1
      from public.d3_employee_reporting reporting
      where reporting.manager_employee_id = private.d3_current_access_employee_id()
        and reporting.subordinate_employee_id = p_employee_id
        and reporting.is_active is true
        and reporting.effective_from <= current_date
        and (reporting.effective_to is null or reporting.effective_to >= current_date)
    )
$function$;

CREATE OR REPLACE FUNCTION private.d3_can_manage_b2_attendance(p_b2_register_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select private.d3_is_current_b2_employee(p_b2_register_id) or coalesce((select private.d3_current_access_role()), 'EMPLOYEE'::public.d3_app_role) = 'HR'::public.d3_app_role or exists (select 1 from public.d3_b2_employee_sources source where source.b2_register_id = p_b2_register_id and private.d3_is_direct_manager_of(source.employee_id))
$function$;

CREATE OR REPLACE FUNCTION private.d3_can_manage_employee_profile(p_employee_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce((select private.d3_current_access_role()), 'EMPLOYEE'::public.d3_app_role) = 'HR'::public.d3_app_role
      or private.d3_is_direct_manager_of(p_employee_id)
$function$;

CREATE OR REPLACE FUNCTION private.d3_can_manage_sensitive_employee(p_employee_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce((select private.d3_current_access_role()), 'EMPLOYEE'::public.d3_app_role) = 'HR'::public.d3_app_role or private.d3_is_direct_manager_of(p_employee_id)
$function$;

CREATE OR REPLACE FUNCTION private.d3_can_view_b2_attendance(p_b2_register_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce((select private.d3_current_access_role()), 'EMPLOYEE'::public.d3_app_role) = 'HR'::public.d3_app_role or private.d3_is_current_b2_employee(p_b2_register_id) or exists (select 1 from public.d3_b2_employee_sources source where source.b2_register_id = p_b2_register_id and private.d3_is_direct_manager_of(source.employee_id))
$function$;

CREATE OR REPLACE FUNCTION private.d3_can_view_employee(p_employee_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce((select private.d3_current_access_role()), 'EMPLOYEE'::public.d3_app_role) in ('HR'::public.d3_app_role, 'MANAGEMENT'::public.d3_app_role)
      or private.d3_current_access_employee_id() = p_employee_id
      or private.d3_is_direct_manager_of(p_employee_id)
$function$;

CREATE OR REPLACE FUNCTION public.d3_current_legacy_employee_uuid()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select employee.id
  from public.b2_register registration
  join public.d3_employee employee
    on lower(employee.email) = lower(registration.email)
  where registration.auth_user_id = auth.uid()
    and registration.is_active = true
  limit 1
$function$;

CREATE OR REPLACE FUNCTION private.d3_can_view_employee_profile(p_employee_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select
    (select auth.uid()) is not null
    and (
      (select public.d3_current_role()) = 'HR'::public.d3_app_role
      or p_employee_id = (select public.d3_current_legacy_employee_uuid())
      or (
        (select public.d3_current_role()) = 'MANAGER'::public.d3_app_role
        and exists (
          select 1
          from public.d3_user_access as access
          join public.d3_employee_reporting as reporting
            on reporting.manager_employee_id = access.employee_id
          where access.auth_user_id = (select auth.uid())
            and reporting.subordinate_employee_id = p_employee_id
            and reporting.is_active is true
            and reporting.effective_from <= current_date
            and (reporting.effective_to is null or reporting.effective_to >= current_date)
        )
      )
    )
$function$;

CREATE OR REPLACE FUNCTION private.d3_can_view_sensitive_employee(p_employee_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce((select private.d3_current_access_role()), 'EMPLOYEE'::public.d3_app_role) = 'HR'::public.d3_app_role or private.d3_current_access_employee_id() = p_employee_id or private.d3_is_direct_manager_of(p_employee_id)
$function$;

CREATE OR REPLACE FUNCTION public.d3_current_b2_employee_context()
 RETURNS TABLE(employee_uuid uuid, employee_code character varying, full_name character varying, email character varying)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select
    employee.id,
    registration.employee_id,
    registration.full_name,
    registration.email
  from public.b2_register registration
  join public.d3_employee employee
    on lower(employee.email) = lower(registration.email)
  where registration.auth_user_id = auth.uid()
    and registration.is_active = true
  limit 1
$function$;

CREATE OR REPLACE FUNCTION public.d3_current_b2_register_uuid()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select registration.id
  from public.b2_register as registration
  where registration.auth_user_id = auth.uid()
    and registration.is_active = true
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.d3_current_employee_uuid()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select public.d3_current_legacy_employee_uuid()
$function$;

CREATE OR REPLACE FUNCTION private.d3_current_idle_logout_profile()
 RETURNS TABLE(b2_register_id uuid, employee_id uuid, work_location text, time_zone text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    registration.id,
    source.employee_id,
    pg_catalog.upper(pg_catalog.btrim(employee.work_location)),
    timezone.time_zone
  from public.b2_register as registration
  join public.d3_b2_employee_sources as source
    on source.b2_register_id = registration.id
  join public.d3_employee as employee
    on employee.id = source.employee_id
  left join private.d3_work_location_timezones as timezone
    on timezone.work_location = pg_catalog.upper(pg_catalog.btrim(employee.work_location))
    and timezone.is_active is true
  where registration.auth_user_id = auth.uid()
    and registration.is_active is true
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.d3_ensure_b2_employee_mirror(p_b2_register_id uuid)
 RETURNS TABLE(employee_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_d3_employee_id uuid;
  v_d3_employee_code text;
  v_d3_email text;
  v_b2_employee_code text;
  v_full_name text;
  v_email text;
  v_phone text;
  v_status text;
  v_position_id uuid;
  v_department_id uuid;
  v_join_date date;
begin
  if auth.uid() is null or public.d3_current_role() <> 'HR'::public.d3_app_role then
    raise exception 'Only authenticated HR users may provision employee profiles' using errcode = '42501';
  end if;
  select source.employee_id into v_d3_employee_id
  from public.d3_b2_employee_sources source
  where source.b2_register_id = p_b2_register_id;
  if v_d3_employee_id is not null then
    return query select v_d3_employee_id;
    return;
  end if;

  select b2.employee_id, b2.full_name, b2.email, b2.phone,
         upper(coalesce(b2.employment_status, 'PROBATION')),
         b2.position_id, b2.departement_id, b2.created_at::date
    into v_b2_employee_code, v_full_name, v_email, v_phone, v_status,
         v_position_id, v_department_id, v_join_date
  from public.b2_register b2
  where b2.id = p_b2_register_id and b2.is_active = true
  for update;

  if not found then
    raise exception 'B2 employee was not found' using errcode = 'P0002';
  end if;
  if nullif(btrim(coalesce(v_full_name, '')), '') is null
    or nullif(btrim(coalesce(v_email, '')), '') is null
    or v_position_id is null
    or v_department_id is null then
    raise exception 'B2 employee profile is incomplete for D3 provisioning' using errcode = '22023';
  end if;

  select employee.id into v_d3_employee_id
  from public.d3_employee employee
  where lower(employee.email) = lower(btrim(v_email))
    and lower(btrim(employee.full_name)) = lower(btrim(v_full_name));

  if v_d3_employee_id is not null then
    if exists (select 1 from public.d3_b2_employee_sources source
               where source.employee_id = v_d3_employee_id) then
      raise exception 'The matching D3 employee is already mapped to another B2 employee' using errcode = '23505';
    end if;
    insert into public.d3_b2_employee_sources (b2_register_id, employee_id, link_kind)
    values (p_b2_register_id, v_d3_employee_id, 'MATCHED');
    return query select v_d3_employee_id;
    return;
  end if;

  v_d3_employee_code := v_b2_employee_code;
  if exists (select 1 from public.d3_employee employee where employee.employee_id = v_d3_employee_code) then
    v_d3_employee_code := 'B2-' || replace(left(p_b2_register_id::text, 8), '-', '');
  end if;
  v_d3_email := lower(btrim(v_email));
  if exists (select 1 from public.d3_employee employee where lower(employee.email) = v_d3_email) then
    v_d3_email := 'b2+' || replace(p_b2_register_id::text, '-', '') || '@internal.andima.invalid';
  end if;

  insert into public.d3_employee (
    employee_id, full_name, email, phone, join_date, employment_status,
    position_id, department_id, work_location
  ) values (
    v_d3_employee_code, btrim(v_full_name), v_d3_email,
    nullif(btrim(coalesce(v_phone, '')), ''), v_join_date,
    case when v_status in ('PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN', 'RESIGNED', 'TERMINATED')
      then v_status else 'PROBATION' end,
    v_position_id, v_department_id, 'HQ'
  )
  returning id into v_d3_employee_id;

  insert into public.d3_b2_employee_sources (b2_register_id, employee_id, link_kind)
  values (p_b2_register_id, v_d3_employee_id, 'CREATED');

  return query select v_d3_employee_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.d3_feedback_employee_uuid()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select dua.employee_id from public.d3_user_access dua where dua.auth_user_id = auth.uid() limit 1 $function$;

CREATE OR REPLACE FUNCTION private.d3_feedback_audit_and_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor uuid := private.d3_feedback_employee_uuid(); action_name text := 'CREATE'; message_text text; event_name text;
begin
  if tg_table_name = 'd3_employee_feedback' then
    if tg_op = 'UPDATE' then
      action_name := case when old.follow_up_status is distinct from new.follow_up_status then 'STATUS_CHANGE' else 'UPDATE' end;
      event_name := case when old.follow_up_status is distinct from new.follow_up_status then 'FEEDBACK_STATUS_CHANGED' else 'FEEDBACK_UPDATED' end;
      message_text := 'Feedback Anda telah diperbarui.';
    else
      event_name := 'FEEDBACK_CREATED'; message_text := 'Feedback baru tersedia untuk Anda.';
    end if;
    insert into public.d3_feedback_reward_audit_log(entity_type, entity_id, target_employee_id, action, actor_auth_user_id, actor_employee_id, before_data, after_data)
    values ('FEEDBACK', new.id, new.employee_id, action_name, auth.uid(), actor, case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
    insert into public.d3_feedback_reward_notifications(recipient_employee_id, entity_type, entity_id, event_type, message)
    select distinct recipient_id, 'FEEDBACK', new.id, event_name, message_text
    from (select new.employee_id recipient_id union all select actor union all select employee_id from public.d3_user_access where app_role = 'HR' and employee_id is not null) recipients
    where recipient_id is not null;
  else
    if tg_op = 'UPDATE' then
      action_name := case when old.status is distinct from new.status then case new.status when 'APPROVED' then 'APPROVE' when 'REJECTED' then 'REJECT' when 'PUBLISHED' then 'PUBLISH' else 'UPDATE' end else 'UPDATE' end;
      event_name := 'REWARD_STATUS_CHANGED'; message_text := 'Status reward Anda telah diperbarui.';
    else
      action_name := 'SUBMIT'; event_name := 'REWARD_SUBMITTED'; message_text := 'Reward baru telah diajukan untuk Anda.';
    end if;
    insert into public.d3_feedback_reward_audit_log(entity_type, entity_id, target_employee_id, action, actor_auth_user_id, actor_employee_id, before_data, after_data, reason)
    values ('REWARD', new.id, new.employee_id, action_name, auth.uid(), actor, case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new), new.approval_reason);
    insert into public.d3_feedback_reward_notifications(recipient_employee_id, entity_type, entity_id, event_type, message)
    select distinct recipient_id, 'REWARD', new.id, event_name, message_text
    from (select new.employee_id recipient_id union all select actor union all select employee_id from public.d3_user_access where app_role = 'HR' and employee_id is not null) recipients
    where recipient_id is not null;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.d3_feedback_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select dua.app_role::text from public.d3_user_access dua where dua.auth_user_id = auth.uid() limit 1 $function$;

CREATE OR REPLACE FUNCTION private.d3_feedback_guard_employee_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare role_name text := private.d3_feedback_role();
begin
  if role_name in ('EMPLOYEE', 'STAFF') then
    if old.employee_id is distinct from new.employee_id or old.given_by is distinct from new.given_by or old.date is distinct from new.date or old.title is distinct from new.title or old.feedback_type is distinct from new.feedback_type or old.category is distinct from new.category or old.feedback_text is distinct from new.feedback_text or old.follow_up_text is distinct from new.follow_up_text or old.target_date is distinct from new.target_date then raise exception 'Employee or Staff may only update feedback progress'; end if;
    if old.follow_up_status = 'NEW' and new.follow_up_status not in ('NEW', 'READ') then raise exception 'Invalid employee feedback status transition'; end if;
    if old.follow_up_status = 'READ' and new.follow_up_status not in ('READ', 'IN_PROGRESS') then raise exception 'Invalid employee feedback status transition'; end if;
    if old.follow_up_status in ('IN_PROGRESS', 'COMPLETED') and new.follow_up_status is distinct from old.follow_up_status then raise exception 'Employee or Staff cannot complete or reopen feedback'; end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.d3_feedback_is_subordinate(target_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select exists (select 1 from public.d3_employee_reporting r where r.manager_employee_id = private.d3_feedback_employee_uuid() and r.subordinate_employee_id = target_id and r.is_active = true and r.effective_from <= current_date and (r.effective_to is null or r.effective_to >= current_date)) $function$;

CREATE OR REPLACE FUNCTION public.d3_get_idle_session_status()
 RETURNS TABLE(status text, expires_at timestamp with time zone, time_zone text, work_location text, idle_timeout_seconds integer, warning_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_b2_register_id uuid;
  v_employee_id uuid;
  v_work_location text;
  v_time_zone text;
  v_expires_at timestamptz;
  v_idle_timeout_seconds integer;
  v_warning_seconds integer;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required' using errcode = '42501';
  end if;

  v_session_id := nullif(
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'session_id',
    ''
  )::uuid;
  if v_session_id is null then
    raise exception 'A valid Supabase session is required' using errcode = '42501';
  end if;

  select policy.idle_timeout_seconds, policy.warning_seconds
    into v_idle_timeout_seconds, v_warning_seconds
  from private.d3_idle_logout_policy as policy
  where policy.policy_key = 'default';

  if not found then
    raise exception 'Automatic logout policy is not configured' using errcode = 'P0001';
  end if;

  select profile.b2_register_id, profile.employee_id, profile.work_location, profile.time_zone
    into v_b2_register_id, v_employee_id, v_work_location, v_time_zone
  from private.d3_current_idle_logout_profile() as profile;

  if not found then
    return query
    select
      'PROFILE_UNAVAILABLE'::text,
      null::timestamptz,
      null::text,
      null::text,
      v_idle_timeout_seconds,
      v_warning_seconds;
    return;
  end if;

  if v_time_zone is null then
    return query
    select
      'LOCATION_UNMAPPED'::text,
      null::timestamptz,
      null::text,
      v_work_location,
      v_idle_timeout_seconds,
      v_warning_seconds;
    return;
  end if;

  select session.expires_at
    into v_expires_at
  from private.d3_idle_sessions as session
  where session.session_id = v_session_id
    and session.auth_user_id = v_user_id
    and session.b2_register_id = v_b2_register_id
    and session.employee_id = v_employee_id;

  if not found then
    return query
    select
      'MISSING_SESSION'::text,
      null::timestamptz,
      v_time_zone,
      v_work_location,
      v_idle_timeout_seconds,
      v_warning_seconds;
    return;
  end if;

  if v_expires_at <= v_now then
    return query
    select
      'EXPIRED'::text,
      v_expires_at,
      v_time_zone,
      v_work_location,
      v_idle_timeout_seconds,
      v_warning_seconds;
    return;
  end if;

  return query
  select
    'ACTIVE'::text,
    v_expires_at,
    v_time_zone,
    v_work_location,
    v_idle_timeout_seconds,
    v_warning_seconds;
end;
$function$;

CREATE OR REPLACE FUNCTION public.d3_log_attendance_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor_id uuid := public.d3_current_b2_register_uuid();
begin
  insert into public.d3_attendance_audit_log (attendance_id, target_b2_register_id, actor_b2_register_id, action, details)
  values (
    new.id, new.b2_register_id, actor_id,
    case when tg_op = 'INSERT' then 'ATTENDANCE_CREATED' else 'ATTENDANCE_UPDATED' end,
    jsonb_build_object('operation', tg_op, 'before', case when tg_op = 'UPDATE' then jsonb_build_object('clock_in', old.clock_in, 'clock_out', old.clock_out, 'status', old.status, 'notes', old.notes) else null end, 'after', jsonb_build_object('clock_in', new.clock_in, 'clock_out', new.clock_out, 'status', new.status, 'notes', new.notes))
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.d3_log_attendance_closing_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor_id uuid := public.d3_current_b2_register_uuid();
begin
  insert into public.d3_attendance_audit_log (closing_id, actor_b2_register_id, action, details)
  values (new.id, actor_id, case when tg_op = 'INSERT' then 'ATTENDANCE_PERIOD_CLOSED' else 'ATTENDANCE_PERIOD_REOPENED' end, jsonb_build_object('period_start', new.period_start, 'period_end', new.period_end, 'status', new.status, 'reason', new.reason));
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.d3_log_attendance_correction_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor_id uuid := public.d3_current_b2_register_uuid(); target_id uuid; action_name text;
begin
  select attendance.b2_register_id into target_id from public.d3_attendances attendance where attendance.id = new.attendance_id;
  action_name := case when tg_op = 'INSERT' then 'CORRECTION_SUBMITTED' when new.status = 'APPROVED' and old.status is distinct from new.status then 'CORRECTION_APPROVED' when new.status = 'REJECTED' and old.status is distinct from new.status then 'CORRECTION_REJECTED' else 'CORRECTION_UPDATED' end;
  insert into public.d3_attendance_audit_log (attendance_id, correction_id, target_b2_register_id, actor_b2_register_id, action, details)
  values (new.attendance_id, new.id, target_id, actor_id, action_name, jsonb_build_object('correction_type', new.correction_type, 'status', new.status, 'proposed_clock_in', new.proposed_clock_in, 'proposed_clock_out', new.proposed_clock_out, 'reason', new.reason, 'review_note', new.review_note));
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.d3_populate_ticket_reporter_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  select employee.full_name, employee.employee_id, coalesce(department.name, '-')
    into new.reporter_name, new.reporter_employee_code, new.reporter_department
  from public.d3_user_access access
  join public.d3_employee employee on employee.id = access.employee_id
  left join public.d3_departments department on department.id = employee.department_id
  where access.auth_user_id = (select auth.uid())
    and access.employee_id = new.employee_id;

  if new.reporter_name is null then
    raise exception 'Authenticated employee mapping is required to create a D3 ticket';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.d3_start_idle_session()
 RETURNS TABLE(status text, expires_at timestamp with time zone, time_zone text, work_location text, idle_timeout_seconds integer, warning_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_b2_register_id uuid;
  v_employee_id uuid;
  v_work_location text;
  v_time_zone text;
  v_idle_timeout_seconds integer;
  v_warning_seconds integer;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required' using errcode = '42501';
  end if;

  v_session_id := nullif(
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'session_id',
    ''
  )::uuid;
  if v_session_id is null then
    raise exception 'A valid Supabase session is required' using errcode = '42501';
  end if;

  select policy.idle_timeout_seconds, policy.warning_seconds
    into v_idle_timeout_seconds, v_warning_seconds
  from private.d3_idle_logout_policy as policy
  where policy.policy_key = 'default';

  if not found then
    raise exception 'Automatic logout policy is not configured' using errcode = 'P0001';
  end if;

  select profile.b2_register_id, profile.employee_id, profile.work_location, profile.time_zone
    into v_b2_register_id, v_employee_id, v_work_location, v_time_zone
  from private.d3_current_idle_logout_profile() as profile;

  if not found then
    raise exception 'Employee profile is not linked to an active D3 employee' using errcode = 'P0001';
  end if;

  if v_time_zone is null then
    raise exception 'Work location is not configured for automatic logout. Contact HR.' using errcode = 'P0001';
  end if;

  -- Expired rows are not audit records. Remove only stale state, retaining
  -- active sessions from other browsers/devices.
  delete from private.d3_idle_sessions as idle_session
  where idle_session.expires_at < v_now - interval '1 day';

  insert into private.d3_idle_sessions (
    session_id,
    auth_user_id,
    b2_register_id,
    employee_id,
    work_location,
    time_zone,
    started_at,
    last_activity_at,
    expires_at
  ) values (
    v_session_id,
    v_user_id,
    v_b2_register_id,
    v_employee_id,
    v_work_location,
    v_time_zone,
    v_now,
    v_now,
    v_now + v_idle_timeout_seconds * interval '1 second'
  )
  on conflict (session_id) do update
  set auth_user_id = excluded.auth_user_id,
      b2_register_id = excluded.b2_register_id,
      employee_id = excluded.employee_id,
      work_location = excluded.work_location,
      time_zone = excluded.time_zone,
      started_at = excluded.started_at,
      last_activity_at = excluded.last_activity_at,
      expires_at = excluded.expires_at;

  return query select * from public.d3_get_idle_session_status();
end;
$function$;

CREATE OR REPLACE FUNCTION public.d3_touch_idle_session()
 RETURNS TABLE(status text, expires_at timestamp with time zone, time_zone text, work_location text, idle_timeout_seconds integer, warning_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_b2_register_id uuid;
  v_employee_id uuid;
  v_work_location text;
  v_time_zone text;
  v_idle_timeout_seconds integer;
  v_current_status text;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required' using errcode = '42501';
  end if;

  v_session_id := nullif(
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'session_id',
    ''
  )::uuid;
  if v_session_id is null then
    raise exception 'A valid Supabase session is required' using errcode = '42501';
  end if;

  select current_status.status
    into v_current_status
  from public.d3_get_idle_session_status() as current_status;

  if v_current_status is distinct from 'ACTIVE' then
    return query select * from public.d3_get_idle_session_status();
    return;
  end if;

  select policy.idle_timeout_seconds
    into v_idle_timeout_seconds
  from private.d3_idle_logout_policy as policy
  where policy.policy_key = 'default';

  select profile.b2_register_id, profile.employee_id, profile.work_location, profile.time_zone
    into v_b2_register_id, v_employee_id, v_work_location, v_time_zone
  from private.d3_current_idle_logout_profile() as profile;

  update private.d3_idle_sessions as session
  set b2_register_id = v_b2_register_id,
      employee_id = v_employee_id,
      work_location = v_work_location,
      time_zone = v_time_zone,
      last_activity_at = v_now,
      expires_at = v_now + v_idle_timeout_seconds * interval '1 second'
  where session.session_id = v_session_id
    and session.auth_user_id = v_user_id
    and session.expires_at > v_now;

  return query select * from public.d3_get_idle_session_status();
end;
$function$;

CREATE OR REPLACE FUNCTION public.d3_update_b2_employee_employment_status(p_b2_register_id uuid, p_employment_status text)
 RETURNS TABLE(employee_id text, employment_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_employee_id text;
  v_status text := upper(btrim(coalesce(p_employment_status, '')));
  v_current_status text;
  v_d3_employee_id uuid;
begin
  if auth.uid() is null or public.d3_current_role() <> 'HR'::public.d3_app_role then
    raise exception 'Only authenticated HR users may change employment status' using errcode = '42501';
  end if;
  if v_status not in ('PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN', 'RESIGNED', 'TERMINATED') then
    raise exception 'Employment status is invalid' using errcode = '22023';
  end if;

  select b2.employee_id, upper(coalesce(b2.employment_status, ''))
    into v_employee_id, v_current_status
  from public.b2_register b2
  where b2.id = p_b2_register_id and b2.is_active = true
  for update;

  if not found then
    raise exception 'B2 employee was not found' using errcode = 'P0002';
  end if;
  if v_current_status = 'PERMANENT' and v_status not in ('PERMANENT', 'RESIGNED', 'TERMINATED') then
    raise exception 'A permanent employee may only change to RESIGNED or TERMINATED' using errcode = '22023';
  end if;
  if v_current_status in ('RESIGNED', 'TERMINATED') and v_status <> v_current_status then
    raise exception 'A resigned or terminated employee has a final employment status' using errcode = '22023';
  end if;

  update public.b2_register set employment_status = lower(v_status) where id = p_b2_register_id;

  select source.employee_id into v_d3_employee_id
  from public.d3_b2_employee_sources source
  where source.b2_register_id = p_b2_register_id;

  if v_d3_employee_id is not null then
    update public.d3_employee set employment_status = v_status where id = v_d3_employee_id;
  end if;

  return query select v_employee_id, v_status;
end;
$function$;

CREATE OR REPLACE FUNCTION public.d3_update_b2_employee_profile(p_b2_register_id uuid, p_full_name text, p_email text, p_phone text, p_position_id uuid, p_department_id uuid, p_work_location text)
 RETURNS TABLE(employee_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_employee_id text; v_d3_employee_id uuid; v_d3_email text;
begin
  select b2.employee_id, source.employee_id into v_employee_id, v_d3_employee_id
  from public.b2_register b2
  join public.d3_b2_employee_sources source on source.b2_register_id = b2.id
  where b2.id = p_b2_register_id and b2.is_active is true
  for update;
  if not found then raise exception 'B2 employee was not found' using errcode = 'P0002'; end if;
  if auth.uid() is null or not private.d3_can_manage_employee_profile(v_d3_employee_id) then
    raise exception 'Only HR or the direct manager may update this employee profile' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_full_name, '')), '') is null
     or nullif(btrim(coalesce(p_email, '')), '') is null
     or p_position_id is null or p_department_id is null
     or nullif(btrim(coalesce(p_work_location, '')), '') is null then
    raise exception 'Employee profile fields are incomplete' using errcode = '22023';
  end if;
  if not exists (select 1 from public.d3_positions where id = p_position_id and department_id = p_department_id) then
    raise exception 'Position does not belong to department' using errcode = '22023';
  end if;
  update public.b2_register
  set full_name = btrim(p_full_name), email = lower(btrim(p_email)),
      phone = nullif(btrim(coalesce(p_phone, '')), ''), position_id = p_position_id,
      departement_id = p_department_id
  where id = p_b2_register_id;
  select employee.email into v_d3_email from public.d3_employee employee where employee.id = v_d3_employee_id;
  if exists (select 1 from public.d3_employee employee where lower(employee.email) = lower(btrim(p_email)) and employee.id <> v_d3_employee_id) then
    v_d3_email := null;
  else
    v_d3_email := lower(btrim(p_email));
  end if;
  update public.d3_employee
  set full_name = btrim(p_full_name), email = coalesce(v_d3_email, email),
      phone = nullif(btrim(coalesce(p_phone, '')), ''), position_id = p_position_id,
      department_id = p_department_id, work_location = btrim(p_work_location)
  where id = v_d3_employee_id;
  insert into public.d3_employee_audit_log (employee_record_id, action, actor_auth_user_id, actor_employee_id, changed_fields)
  values (v_d3_employee_id, 'UPDATE', auth.uid(), private.d3_current_access_employee_id(), array['profile']);
  return query select v_employee_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.d3_write_ticket_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_actor uuid;
begin
  if tg_table_name = 'd3_tickets' and tg_op = 'INSERT' then
    insert into public.d3_ticket_history (
      ticket_id, actor_employee_id, event_type, to_status
    ) values (
      new.id, new.employee_id, 'CREATED', new.status
    );
    return new;
  end if;

  if tg_table_name = 'd3_tickets' and tg_op = 'UPDATE' then
    select employee_id into current_actor
    from public.d3_user_access
    where auth_user_id = auth.uid();

    if current_actor is null then
      raise exception 'Authenticated D3 user mapping is required for an audit entry';
    end if;

    if new.status is distinct from old.status then
      insert into public.d3_ticket_history (
        ticket_id, actor_employee_id, event_type, from_status, to_status
      ) values (
        new.id, current_actor, 'STATUS_CHANGED', old.status, new.status
      );
    end if;

    if new.priority is distinct from old.priority then
      insert into public.d3_ticket_history (
        ticket_id, actor_employee_id, event_type, note
      ) values (
        new.id, current_actor, 'PRIORITY_CHANGED', 'Priority changed to ' || new.priority::text
      );
    end if;

    if new.due_at is distinct from old.due_at then
      insert into public.d3_ticket_history (
        ticket_id, actor_employee_id, event_type, note
      ) values (
        new.id, current_actor, 'DUE_DATE_CHANGED',
        case when new.due_at is null then 'Due date cleared' else 'Due date updated' end
      );
    end if;

    return new;
  end if;

  if tg_table_name = 'd3_ticket_followups' and tg_op = 'INSERT' then
    insert into public.d3_ticket_history (
      ticket_id, actor_employee_id, event_type, note
    ) values (
      new.ticket_id, new.actor_employee_id, 'FOLLOW_UP_ADDED', new.note
    );
    return new;
  end if;

  return new;
end;
$function$;

-- Trigger
CREATE TRIGGER d3_log_attendance_closing_change AFTER INSERT OR UPDATE OF status ON public.d3_attendance_closings FOR EACH ROW EXECUTE FUNCTION d3_log_attendance_closing_change();
CREATE TRIGGER d3_log_attendance_correction_change AFTER INSERT OR UPDATE ON public.d3_attendance_corrections FOR EACH ROW EXECUTE FUNCTION d3_log_attendance_correction_change();
CREATE TRIGGER d3_log_attendance_change AFTER INSERT OR UPDATE ON public.d3_attendances FOR EACH ROW EXECUTE FUNCTION d3_log_attendance_change();
CREATE TRIGGER d3_employee_profile_audit AFTER INSERT OR DELETE OR UPDATE ON public.d3_employee FOR EACH ROW EXECUTE FUNCTION d3_audit_employee_profile();
CREATE TRIGGER d3_employee_feedback_audit AFTER INSERT OR UPDATE ON public.d3_employee_feedback FOR EACH ROW EXECUTE FUNCTION private.d3_feedback_audit_and_notify();
CREATE TRIGGER d3_employee_feedback_guard_update BEFORE UPDATE ON public.d3_employee_feedback FOR EACH ROW EXECUTE FUNCTION private.d3_feedback_guard_employee_update();
CREATE TRIGGER d3_employee_rewards_audit AFTER INSERT OR UPDATE ON public.d3_employee_rewards FOR EACH ROW EXECUTE FUNCTION private.d3_feedback_audit_and_notify();
CREATE TRIGGER d3_ticket_followups_audit AFTER INSERT ON public.d3_ticket_followups FOR EACH ROW EXECUTE FUNCTION private.d3_write_ticket_history();
CREATE TRIGGER d3_tickets_audit AFTER INSERT OR UPDATE OF status, priority, due_at ON public.d3_tickets FOR EACH ROW EXECUTE FUNCTION private.d3_write_ticket_history();
CREATE TRIGGER d3_tickets_reporter_snapshot BEFORE INSERT ON public.d3_tickets FOR EACH ROW EXECUTE FUNCTION private.d3_populate_ticket_reporter_snapshot();

-- Relasi ke auth.users. Dipasang NOT VALID karena tabel user versi login baru belum ada;
-- kemungkinan perlu diarahkan ke tabel user yang baru.
alter table public.d3_employee_audit_log add constraint d3_employee_audit_log_actor_auth_user_id_fkey FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;
alter table public.d3_employee_directory_hidden add constraint d3_employee_directory_hidden_hidden_by_fkey FOREIGN KEY (hidden_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;
alter table public.d3_face_biometric_events add constraint d3_face_biometric_events_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table public.d3_face_biometric_templates add constraint d3_face_biometric_templates_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table public.d3_user_access add constraint d3_user_access_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

-- Row level security
alter table private.d3_idle_logout_policy enable row level security;
alter table private.d3_idle_sessions enable row level security;
alter table private.d3_work_location_timezones enable row level security;
alter table public.d3_attendance_audit_log enable row level security;
alter table public.d3_attendance_closings enable row level security;
alter table public.d3_attendance_corrections enable row level security;
alter table public.d3_attendances enable row level security;
alter table public.d3_b2_employee_sources enable row level security;
alter table public.d3_competencies enable row level security;
alter table public.d3_d1_department_mappings enable row level security;
alter table public.d3_d1_position_mappings enable row level security;
alter table public.d3_departments enable row level security;
alter table public.d3_employee enable row level security;
alter table public.d3_employee_audit_log enable row level security;
alter table public.d3_employee_certifications enable row level security;
alter table public.d3_employee_directory_hidden enable row level security;
alter table public.d3_employee_feedback enable row level security;
alter table public.d3_employee_reporting enable row level security;
alter table public.d3_employee_rewards enable row level security;
alter table public.d3_employee_skills enable row level security;
alter table public.d3_employee_sync_events enable row level security;
alter table public.d3_face_biometric_events enable row level security;
alter table public.d3_face_biometric_templates enable row level security;
alter table public.d3_feedback_reward_audit_log enable row level security;
alter table public.d3_feedback_reward_notifications enable row level security;
alter table public.d3_positions enable row level security;
alter table public.d3_ticket_attachments enable row level security;
alter table public.d3_ticket_followups enable row level security;
alter table public.d3_ticket_history enable row level security;
alter table public.d3_tickets enable row level security;
alter table public.d3_user_access enable row level security;

create policy "D3 HR managers read attendance audit" on public.d3_attendance_audit_log as permissive for select to authenticated
  using ((d3_current_role() = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role])));
create policy "D3 attendance audit trigger insert" on public.d3_attendance_audit_log as permissive for insert to authenticated
  with check ((actor_b2_register_id = d3_current_b2_register_uuid()));
create policy "D3 HR managers create attendance closing" on public.d3_attendance_closings as permissive for insert to authenticated
  with check (((d3_current_role() = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role])) AND (closed_by_b2_register_id = d3_current_b2_register_uuid())));
create policy "D3 HR managers update attendance closing" on public.d3_attendance_closings as permissive for update to authenticated
  using ((d3_current_role() = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role])))
  with check (((d3_current_role() = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role])) AND (reopened_by_b2_register_id = d3_current_b2_register_uuid())));
create policy "D3 attendance closing read" on public.d3_attendance_closings as permissive for select to authenticated
  using (true);
create policy "D3 attendance correction create own" on public.d3_attendance_corrections as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM d3_attendances attendance
  WHERE ((attendance.id = d3_attendance_corrections.attendance_id) AND private.d3_is_current_b2_employee(attendance.b2_register_id)))));
create policy "D3 attendance correction read by direct scope" on public.d3_attendance_corrections as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM d3_attendances attendance
  WHERE ((attendance.id = d3_attendance_corrections.attendance_id) AND private.d3_can_view_b2_attendance(attendance.b2_register_id)))));
create policy "D3 attendance correction update by direct scope" on public.d3_attendance_corrections as permissive for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM d3_attendances attendance
  WHERE ((attendance.id = d3_attendance_corrections.attendance_id) AND private.d3_can_manage_b2_attendance(attendance.b2_register_id)))))
  with check ((EXISTS ( SELECT 1
   FROM d3_attendances attendance
  WHERE ((attendance.id = d3_attendance_corrections.attendance_id) AND private.d3_can_manage_b2_attendance(attendance.b2_register_id)))));
create policy "D3 attendance create own record" on public.d3_attendances as permissive for insert to authenticated
  with check (private.d3_is_current_b2_employee(b2_register_id));
create policy "D3 attendance read by direct scope" on public.d3_attendances as permissive for select to authenticated
  using (private.d3_can_view_b2_attendance(b2_register_id));
create policy "D3 attendance update by direct scope" on public.d3_attendances as permissive for update to authenticated
  using (private.d3_can_manage_b2_attendance(b2_register_id))
  with check (private.d3_can_manage_b2_attendance(b2_register_id));
create policy "D3 role scoped B2 employee source read" on public.d3_b2_employee_sources as permissive for select to authenticated
  using (((( SELECT auth.uid() AS uid) IS NOT NULL) AND private.d3_can_view_employee_profile(employee_id)));
create policy "D3 reference competencies select v1" on public.d3_competencies as permissive for select to authenticated
  using ((d3_current_role() IS NOT NULL));
create policy "D3 HR creates departments v1" on public.d3_departments as permissive for insert to authenticated
  with check ((( SELECT d3_current_role() AS d3_current_role) = 'HR'::d3_app_role));
create policy "D3 HR updates departments v1" on public.d3_departments as permissive for update to authenticated
  using ((( SELECT d3_current_role() AS d3_current_role) = 'HR'::d3_app_role))
  with check ((( SELECT d3_current_role() AS d3_current_role) = 'HR'::d3_app_role));
create policy "D3 reference departments select v1" on public.d3_departments as permissive for select to authenticated
  using ((d3_current_role() IS NOT NULL));
create policy "Login log can read departments" on public.d3_departments as permissive for select to authenticated
  using (true);
create policy "D3 role scoped employee profile read" on public.d3_employee as permissive for select to authenticated
  using (private.d3_can_view_employee(id));
create policy "D3 HR and management read employee audit" on public.d3_employee_audit_log as permissive for select to authenticated
  using ((private.d3_current_access_role() = ANY (ARRAY['HR'::d3_app_role, 'MANAGEMENT'::d3_app_role])));
create policy "D3 employee certifications select v1" on public.d3_employee_certifications as permissive for select to authenticated
  using (((d3_current_role() = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role])) OR (employee_id = d3_current_employee_uuid())));
create policy "D3 HR hide employees from directory" on public.d3_employee_directory_hidden as permissive for insert to authenticated
  with check (((( SELECT auth.uid() AS uid) = hidden_by) AND (EXISTS ( SELECT 1
   FROM d3_user_access access
  WHERE ((access.auth_user_id = ( SELECT auth.uid() AS uid)) AND (access.app_role = 'HR'::d3_app_role))))));
create policy "D3 HR restore employees to directory" on public.d3_employee_directory_hidden as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM d3_user_access access
  WHERE ((access.auth_user_id = ( SELECT auth.uid() AS uid)) AND (access.app_role = 'HR'::d3_app_role)))));
create policy "D3 authenticated users read directory visibility" on public.d3_employee_directory_hidden as permissive for select to authenticated
  using (true);
create policy "d3_feedback_insert_hr" on public.d3_employee_feedback as permissive for insert to authenticated
  with check (((private.d3_feedback_role() = 'HR'::text) AND (given_by = private.d3_feedback_employee_uuid())));
create policy "d3_feedback_insert_manager" on public.d3_employee_feedback as permissive for insert to authenticated
  with check (((private.d3_feedback_role() = 'MANAGER'::text) AND private.d3_feedback_is_subordinate(employee_id) AND (given_by = private.d3_feedback_employee_uuid())));
create policy "d3_feedback_select_employee" on public.d3_employee_feedback as permissive for select to authenticated
  using (((private.d3_feedback_role() = ANY (ARRAY['EMPLOYEE'::text, 'STAFF'::text])) AND (employee_id = private.d3_feedback_employee_uuid())));
create policy "d3_feedback_select_hr" on public.d3_employee_feedback as permissive for select to authenticated
  using ((private.d3_feedback_role() = 'HR'::text));
create policy "d3_feedback_select_manager" on public.d3_employee_feedback as permissive for select to authenticated
  using (((private.d3_feedback_role() = 'MANAGER'::text) AND private.d3_feedback_is_subordinate(employee_id)));
create policy "d3_feedback_update_employee" on public.d3_employee_feedback as permissive for update to authenticated
  using (((private.d3_feedback_role() = ANY (ARRAY['EMPLOYEE'::text, 'STAFF'::text])) AND (employee_id = private.d3_feedback_employee_uuid())))
  with check (((private.d3_feedback_role() = ANY (ARRAY['EMPLOYEE'::text, 'STAFF'::text])) AND (employee_id = private.d3_feedback_employee_uuid())));
create policy "d3_feedback_update_hr" on public.d3_employee_feedback as permissive for update to authenticated
  using ((private.d3_feedback_role() = 'HR'::text))
  with check ((private.d3_feedback_role() = 'HR'::text));
create policy "d3_feedback_update_manager" on public.d3_employee_feedback as permissive for update to authenticated
  using (((private.d3_feedback_role() = 'MANAGER'::text) AND private.d3_feedback_is_subordinate(employee_id)))
  with check (((private.d3_feedback_role() = 'MANAGER'::text) AND private.d3_feedback_is_subordinate(employee_id)));
create policy "D3 HR creates employee reporting" on public.d3_employee_reporting as permissive for insert to authenticated
  with check ((( SELECT d3_current_role() AS d3_current_role) = 'HR'::d3_app_role));
create policy "D3 HR deletes employee reporting" on public.d3_employee_reporting as permissive for delete to authenticated
  using ((( SELECT d3_current_role() AS d3_current_role) = 'HR'::d3_app_role));
create policy "D3 HR reads all employee reporting" on public.d3_employee_reporting as permissive for select to authenticated
  using ((( SELECT d3_current_role() AS d3_current_role) = 'HR'::d3_app_role));
create policy "D3 HR updates employee reporting" on public.d3_employee_reporting as permissive for update to authenticated
  using ((( SELECT d3_current_role() AS d3_current_role) = 'HR'::d3_app_role))
  with check ((( SELECT d3_current_role() AS d3_current_role) = 'HR'::d3_app_role));
create policy "D3 manager reads own employee reporting" on public.d3_employee_reporting as permissive for select to authenticated
  using (((( SELECT d3_current_role() AS d3_current_role) = 'MANAGER'::d3_app_role) AND (manager_employee_id = ( SELECT d3_current_employee_uuid() AS d3_current_employee_uuid)) AND (is_active = true) AND (effective_from <= CURRENT_DATE) AND ((effective_to IS NULL) OR (effective_to >= CURRENT_DATE))));
create policy "d3_reward_insert_hr" on public.d3_employee_rewards as permissive for insert to authenticated
  with check (((private.d3_feedback_role() = 'HR'::text) AND (proposed_by = private.d3_feedback_employee_uuid())));
create policy "d3_reward_insert_manager" on public.d3_employee_rewards as permissive for insert to authenticated
  with check (((private.d3_feedback_role() = 'MANAGER'::text) AND private.d3_feedback_is_subordinate(employee_id) AND (proposed_by = private.d3_feedback_employee_uuid())));
create policy "d3_reward_select_employee" on public.d3_employee_rewards as permissive for select to authenticated
  using (((private.d3_feedback_role() = ANY (ARRAY['EMPLOYEE'::text, 'STAFF'::text])) AND (employee_id = private.d3_feedback_employee_uuid()) AND ((visibility = 'PRIVATE'::text) OR (status = 'PUBLISHED'::text))));
create policy "d3_reward_select_hr" on public.d3_employee_rewards as permissive for select to authenticated
  using ((private.d3_feedback_role() = 'HR'::text));
create policy "d3_reward_select_management_published" on public.d3_employee_rewards as permissive for select to authenticated
  using (((private.d3_feedback_role() = 'MANAGEMENT'::text) AND (status = 'PUBLISHED'::text) AND (visibility = 'PUBLIC'::text)));
create policy "d3_reward_select_manager" on public.d3_employee_rewards as permissive for select to authenticated
  using (((private.d3_feedback_role() = 'MANAGER'::text) AND private.d3_feedback_is_subordinate(employee_id)));
create policy "d3_reward_update_hr" on public.d3_employee_rewards as permissive for update to authenticated
  using ((private.d3_feedback_role() = 'HR'::text))
  with check ((private.d3_feedback_role() = 'HR'::text));
create policy "D3 employee skills select v1" on public.d3_employee_skills as permissive for select to authenticated
  using (((d3_current_role() = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role])) OR (employee_id = d3_current_employee_uuid())));
create policy "D3 HR reads employee sync history" on public.d3_employee_sync_events as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM d3_user_access access
  WHERE ((access.auth_user_id = ( SELECT auth.uid() AS uid)) AND (access.app_role = 'HR'::d3_app_role)))));
create policy "D3 biometric event read by direct scope" on public.d3_face_biometric_events as permissive for select to authenticated
  using (((auth_user_id = auth.uid()) OR private.d3_can_view_sensitive_employee(employee_id)));
create policy "D3 users insert biometric events from B2 identity" on public.d3_face_biometric_events as permissive for insert to authenticated
  with check (((auth_user_id = auth.uid()) AND (employee_id = d3_current_employee_uuid())));
create policy "D3 users insert only their own mapped biometric event" on public.d3_face_biometric_events as permissive for insert to authenticated
  with check (((auth_user_id = ( SELECT auth.uid() AS uid)) AND (employee_id = ( SELECT access.employee_id
   FROM d3_user_access access
  WHERE (access.auth_user_id = ( SELECT auth.uid() AS uid))))));
create policy "D3 users enroll biometric templates from B2 identity" on public.d3_face_biometric_templates as permissive for insert to authenticated
  with check (((auth_user_id = auth.uid()) AND (employee_id = d3_current_employee_uuid())));
create policy "D3 users read their own biometric template" on public.d3_face_biometric_templates as permissive for select to authenticated
  using ((auth_user_id = ( SELECT auth.uid() AS uid)));
create policy "D3 users update biometric templates from B2 identity" on public.d3_face_biometric_templates as permissive for update to authenticated
  using ((auth_user_id = auth.uid()))
  with check (((auth_user_id = auth.uid()) AND (employee_id = d3_current_employee_uuid())));
create policy "d3_feedback_audit_read_hr" on public.d3_feedback_reward_audit_log as permissive for select to authenticated
  using ((private.d3_feedback_role() = 'HR'::text));
create policy "d3_feedback_audit_read_manager" on public.d3_feedback_reward_audit_log as permissive for select to authenticated
  using (((private.d3_feedback_role() = 'MANAGER'::text) AND private.d3_feedback_is_subordinate(target_employee_id)));
create policy "d3_notification_read_own" on public.d3_feedback_reward_notifications as permissive for select to authenticated
  using ((recipient_employee_id = private.d3_feedback_employee_uuid()));
create policy "d3_notification_update_own" on public.d3_feedback_reward_notifications as permissive for update to authenticated
  using ((recipient_employee_id = private.d3_feedback_employee_uuid()))
  with check ((recipient_employee_id = private.d3_feedback_employee_uuid()));
create policy "Allow Public Read Positions" on public.d3_positions as permissive for select to public
  using (true);
create policy "D3 reference positions select v1" on public.d3_positions as permissive for select to authenticated
  using ((d3_current_role() IS NOT NULL));
create policy "Login log can read positions" on public.d3_positions as permissive for select to authenticated
  using (true);
create policy "allow_anon_read_d3_positions" on public.d3_positions as permissive for select to anon
  using (true);
create policy "allow_authenticated_read_d3_positions" on public.d3_positions as permissive for select to authenticated
  using (true);
create policy "D3 ticket attachment create by direct scope" on public.d3_ticket_attachments as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM d3_tickets ticket
  WHERE ((ticket.id = d3_ticket_attachments.ticket_id) AND private.d3_can_view_sensitive_employee(ticket.employee_id)))));
create policy "D3 ticket attachment read by direct scope" on public.d3_ticket_attachments as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM d3_tickets ticket
  WHERE ((ticket.id = d3_ticket_attachments.ticket_id) AND private.d3_can_view_sensitive_employee(ticket.employee_id)))));
create policy "D3 ticket followup create by direct scope" on public.d3_ticket_followups as permissive for insert to authenticated
  with check (((actor_employee_id = private.d3_current_access_employee_id()) AND (EXISTS ( SELECT 1
   FROM d3_tickets ticket
  WHERE ((ticket.id = d3_ticket_followups.ticket_id) AND private.d3_can_manage_sensitive_employee(ticket.employee_id))))));
create policy "D3 ticket followup read by direct scope" on public.d3_ticket_followups as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM d3_tickets ticket
  WHERE ((ticket.id = d3_ticket_followups.ticket_id) AND private.d3_can_view_sensitive_employee(ticket.employee_id)))));
create policy "D3 ticket history read by direct scope" on public.d3_ticket_history as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM d3_tickets ticket
  WHERE ((ticket.id = d3_ticket_history.ticket_id) AND private.d3_can_view_sensitive_employee(ticket.employee_id)))));
create policy "D3 ticket create own" on public.d3_tickets as permissive for insert to authenticated
  with check (((employee_id = private.d3_current_access_employee_id()) AND (private.d3_current_access_role() = ANY (ARRAY['EMPLOYEE'::d3_app_role, 'STAFF'::d3_app_role]))));
create policy "D3 ticket read by direct scope" on public.d3_tickets as permissive for select to authenticated
  using (private.d3_can_view_sensitive_employee(employee_id));
create policy "D3 ticket update by direct scope" on public.d3_tickets as permissive for update to authenticated
  using (private.d3_can_manage_sensitive_employee(employee_id))
  with check (private.d3_can_manage_sensitive_employee(employee_id));
create policy "D3 users read their own access mapping" on public.d3_user_access as permissive for select to authenticated
  using ((auth_user_id = ( SELECT auth.uid() AS uid)));

commit;
