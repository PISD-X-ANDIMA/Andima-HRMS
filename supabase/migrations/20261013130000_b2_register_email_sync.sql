-- Login (Supabase Auth) must follow b2_register. Passwords already sync via trigger_sync_password;
-- emails did not, so an account whose b2_register email changed could no longer sign in.
create or replace function public.sync_register_email_to_auth() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update auth.users set email = lower(new.email), updated_at = now() where id = new.id;
    update auth.identities
      set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(lower(new.email))), updated_at = now()
      where user_id = new.id and provider = 'email';
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_sync_email on public.b2_register;
create trigger trigger_sync_email after update of email on public.b2_register
  for each row execute function public.sync_register_email_to_auth();

-- One-time catch-up for accounts already out of sync.
update auth.users u set email = lower(r.email), updated_at = now()
  from public.b2_register r
  where r.id = u.id and r.email is not null and lower(r.email) <> lower(u.email)
    and not exists (select 1 from auth.users x where lower(x.email) = lower(r.email) and x.id <> r.id);
update auth.identities i set identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(lower(r.email))), updated_at = now()
  from public.b2_register r
  where r.id = i.user_id and i.provider = 'email' and r.email is not null
    and lower(r.email) <> lower(coalesce(i.identity_data->>'email', ''));
