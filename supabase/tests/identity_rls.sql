-- Identity verification gating and access rules.
-- Run against a LOCAL database only (scripts/test-db.sh). Everything happens
-- inside one transaction that is rolled back, so the script is repeatable.
\set ON_ERROR_STOP on
begin;

create schema it;
create function it.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function it.reset() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
grant usage on schema it to authenticated;
grant execute on all functions in schema it to authenticated;

-- V is a student with no verification; S is an admin.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
values
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'iv@test.local', '{"first_name":"Ivy","last_name":"Vance"}', '{}', now(), now(), now()),
  ('20000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'iadmin@test.local', '{"full_name":"Ida Admin"}', '{"role":"admin"}', now(), now(), now());

create temp table iids as select
  (select id from public.cdl_students where user_id = '20000000-0000-0000-0000-0000000000a1') as student_id,
  (select id from public.cdl_courses where code = 'CDL-A') as course_id,
  (select id from public.cdl_academic_sessions order by starts_at limit 1) as session_id;
grant select on iids to authenticated;

-- A complete training application, ready to submit.
insert into public.cdl_class_applications (id, user_id, student_id, application_type, status, course_id, session_id, first_name, last_name, email, phone, form_data)
select '21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a1', student_id, 'TRAINING', 'DRAFT', course_id, session_id,
  'Ivy', 'Vance', 'iv@test.local', '5135550100',
  '{"profile":{"dateOfBirth":"1990-01-01","addressLine1":"1 Main St","city":"Cincinnati","state":"OH","zipCode":"45202"},"license":{"licenseType":"NONE"}}'::jsonb
from iids;
insert into public.cdl_application_documents (application_id, user_id, doc_type, storage_path, file_name, mime_type, size_bytes)
values ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a1', 'LICENSE_CLP',
  '20000000-0000-0000-0000-0000000000a1/21000000-0000-0000-0000-000000000001/id.pdf', 'id.pdf', 'application/pdf', 1000);

-- ------------------------------------------------ submission gate
select it.act_as('20000000-0000-0000-0000-0000000000a1');
do $$
declare blocked boolean := false;
begin
  assert not public.identity_verified(auth.uid()), 'a new student is not verified';
  begin
    perform public.submit_application('21000000-0000-0000-0000-000000000001');
  exception when others then
    blocked := sqlerrm = 'identity_not_verified';
  end;
  assert blocked, 'an unverified student cannot submit an application';
end $$;

-- Students cannot write their own verification.
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.cdl_identity_verifications (user_id, student_id, document_type, status, consent_version, consent_at)
    select auth.uid(), student_id, 'DRIVING_LICENSE', 'VERIFIED', 'x', now() from iids;
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked, 'students cannot mark themselves verified';
end $$;
select it.reset();

-- A pending attempt does not clear identity; only one may be open.
insert into public.cdl_identity_verifications (id, user_id, student_id, document_type, status, consent_version, consent_at)
select '22000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a1', student_id, 'GREEN_CARD', 'PENDING', 'identity-v1-2026-10', now() from iids;
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.cdl_identity_verifications (user_id, student_id, document_type, status, consent_version, consent_at)
    select '20000000-0000-0000-0000-0000000000a1', student_id, 'GREEN_CARD', 'PENDING', 'identity-v1-2026-10', now() from iids;
  exception when unique_violation then blocked := true;
  end;
  assert blocked, 'only one pending verification per student';
  assert not public.identity_verified('20000000-0000-0000-0000-0000000000a1'), 'pending does not clear identity';
end $$;

-- The provider verifies: the status change is audited and submission works.
update public.cdl_identity_verifications set status = 'VERIFIED', last_action = 'PROVIDER_UPDATE', decided_at = now()
where id = '22000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select count(*) from public.cdl_identity_events where verification_id = '22000000-0000-0000-0000-000000000001') = 2,
    'start and verification are both in the audit trail';
  assert (select to_status from public.cdl_identity_events where verification_id = '22000000-0000-0000-0000-000000000001' order by id desc limit 1) = 'VERIFIED',
    'the audit trail records the new status';
end $$;

select it.act_as('20000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.submit_application('21000000-0000-0000-0000-000000000001');
  assert (select status from public.cdl_class_applications where id = '21000000-0000-0000-0000-000000000001') = 'SUBMITTED',
    'a verified student can submit';
  assert (select count(*) from public.cdl_identity_verifications) = 1, 'students see only their own verifications';
  assert (select count(*) from public.cdl_identity_events) = 0, 'students cannot read the audit trail';
end $$;
select it.reset();

insert into public.cdl_identity_evidence (verification_id, user_id, date_of_birth_enc, files)
values ('22000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a1', 'encrypted', '[]');

select it.act_as('20000000-0000-0000-0000-0000000000c3');
do $$
declare blocked boolean := false;
begin
  assert (select count(*) from public.cdl_identity_events where verification_id = '22000000-0000-0000-0000-000000000001') = 2,
    'admins can read the audit trail';
  begin
    perform 1 from public.cdl_identity_evidence;
  exception when insufficient_privilege then blocked := true;
  end;
  assert blocked, 'stored ID evidence is not readable from the database, even by admins';
end $$;
select it.reset();

\echo 'ALL IDENTITY TESTS PASSED'
rollback;
