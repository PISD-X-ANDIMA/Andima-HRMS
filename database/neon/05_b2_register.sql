-- 05_b2_register.sql: bagian D3 yang membaca tabel MID public.b2_register (sudah ada di Neon)
-- Jalankan setelah 01-04. Tidak butuh login Supabase dan TIDAK mengubah tabel MID: fungsi di sini hanya membaca b2_register
-- dan menulis ke tabel D3 sendiri.
-- Isi: 7 fungsi sinkron pegawai dari b2_register, 3 trigger di tabel D3.
-- Sinkron manual pegawai baru dari MID (tanpa trigger di tabel MID): select private.d3_reconcile_b2_employee_sources();

begin;
set search_path = public;

CREATE OR REPLACE FUNCTION private.d3_sync_employee_from_b2(p_b2_register_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_b2_id uuid; v_employee_code text; v_full_name text; v_email text; v_phone text; v_position_id uuid; v_department_id uuid; v_employment_status text; v_created_at timestamptz; v_is_active boolean; v_employee_id uuid; v_candidate_count integer; v_link_kind text; v_status text;
begin
  select register.id, register.employee_id, register.full_name, register.email, register.phone, register.position_id, register.departement_id, register.employment_status, register.created_at, register.is_active into v_b2_id, v_employee_code, v_full_name, v_email, v_phone, v_position_id, v_department_id, v_employment_status, v_created_at, v_is_active from public.b2_register register where register.id = p_b2_register_id;
  if not found or v_is_active is not true or exists (select 1 from public.d3_b2_employee_sources source where source.b2_register_id = v_b2_id) then return; end if;
  if nullif(btrim(v_employee_code), '') is null or nullif(btrim(v_full_name), '') is null or nullif(btrim(v_email), '') is null or v_position_id is null or v_department_id is null or v_created_at is null then
    insert into public.d3_employee_sync_events (b2_register_id,event_kind,message) values (v_b2_id,'WAITING_MASTER','Registrasi B2 aktif belum memiliki data employee yang lengkap.') on conflict (b2_register_id,event_kind) do update set message=excluded.message; return;
  end if;
  if not exists (select 1 from public.d3_departments department where department.id=v_department_id) or not exists (select 1 from public.d3_positions position where position.id=v_position_id and position.department_id=v_department_id) then
    insert into public.d3_employee_sync_events (b2_register_id,event_kind,message) values (v_b2_id,'WAITING_MASTER','Menunggu mapping Department dan Position D3 yang valid.') on conflict (b2_register_id,event_kind) do update set message=excluded.message; return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('d3:b2:employee:' || lower(btrim(v_employee_code))));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('d3:b2:email:' || lower(btrim(v_email))));
  select count(*) into v_candidate_count from public.d3_employee employee where lower(btrim(employee.employee_id))=lower(btrim(v_employee_code)) or lower(btrim(employee.email))=lower(btrim(v_email));
  if v_candidate_count>1 then insert into public.d3_employee_sync_events (b2_register_id,event_kind,message) values (v_b2_id,'AMBIGUOUS_IDENTIFIER','Employee ID atau email B2 cocok dengan lebih dari satu employee D3.') on conflict (b2_register_id,event_kind) do update set message=excluded.message; return; end if;
  if v_candidate_count=1 then
    select employee.id into v_employee_id from public.d3_employee employee where lower(btrim(employee.employee_id))=lower(btrim(v_employee_code)) or lower(btrim(employee.email))=lower(btrim(v_email)) limit 1;
    if exists (select 1 from public.d3_b2_employee_sources source where source.employee_id=v_employee_id) then
      update public.d3_employee_sync_events set event_kind='AMBIGUOUS_IDENTIFIER',employee_id=v_employee_id,message='Employee D3 yang cocok sudah terhubung ke registrasi B2 lain; tidak dibuat duplikasi.' where b2_register_id=v_b2_id and event_kind='MATCHED';
      insert into public.d3_employee_sync_events (b2_register_id,employee_id,event_kind,message) values (v_b2_id,v_employee_id,'AMBIGUOUS_IDENTIFIER','Employee D3 yang cocok sudah terhubung ke registrasi B2 lain; tidak dibuat duplikasi.') on conflict (b2_register_id,event_kind) do update set employee_id=excluded.employee_id,message=excluded.message; return;
    end if;
    v_link_kind:='MATCHED';
  else
    v_status:=upper(btrim(coalesce(v_employment_status,''))); if v_status not in ('PERMANENT','CONTRACT','PROBATION','INTERN','RESIGNED','TERMINATED') then v_status:='PROBATION'; end if;
    insert into public.d3_employee (employee_id,full_name,email,phone,position_id,department_id,employment_status,join_date,work_location) values (btrim(v_employee_code),btrim(v_full_name),lower(btrim(v_email)),nullif(btrim(v_phone),''),v_position_id,v_department_id,v_status,v_created_at::date,'HQ') returning id into v_employee_id;
    v_link_kind:='CREATED';
  end if;
  insert into public.d3_b2_employee_sources (b2_register_id,employee_id,link_kind) values (v_b2_id,v_employee_id,v_link_kind);
  insert into public.d3_employee_sync_events (b2_register_id,employee_id,event_kind,message) values (v_b2_id,v_employee_id,v_link_kind,case when v_link_kind='CREATED' then 'Employee baru dibuat otomatis dari registrasi B2 aktif.' else 'Employee D3 yang sudah ada berhasil dikaitkan ke registrasi B2 aktif.' end) on conflict (b2_register_id,event_kind) do update set employee_id=excluded.employee_id,message=excluded.message;
