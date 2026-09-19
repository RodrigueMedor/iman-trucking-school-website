-- Dispatcher registration checkout fixes for existing deployments.
-- Sets the advertised/charged price to $520 and records payment-policy
-- acceptance before Stripe Checkout.

alter table public.cdl_dispatcher_registrations
  add column if not exists refund_policy_accepted_at timestamptz;

-- Registration creation now goes through the server so the returned id is the
-- same canonical row later used by Stripe Checkout.
drop policy if exists "Anyone can register for dispatcher class" on public.cdl_dispatcher_registrations;
revoke insert on public.cdl_dispatcher_registrations from anon, authenticated;

update public.cdl_dispatcher_classes
set price_cents = 52000,
    updated_at = now()
where name = 'Dispatcher Training — Rolling Enrollment 2026';
