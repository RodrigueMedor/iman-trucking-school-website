-- Itemized CDL pricing (training, testing, administrative and materials
-- fees) with optional housing. Additive only: existing courses keep their
-- tuition as the training price, and existing tuition accounts keep the
-- amount the student agreed to.
--
-- 1. cdl_courses carries the fee breakdown; tuition_cents is always the sum
--    of the fees (housing excluded) and is maintained by a trigger.
-- 2. Every price change is recorded in cdl_course_pricing_versions with who
--    made it, so pricing is auditable and versioned.
-- 3. Tuition accounts snapshot the fees, the housing price offered and
--    whether the student chose housing. Later price changes never touch them.
--
-- Rollback: drop the triggers and cdl_course_pricing_versions, recreate the
-- balance view from 202610220001, then drop the added columns.

-- ---------------------------------------------------------------- courses
alter table public.cdl_courses
  add column if not exists training_cents integer not null default 0 check (training_cents between 0 and 10000000),
  add column if not exists testing_fee_cents integer not null default 0 check (testing_fee_cents between 0 and 10000000),
  add column if not exists administrative_fee_cents integer not null default 0 check (administrative_fee_cents between 0 and 10000000),
  add column if not exists materials_fee_cents integer not null default 0 check (materials_fee_cents between 0 and 10000000),
  add column if not exists housing_fee_cents integer not null default 0 check (housing_fee_cents between 0 and 10000000),
  add column if not exists currency text not null default 'usd' check (currency = lower(currency) and char_length(currency) = 3),
  add column if not exists pricing_version integer not null default 1 check (pricing_version > 0),
  add column if not exists pricing_effective_at timestamptz not null default now(),
  add column if not exists pricing_updated_by uuid references auth.users(id) on delete set null;

-- Existing prices become the training price so no total changes here.
update public.cdl_courses set training_cents = tuition_cents
where training_cents = 0 and testing_fee_cents = 0 and administrative_fee_cents = 0 and materials_fee_cents = 0;

-- CDL Training special pricing for Class A and Class B: $3,429 without
-- housing, $3,929 with the optional $500 housing. Full payment only.
update public.cdl_courses set
  training_cents = 259900, testing_fee_cents = 60000, administrative_fee_cents = 8000, materials_fee_cents = 15000,
  housing_fee_cents = 50000, tuition_cents = 342900, deposit_cents = 0, installment_count = 1, installments_enabled = false,
  pricing_effective_at = now(), updated_at = now()
where code in ('CDL-A', 'CDL-B');

-- ---------------------------------------------------------------- history
create table if not exists public.cdl_course_pricing_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.cdl_courses(id) on delete cascade,
  version integer not null check (version > 0),
  currency text not null,
  training_cents integer not null,
  testing_fee_cents integer not null,
  administrative_fee_cents integer not null,
  materials_fee_cents integer not null,
  housing_fee_cents integer not null,
  tuition_cents integer not null,
  deposit_cents integer not null,
  installment_count integer not null,
  effective_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (course_id, version)
);

insert into public.cdl_course_pricing_versions (course_id, version, currency, training_cents, testing_fee_cents,
  administrative_fee_cents, materials_fee_cents, housing_fee_cents, tuition_cents, deposit_cents, installment_count, effective_at)
select id, pricing_version, currency, training_cents, testing_fee_cents, administrative_fee_cents, materials_fee_cents,
  housing_fee_cents, tuition_cents, deposit_cents, installment_count, pricing_effective_at
from public.cdl_courses
on conflict (course_id, version) do nothing;

alter table public.cdl_course_pricing_versions enable row level security;
drop policy if exists "Staff read course pricing history" on public.cdl_course_pricing_versions;
create policy "Staff read course pricing history" on public.cdl_course_pricing_versions
  for select to authenticated using (public.is_iman_staff());
-- Written only by the trigger below; history is append-only.
revoke all on public.cdl_course_pricing_versions from anon, authenticated;
grant select on public.cdl_course_pricing_versions to authenticated;

-- The total is derived from the fees, so it can never disagree with them.
-- A price change bumps the version and becomes effective immediately.
create or replace function public.price_cdl_course()
returns trigger language plpgsql set search_path = public as $$
begin
  new.tuition_cents := new.training_cents + new.testing_fee_cents + new.administrative_fee_cents + new.materials_fee_cents;
  if tg_op = 'UPDATE' and (new.training_cents, new.testing_fee_cents, new.administrative_fee_cents, new.materials_fee_cents,
       new.housing_fee_cents, new.currency, new.deposit_cents, new.installment_count)
     is distinct from (old.training_cents, old.testing_fee_cents, old.administrative_fee_cents, old.materials_fee_cents,
       old.housing_fee_cents, old.currency, old.deposit_cents, old.installment_count) then
    new.pricing_version := old.pricing_version + 1;
    new.pricing_effective_at := now();
  end if;
  return new;
end $$;
drop trigger if exists cdl_courses_price on public.cdl_courses;
create trigger cdl_courses_price
before insert or update on public.cdl_courses
for each row execute procedure public.price_cdl_course();

create or replace function public.record_cdl_course_pricing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.pricing_version is distinct from old.pricing_version then
    insert into public.cdl_course_pricing_versions (course_id, version, currency, training_cents, testing_fee_cents,
      administrative_fee_cents, materials_fee_cents, housing_fee_cents, tuition_cents, deposit_cents, installment_count,
      effective_at, created_by)
    values (new.id, new.pricing_version, new.currency, new.training_cents, new.testing_fee_cents, new.administrative_fee_cents,
      new.materials_fee_cents, new.housing_fee_cents, new.tuition_cents, new.deposit_cents, new.installment_count,
      new.pricing_effective_at, coalesce(new.pricing_updated_by, auth.uid()))
    on conflict (course_id, version) do nothing;
  end if;
  return null;
end $$;
drop trigger if exists cdl_courses_pricing_history on public.cdl_courses;
create trigger cdl_courses_pricing_history
after insert or update on public.cdl_courses
for each row execute procedure public.record_cdl_course_pricing();

revoke all on function public.price_cdl_course(), public.record_cdl_course_pricing() from public;

-- ---------------------------------------------------------------- accounts
-- fee_items is the itemized snapshot: [{code, label, amount_cents}], housing
-- excluded. An empty array means the account predates itemized pricing or
-- admissions set a custom tuition.
alter table public.cdl_tuition_accounts
  add column if not exists fee_items jsonb not null default '[]'::jsonb check (jsonb_typeof(fee_items) = 'array'),
  add column if not exists housing_fee_cents integer not null default 0 check (housing_fee_cents between 0 and 10000000),
  add column if not exists housing_selected boolean not null default false,
  add column if not exists pricing_version integer check (pricing_version is null or pricing_version > 0);
alter table public.cdl_tuition_accounts drop constraint if exists cdl_tuition_accounts_housing_offered;
alter table public.cdl_tuition_accounts add constraint cdl_tuition_accounts_housing_offered
  check (not housing_selected or housing_fee_cents > 0);

-- The view expands a.* when created, so it is rebuilt to expose the new
-- columns. Same definition as 202610220001.
drop view if exists public.cdl_tuition_account_balances;
create view public.cdl_tuition_account_balances with (security_invoker = true) as
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
revoke all on public.cdl_tuition_account_balances from anon;
grant select on public.cdl_tuition_account_balances to authenticated;

notify pgrst, 'reload schema';
