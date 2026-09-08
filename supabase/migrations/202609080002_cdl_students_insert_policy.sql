-- Add INSERT policy for cdl_students table to allow users to create their own student record
-- This is needed for the student registration flow

create policy "Users can insert own student record"
on public.cdl_students for insert
with check (exists (select 1 from public.cdl_users where id = user_id and auth.uid() = id));

create policy "Users can update own student record"
on public.cdl_students for update
using (exists (select 1 from public.cdl_users where id = user_id and auth.uid() = id));
