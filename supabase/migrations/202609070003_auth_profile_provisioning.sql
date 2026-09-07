create or replace function public.iman_role_for_user(user_email text, app_metadata jsonb, user_metadata jsonb)
returns text
language sql
stable
as $$
  select case
    when lower(coalesce(user_email, '')) = 'rodriguemedor@yahoo.fr' then 'super_admin'
    when coalesce(app_metadata ->> 'role', user_metadata ->> 'role') in ('super_admin', 'admin', 'instructor', 'student')
      then coalesce(app_metadata ->> 'role', user_metadata ->> 'role')
    else 'student'
  end
$$;

create or replace function public.handle_iman_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
begin
  assigned_role := public.iman_role_for_user(new.email, new.raw_app_meta_data, new.raw_user_meta_data);

  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'User'), '@', 1)),
    assigned_role,
    true
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role,
    active = true;

  insert into public.cdl_users (id, role, email)
  values (new.id, case when assigned_role in ('super_admin', 'admin') then 'admin' else assigned_role end, new.email)
  on conflict (id) do update set role = excluded.role, email = excluded.email, updated_at = now();

  if assigned_role = 'student' then
    insert into public.cdl_students (user_id, first_name, last_name)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'first_name', split_part(coalesce(new.email, 'Student'), '@', 1)),
      coalesce(new.raw_user_meta_data ->> 'last_name', '')
    )
    on conflict (user_id) do nothing;
  elsif assigned_role = 'instructor' then
    insert into public.cdl_instructors (user_id, display_name, active)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'Instructor'), '@', 1)), true)
    on conflict (user_id) do update set active = true;
  end if;

  return new;
end;
$$;

drop trigger if exists on_iman_auth_user_created on auth.users;
create trigger on_iman_auth_user_created
after insert or update of email, raw_app_meta_data, raw_user_meta_data on auth.users
for each row execute procedure public.handle_iman_auth_user();

-- Provision users that were created in the Dashboard before this trigger existed.
insert into public.profiles (id, full_name, role, active)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', split_part(coalesce(email, 'User'), '@', 1)),
  public.iman_role_for_user(email, raw_app_meta_data, raw_user_meta_data),
  true
from auth.users
on conflict (id) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  active = true;

insert into public.cdl_users (id, role, email)
select
  id,
  case when public.iman_role_for_user(email, raw_app_meta_data, raw_user_meta_data) in ('super_admin', 'admin') then 'admin'
       else public.iman_role_for_user(email, raw_app_meta_data, raw_user_meta_data) end,
  email
from auth.users
where email is not null
on conflict (id) do update set role = excluded.role, email = excluded.email, updated_at = now();

