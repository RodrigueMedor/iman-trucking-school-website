-- Avoid querying profiles directly from a policy on profiles. PostgreSQL
-- otherwise detects infinite RLS recursion and PostgREST returns HTTP 500.
create or replace function public.is_iman_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('super_admin', 'admin', 'instructor')
      and active = true
  )
$$;

revoke all on function public.is_iman_staff() from public;
grant execute on function public.is_iman_staff() to authenticated;

drop policy if exists "Staff read profiles" on public.profiles;
create policy "Staff read profiles"
on public.profiles
for select
to authenticated
using (public.is_iman_staff());

notify pgrst, 'reload schema';
