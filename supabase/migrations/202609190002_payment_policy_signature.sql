-- Replace the non-refundable checkout wording with a signed payment policy.
-- Stores the typed electronic signature and acceptance timestamp.

alter table public.cdl_dispatcher_registrations
  add column if not exists payment_policy_accepted_at timestamptz,
  add column if not exists payment_policy_signature text,
  add column if not exists payment_policy_version text;

alter table public.cdl_class_applications
  add column if not exists payment_policy_accepted_at timestamptz,
  add column if not exists payment_policy_signature text,
  add column if not exists payment_policy_version text;

alter table public.cdl_students
  add column if not exists payment_policy_accepted_at timestamptz,
  add column if not exists payment_policy_signature text,
  add column if not exists payment_policy_version text;
