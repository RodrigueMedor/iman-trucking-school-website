-- Student profiles stay inactive until Supabase Auth confirms ownership of the
-- email address. Staff created by the privileged admin API are email-confirmed
-- at creation and retain their explicitly assigned active state.
create or replace function public.handle_iman_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
  authoritative boolean;
  verified boolean;
begin
  assigned_role := public.iman_role_for_user(new.email, new.raw_app_meta_data, new.raw_user_meta_data);
  authoritative := lower(coalesce(new.email, '')) = 'rodriguemedor@yahoo.fr'
    or (new.raw_app_meta_data ->> 'role') in ('super_admin', 'admin', 'instructor', 'student');
  verified := new.email_confirmed_at is not null;

  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'User'), '@', 1)),
    assigned_role,
    case when assigned_role = 'student' then verified else true end
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = case when authoritative then excluded.role else public.profiles.role end,
    active = case
      when public.profiles.role = 'student' and verified then true
      else public.profiles.active
    end;

  insert into public.cdl_users (id, role, email)
  values (new.id, case when assigned_role in ('super_admin', 'admin') then 'admin' else assigned_role end, new.email)
  on conflict (id) do update set
    role = case when authoritative then excluded.role else public.cdl_users.role end,
    email = excluded.email,
    updated_at = now();

  if assigned_role = 'student' then
    insert into public.cdl_students (user_id, first_name, last_name, email)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'first_name', split_part(coalesce(new.email, 'Student'), '@', 1)),
      coalesce(new.raw_user_meta_data ->> 'last_name', ''),
      new.email
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
after insert or update of email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data on auth.users
for each row execute procedure public.handle_iman_auth_user();

-- Correct pre-existing unverified student profiles without changing staff or
-- deliberately deactivated verified accounts.
update public.profiles p
set active = false
from auth.users u
where p.id = u.id
  and p.role = 'student'
  and u.email_confirmed_at is null;

notify pgrst, 'reload schema';
