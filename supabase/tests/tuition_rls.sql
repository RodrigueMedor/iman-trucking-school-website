-- Tuition ledger, financing and authorization tests.
-- Run against a LOCAL database only (scripts/test-db.sh). Everything happens
-- inside one transaction that is rolled back, so the script is repeatable.
\set ON_ERROR_STOP on
begin;

create schema tt;
create function tt.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function tt.reset() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
grant usage on schema tt to authenticated;
grant execute on all functions in schema tt to authenticated;

-- A and B are students, S is an admin, O is the super administrator.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ta@test.local', '{"first_name":"Tia","last_name":"Able"}', '{}', now(), now(), now()),
  ('10000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tb@test.local', '{"first_name":"Tom","last_name":"Baker"}', '{}', now(), now(), now()),
  ('10000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tadmin@test.local', '{"full_name":"Ada Admin"}', '{"role":"admin"}', now(), now(), now()),
  ('10000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'info@imanlogistics.com', '{"full_name":"Iman"}', '{}', now(), now(), now());

create temp table ids as select
  (select id from public.cdl_students where user_id = '10000000-0000-0000-0000-0000000000a1') as student_a;
grant select on ids to authenticated;

-- ------------------------------------------------ admins manage tuition
select tt.act_as('10000000-0000-0000-0000-0000000000c3');
insert into public.cdl_tuition_accounts (id, user_id, student_id, tuition_cents, deposit_cents, installment_count, installments_enabled)
select '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1', student_a, 500000, 100000, 2, true from ids;
insert into public.cdl_tuition_installments (id, tuition_account_id, installment_no, label, amount_cents) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'Installment 1 of 2', 200000),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 2, 'Installment 2 of 2', 200000);

do $$
declare ok boolean := false;
begin
  begin
    update public.cdl_tuition_accounts set financing_cents = 100000 where id = '20000000-0000-0000-0000-000000000001';
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'a regular admin cannot change financing on a tuition account';
  ok := false;
  begin
    insert into public.cdl_tuition_adjustments (tuition_account_id, amount_cents, reason)
    values ('20000000-0000-0000-0000-000000000001', 100, 'not allowed');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'clients cannot write waivers directly';
  ok := false;
  begin
    update public.cdl_payments set refunded_cents = 0;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'clients cannot write payments';
end $$;
select tt.reset();

-- ------------------------------------------------ students see only their own
select tt.act_as('10000000-0000-0000-0000-0000000000b2');
do $$ begin
  assert (select count(*) from public.cdl_tuition_account_balances) = 0, 'student B cannot see student A tuition';
end $$;
select tt.reset();
select tt.act_as('10000000-0000-0000-0000-0000000000a1');
do $$ begin
  assert (select remaining_cents from public.cdl_tuition_account_balances) = 500000, 'student A sees the full balance';
  assert (select status from public.cdl_tuition_account_balances) = 'OPEN', 'new account is open';
end $$;
select tt.reset();

-- ------------------------------------------------ payments, refunds, status
insert into public.cdl_payments (id, amount_cents, status, payment_type, payment_kind, tuition_account_id, student_id)
select '40000000-0000-0000-0000-000000000001', 100000, 'pending', 'tuition', 'deposit', '20000000-0000-0000-0000-000000000001', student_a from ids;
do $$
declare ok boolean := false;
begin
  assert (select status from public.cdl_tuition_accounts where id = '20000000-0000-0000-0000-000000000001') = 'PAYMENT_PENDING',
    'an open checkout marks the account PAYMENT_PENDING';
  begin
    insert into public.cdl_payments (amount_cents, status, payment_type, tuition_account_id)
    values (5000, 'pending', 'tuition', '20000000-0000-0000-0000-000000000001');
  exception when unique_violation then ok := true;
  end;
  assert ok, 'only one open checkout per tuition account';
end $$;

update public.cdl_payments set status = 'succeeded', succeeded_at = now() where id = '40000000-0000-0000-0000-000000000001';
update public.cdl_payments set refunded_cents = 25000 where id = '40000000-0000-0000-0000-000000000001';
do $$
declare b public.cdl_tuition_account_balances;
declare ok boolean := false;
begin
  select * into b from public.cdl_tuition_account_balances where id = '20000000-0000-0000-0000-000000000001';
  assert b.paid_cents = 75000, 'a partial refund reduces the amount paid';
  assert b.refunded_cents = 25000, 'refunded amount is reported';
  assert b.remaining_cents = 425000, 'a partial refund raises the remaining balance';
  assert b.status = 'OPEN', 'status returns to OPEN once the checkout completes';
  begin
    update public.cdl_payments set refunded_cents = 100001 where id = '40000000-0000-0000-0000-000000000001';
  exception when check_violation then ok := true;
  end;
  assert ok, 'cannot refund more than was paid';
