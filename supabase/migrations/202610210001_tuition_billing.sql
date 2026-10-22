-- Tuition billing, installment schedules, financing milestones, receipts and
-- signed agreements. Additive only: existing students, applications and
-- registration/application payments are preserved.

alter table public.cdl_courses
  add column if not exists tuition_cents integer not null default 0 check (tuition_cents >= 0 and tuition_cents <= 10000000),
  add column if not exists deposit_cents integer not null default 0 check (deposit_cents >= 0 and deposit_cents <= 10000000),
  add column if not exists installment_count integer not null default 1 check (installment_count between 1 and 24),
  add column if not exists installments_enabled boolean not null default false;

create table if not exists public.cdl_tuition_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.cdl_students(id) on delete cascade,
  application_id uuid references public.cdl_class_applications(id) on delete set null,
  course_id uuid references public.cdl_courses(id) on delete set null,
  currency text not null default 'usd' check (currency = lower(currency) and char_length(currency) = 3),
  tuition_cents integer not null check (tuition_cents >= 0 and tuition_cents <= 10000000),
  deposit_cents integer not null default 0 check (deposit_cents >= 0 and deposit_cents <= tuition_cents),
  financing_cents integer not null default 0 check (financing_cents >= 0 and financing_cents <= tuition_cents),
  status text not null default 'OPEN' check (status in ('OPEN','PAYMENT_PENDING','FINANCING_PENDING','PAID','CLOSED')),
  installment_count integer not null default 1 check (installment_count between 1 and 24),
  installments_enabled boolean not null default false,
  first_due_at date,
  staff_notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_cdl_tuition_account_application on public.cdl_tuition_accounts(application_id) where application_id is not null;
create index if not exists idx_cdl_tuition_accounts_student on public.cdl_tuition_accounts(student_id, created_at desc);
create index if not exists idx_cdl_tuition_accounts_status on public.cdl_tuition_accounts(status, updated_at desc);

