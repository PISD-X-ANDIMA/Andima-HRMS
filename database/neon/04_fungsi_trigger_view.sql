-- 04_fungsi_trigger_view.sql: fungsi dan trigger yang tidak bergantung pada login Supabase atau tabel tribe lain, plus view
-- 6 fungsi, 8 trigger, 2 view.

begin;
set search_path = public;

CREATE OR REPLACE FUNCTION public.d3_attendance_period_is_closed(target_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select exists (select 1 from public.d3_attendance_closings closing where closing.status = 'CLOSED' and target_date between closing.period_start and closing.period_end);
$function$;

CREATE OR REPLACE FUNCTION private.d3_audit_directory_visibility()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_target uuid; v_actor uuid;
begin
  v_target := coalesce(new.employee_id, old.employee_id);
  v_actor := coalesce(new.hidden_by, old.hidden_by);
  insert into public.d3_employee_audit_log (employee_record_id, action, actor_auth_user_id, actor_employee_id, changed_fields)
  values (
    v_target,
    case when tg_op = 'INSERT' then 'UPDATE' else 'UPDATE' end,
    v_actor,
    (select access.employee_id from public.d3_user_access access where access.auth_user_id = v_actor limit 1),
    array[case when tg_op = 'INSERT' then 'directory_hidden' else 'directory_restored' end]
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.d3_prevent_overlapping_attendance_closing()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if new.status = 'CLOSED' and exists (
    select 1
    from public.d3_attendance_closings closing
    where closing.id <> coalesce(new.id, gen_random_uuid())
      and closing.status = 'CLOSED'
      and daterange(closing.period_start, closing.period_end, '[]') && daterange(new.period_start, new.period_end, '[]')
  ) then
    raise exception 'Attendance closing period overlaps an existing closed period'
      using errcode = '23P01';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.d3_protect_ticket_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.ticket_code is distinct from old.ticket_code
     or new.employee_id is distinct from old.employee_id
     or new.title is distinct from old.title
     or new.category is distinct from old.category
     or new.description is distinct from old.description
     or new.occurred_at is distinct from old.occurred_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Only ticket workflow fields may be updated after creation';
  end if;

  if new.status is not distinct from old.status
     and new.priority is not distinct from old.priority
     and new.due_at is not distinct from old.due_at then
    raise exception 'At least one ticket workflow field must change when updating a ticket';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.d3_reject_closed_attendance_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare attendance_date date;
begin
  if tg_table_name = 'd3_attendances' then
    attendance_date := new.date;
  else
    select attendance.date into attendance_date from public.d3_attendances attendance where attendance.id = new.attendance_id;
  end if;
  if public.d3_attendance_period_is_closed(attendance_date) then
    raise exception 'Attendance period is closed for %', attendance_date using errcode = '42501';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.d3_set_employee_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

CREATE TRIGGER d3_prevent_overlapping_attendance_closing BEFORE INSERT OR UPDATE OF period_start, period_end, status ON public.d3_attendance_closings FOR EACH ROW EXECUTE FUNCTION d3_prevent_overlapping_attendance_closing();
CREATE TRIGGER d3_reject_closed_correction_write BEFORE INSERT OR UPDATE ON public.d3_attendance_corrections FOR EACH ROW EXECUTE FUNCTION d3_reject_closed_attendance_write();
CREATE TRIGGER d3_reject_closed_attendance_write BEFORE INSERT OR UPDATE ON public.d3_attendances FOR EACH ROW EXECUTE FUNCTION d3_reject_closed_attendance_write();
CREATE TRIGGER d3_employees_set_updated_at BEFORE UPDATE ON public.d3_employee FOR EACH ROW EXECUTE FUNCTION d3_set_employee_updated_at();
CREATE TRIGGER d3_audit_directory_visibility_delete AFTER DELETE ON public.d3_employee_directory_hidden FOR EACH ROW EXECUTE FUNCTION private.d3_audit_directory_visibility();
CREATE TRIGGER d3_audit_directory_visibility_insert AFTER INSERT ON public.d3_employee_directory_hidden FOR EACH ROW EXECUTE FUNCTION private.d3_audit_directory_visibility();
CREATE TRIGGER d3_employee_reporting_set_updated_at BEFORE UPDATE ON public.d3_employee_reporting FOR EACH ROW EXECUTE FUNCTION d3_set_employee_updated_at();
CREATE TRIGGER d3_tickets_protect_update BEFORE UPDATE ON public.d3_tickets FOR EACH ROW EXECUTE FUNCTION private.d3_protect_ticket_update();

create view public.d3_view_employee_360 with (security_invoker=true) as
 SELECT e.id,
    e.employee_id,
    e.full_name,
    e.email,
    e.phone,
    e.identity_type,
    e.identity_number,
    e.join_date,
    e.employment_status,
    e.work_location,
    e.position_id,
    p.title AS position_title,
    e.department_id,
    d.name AS department_name,
    EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, e.join_date::timestamp with time zone))::integer AS tenure_years,
    EXTRACT(month FROM age(CURRENT_DATE::timestamp with time zone, e.join_date::timestamp with time zone))::integer AS tenure_months
   FROM d3_employee e
     JOIN d3_positions p ON p.id = e.position_id
     JOIN d3_departments d ON d.id = e.department_id;

create view public.view_employee_certifications with (security_invoker=true) as
 SELECT id,
    employee_id,
    title,
    issuing_organization,
    issue_date,
    expiry_date,
    credential_id,
    created_at,
        CASE
            WHEN expiry_date IS NULL THEN 'VALID'::text
            WHEN expiry_date < CURRENT_DATE THEN 'EXPIRED'::text
            WHEN expiry_date <= (CURRENT_DATE + '60 days'::interval) THEN 'EXPIRING'::text
            ELSE 'VALID'::text
        END AS status,
    document_url
   FROM d3_employee_certifications ec;

commit;
