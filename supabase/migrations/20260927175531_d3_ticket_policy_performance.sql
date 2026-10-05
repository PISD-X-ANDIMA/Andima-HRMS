-- D3-005: retain the existing authorization model while avoiding per-row
-- re-evaluation of the authenticated user identity in RLS policies.

create index if not exists d3_ticket_followups_actor_idx
  on public.d3_ticket_followups (actor_employee_id);
create index if not exists d3_ticket_history_actor_idx
  on public.d3_ticket_history (actor_employee_id);

drop policy if exists "D3 users read their own access mapping" on public.d3_user_access;
create policy "D3 users read their own access mapping"
on public.d3_user_access for select to authenticated
using (auth_user_id = (select auth.uid()));

drop policy if exists "D3 users read allowed tickets" on public.d3_tickets;
create policy "D3 users read allowed tickets"
on public.d3_tickets for select to authenticated
using (exists (select 1 from public.d3_user_access access where access.auth_user_id = (select auth.uid()) and (access.employee_id = d3_tickets.employee_id or access.app_role in ('HR', 'MANAGER'))));

drop policy if exists "Employees create their own tickets" on public.d3_tickets;
create policy "Employees create their own tickets"
on public.d3_tickets for insert to authenticated
with check (exists (select 1 from public.d3_user_access access where access.auth_user_id = (select auth.uid()) and access.employee_id = d3_tickets.employee_id and access.app_role = 'EMPLOYEE'));

drop policy if exists "HR and managers update ticket status" on public.d3_tickets;
create policy "HR and managers update ticket status"
on public.d3_tickets for update to authenticated
using (exists (select 1 from public.d3_user_access access where access.auth_user_id = (select auth.uid()) and access.app_role in ('HR', 'MANAGER')))
with check (exists (select 1 from public.d3_user_access access where access.auth_user_id = (select auth.uid()) and access.app_role in ('HR', 'MANAGER')));

drop policy if exists "D3 users read allowed follow-ups" on public.d3_ticket_followups;
create policy "D3 users read allowed follow-ups"
on public.d3_ticket_followups for select to authenticated
using (exists (select 1 from public.d3_tickets ticket join public.d3_user_access access on access.auth_user_id = (select auth.uid()) where ticket.id = d3_ticket_followups.ticket_id and (ticket.employee_id = access.employee_id or access.app_role in ('HR', 'MANAGER'))));

drop policy if exists "HR and managers add their own follow-ups" on public.d3_ticket_followups;
create policy "HR and managers add their own follow-ups"
on public.d3_ticket_followups for insert to authenticated
with check (actor_employee_id = (select employee_id from public.d3_user_access where auth_user_id = (select auth.uid())) and exists (select 1 from public.d3_user_access access where access.auth_user_id = (select auth.uid()) and access.app_role in ('HR', 'MANAGER')));

drop policy if exists "D3 users read allowed ticket attachments" on public.d3_ticket_attachments;
create policy "D3 users read allowed ticket attachments"
on public.d3_ticket_attachments for select to authenticated
using (exists (select 1 from public.d3_tickets ticket join public.d3_user_access access on access.auth_user_id = (select auth.uid()) where ticket.id = d3_ticket_attachments.ticket_id and (ticket.employee_id = access.employee_id or access.app_role in ('HR', 'MANAGER'))));

drop policy if exists "Allowed users attach files to tickets" on public.d3_ticket_attachments;
create policy "Allowed users attach files to tickets"
on public.d3_ticket_attachments for insert to authenticated
with check (exists (select 1 from public.d3_tickets ticket join public.d3_user_access access on access.auth_user_id = (select auth.uid()) where ticket.id = d3_ticket_attachments.ticket_id and (ticket.employee_id = access.employee_id or access.app_role in ('HR', 'MANAGER'))));

drop policy if exists "D3 users read allowed ticket history" on public.d3_ticket_history;
create policy "D3 users read allowed ticket history"
on public.d3_ticket_history for select to authenticated
using (exists (select 1 from public.d3_tickets ticket join public.d3_user_access access on access.auth_user_id = (select auth.uid()) where ticket.id = d3_ticket_history.ticket_id and (ticket.employee_id = access.employee_id or access.app_role in ('HR', 'MANAGER'))));
