-- New school sign-ups become student accounts in the database right away.
--
-- Production shares this database with the Iman Logistics app, whose sign-up
-- trigger (on_auth_user_created -> handle_new_user, not in this repo) creates
-- every new profile with role 'employee' and runs before the school trigger.
-- The school trigger kept that role, so new school students could only use
-- the portal after the API server repaired the account on first sign-in
-- (POST /api/me/student-account), and saw "Account not set up" wherever the
-- server was unavailable.
--
-- The school sign-up form now sends user metadata
-- signup_source = 'iman_trucking_school'. This redefinition of
-- handle_iman_auth_user (based on 202610070001, which matches production)
-- converts such an account from 'employee' to 'student' in profiles and
-- cdl_users and creates its cdl_students row. Profiles in any other role,
-- and sign-ups without the tag (for example from the Logistics app), are
-- unchanged. The Logistics trigger is not modified.
--
-- Existing accounts are not changed here; the API repair still converts them
-- on their next portal sign-in.
--
-- Rollback: re-run the handle_iman_auth_user definition from
-- 202610070001_super_admin_email.sql.

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
  prior_role text;
  converts_employee boolean;
begin
  assigned_role := public.iman_role_for_user(new.email, new.raw_app_meta_data, new.raw_user_meta_data);
  authoritative := lower(coalesce(new.email, '')) = public.iman_super_admin_email()
    or (new.raw_app_meta_data ->> 'role') in ('super_admin', 'admin', 'instructor', 'student');
  verified := new.email_confirmed_at is not null;
  -- The Iman Logistics app shares this database and its own sign-up trigger
  -- (on_auth_user_created, which fires first) creates every new profile as
  -- 'employee'. Accounts created by the school's sign-up form are tagged
  -- signup_source = 'iman_trucking_school' and become students instead. Only
  -- an 'employee' profile is converted, so no other role can be changed this
  -- way, and the tag can only ever produce a student account.
  select role into prior_role from public.profiles where id = new.id;
  converts_employee := prior_role = 'employee'
    and new.raw_user_meta_data ->> 'signup_source' = 'iman_trucking_school'
    and assigned_role = 'student';

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
      when authoritative or public.profiles.role = 'super_admin' or converts_employee then excluded.role
      else public.profiles.role
    end,
    active = case
      when converts_employee then verified
      when public.profiles.role in ('student', 'super_admin') and verified then true
      else public.profiles.active
    end;

  insert into public.cdl_users (id, role, email)
  values (new.id, case when assigned_role in ('super_admin', 'admin') then 'admin' else assigned_role end, new.email)
  on conflict (id) do update set
    role = case when authoritative or converts_employee then excluded.role else public.cdl_users.role end,
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
