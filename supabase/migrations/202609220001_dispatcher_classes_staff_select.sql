-- Fix: staff could not update/delete dispatcher class sessions whose
-- `open` column was false (e.g. status FULL/CLOSED/COMPLETED).
--
-- Root cause: the base table `cdl_dispatcher_classes` only ever had one
-- SELECT policy, "Public can read open dispatcher classes" (open = true).
-- Postgres RLS requires the target row of an UPDATE/DELETE to also be
-- visible under an applicable SELECT policy, in addition to satisfying the
-- UPDATE/DELETE policy's own USING clause. The 202609210001 migration added
-- staff INSERT/UPDATE/DELETE policies (auth-check only, row-independent)
-- and staff-visible admin/public views, but never a staff SELECT policy on
-- the base table itself — so a staff UPDATE/DELETE on any row with
-- open = false matched zero rows under RLS (silently, since PostgREST
-- returns 200/204 for a 0-row update, not an error).
--
-- Confirmed by direct A/B test: an identical authenticated PATCH request
-- succeeded against a row with open = true and returned zero rows against
-- an otherwise-identical row with open = false.
--
-- Idempotent and safe to re-run.

drop policy if exists "Staff can read all dispatcher classes" on public.cdl_dispatcher_classes;
create policy "Staff can read all dispatcher classes" on public.cdl_dispatcher_classes for select using (
  public.is_super_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'instructor', 'super_admin') and active = true
  )
);
