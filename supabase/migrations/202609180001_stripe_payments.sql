-- Stripe Payments Table Migration
-- This migration adds the payment tracking system for Stripe integration

-- Create payments table
create table if not exists public.cdl_payments (
  id uuid primary key default gen_random_uuid(),
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text unique,
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded')),
  payment_type text not null check (payment_type in ('registration', 'application')),
  student_id uuid references public.cdl_students(id) on delete set null,
  application_id uuid references public.cdl_class_applications(id) on delete set null,
  customer_email text,
  metadata jsonb,
  error_message text,
  succeeded_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.cdl_payments enable row level security;

-- RLS Policies
-- Students can read their own payments
create policy "Students can read own payments" on public.cdl_payments for select using (
  student_id = (select id from public.cdl_students where user_id = auth.uid()) or
  application_id in (select id from public.cdl_class_applications where student_id = (select id from public.cdl_students where user_id = auth.uid()))
);

-- Admins and instructors can read all payments
create policy "Admins can read all payments" on public.cdl_payments for select using (
  public.is_super_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'instructor', 'super_admin') and active = true
  )
);

-- Payment rows are written exclusively by the API server, which uses the
-- Supabase service-role key (SUPABASE_SERVICE_ROLE_KEY). Service-role requests
-- bypass RLS, so no INSERT/UPDATE policy is required and client roles must not
-- be able to write payment records directly.
drop policy if exists "Authenticated can create payments" on public.cdl_payments;
drop policy if exists "Admins can update payments" on public.cdl_payments;

-- Grant permissions (read-only for clients; writes happen via service role)
grant select on public.cdl_payments to anon, authenticated;

-- Create indexes for performance
create index if not exists idx_cdl_payments_student on public.cdl_payments(student_id);
create index if not exists idx_cdl_payments_application on public.cdl_payments(application_id);
create index if not exists idx_cdl_payments_status on public.cdl_payments(status);
create index if not exists idx_cdl_payments_stripe_intent on public.cdl_payments(stripe_payment_intent_id);
create index if not exists idx_cdl_payments_stripe_session on public.cdl_payments(stripe_checkout_session_id);
create index if not exists idx_cdl_payments_email on public.cdl_payments(customer_email);

-- Add payment_amount and payment_required columns to cdl_courses for pricing
alter table public.cdl_courses 
add column if not exists registration_fee_cents integer default 0,
add column if not exists application_fee_cents integer default 0,
add column if not exists payment_required boolean default false;

-- Update default courses with example pricing (can be modified by admin)
update public.cdl_courses 
set 
  registration_fee_cents = 5000, -- $50.00
  application_fee_cents = 2500, -- $25.00
  payment_required = true
where code in ('CDL-A', 'CDL-B');

-- Add payment_status column to cdl_class_applications
alter table public.cdl_class_applications
add column if not exists payment_status text default 'not_required' check (payment_status in ('not_required', 'pending', 'processing', 'paid', 'failed', 'canceled', 'refunded')),
add column if not exists payment_id uuid references public.cdl_payments(id) on delete set null;

-- Add payment_status column to cdl_students for registration payments
alter table public.cdl_students
add column if not exists registration_payment_status text default 'not_required' check (registration_payment_status in ('not_required', 'pending', 'processing', 'paid', 'failed', 'canceled', 'refunded')),
add column if not exists registration_payment_id uuid references public.cdl_payments(id) on delete set null;