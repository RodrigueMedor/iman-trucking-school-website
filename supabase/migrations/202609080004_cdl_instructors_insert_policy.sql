-- Add INSERT policy for cdl_instructors table to allow super admins to create instructor accounts
-- This is needed for the instructor account creation flow

create policy "Super admins can insert instructor records"
on public.cdl_instructors for insert
with check (public.is_super_admin());

create policy "Super admins can update instructor records"
on public.cdl_instructors for update
using (public.is_super_admin());
