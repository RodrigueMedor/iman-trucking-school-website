-- Tuition billing hardening. Additive only: existing students, applications,
-- payments, agreements and financing referrals are preserved.
--
-- 1. Partial refunds reduce the amount counted as paid (refunded_cents).
-- 2. Admins can record offline payments (payment_method) and waive
--    installments (cdl_tuition_adjustments); both are audited.
-- 3. Financing is managed by the super administrator only. A FUNDED referral
--    sets the linked account's financing_cents in the database, so the two
--    can no longer disagree.
-- 4. The account status is recomputed by triggers whenever payments,
--    waivers or financing change, and reports open financing as
--    FINANCING_PENDING instead of guessing from financing_cents.

-- ---------------------------------------------------------------- roles
-- Same rule as SuperAdminRoute: the super_admin role on the one allowed email.
create or replace function public.is_iman_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = auth.uid()
      and p.role = 'super_admin'
      and p.active = true
      and lower(coalesce(u.email, '')) = public.iman_super_admin_email()
  )
$$;
revoke all on function public.is_iman_super_admin() from public;
grant execute on function public.is_iman_super_admin() to authenticated;

-- ---------------------------------------------------------------- payments
alter table public.cdl_payments
  add column if not exists refunded_cents integer not null default 0 check (refunded_cents >= 0),
  add column if not exists payment_method text not null default 'stripe'
    check (payment_method in ('stripe', 'cash', 'check', 'money_order', 'other')),
  add column if not exists recorded_by uuid references auth.users(id) on delete set null;

-- Backfill: full refunds already carry status 'refunded'; partial refunds
-- were only noted in metadata.amount_refunded.
update public.cdl_payments set refunded_cents = amount_cents
where status = 'refunded' and refunded_cents = 0;
update public.cdl_payments
set refunded_cents = least((metadata ->> 'amount_refunded')::integer, amount_cents)
where status = 'succeeded' and refunded_cents = 0
  and (metadata ->> 'amount_refunded') ~ '^[0-9]+$';

alter table public.cdl_payments drop constraint if exists cdl_payments_refund_within_amount;
alter table public.cdl_payments add constraint cdl_payments_refund_within_amount
  check (refunded_cents <= amount_cents);

-- ---------------------------------------------------------------- waivers
create table if not exists public.cdl_tuition_adjustments (
  id uuid primary key default gen_random_uuid(),
  tuition_account_id uuid not null references public.cdl_tuition_accounts(id) on delete cascade,
  installment_id uuid references public.cdl_tuition_installments(id) on delete set null,
  kind text not null default 'WAIVER' check (kind in ('WAIVER')),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 10000000),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_cdl_tuition_adjustments_account
  on public.cdl_tuition_adjustments(tuition_account_id, created_at desc);
create unique index if not exists uq_cdl_tuition_adjustment_installment
  on public.cdl_tuition_adjustments(installment_id) where installment_id is not null;

alter table public.cdl_tuition_adjustments enable row level security;
drop policy if exists "Students read own adjustments" on public.cdl_tuition_adjustments;
create policy "Students read own adjustments" on public.cdl_tuition_adjustments
  for select to authenticated using (exists (
    select 1 from public.cdl_tuition_accounts a where a.id = tuition_account_id and a.user_id = auth.uid()
  ));
drop policy if exists "Staff read adjustments" on public.cdl_tuition_adjustments;
create policy "Staff read adjustments" on public.cdl_tuition_adjustments
  for select to authenticated using (public.is_iman_staff());
-- Written only by the API server (service role), which records who waived it.
revoke all on public.cdl_tuition_adjustments from anon, authenticated;
grant select on public.cdl_tuition_adjustments to authenticated;

