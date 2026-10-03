-- Auth hardening.
--
-- 1. Roles come only from app_metadata (writable by the service role only) or
--    the super-admin email. user_metadata is user-writable through
--    supabase.auth.updateUser(), so it must never grant a role.
-- 2. Re-running the auth trigger (any metadata/email update) no longer resets
--    a staff-assigned role or reactivates a deactivated account.
-- 3. Client roles cannot change role/active on profiles or role on cdl_users,
--    nor payment fields on cdl_students.
-- 4. ELP results are written only by the API server, which re-scores them.

create or replace function public.iman_role_for_user(user_email text, app_metadata jsonb, user_metadata jsonb)
returns text
language sql
stable
as $$
  select case
    when lower(coalesce(user_email, '')) = 'rodriguemedor@yahoo.fr' then 'super_admin'
    when app_metadata ->> 'role' in ('super_admin', 'admin', 'instructor', 'student') then app_metadata ->> 'role'
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
begin
  assigned_role := public.iman_role_for_user(new.email, new.raw_app_meta_data, new.raw_user_meta_data);
  authoritative := lower(coalesce(new.email, '')) = 'rodriguemedor@yahoo.fr'
    or (new.raw_app_meta_data ->> 'role') in ('super_admin', 'admin', 'instructor', 'student');

  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'User'), '@', 1)),
    assigned_role,
    true
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = case when authoritative then excluded.role else public.profiles.role end;

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

create or replace function public.is_iman_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin' and active = true
  )
$$;
revoke all on function public.is_iman_super_admin() from public;
grant execute on function public.is_iman_super_admin() to authenticated;

-- profiles: role/active are managed by the auth trigger, the service role or
-- a super admin.
create or replace function public.profiles_role_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_iman_super_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.role is distinct from 'student' or new.active is distinct from true then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  elsif (new.id, new.role, new.active) is distinct from (old.id, old.role, old.active) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
before insert or update on public.profiles
for each row execute procedure public.profiles_role_guard();

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id and role = 'student');

create or replace function public.cdl_users_role_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_iman_super_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.role is distinct from 'student' then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  elsif (new.id, new.role) is distinct from (old.id, old.role) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists cdl_users_role_guard on public.cdl_users;
create trigger cdl_users_role_guard
before insert or update on public.cdl_users
for each row execute procedure public.cdl_users_role_guard();

-- cdl_students: a student may edit their own profile fields, never the
-- owner or the payment state (written by the API server).
create or replace function public.cdl_students_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_iman_staff() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.registration_payment_status := 'not_required';
    new.registration_payment_id := null;
    new.payment_policy_accepted_at := null;
    new.payment_policy_signature := null;
    new.payment_policy_version := null;
  elsif (new.id, new.user_id, new.registration_payment_status, new.registration_payment_id,
         new.payment_policy_accepted_at, new.payment_policy_signature, new.payment_policy_version, new.created_at)
        is distinct from
        (old.id, old.user_id, old.registration_payment_status, old.registration_payment_id,
         old.payment_policy_accepted_at, old.payment_policy_signature, old.payment_policy_version, old.created_at) then
    raise exception 'protected_field' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists cdl_students_guard on public.cdl_students;
create trigger cdl_students_guard
before insert or update on public.cdl_students
for each row execute procedure public.cdl_students_guard();

-- ELP submissions are inserted by POST /api/elp-submissions (service role).
drop policy if exists "Students insert own ELP submissions" on public.elp_submissions;
revoke insert on public.elp_submissions from anon, authenticated;

notify pgrst, 'reload schema';
