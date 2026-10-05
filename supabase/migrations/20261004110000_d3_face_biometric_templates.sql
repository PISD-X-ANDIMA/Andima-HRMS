-- D3 biometric enrollment and attendance events.
-- Additive only: no existing shared table is changed.

create table if not exists public.d3_face_biometric_templates (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.d3_employee(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  embedding_model text not null check (char_length(trim(embedding_model)) between 3 and 120),
  embedding_version integer not null default 1 check (embedding_version >= 1),
  descriptors jsonb not null check (
    jsonb_typeof(descriptors) = 'array'
    and jsonb_array_length(descriptors) between 5 and 30
  ),
  enrollment_quality jsonb not null default '{}'::jsonb,
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.d3_face_biometric_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.d3_employee(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('CLOCK_IN', 'CLOCK_OUT')),
  similarity numeric(5,4) not null check (similarity >= -1 and similarity <= 1),
  liveness_score numeric(5,4),
  anti_spoof_score numeric(5,4),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists d3_face_biometric_events_employee_verified_idx
  on public.d3_face_biometric_events (employee_id, verified_at desc);

alter table public.d3_face_biometric_templates enable row level security;
alter table public.d3_face_biometric_events enable row level security;

revoke all on public.d3_face_biometric_templates from anon;
revoke all on public.d3_face_biometric_events from anon;
grant select, insert, update on public.d3_face_biometric_templates to authenticated;
grant select, insert on public.d3_face_biometric_events to authenticated;

create policy "D3 users read their own biometric template"
on public.d3_face_biometric_templates for select to authenticated
using (auth_user_id = (select auth.uid()));

create policy "D3 users enroll only their mapped biometric template"
on public.d3_face_biometric_templates for insert to authenticated
with check (
  auth_user_id = (select auth.uid())
  and employee_id = (
    select access.employee_id
    from public.d3_user_access access
    where access.auth_user_id = (select auth.uid())
  )
);

create policy "D3 users update only their mapped biometric template"
on public.d3_face_biometric_templates for update to authenticated
using (auth_user_id = (select auth.uid()))
with check (
  auth_user_id = (select auth.uid())
  and employee_id = (
    select access.employee_id
    from public.d3_user_access access
    where access.auth_user_id = (select auth.uid())
  )
);

create policy "D3 users read allowed biometric attendance events"
on public.d3_face_biometric_events for select to authenticated
using (
  auth_user_id = (select auth.uid())
  or exists (
    select 1
    from public.d3_user_access access
    where access.auth_user_id = (select auth.uid())
      and access.app_role in ('HR', 'MANAGER')
  )
);

create policy "D3 users insert only their own mapped biometric event"
on public.d3_face_biometric_events for insert to authenticated
with check (
  auth_user_id = (select auth.uid())
  and employee_id = (
    select access.employee_id
    from public.d3_user_access access
    where access.auth_user_id = (select auth.uid())
  )
);