-- ---------------------------------------------------------------- balance view
-- Columns are appended after the original ones so the view can be replaced
-- in place.
create or replace view public.cdl_tuition_account_balances with (security_invoker = true) as
select a.*,
  coalesce(p.paid_cents, 0)::integer as paid_cents,
  greatest(a.tuition_cents - a.financing_cents - coalesce(p.paid_cents, 0) - coalesce(w.waived_cents, 0), 0)::integer as remaining_cents,
  coalesce(p.refunded_cents, 0)::integer as refunded_cents,
  coalesce(w.waived_cents, 0)::integer as waived_cents,
  greatest(a.financing_cents + coalesce(p.paid_cents, 0) + coalesce(w.waived_cents, 0) - a.tuition_cents, 0)::integer as credit_cents,
  f.status as financing_status
from public.cdl_tuition_accounts a
left join (
  select tuition_account_id,
    sum(case when status = 'succeeded' then amount_cents - refunded_cents else 0 end) as paid_cents,
    sum(case when status in ('succeeded', 'refunded') then refunded_cents else 0 end) as refunded_cents
  from public.cdl_payments where tuition_account_id is not null group by tuition_account_id
) p on p.tuition_account_id = a.id
left join (
  select tuition_account_id, sum(amount_cents) as waived_cents
  from public.cdl_tuition_adjustments group by tuition_account_id
) w on w.tuition_account_id = a.id
left join lateral (
  select r.status from public.cdl_financing_referrals r
  where r.tuition_account_id = a.id order by r.updated_at desc limit 1
) f on true;