exception when unique_violation then
  insert into public.d3_employee_sync_events (b2_register_id,event_kind,message) values (v_b2_id,'AMBIGUOUS_IDENTIFIER','Identitas B2 tidak dapat dikaitkan secara aman ke employee D3.') on conflict (b2_register_id,event_kind) do update set message=excluded.message;
when others then
  insert into public.d3_employee_sync_events (b2_register_id,event_kind,message) values (v_b2_id,'SYNC_ERROR','Sinkronisasi employee B2 gagal diproses dengan aman.') on conflict (b2_register_id,event_kind) do update set message=excluded.message;
end;
$function$;

CREATE OR REPLACE FUNCTION private.d3_reconcile_b2_employee_sources()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_b2_register_id uuid;
begin
  for v_b2_register_id in
    select register.id
    from public.b2_register register
    where register.is_active is true
      and nullif(btrim(register.employee_id), '') is not null
      and nullif(btrim(register.full_name), '') is not null
      and nullif(btrim(register.email), '') is not null
      and register.position_id is not null
      and register.departement_id is not null
      and register.created_at is not null
      and not exists (select 1 from public.d3_b2_employee_sources source where source.b2_register_id = register.id)
  loop
    perform private.d3_sync_employee_from_b2(v_b2_register_id);
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION private.d3_reconcile_b2_employee_sources_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  perform private.d3_reconcile_b2_employee_sources();
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.d3_reject_b2_employee_id_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Jika employee_id tidak berubah, biarkan
  IF NEW.employee_id IS NOT DISTINCT FROM OLD.employee_id THEN
    RETURN NEW;
  END IF;

  -- Izinkan employee_id berubah jika position_id juga berubah
  IF NEW.position_id IS DISTINCT FROM OLD.position_id THEN
    RETURN NEW;
  END IF;

  -- Selain itu (ubah employee_id manual tanpa ganti posisi), tetap tolak
  RAISE EXCEPTION 'Employee ID is immutable after registration' USING ERRCODE = '22023';
END;
$function$;

CREATE OR REPLACE FUNCTION private.d3_sync_access_from_b2(p_b2_register_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_auth_user_id uuid; v_employee_id uuid; v_role public.d3_app_role;
begin
  select register.auth_user_id, source.employee_id, register.app_role
  into v_auth_user_id, v_employee_id, v_role
  from public.b2_register register
  join public.d3_b2_employee_sources source on source.b2_register_id = register.id
  where register.id = p_b2_register_id and register.is_active is true;
  if found and v_auth_user_id is not null then
    insert into public.d3_user_access (auth_user_id, employee_id, app_role)
    values (v_auth_user_id, v_employee_id, v_role)
    on conflict (auth_user_id) do update
      set employee_id = excluded.employee_id, app_role = excluded.app_role, updated_at = now();
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION private.d3_sync_access_from_source_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  perform private.d3_sync_access_from_b2(new.b2_register_id);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.d3_sync_employee_from_b2_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  begin
    perform private.d3_sync_employee_from_b2(new.id);
  exception when others then
    insert into public.d3_employee_sync_events (b2_register_id, event_kind, message)
    values (new.id, 'SYNC_ERROR', 'Sinkronisasi B2 gagal: ' || sqlerrm)
    on conflict (b2_register_id, event_kind) do nothing;
    raise warning 'D3 B2 employee sync skipped registration %: %', new.id, sqlerrm;
  end;
  return new;
end;
$function$;

CREATE TRIGGER d3_sync_access_after_b2_source_link AFTER INSERT ON public.d3_b2_employee_sources FOR EACH ROW EXECUTE FUNCTION private.d3_sync_access_from_source_trigger();
CREATE TRIGGER d3_reconcile_b2_employee_sources_after_department_change AFTER INSERT OR UPDATE ON public.d3_departments FOR EACH STATEMENT EXECUTE FUNCTION private.d3_reconcile_b2_employee_sources_trigger();
CREATE TRIGGER d3_reconcile_b2_employee_sources_after_position_change AFTER INSERT OR UPDATE OF department_id ON public.d3_positions FOR EACH STATEMENT EXECUTE FUNCTION private.d3_reconcile_b2_employee_sources_trigger();

commit;
