-- Logistics accounts no longer get school records.
--
-- Production shares this database with the Iman Logistics back office, whose
-- sign-up trigger creates every profile as 'employee'; there 'employee' and
-- 'admin' are real staff roles. Until now handle_iman_auth_user also gave
-- every such account a cdl_users row with role 'student' and a cdl_students
-- row, so Logistics staff were filed as school students.
--
-- This redefinition (based on 202611050004) leaves an 'employee' or 'admin'
-- profile with only its profile row unless the account is a school account:
-- tagged by the school sign-up form (converted to student as in 0004) or given
-- a role in app_metadata by the school. Untagged school sign-ups made with an
-- older form still become students when they first sign in to the portal: the
-- API server (POST /api/me/student-account) creates their cdl_users and
-- cdl_students rows, and never converts an account Logistics created.
--
-- Existing rows are not changed here. Every 'employee' account in production
-- on 2026-11-07 was a school sign-up (Logistics has no public sign-up and had
-- created no accounts).
--
-- Rollback: re-run the handle_iman_auth_user definition from
-- 202611050004_school_signups_are_students.sql.

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
  logistics_account boolean;
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
  -- An 'employee' or 'admin' profile the school did not claim belongs to the
  -- Logistics app: keep its profile and add no school records.
  -- (authoritative and converts_employee are NULL, not false, when the
  -- metadata they read is missing, hence "is not true".)
  logistics_account := coalesce(prior_role in ('employee', 'admin'), false)
    and authoritative is not true
    and converts_employee is not true;

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

  if logistics_account then
    return new;
  end if;

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
