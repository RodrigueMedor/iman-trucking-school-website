-- The super administrator is info@imanlogistics.com, and only that account
-- may hold the super_admin role.
--
-- 1. The super-admin email moves from rodriguemedor@yahoo.fr to
--    info@imanlogistics.com.
-- 2. app_metadata can no longer grant super_admin; only the email does.
-- 3. A guard on profiles rejects super_admin for any other account, whoever
--    writes the row (including the service role).
-- 4. Existing super_admin profiles for other accounts are demoted and
--    deactivated; the info@imanlogistics.com profile, if it exists, is promoted.

create or replace function public.iman_super_admin_email()
returns text
language sql
immutable
as $$ select 'info@imanlogistics.com'::text $$;

create or replace function public.iman_role_for_user(user_email text, app_metadata jsonb, user_metadata jsonb)
returns text
language sql
stable
as $$
  select case
    when lower(coalesce(user_email, '')) = public.iman_super_admin_email() then 'super_admin'
    when app_metadata ->> 'role' in ('admin', 'instructor', 'student') then app_metadata ->> 'role'
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
  authoritative boolean;
  verified boolean;
begin
  assigned_role := public.iman_role_for_user(new.email, new.raw_app_meta_data, new.raw_user_meta_data);
  authoritative := lower(coalesce(new.email, '')) = public.iman_super_admin_email()
    or (new.raw_app_meta_data ->> 'role') in ('super_admin', 'admin', 'instructor', 'student');
  verified := new.email_confirmed_at is not null;

  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'User'), '@', 1)),
    assigned_role,
    case when assigned_role in ('student', 'super_admin') then verified else true end
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    -- A super admin whose email changes loses the role.
    role = case
      when authoritative or public.profiles.role = 'super_admin' then excluded.role
      else public.profiles.role
    end,
    active = case
      when public.profiles.role in ('student', 'super_admin') and verified then true
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

-- Demote every other super_admin before the guard is installed.
update public.cdl_users c
set role = 'student', updated_at = now()
from public.profiles p, auth.users u
where c.id = p.id and p.id = u.id
  and p.role = 'super_admin'
  and lower(coalesce(u.email, '')) <> public.iman_super_admin_email();

update public.profiles p
set role = 'student', active = false
from auth.users u
where p.id = u.id
  and p.role = 'super_admin'
  and lower(coalesce(u.email, '')) <> public.iman_super_admin_email();

update public.profiles p
set role = 'super_admin', active = u.email_confirmed_at is not null
from auth.users u
where p.id = u.id
  and lower(coalesce(u.email, '')) = public.iman_super_admin_email();

update public.cdl_users c
set role = 'admin', updated_at = now()
from auth.users u
where c.id = u.id
  and lower(coalesce(u.email, '')) = public.iman_super_admin_email();

create or replace function public.profiles_super_admin_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'super_admin' and not exists (
    select 1 from auth.users
    where id = new.id and lower(coalesce(email, '')) = public.iman_super_admin_email()
  ) then
    raise exception 'only % may be super_admin', public.iman_super_admin_email() using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_super_admin_guard on public.profiles;
create trigger profiles_super_admin_guard
before insert or update on public.profiles
for each row execute procedure public.profiles_super_admin_guard();

notify pgrst, 'reload schema';
