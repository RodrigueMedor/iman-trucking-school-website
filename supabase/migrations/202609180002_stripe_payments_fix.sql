-- Stripe Payments - security fix for environments that already applied
-- 202609180001_stripe_payments.sql.
--
-- The API server writes payment records with the Supabase service-role key
-- (SUPABASE_SERVICE_ROLE_KEY), which bypasses RLS. Therefore client roles
-- (anon/authenticated) must not hold INSERT/UPDATE on public.cdl_payments and
-- the original write policies are dropped. This file is idempotent and safe to
-- re-run.

revoke insert, update on public.cdl_payments from anon, authenticated;

drop policy if exists "Authenticated can create payments" on public.cdl_payments;
drop policy if exists "Admins can update payments" on public.cdl_payments;

-- Only the read grants remain for the dashboard/student views.
grant select on public.cdl_payments to anon, authenticated;