end $$;

-- ------------------------------------------------ financing
insert into public.cdl_financing_referrals (user_id, student_id, status)
select '10000000-0000-0000-0000-0000000000a1', student_a, 'REFERRED' from ids;
do $$ begin
  assert (select tuition_account_id from public.cdl_financing_referrals where user_id = '10000000-0000-0000-0000-0000000000a1')
    = '20000000-0000-0000-0000-000000000001', 'a referral links to the student tuition account';
  assert (select status from public.cdl_tuition_accounts where id = '20000000-0000-0000-0000-000000000001') = 'FINANCING_PENDING',
    'an open referral marks the account FINANCING_PENDING';
end $$;

select tt.act_as('10000000-0000-0000-0000-0000000000c3');
update public.cdl_financing_referrals set status = 'FUNDED', funded_amount_cents = 200000
where user_id = '10000000-0000-0000-0000-0000000000a1';
select tt.reset();
do $$ begin
  assert (select status from public.cdl_financing_referrals where user_id = '10000000-0000-0000-0000-0000000000a1') = 'REFERRED',
    'a regular admin cannot update financing referrals';
end $$;

select tt.act_as('10000000-0000-0000-0000-0000000000f6');
do $$
declare ok boolean := false;
begin
  begin
    update public.cdl_financing_referrals set status = 'FUNDED' where user_id = '10000000-0000-0000-0000-0000000000a1';
  exception when check_violation then ok := true;
  end;
  assert ok, 'FUNDED requires a funded amount';
  ok := false;
  begin
    update public.cdl_financing_referrals set status = 'FUNDED', funded_amount_cents = 600000 where user_id = '10000000-0000-0000-0000-0000000000a1';
  exception when check_violation then ok := true;
  end;
  assert ok, 'funding cannot exceed the tuition';
end $$;
update public.cdl_financing_referrals set status = 'FUNDED', funded_amount_cents = 200000
where user_id = '10000000-0000-0000-0000-0000000000a1';
select tt.reset();
do $$
declare b public.cdl_tuition_account_balances;
begin
  select * into b from public.cdl_tuition_account_balances where id = '20000000-0000-0000-0000-000000000001';
  assert b.financing_cents = 200000, 'FUNDED applies the funded amount';
  assert b.remaining_cents = 225000, 'funding reduces the remaining balance';
  assert b.financing_status = 'FUNDED', 'financing status is reported on the balance';
  assert b.status = 'OPEN', 'funded financing is no longer pending';
end $$;

-- ------------------------------------------------ waivers and payoff
insert into public.cdl_tuition_adjustments (tuition_account_id, installment_id, amount_cents, reason)
values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 25000, 'Scholarship');
do $$ begin
  assert (select remaining_cents from public.cdl_tuition_account_balances where id = '20000000-0000-0000-0000-000000000001') = 200000,
    'a waiver reduces the remaining balance';
end $$;

insert into public.cdl_payments (amount_cents, status, payment_type, payment_method, tuition_account_id, succeeded_at)
values (250000, 'succeeded', 'tuition', 'check', '20000000-0000-0000-0000-000000000001', now());
do $$
declare b public.cdl_tuition_account_balances;
begin
  select * into b from public.cdl_tuition_account_balances where id = '20000000-0000-0000-0000-000000000001';
  assert b.remaining_cents = 0 and b.status = 'PAID', 'paying the balance marks the account PAID';
  assert b.credit_cents = 50000, 'overpayment is reported as a credit';
end $$;

select tt.act_as('10000000-0000-0000-0000-0000000000f6');
update public.cdl_financing_referrals set status = 'CLOSED' where user_id = '10000000-0000-0000-0000-0000000000a1';
select tt.reset();
do $$ begin
  assert (select financing_cents from public.cdl_tuition_accounts where id = '20000000-0000-0000-0000-000000000001') = 0,
    'leaving FUNDED removes the financing from the balance';
  assert (select status from public.cdl_tuition_accounts where id = '20000000-0000-0000-0000-000000000001') = 'OPEN',
    'the balance is due again';
end $$;

\echo 'ALL TUITION TESTS PASSED'
rollback;
