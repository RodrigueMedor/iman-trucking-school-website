-- Fixtures for tests/integration: one student with a $5,000 tuition account,
-- a $1,000 deposit and two $2,000 installments.
\set ON_ERROR_STOP on

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
values ('50000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'student@test.local', '{"first_name":"Tia","last_name":"Able"}', '{}', now(), now(), now());

insert into public.cdl_tuition_accounts (id, user_id, student_id, tuition_cents, deposit_cents, installment_count, installments_enabled)
select '60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-0000000000a1', s.id, 500000, 100000, 2, true
from public.cdl_students s where s.user_id = '50000000-0000-0000-0000-0000000000a1';

insert into public.cdl_tuition_installments (id, tuition_account_id, installment_no, label, amount_cents) values
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 1, 'Installment 1 of 2', 200000),
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 2, 'Installment 2 of 2', 200000);

-- A second student and a tuition admin, for authorization checks.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
values
  ('50000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'other@test.local', '{"first_name":"Tom","last_name":"Baker"}', '{}', now(), now(), now()),
  ('50000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@test.local', '{"full_name":"Ada Admin"}', '{"role":"admin"}', now(), now(), now());
