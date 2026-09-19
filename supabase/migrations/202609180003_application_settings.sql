-- Application settings key/value table used by the Stripe payment API to
-- resolve configurable fee amounts at runtime.
--
-- The API server reads this table with the Supabase service-role key, so
-- clients only need SELECT (writes stay server-side). Fee amounts are stored
-- in cents as JSONB, e.g. {"amount": 5000} = $50.00.
--
-- Idempotent and safe to re-run.

create table if not exists public.cdl_application_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Default registration fee: $50.00 (mirrors cdl_courses.registration_fee_cents
-- seeded in the stripe payments migration).
insert into public.cdl_application_settings (key, value, updated_at)
values ('registration_fee_cents', jsonb_build_object('amount', 5000), now())
on conflict (key) do nothing;

alter table public.cdl_application_settings enable row level security;

grant select on public.cdl_application_settings to anon, authenticated;