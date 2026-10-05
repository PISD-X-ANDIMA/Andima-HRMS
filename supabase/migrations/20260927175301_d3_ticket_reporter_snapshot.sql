-- D3-005: immutable reporter fields displayed in the ticket workflow.
-- This migration is additive and only derives basic display data from the
-- employee record already mapped to the authenticated D3 account.

alter table public.d3_tickets
  add column if not exists reporter_name text,
  add column if not exists reporter_employee_code text,
  add column if not exists reporter_department text;

create or replace function private.d3_populate_ticket_reporter_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select employee.full_name, employee.employee_id, coalesce(department.name, '-')
    into new.reporter_name, new.reporter_employee_code, new.reporter_department
  from public.d3_user_access access
  join public.employees employee on employee.id = access.employee_id
  left join public.departments department on department.id = employee.department_id
  where access.auth_user_id = auth.uid()
    and access.employee_id = new.employee_id;

  if new.reporter_name is null then
    raise exception 'Authenticated employee mapping is required to create a D3 ticket';
  end if;

  return new;
end;
$$;

revoke all on function private.d3_populate_ticket_reporter_snapshot() from public, anon, authenticated;

drop trigger if exists d3_tickets_reporter_snapshot on public.d3_tickets;
create trigger d3_tickets_reporter_snapshot
before insert on public.d3_tickets
for each row execute function private.d3_populate_ticket_reporter_snapshot();

update public.d3_tickets ticket
set reporter_name = employee.full_name,
    reporter_employee_code = employee.employee_id,
    reporter_department = coalesce(department.name, '-')
from public.employees employee
left join public.departments department on department.id = employee.department_id
where employee.id = ticket.employee_id
  and (ticket.reporter_name is null or ticket.reporter_employee_code is null or ticket.reporter_department is null);
