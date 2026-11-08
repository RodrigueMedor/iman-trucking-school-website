-- School sign-ups in a database shared with the Iman Logistics app.
-- Run against a LOCAL database only (scripts/test-db.sh). One transaction,
-- rolled back, so it is repeatable.
\set ON_ERROR_STOP on
begin;

-- Reproduce production: the Logistics app's sign-up trigger fires before the
-- school's (trigger names sort alphabetically) and creates every profile as
-- 'employee'.
create or replace function public.test_logistics_signup() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'employee')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.test_logistics_signup();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
values
  -- School sign-up, email not verified yet.
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'school-new@test.local',
   '{"first_name":"Sky","last_name":"Learner","full_name":"Sky Learner","signup_source":"iman_trucking_school"}', '{}', null, now(), now()),
  -- Logistics sign-up (no tag): stays an employee.
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'logistics@test.local',
   '{"first_name":"Lee","last_name":"Worker","full_name":"Lee Worker"}', '{}', now(), now(), now()),
  -- Admin created by staff: the tag cannot change an admin.
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff@test.local',
   '{"full_name":"Sam Staff","signup_source":"iman_trucking_school"}', '{"role":"admin"}', now(), now(), now());

do $$
declare r record;
begin
  -- 1. School sign-up: student, inactive until verified, with a student row.
  select p.role, p.active, cu.role as user_role, exists (select 1 from public.cdl_students where user_id = p.id) as has_student into r
  from public.profiles p join public.cdl_users cu on cu.id = p.id where p.id = '60000000-0000-0000-0000-000000000001';
  if r.role <> 'student' or r.active or r.user_role <> 'student' or not r.has_student then raise exception 'school sign-up: %', r; end if;

  -- 2. Logistics sign-up keeps the Logistics role and gets no school records.
  if (select role from public.profiles where id = '60000000-0000-0000-0000-000000000002') <> 'employee' then
    raise exception 'logistics sign-up was changed';
  end if;
  if exists (select 1 from public.cdl_users where id = '60000000-0000-0000-0000-000000000002')
     or exists (select 1 from public.cdl_students where user_id = '60000000-0000-0000-0000-000000000002') then
    raise exception 'logistics sign-up was given school records';
  end if;

  -- 3. Admin stays admin.
  if (select role from public.profiles where id = '60000000-0000-0000-0000-000000000003') <> 'admin' then
    raise exception 'admin was changed';
  end if;
end $$;

-- 4. Verifying the email activates the school student.
update auth.users set email_confirmed_at = now() where id = '60000000-0000-0000-0000-000000000001';
do $$ begin
  if not (select active from public.profiles where id = '60000000-0000-0000-0000-000000000001') then
    raise exception 'verified school student is not active';
  end if;
end $$;

-- 4b. A Logistics admin (promoted in Logistics, no school role) gets no school
-- records when its auth user changes, and keeps its role.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
values ('60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'logistics-admin@test.local',
  '{"full_name":"Lou Manager"}', '{}', now(), now(), now());
update public.profiles set role = 'admin' where id = '60000000-0000-0000-0000-000000000004';
update auth.users set email = 'logistics-admin2@test.local' where id = '60000000-0000-0000-0000-000000000004';
do $$ begin
  if (select role from public.profiles where id = '60000000-0000-0000-0000-000000000004') <> 'admin' then
    raise exception 'logistics admin was changed';
  end if;
  if exists (select 1 from public.cdl_users where id = '60000000-0000-0000-0000-000000000004')
     or exists (select 1 from public.cdl_students where user_id = '60000000-0000-0000-0000-000000000004') then
    raise exception 'logistics admin was given school records';
  end if;
end $$;

-- 5. Adding the tag later converts only an 'employee' profile, and only to student.
update auth.users set raw_user_meta_data = raw_user_meta_data || '{"signup_source":"iman_trucking_school"}'
where id = '60000000-0000-0000-0000-000000000002';
do $$ begin
  if (select role from public.profiles where id = '60000000-0000-0000-0000-000000000002') <> 'student' then
    raise exception 'tagged employee was not converted to student';
  end if;
  if not exists (select 1 from public.cdl_students where user_id = '60000000-0000-0000-0000-000000000002') then
    raise exception 'converted employee has no student row';
  end if;
  if (select role from public.cdl_users where id = '60000000-0000-0000-0000-000000000002') is distinct from 'student' then
    raise exception 'converted employee has no student cdl_users row';
  end if;
end $$;

select 'school_signup: all assertions passed' as result;
rollback;