create table if not exists public.cdl_tuition_installments (
  id uuid primary key default gen_random_uuid(),
  tuition_account_id uuid not null references public.cdl_tuition_accounts(id) on delete cascade,
  installment_no integer not null check (installment_no > 0),
  label text not null,
  amount_cents integer not null check (amount_cents > 0),
  due_at date,
  status text not null default 'DUE' check (status in ('DUE','PENDING','PAID','WAIVED','CANCELED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tuition_account_id, installment_no)
);

alter table public.cdl_payments drop constraint if exists cdl_payments_payment_type_check;
alter table public.cdl_payments add constraint cdl_payments_payment_type_check
  check (payment_type in ('registration', 'application', 'tuition'));
alter table public.cdl_payments
  add column if not exists tuition_account_id uuid references public.cdl_tuition_accounts(id) on delete set null,
  add column if not exists installment_id uuid references public.cdl_tuition_installments(id) on delete set null,
  add column if not exists payment_kind text check (payment_kind is null or payment_kind in ('full','deposit','installment')),
  add column if not exists receipt_number text unique,
  add column if not exists agreement_id uuid;
create index if not exists idx_cdl_payments_tuition_account on public.cdl_payments(tuition_account_id, created_at desc);
create unique index if not exists uq_one_open_tuition_checkout
  on public.cdl_payments(tuition_account_id)
  where tuition_account_id is not null and status in ('pending','processing');

create table if not exists public.cdl_payment_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.cdl_students(id) on delete cascade,
  tuition_account_id uuid references public.cdl_tuition_accounts(id) on delete set null,
  payment_id uuid references public.cdl_payments(id) on delete set null,
  version text not null,
  agreement_text text not null,
  signer_name text not null,
  accepted_at timestamptz not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.cdl_payments drop constraint if exists cdl_payments_agreement_id_fkey;
alter table public.cdl_payments add constraint cdl_payments_agreement_id_fkey
  foreign key (agreement_id) references public.cdl_payment_agreements(id) on delete set null;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing','processed','failed')),
  attempts integer not null default 1,
  error text not null default '',
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cdl_notification_log (
  id bigint generated always as identity primary key,
  payment_id uuid references public.cdl_payments(id) on delete set null,
  channel text not null check (channel in ('email','sms')),
  audience text not null check (audience in ('student','admin')),
  recipient text not null,
  template text not null,
  status text not null check (status in ('sent','failed','skipped')),
  provider_id text not null default '',
  error text not null default '',
  created_at timestamptz not null default now(),
  unique (payment_id, channel, audience, template)
);

-- Public balance view. No mutable balance column can drift from the ledger.
create or replace view public.cdl_tuition_account_balances with (security_invoker = true) as
select a.*,
  coalesce(p.paid_cents, 0)::integer as paid_cents,
  greatest(a.tuition_cents - a.financing_cents - coalesce(p.paid_cents, 0), 0)::integer as remaining_cents,
  coalesce(p.refunded_cents, 0)::integer as refunded_cents
from public.cdl_tuition_accounts a
left join (
  select tuition_account_id,
    sum(case when status = 'succeeded' then amount_cents else 0 end) as paid_cents,
    sum(case when status = 'refunded' then amount_cents else 0 end) as refunded_cents
  from public.cdl_payments where tuition_account_id is not null group by tuition_account_id
) p on p.tuition_account_id = a.id;

create or replace function public.sync_tuition_account(p_account_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare remaining integer;
begin
  select greatest(a.tuition_cents - a.financing_cents - coalesce(sum(case when p.status='succeeded' then p.amount_cents else 0 end),0),0)
    into remaining
  from public.cdl_tuition_accounts a left join public.cdl_payments p on p.tuition_account_id=a.id
  where a.id=p_account_id group by a.id;
  update public.cdl_tuition_accounts set
    status = case when remaining = 0 then 'PAID'
                  when exists(select 1 from public.cdl_payments where tuition_account_id=p_account_id and status in ('pending','processing')) then 'PAYMENT_PENDING'
                  when financing_cents > 0 then 'FINANCING_PENDING' else 'OPEN' end,
    updated_at=now()
  where id=p_account_id and status <> 'CLOSED';
end $$;
revoke all on function public.sync_tuition_account(uuid) from public;

create or replace function public.sync_tuition_after_financing_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_tuition_account(new.id);
  return null;
end $$;
drop trigger if exists cdl_tuition_financing_sync on public.cdl_tuition_accounts;
create trigger cdl_tuition_financing_sync after update of financing_cents on public.cdl_tuition_accounts
for each row when (old.financing_cents is distinct from new.financing_cents)
execute procedure public.sync_tuition_after_financing_change();

alter table public.cdl_tuition_accounts enable row level security;
alter table public.cdl_tuition_installments enable row level security;
alter table public.cdl_payment_agreements enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.cdl_notification_log enable row level security;

create policy "Students read own tuition accounts" on public.cdl_tuition_accounts for select to authenticated using (user_id=auth.uid());
create policy "Admins manage tuition accounts" on public.cdl_tuition_accounts for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "Students read own installments" on public.cdl_tuition_installments for select to authenticated using (exists(select 1 from public.cdl_tuition_accounts a where a.id=tuition_account_id and a.user_id=auth.uid()));
create policy "Admins manage installments" on public.cdl_tuition_installments for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "Students read own agreements" on public.cdl_payment_agreements for select to authenticated using (user_id=auth.uid());
create policy "Staff read agreements" on public.cdl_payment_agreements for select to authenticated using (public.is_iman_staff());
create policy "Staff read notification log" on public.cdl_notification_log for select to authenticated using (public.is_iman_staff());

revoke all on public.cdl_tuition_accounts, public.cdl_tuition_installments, public.cdl_payment_agreements, public.stripe_webhook_events, public.cdl_notification_log from anon;
grant select on public.cdl_tuition_accounts, public.cdl_tuition_account_balances, public.cdl_tuition_installments, public.cdl_payment_agreements to authenticated;
grant select, insert, update on public.cdl_tuition_accounts, public.cdl_tuition_installments to authenticated;
grant select on public.cdl_notification_log to authenticated;

-- Expand privacy-safe financing milestones without storing credit data.
alter table public.cdl_financing_referrals drop constraint if exists cdl_financing_referrals_status_check;
alter table public.cdl_financing_referrals add constraint cdl_financing_referrals_status_check
  check (status in ('REFERRED','STUDENT_REPORTED_SUBMITTED','UNDER_REVIEW','APPROVED','PARTIALLY_APPROVED','DECLINED','FUNDED','FOLLOW_UP_NEEDED','CLOSED'));
alter table public.cdl_financing_referrals
  add column if not exists approved_amount_cents integer check (approved_amount_cents is null or approved_amount_cents >= 0),
  add column if not exists funded_amount_cents integer check (funded_amount_cents is null or funded_amount_cents >= 0),
  add column if not exists tuition_account_id uuid references public.cdl_tuition_accounts(id) on delete set null;
grant update (status, staff_notes, updated_by, approved_amount_cents, funded_amount_cents, tuition_account_id) on public.cdl_financing_referrals to authenticated;
drop policy if exists "Staff update financing referrals" on public.cdl_financing_referrals;
create policy "Admins update financing referrals" on public.cdl_financing_referrals
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
