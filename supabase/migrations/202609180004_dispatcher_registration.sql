-- Dispatcher Class Registration
--
-- Adds dispatcher class offerings, public registrations, and links them to
-- the existing cdl_payments table so Stripe payments and statuses flow through
-- the same webhook pipeline as CDL registrations and class applications.
--
-- Idempotent and safe to re-run.

-- Dispatcher class offerings with a tuition/registration price.
create table if not exists public.cdl_dispatcher_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents integer not null default 0,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Public dispatcher class registrations. Each registration carries a unique
-- registration number used to link it to its Stripe payment.
create table if not exists public.cdl_dispatcher_registrations (
  id uuid primary key default gen_random_uuid(),
  registration_no text not null unique,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  zip_code text not null,
  class_id uuid references public.cdl_dispatcher_classes(id) on delete set null,
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED', 'CONFIRMED', 'CANCELED')),
  payment_status text default 'not_required' check (payment_status in ('not_required', 'pending', 'processing', 'paid', 'failed', 'canceled', 'refunded')),
  payment_id uuid references public.cdl_payments(id) on delete set null,
  refund_policy_accepted_at timestamptz,
  staff_notes text,
  submitted_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cdl_dispatcher_classes enable row level security;
alter table public.cdl_dispatcher_registrations enable row level security;

-- Public can read open dispatcher classes (price shown on the registration page).
drop policy if exists "Public can read open dispatcher classes" on public.cdl_dispatcher_classes;
create policy "Public can read open dispatcher classes" on public.cdl_dispatcher_classes for select using (open = true);

-- Registrations are created by the payment API with the service-role key.
-- Browser roles must not create unverified rows or IDs that checkout cannot find.
drop policy if exists "Anyone can register for dispatcher class" on public.cdl_dispatcher_registrations;

-- Staff (admin/instructor/super_admin) can read and update registrations.
drop policy if exists "Staff can read dispatcher registrations" on public.cdl_dispatcher_registrations;
create policy "Staff can read dispatcher registrations" on public.cdl_dispatcher_registrations for select using (
  public.is_super_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'instructor', 'super_admin') and active = true
  )
);
drop policy if exists "Staff can update dispatcher registrations" on public.cdl_dispatcher_registrations;
create policy "Staff can update dispatcher registrations" on public.cdl_dispatcher_registrations for update using (
  public.is_super_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'instructor', 'super_admin') and active = true
  )
);

grant select on public.cdl_dispatcher_classes to anon, authenticated;
grant select, update on public.cdl_dispatcher_registrations to authenticated;
revoke insert on public.cdl_dispatcher_registrations from anon, authenticated;

-- Link payments to dispatcher registrations and allow the new payment type.
-- The API server writes these rows with the service-role key (bypasses RLS);
-- client roles remain read-only on cdl_payments.
alter table public.cdl_payments
  add column if not exists dispatcher_registration_id uuid references public.cdl_dispatcher_registrations(id) on delete set null;

alter table public.cdl_payments drop constraint if exists cdl_payments_payment_type_check;
alter table public.cdl_payments add constraint cdl_payments_payment_type_check
  check (payment_type in ('registration', 'application', 'dispatcher'));

create index if not exists idx_cdl_payments_dispatcher on public.cdl_payments(dispatcher_registration_id);

-- Seed a default dispatcher class (price and dates are admin-editable).
insert into public.cdl_dispatcher_classes (name, description, price_cents, starts_at, ends_at, open)
select 'Dispatcher Training — Rolling Enrollment 2026',
       'Entry-level freight and fleet dispatcher certification training.',
       52000,
       '2026-01-01T00:00:00Z',
       '2026-12-31T23:59:59Z',
       true
where not exists (
  select 1 from public.cdl_dispatcher_classes where name = 'Dispatcher Training — Rolling Enrollment 2026'
);
