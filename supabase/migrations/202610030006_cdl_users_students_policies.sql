-- Production has RLS enabled on cdl_users and cdl_students but no policies
-- (the ones from 202609060001/202609080002/202609080003 never landed), so
-- signed-in students could not read their own rows and the portal reported
-- "We couldn't find your student profile".
--
-- Role and payment fields stay protected by cdl_users_role_guard and
-- cdl_students_guard (202610030002). Idempotent.

drop policy if exists "Users can read own data" on public.cdl_users;
create policy "Users can read own data" on public.cdl_users
  for select to authenticated using (id = auth.uid());

drop policy if exists "Admins can read all users" on public.cdl_users;
drop policy if exists "Staff read cdl users" on public.cdl_users;
create policy "Staff read cdl users" on public.cdl_users
  for select to authenticated using (public.is_iman_staff());

drop policy if exists "Users can insert own user record" on public.cdl_users;
create policy "Users can insert own user record" on public.cdl_users
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "Users can update own data" on public.cdl_users;
create policy "Users can update own data" on public.cdl_users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Students can read own data" on public.cdl_students;
create policy "Students can read own data" on public.cdl_students
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Admins can read all students" on public.cdl_students;
drop policy if exists "Staff read students" on public.cdl_students;
create policy "Staff read students" on public.cdl_students
  for select to authenticated using (public.is_iman_staff());

drop policy if exists "Users can insert own student record" on public.cdl_students;
create policy "Users can insert own student record" on public.cdl_students
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users can update own student record" on public.cdl_students;
create policy "Users can update own student record" on public.cdl_students
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.cdl_users, public.cdl_students from anon;
grant select, insert, update on public.cdl_users, public.cdl_students to authenticated;

notify pgrst, 'reload schema';