-- ---------------------------------------------------------------- status sync
create or replace function public.sync_tuition_account(p_account_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  remaining integer;
  next_status text;
begin
  select b.remaining_cents into remaining from public.cdl_tuition_account_balances b where b.id = p_account_id;
  if not found then return; end if;
  next_status := case
    when remaining = 0 then 'PAID'
    when exists (select 1 from public.cdl_payments where tuition_account_id = p_account_id and status in ('pending', 'processing')) then 'PAYMENT_PENDING'
    when exists (select 1 from public.cdl_financing_referrals where tuition_account_id = p_account_id
                 and status in ('REFERRED', 'STUDENT_REPORTED_SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'FOLLOW_UP_NEEDED')) then 'FINANCING_PENDING'
    else 'OPEN'
  end;
  update public.cdl_tuition_accounts set status = next_status, updated_at = now()
  where id = p_account_id and status <> 'CLOSED' and status is distinct from next_status;
end $$;
revoke all on function public.sync_tuition_account(uuid) from public;

create or replace function public.sync_tuition_after_ledger_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' and old.tuition_account_id is not null then
    perform public.sync_tuition_account(old.tuition_account_id);
  end if;
  if tg_op <> 'DELETE' and new.tuition_account_id is not null
     and (tg_op = 'INSERT' or new.tuition_account_id is distinct from old.tuition_account_id) then
    perform public.sync_tuition_account(new.tuition_account_id);
  end if;
  return null;
end $$;
revoke all on function public.sync_tuition_after_ledger_change() from public;

drop trigger if exists cdl_payments_tuition_sync on public.cdl_payments;
create trigger cdl_payments_tuition_sync
after insert or delete or update of status, amount_cents, refunded_cents, tuition_account_id on public.cdl_payments
for each row execute procedure public.sync_tuition_after_ledger_change();

drop trigger if exists cdl_tuition_adjustments_sync on public.cdl_tuition_adjustments;
create trigger cdl_tuition_adjustments_sync
after insert or delete on public.cdl_tuition_adjustments
for each row execute procedure public.sync_tuition_after_ledger_change();

-- ---------------------------------------------------------------- financing
-- Financing writes are reserved for the super administrator. Regular admins
-- still manage tuition accounts but cannot change the funded amount.
drop policy if exists "Admins update financing referrals" on public.cdl_financing_referrals;
drop policy if exists "Super admin updates financing referrals" on public.cdl_financing_referrals;
create policy "Super admin updates financing referrals" on public.cdl_financing_referrals
  for update to authenticated using (public.is_iman_super_admin()) with check (public.is_iman_super_admin());
-- The account link is maintained by triggers below, not by clients.
revoke update on public.cdl_financing_referrals from authenticated;
grant update (status, staff_notes, updated_by, approved_amount_cents, funded_amount_cents) on public.cdl_financing_referrals to authenticated;

create or replace function public.guard_tuition_financing()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon')
     and (tg_op = 'INSERT' and new.financing_cents <> 0
          or tg_op = 'UPDATE' and new.financing_cents is distinct from old.financing_cents)
     and not public.is_iman_super_admin() then
    raise exception 'only the super administrator can change financing' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists cdl_tuition_financing_guard on public.cdl_tuition_accounts;
create trigger cdl_tuition_financing_guard
before insert or update of financing_cents on public.cdl_tuition_accounts
for each row execute procedure public.guard_tuition_financing();

-- Link a referral to the student's most recent tuition account.
create or replace function public.link_financing_referral()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tuition_account_id is null then
    select id into new.tuition_account_id from public.cdl_tuition_accounts
    where user_id = new.user_id and status <> 'CLOSED'
    order by created_at desc limit 1;
  end if;
  if new.status = 'FUNDED' and new.funded_amount_cents is null
     and (tg_op = 'INSERT' or old.status is distinct from 'FUNDED' or old.funded_amount_cents is not null) then
    raise exception 'enter the funded amount before marking financing as funded' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists cdl_financing_referrals_link on public.cdl_financing_referrals;
create trigger cdl_financing_referrals_link
before insert or update on public.cdl_financing_referrals
for each row execute procedure public.link_financing_referral();

-- Only FUNDED money reduces the balance; leaving FUNDED removes it again.
create or replace function public.apply_financing_to_tuition()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  funded integer := case when new.status = 'FUNDED' then coalesce(new.funded_amount_cents, 0) else 0 end;
  account public.cdl_tuition_accounts;
begin
  if tg_op = 'UPDATE' and old.tuition_account_id is not null
     and old.tuition_account_id is distinct from new.tuition_account_id then
    update public.cdl_tuition_accounts set financing_cents = 0 where id = old.tuition_account_id;
  end if;
  if new.tuition_account_id is null then return null; end if;
  select * into account from public.cdl_tuition_accounts where id = new.tuition_account_id;
  if funded > account.tuition_cents then
    raise exception 'funded amount exceeds the tuition on this account' using errcode = '23514';
  end if;
  if account.financing_cents is distinct from funded then
    update public.cdl_tuition_accounts set financing_cents = funded where id = new.tuition_account_id;
  else
    perform public.sync_tuition_account(new.tuition_account_id);
  end if;
  return null;
end $$;
drop trigger if exists cdl_financing_referrals_apply on public.cdl_financing_referrals;
create trigger cdl_financing_referrals_apply
after insert or update of status, funded_amount_cents, tuition_account_id on public.cdl_financing_referrals
for each row execute procedure public.apply_financing_to_tuition();

-- A new tuition account picks up the student's existing referral.
create or replace function public.link_referral_to_new_account()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.cdl_financing_referrals set tuition_account_id = new.id
  where user_id = new.user_id and tuition_account_id is null;
  return null;
end $$;
drop trigger if exists cdl_tuition_accounts_link_referral on public.cdl_tuition_accounts;
create trigger cdl_tuition_accounts_link_referral
after insert on public.cdl_tuition_accounts
for each row execute procedure public.link_referral_to_new_account();

revoke all on function public.guard_tuition_financing(), public.link_financing_referral(),
  public.apply_financing_to_tuition(), public.link_referral_to_new_account() from public;

-- Existing data: link referrals and recompute every account once.
update public.cdl_financing_referrals r set tuition_account_id = (
  select a.id from public.cdl_tuition_accounts a
  where a.user_id = r.user_id and a.status <> 'CLOSED' order by a.created_at desc limit 1
) where r.tuition_account_id is null;
select public.sync_tuition_account(id) from public.cdl_tuition_accounts;

-- Students may open their own account before applying; one open self-paid
-- account per course stops a double click from billing them twice.
create unique index if not exists uq_cdl_tuition_account_self_paid_course
  on public.cdl_tuition_accounts(user_id, course_id)
  where application_id is null and status <> 'CLOSED';

notify pgrst, 'reload schema';
