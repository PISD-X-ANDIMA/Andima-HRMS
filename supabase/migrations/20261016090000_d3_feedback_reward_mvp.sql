-- D3-004 Feedback & Reward MVP (additive only)
-- Does not alter the legacy feedback_rewards table.

create schema if not exists private;

alter table public.d3_employee_feedback
  add column if not exists title text,
  add column if not exists feedback_type text,
  add column if not exists category text,
  add column if not exists follow_up_text text,
  add column if not exists target_date date,
  add column if not exists follow_up_status text,
  add column if not exists progress_note text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.d3_employee_rewards
  add column if not exists reward_type text,
  add column if not exists title text,
  add column if not exists reason text,
  add column if not exists proposed_by uuid references public.d3_employee(id) on delete set null,
  add column if not exists status text,
  add column if not exists visibility text,
  add column if not exists approval_reason text,
  add column if not exists approved_by uuid references public.d3_employee(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists evidence_path text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists is_legacy boolean not null default false;

update public.d3_employee_feedback
set title = coalesce(nullif(title, ''), 'Catatan Kinerja'),
    feedback_type = coalesce(nullif(feedback_type, ''), 'PERFORMANCE_NOTE'),
    category = coalesce(nullif(category, ''), 'OTHER'),
    follow_up_status = coalesce(nullif(follow_up_status, ''), 'COMPLETED'),
    updated_at = coalesce(updated_at, created_at);

update public.d3_employee_rewards
set title = coalesce(nullif(title, ''), reward_name),
    reason = coalesce(nullif(reason, ''), description),
    reward_type = coalesce(nullif(reward_type, ''), 'OTHER'),
    status = coalesce(nullif(status, ''), 'APPROVED'),
    visibility = coalesce(nullif(visibility, ''), 'PRIVATE'),
    is_legacy = true,
    updated_at = coalesce(updated_at, created_at);

alter table public.d3_employee_feedback alter column title set not null;
alter table public.d3_employee_feedback alter column feedback_type set not null;
alter table public.d3_employee_feedback alter column category set not null;
alter table public.d3_employee_feedback alter column follow_up_status set not null;
alter table public.d3_employee_rewards alter column title set not null;
alter table public.d3_employee_rewards alter column reason set not null;
alter table public.d3_employee_rewards alter column reward_type set not null;
alter table public.d3_employee_rewards alter column status set not null;
alter table public.d3_employee_rewards alter column visibility set not null;

do $$ begin
  alter table public.d3_employee_feedback drop constraint if exists d3_employee_feedback_type_check;
  alter table public.d3_employee_feedback add constraint d3_employee_feedback_type_check check (feedback_type in ('APPRECIATION','IMPROVEMENT','PERFORMANCE_NOTE'));
  alter table public.d3_employee_feedback drop constraint if exists d3_employee_feedback_category_check;
  alter table public.d3_employee_feedback add constraint d3_employee_feedback_category_check check (category in ('DISCIPLINE','TEAMWORK','COMMUNICATION','WORKPLACE_SAFETY','QUALITY','SERVICE','OTHER'));
  alter table public.d3_employee_feedback drop constraint if exists d3_employee_feedback_follow_up_status_check;
  alter table public.d3_employee_feedback add constraint d3_employee_feedback_follow_up_status_check check (follow_up_status in ('NEW','READ','IN_PROGRESS','COMPLETED'));
  alter table public.d3_employee_rewards drop constraint if exists d3_employee_rewards_type_check;
  alter table public.d3_employee_rewards add constraint d3_employee_rewards_type_check check (reward_type in ('EMPLOYEE_OF_THE_MONTH','SAFETY_CHAMPION','SERVICE_EXCELLENCE','BEST_ATTENDANCE','SPECIAL_CONTRIBUTION','OTHER'));
  alter table public.d3_employee_rewards drop constraint if exists d3_employee_rewards_status_check;
  alter table public.d3_employee_rewards add constraint d3_employee_rewards_status_check check (status in ('SUBMITTED','APPROVED','PUBLISHED','REJECTED'));
  alter table public.d3_employee_rewards drop constraint if exists d3_employee_rewards_visibility_check;
  alter table public.d3_employee_rewards add constraint d3_employee_rewards_visibility_check check (visibility in ('PRIVATE','PUBLIC'));
  alter table public.d3_feedback_reward_audit_log drop constraint if exists d3_feedback_reward_audit_log_action_check;
  alter table public.d3_feedback_reward_audit_log add constraint d3_feedback_reward_audit_log_action_check check (action in ('CREATE','UPDATE','STATUS_CHANGE','SUBMIT','APPROVE','REJECT','PUBLISH'));
exception when duplicate_object then null;
end $$;

alter table public.d3_feedback_reward_audit_log
  add column if not exists before_data jsonb,
  add column if not exists after_data jsonb,
  add column if not exists reason text;

create table if not exists public.d3_feedback_reward_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_employee_id uuid not null references public.d3_employee(id) on delete cascade,
  entity_type text not null check (entity_type in ('FEEDBACK','REWARD')),
  entity_id bigint not null,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists d3_feedback_notifications_recipient_idx on public.d3_feedback_reward_notifications (recipient_employee_id, created_at desc);
create index if not exists d3_feedback_notifications_unread_idx on public.d3_feedback_reward_notifications (recipient_employee_id) where read_at is null;
create index if not exists d3_feedback_employee_filter_idx on public.d3_employee_feedback (employee_id, date desc, follow_up_status);
create index if not exists d3_reward_employee_filter_idx on public.d3_employee_rewards (employee_id, date desc, status, reward_type);

create or replace function private.d3_feedback_role()
returns text language sql stable security definer set search_path = pg_catalog, public
as $$ select dua.app_role::text from public.d3_user_access dua where dua.auth_user_id = auth.uid() limit 1 $$;

create or replace function private.d3_feedback_employee_uuid()
returns uuid language sql stable security definer set search_path = pg_catalog, public
as $$ select dua.employee_id from public.d3_user_access dua where dua.auth_user_id = auth.uid() limit 1 $$;

create or replace function private.d3_feedback_is_subordinate(target_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$ select exists (select 1 from public.d3_employee_reporting r where r.manager_employee_id = private.d3_feedback_employee_uuid() and r.subordinate_employee_id = target_id and r.is_active = true and r.effective_from <= current_date and (r.effective_to is null or r.effective_to >= current_date)) $$;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke all on function private.d3_feedback_role() from public, anon;
revoke all on function private.d3_feedback_employee_uuid() from public, anon;
revoke all on function private.d3_feedback_is_subordinate(uuid) from public, anon;
grant execute on function private.d3_feedback_role() to authenticated;
grant execute on function private.d3_feedback_employee_uuid() to authenticated;
grant execute on function private.d3_feedback_is_subordinate(uuid) to authenticated;

alter table public.d3_employee_feedback enable row level security;
alter table public.d3_employee_rewards enable row level security;
alter table public.d3_feedback_reward_audit_log enable row level security;
alter table public.d3_feedback_reward_notifications enable row level security;

drop policy if exists "D3 HR creates employee feedback" on public.d3_employee_feedback;
drop policy if exists "D3 employee reads own feedback" on public.d3_employee_feedback;
drop policy if exists "D3 manager creates subordinate feedback" on public.d3_employee_feedback;
drop policy if exists "D3 HR reads all employee feedback" on public.d3_employee_feedback;
drop policy if exists "D3 manager reads subordinate feedback" on public.d3_employee_feedback;
drop policy if exists "D3 HR creates employee rewards" on public.d3_employee_rewards;
drop policy if exists "D3 HR reads all employee rewards" on public.d3_employee_rewards;
drop policy if exists "D3 employee reads own rewards" on public.d3_employee_rewards;
drop policy if exists "D3 manager creates subordinate rewards" on public.d3_employee_rewards;
drop policy if exists "D3 manager reads subordinate rewards" on public.d3_employee_rewards;

create policy d3_feedback_select_hr on public.d3_employee_feedback for select to authenticated using (private.d3_feedback_role() = 'HR');
create policy d3_feedback_select_manager on public.d3_employee_feedback for select to authenticated using (private.d3_feedback_role() = 'MANAGER' and private.d3_feedback_is_subordinate(employee_id));
create policy d3_feedback_select_employee on public.d3_employee_feedback for select to authenticated using (private.d3_feedback_role() = 'EMPLOYEE' and employee_id = private.d3_feedback_employee_uuid());
create policy d3_feedback_insert_hr on public.d3_employee_feedback for insert to authenticated with check (private.d3_feedback_role() = 'HR' and given_by = private.d3_feedback_employee_uuid());
create policy d3_feedback_insert_manager on public.d3_employee_feedback for insert to authenticated with check (private.d3_feedback_role() = 'MANAGER' and private.d3_feedback_is_subordinate(employee_id) and given_by = private.d3_feedback_employee_uuid());
create policy d3_feedback_update_hr on public.d3_employee_feedback for update to authenticated using (private.d3_feedback_role() = 'HR') with check (private.d3_feedback_role() = 'HR');
create policy d3_feedback_update_manager on public.d3_employee_feedback for update to authenticated using (private.d3_feedback_role() = 'MANAGER' and private.d3_feedback_is_subordinate(employee_id)) with check (private.d3_feedback_role() = 'MANAGER' and private.d3_feedback_is_subordinate(employee_id));
create policy d3_feedback_update_employee on public.d3_employee_feedback for update to authenticated using (private.d3_feedback_role() = 'EMPLOYEE' and employee_id = private.d3_feedback_employee_uuid()) with check (private.d3_feedback_role() = 'EMPLOYEE' and employee_id = private.d3_feedback_employee_uuid());

create policy d3_reward_select_hr on public.d3_employee_rewards for select to authenticated using (private.d3_feedback_role() = 'HR');
create policy d3_reward_select_manager on public.d3_employee_rewards for select to authenticated using (private.d3_feedback_role() = 'MANAGER' and private.d3_feedback_is_subordinate(employee_id));
create policy d3_reward_select_employee on public.d3_employee_rewards for select to authenticated using (private.d3_feedback_role() = 'EMPLOYEE' and employee_id = private.d3_feedback_employee_uuid() and (visibility = 'PRIVATE' or status = 'PUBLISHED'));
create policy d3_reward_insert_hr on public.d3_employee_rewards for insert to authenticated with check (private.d3_feedback_role() = 'HR' and proposed_by = private.d3_feedback_employee_uuid());
create policy d3_reward_insert_manager on public.d3_employee_rewards for insert to authenticated with check (private.d3_feedback_role() = 'MANAGER' and private.d3_feedback_is_subordinate(employee_id) and proposed_by = private.d3_feedback_employee_uuid());
create policy d3_reward_update_hr on public.d3_employee_rewards for update to authenticated using (private.d3_feedback_role() = 'HR') with check (private.d3_feedback_role() = 'HR');

create policy d3_feedback_audit_read_hr on public.d3_feedback_reward_audit_log for select to authenticated using (private.d3_feedback_role() = 'HR');
create policy d3_feedback_audit_read_manager on public.d3_feedback_reward_audit_log for select to authenticated using (private.d3_feedback_role() = 'MANAGER' and private.d3_feedback_is_subordinate(target_employee_id));
create policy d3_notification_read_own on public.d3_feedback_reward_notifications for select to authenticated using (recipient_employee_id = private.d3_feedback_employee_uuid());
create policy d3_notification_update_own on public.d3_feedback_reward_notifications for update to authenticated using (recipient_employee_id = private.d3_feedback_employee_uuid()) with check (recipient_employee_id = private.d3_feedback_employee_uuid());

grant select, insert, update on public.d3_employee_feedback, public.d3_employee_rewards to authenticated;
grant select on public.d3_feedback_reward_audit_log to authenticated;
grant select, update on public.d3_feedback_reward_notifications to authenticated;

create or replace function private.d3_feedback_audit_and_notify()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
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
end $$;

create or replace function private.d3_feedback_guard_employee_update()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
declare role_name text := private.d3_feedback_role();
begin
  if role_name = 'EMPLOYEE' then
    if old.employee_id is distinct from new.employee_id or old.given_by is distinct from new.given_by or old.date is distinct from new.date or old.title is distinct from new.title or old.feedback_type is distinct from new.feedback_type or old.category is distinct from new.category or old.feedback_text is distinct from new.feedback_text or old.follow_up_text is distinct from new.follow_up_text or old.target_date is distinct from new.target_date then
      raise exception 'Employee may only update feedback progress';
    end if;
    if old.follow_up_status = 'NEW' and new.follow_up_status not in ('NEW','READ') then
      raise exception 'Invalid employee feedback status transition';
    end if;
    if old.follow_up_status = 'READ' and new.follow_up_status not in ('READ','IN_PROGRESS') then
      raise exception 'Invalid employee feedback status transition';
    end if;
    if old.follow_up_status in ('IN_PROGRESS','COMPLETED') and new.follow_up_status is distinct from old.follow_up_status then
      raise exception 'Employee cannot complete or reopen feedback';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists d3_employee_feedback_create_audit on public.d3_employee_feedback;
drop trigger if exists d3_employee_rewards_create_audit on public.d3_employee_rewards;
create trigger d3_employee_feedback_audit after insert or update on public.d3_employee_feedback for each row execute function private.d3_feedback_audit_and_notify();
create trigger d3_employee_rewards_audit after insert or update on public.d3_employee_rewards for each row execute function private.d3_feedback_audit_and_notify();
drop trigger if exists d3_employee_feedback_guard_update on public.d3_employee_feedback;
create trigger d3_employee_feedback_guard_update before update on public.d3_employee_feedback for each row execute function private.d3_feedback_guard_employee_update();
