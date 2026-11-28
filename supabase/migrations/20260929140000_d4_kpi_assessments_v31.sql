-- KPI assessments use the five indicators and weights supplied in the V3.1 workbook.
-- A new row records each revision so prior evaluations remain available.
create table public.d4_kpi_assessments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.d3_employee(id),
  role_order integer not null check (role_order between 1 and 10),
  role_name text not null,
  period varchar(7) not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  evaluation_date date,
  evaluator_name text not null default '',
  status varchar(16) not null check (status in ('draft', 'completed')),
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) = 5),
  overall_score numeric(3,2) check (overall_score between 1 and 5),
  general_notes text not null default '',
  actor_auth_user_id uuid not null default auth.uid() references auth.users(id),
  actor_employee_id uuid not null default public.d3_current_employee_uuid() references public.d3_employee(id),
  created_at timestamptz not null default now(),
  check (status <> 'completed' or (evaluation_date is not null and length(btrim(evaluator_name)) > 0 and overall_score is not null))
);
create index d4_kpi_assessments_employee_period_idx on public.d4_kpi_assessments(employee_id, period, created_at desc);

create function public.d4_calculate_kpi_assessment() returns trigger
language plpgsql set search_path = public as $$
declare
  role_title text;
  indicator_count integer;
  total_weight integer;
  template_name text;
  template_weight integer;
  line jsonb;
  raw_score integer;
  weighted_total numeric := 0;
  all_scored boolean := true;
  item integer;
begin
  select min(role_name), count(*), sum(weight_percent)
    into role_title, indicator_count, total_weight
    from public.d4_kpi_role_catalog where role_order = new.role_order;
  if indicator_count <> 5 or total_weight <> 100 or new.role_name is distinct from role_title then
    raise exception 'Jabatan KPI dan total bobot harus sesuai katalog V3.1';
  end if;

  for item in 1..5 loop
    select kpi_name, weight_percent into template_name, template_weight
      from public.d4_kpi_role_catalog
      where role_order = new.role_order and indicator_order = item;
    line := new.lines -> (item - 1);
    if line->>'indicator_order' is distinct from item::text
       or line->>'kpi_name' is distinct from template_name
       or line->>'weight_percent' is distinct from template_weight::text then
      raise exception 'Indikator % harus sesuai katalog KPI V3.1', item;
    end if;
    if line->>'raw_score' is null or line->>'raw_score' = '' then
      all_scored := false;
    else
      raw_score := (line->>'raw_score')::integer;
      if raw_score < 1 or raw_score > 5 then
        raise exception 'Skor indikator % harus antara 1 dan 5', item;
      end if;
      weighted_total := weighted_total + template_weight * raw_score / 100.0;
    end if;
  end loop;

  if new.status = 'completed' and not all_scored then
    raise exception 'Seluruh lima indikator harus dinilai sebelum diselesaikan';
  end if;
  new.overall_score := case when all_scored then round(weighted_total, 2) else null end;
  return new;
end;
$$;
create trigger d4_kpi_assessments_calculate before insert on public.d4_kpi_assessments
  for each row execute function public.d4_calculate_kpi_assessment();

revoke all on public.d4_kpi_assessments from anon, authenticated;
grant select, insert on public.d4_kpi_assessments to authenticated;
alter table public.d4_kpi_assessments enable row level security;
create policy "D4 KPI assessment read permitted employee" on public.d4_kpi_assessments
  for select to authenticated using (
    public.d3_current_role() in ('HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role)
    or employee_id = public.d3_current_employee_uuid()
  );
create policy "D4 KPI assessment insert HR manager" on public.d4_kpi_assessments
  for insert to authenticated with check (
    public.d3_current_role() in ('HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role)
    and actor_auth_user_id = auth.uid()
    and actor_employee_id = public.d3_current_employee_uuid()
  );
