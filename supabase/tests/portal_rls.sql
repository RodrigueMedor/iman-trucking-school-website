-- Student portal authorization tests.
-- Run against a LOCAL database only (scripts/test-db.sh). Everything happens
-- inside one transaction that is rolled back, so the script is repeatable.
\set ON_ERROR_STOP on
begin;

create schema t;
grant usage on schema t to authenticated, anon;

create function t.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function t.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end $$;
create function t.reset() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
grant execute on all functions in schema t to authenticated, anon;

create table t.ids (name text primary key, id uuid);
grant select, insert on t.ids to authenticated, anon;

-- Users: A and B are students; S is staff (role granted via app_metadata);
-- X tries to self-assign super_admin through user metadata at signup.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{"first_name":"Ann","last_name":"Able","full_name":"Ann Able"}', '{}', now(), now(), now()),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '{"first_name":"Ben","last_name":"Baker"}', '{}', now(), now(), now()),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff@test.local', '{"full_name":"Sam Staff"}', '{"role":"admin"}', now(), now(), now()),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x@test.local', '{"full_name":"Mal","role":"super_admin"}', '{}', now(), now(), now());

do $$ begin
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000d4') = 'student',
    'signup metadata must not grant super_admin';
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000c3') = 'admin',
    'app_metadata role is honoured';
end $$;

-- Unverified public signups remain inactive and user metadata still cannot
-- elevate the role. Confirming the email activates only the student account.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pending@test.local', '{"full_name":"Pending","role":"super_admin"}', '{}', null, now(), now());

do $$ begin
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000e5') = 'student',
    'public metadata must not elevate an unverified account';
  assert not (select active from public.profiles where id = '00000000-0000-0000-0000-0000000000e5'),
    'unverified student must be inactive';
end $$;

update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000e5';

do $$ begin
  assert (select active from public.profiles where id = '00000000-0000-0000-0000-0000000000e5'),
    'verified student must become active';
end $$;

-- ---------------------------------------------------------------- role guard
select t.act_as('00000000-0000-0000-0000-0000000000a1');
do $$
declare ok boolean := false;
begin
  begin
    update public.profiles set role = 'super_admin' where id = auth.uid();
  exception when others then ok := true;
  end;
  assert ok, 'student must not change own profile role';
  ok := false;
  begin
    update public.cdl_users set role = 'admin' where id = auth.uid();
  exception when others then ok := true;
  end;
  assert ok, 'student must not change own cdl_users role';
  -- a harmless own-profile update still works
  update public.profiles set full_name = 'Ann A. Able' where id = auth.uid();
  assert found, 'student can update own full_name';
end $$;
select t.reset();

-- ------------------------------------------------- anon cannot create rows
select t.act_as_anon();
do $$
declare ok boolean := false;
begin
  begin
    insert into public.cdl_class_applications (first_name, last_name, email, status)
    values ('Anon', 'Ymous', 'anon@test.local', 'APPROVED');
  exception when others then ok := true;
  end;
  assert ok, 'anon must not insert applications';
end $$;
select t.reset();

-- ------------------------------------------------- student A creates a draft
select t.act_as('00000000-0000-0000-0000-0000000000a1');
do $$
declare app_id uuid; ok boolean := false;
begin
  -- inserting with a non-draft status is refused
  begin
    insert into public.cdl_class_applications (user_id, application_type, first_name, last_name, email, status)
    values (auth.uid(), 'TRAINING', 'Ann', 'Able', 'a@test.local', 'APPROVED');
  exception when others then ok := true;
  end;
  assert ok, 'student cannot insert a non-draft application';

  -- inserting for another user is refused
  ok := false;
  begin
    insert into public.cdl_class_applications (user_id, application_type, first_name, last_name, email, status)
    values ('00000000-0000-0000-0000-0000000000b2', 'TRAINING', 'Ann', 'Able', 'a@test.local', 'DRAFT');
  exception when others then ok := true;
  end;
  assert ok, 'student cannot insert an application for someone else';

  insert into public.cdl_class_applications (user_id, application_type, first_name, last_name, email, status)
  values (auth.uid(), 'TRAINING', 'Ann', 'Able', 'a@test.local', 'DRAFT')
  returning id into app_id;
  assert (select reference_no from public.cdl_class_applications where id = app_id) like 'TRN-%', 'reference number assigned';
  insert into t.ids values ('app_a', app_id);

  -- a second TRAINING draft is refused (one open draft per type)
  ok := false;
  begin
    insert into public.cdl_class_applications (user_id, application_type, first_name, last_name, email, status)
    values (auth.uid(), 'TRAINING', 'Ann', 'Able', 'a@test.local', 'DRAFT');
  exception when unique_violation then ok := true;
  end;
  assert ok, 'only one training draft per student';

  -- protected columns cannot be changed by the student
  ok := false;
  begin
    update public.cdl_class_applications set status = 'APPROVED' where id = app_id;
  exception when others then ok := true;
  end;
  assert ok, 'student cannot set status directly';
  ok := false;
  begin
    update public.cdl_class_applications set staff_message = 'self-approved' where id = app_id;
  exception when others then ok := true;
  end;
  assert ok, 'student cannot write staff_message';
  ok := false;
  begin
    update public.cdl_class_applications set scheduled_at = now() where id = app_id;
  exception when others then ok := true;
  end;
  assert ok, 'student cannot write scheduled_at';
  ok := false;
  begin
    update public.cdl_class_applications set user_id = '00000000-0000-0000-0000-0000000000b2' where id = app_id;
  exception when others then ok := true;
  end;
  assert ok, 'student cannot transfer ownership';

  -- submitting an incomplete application fails with a field error
  ok := false;
  begin
    perform public.submit_application(app_id);
  exception when others then ok := sqlerrm like 'invalid_field:%';
  end;
  assert ok, 'incomplete application is rejected by submit_application';

  -- fill in everything except the license document
  update public.cdl_class_applications set
    phone = '4075550123',
    course_id = (select id from public.cdl_courses where code = 'CDL-A'),
    session_id = (select id from public.cdl_academic_sessions order by starts_at limit 1),
    form_data = jsonb_build_object(
      'profile', jsonb_build_object('dateOfBirth', '1990-01-15', 'addressLine1', '1 Main St', 'city', 'Orlando', 'state', 'FL', 'zipCode', '32801'),
      'license', jsonb_build_object('licenseType', 'REGULAR', 'licenseNumber', 'A123-456', 'licenseState', 'FL'))
  where id = app_id;
  assert found, 'student can edit own draft';

  ok := false;
  begin
    perform public.submit_application(app_id);
  exception when others then ok := sqlerrm = 'missing_document';
  end;
  assert ok, 'submit requires a license document';
end $$;

-- ---------------------------------------------------------- document rules
do $$
declare app_id uuid := (select id from t.ids where name = 'app_a'); ok boolean := false;
begin
  begin
    insert into public.cdl_application_documents (application_id, user_id, doc_type, storage_path, file_name, mime_type, size_bytes)
    values (app_id, auth.uid(), 'LICENSE_CLP', auth.uid() || '/' || app_id || '/x.exe', 'x.exe', 'application/x-msdownload', 100);
  exception when others then ok := true;
  end;
  assert ok, 'executable mime type rejected';
  ok := false;
  begin
    insert into public.cdl_application_documents (application_id, user_id, doc_type, storage_path, file_name, mime_type, size_bytes)
    values (app_id, auth.uid(), 'LICENSE_CLP', auth.uid() || '/' || app_id || '/big.pdf', 'big.pdf', 'application/pdf', 10485761);
  exception when others then ok := true;
  end;
  assert ok, 'file larger than 10 MB rejected';
  ok := false;
  begin
    insert into public.cdl_application_documents (application_id, user_id, doc_type, storage_path, file_name, mime_type, size_bytes)
    values (app_id, auth.uid(), 'LICENSE_CLP', '00000000-0000-0000-0000-0000000000b2/' || app_id || '/l.pdf', 'l.pdf', 'application/pdf', 1000);
  exception when others then ok := true;
  end;
  assert ok, 'storage path outside own folder rejected';

  insert into public.cdl_application_documents (application_id, user_id, doc_type, storage_path, file_name, mime_type, size_bytes)
  values (app_id, auth.uid(), 'LICENSE_CLP', auth.uid() || '/' || app_id || '/license.pdf', 'license.pdf', 'application/pdf', 1000);

  perform public.submit_application(app_id);
  assert (select status from public.cdl_class_applications where id = app_id) = 'SUBMITTED', 'submitted';
  assert (select count(*) from public.cdl_application_events where application_id = app_id and to_status = 'SUBMITTED') = 1, 'event recorded';

  -- once submitted the student can no longer edit it or its documents
  update public.cdl_class_applications set phone = '4075550000' where id = app_id;
  assert not found, 'submitted application is read-only for the student';
  ok := false;
  begin
    insert into public.cdl_application_documents (application_id, user_id, doc_type, storage_path, file_name, mime_type, size_bytes)
    values (app_id, auth.uid(), 'OTHER', auth.uid() || '/' || app_id || '/late.pdf', 'late.pdf', 'application/pdf', 1000);
  exception when others then ok := true;
  end;
  assert ok, 'documents locked after submit';

  -- students cannot call the staff RPC
  ok := false;
  begin
    perform public.set_application_status(app_id, 'APPROVED');
  exception when others then ok := sqlerrm = 'not_allowed';
  end;
  assert ok, 'student cannot use set_application_status';
end $$;

-- storage: a student may only write inside their own folder
do $$
declare ok boolean := false;
begin
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('student-documents', '00000000-0000-0000-0000-0000000000b2/x/evil.pdf', auth.uid());
  exception when others then ok := true;
  end;
  assert ok, 'cannot upload into another student folder';
  insert into storage.objects (bucket_id, name, owner)
  values ('student-documents', auth.uid() || '/' || (select id from t.ids where name = 'app_a') || '/ok.pdf', auth.uid());
end $$;
select t.reset();

do $$ begin
  assert (select public from storage.buckets where id = 'student-documents') = false, 'bucket is private';
  assert (select file_size_limit from storage.buckets where id = 'student-documents') = 10485760, 'bucket size limit';
  assert (select allowed_mime_types from storage.buckets where id = 'student-documents')
    @> array['application/pdf','image/jpeg','image/png'], 'bucket mime list';
end $$;

-- ------------------------------------------------ student B sees nothing of A
select t.act_as('00000000-0000-0000-0000-0000000000b2');
do $$
declare app_id uuid := (select id from t.ids where name = 'app_a');
begin
  assert (select count(*) from public.cdl_class_applications where id = app_id) = 0, 'B cannot read A application';
  assert (select count(*) from public.cdl_application_documents where application_id = app_id) = 0, 'B cannot read A documents';
  assert (select count(*) from public.cdl_application_events where application_id = app_id) = 0, 'B cannot read A events';
  assert (select count(*) from storage.objects where bucket_id = 'student-documents') = 0, 'B cannot list A files';
  update public.cdl_class_applications set phone = '1' where id = app_id;
  assert not found, 'B cannot update A application';
  delete from public.cdl_class_applications where id = app_id;
  assert not found, 'B cannot delete A application';
end $$;
select t.reset();

-- ----------------------------------------------------- staff transitions
select t.act_as('00000000-0000-0000-0000-0000000000c3');
do $$
declare app_id uuid := (select id from t.ids where name = 'app_a'); ok boolean := false;
begin
  assert (select count(*) from public.cdl_class_applications where id = app_id) = 1, 'staff can read';
  assert (select count(*) from storage.objects where bucket_id = 'student-documents') >= 1, 'staff can read files';
  begin
    perform public.set_application_status(app_id, 'SCHEDULED', null, now() + interval '7 days', 'Main yard');
  exception when others then ok := sqlerrm = 'invalid_transition';
  end;
  assert ok, 'SUBMITTED -> SCHEDULED is not allowed';

  perform public.set_application_status(app_id, 'INFO_REQUIRED', 'Please upload the back of your license.');
  assert (select staff_message from public.cdl_class_applications where id = app_id) = 'Please upload the back of your license.', 'message stored';
end $$;
select t.reset();

-- student responds to the info request and resubmits
select t.act_as('00000000-0000-0000-0000-0000000000a1');
do $$
declare app_id uuid := (select id from t.ids where name = 'app_a');
begin
  insert into public.cdl_application_documents (application_id, user_id, doc_type, storage_path, file_name, mime_type, size_bytes)
  values (app_id, auth.uid(), 'OTHER', auth.uid() || '/' || app_id || '/back.png', 'back.png', 'image/png', 2000);
  perform public.submit_application(app_id);
  assert (select status from public.cdl_class_applications where id = app_id) = 'SUBMITTED', 'resubmitted';
end $$;
select t.reset();

select t.act_as('00000000-0000-0000-0000-0000000000c3');
do $$
declare app_id uuid := (select id from t.ids where name = 'app_a'); ok boolean := false;
begin
  perform public.set_application_status(app_id, 'UNDER_REVIEW');
  perform public.set_application_status(app_id, 'APPROVED');
  begin
    perform public.set_application_status(app_id, 'SCHEDULED');
  exception when others then ok := sqlerrm = 'invalid_field:scheduled_at';
  end;
  assert ok, 'scheduling requires a date';
  perform public.set_application_status(app_id, 'SCHEDULED', 'See you at the yard.', now() + interval '7 days', 'Main yard');
  perform public.set_application_status(app_id, 'COMPLETED');
  assert (select count(*) from public.cdl_application_events where application_id = app_id) = 7, 'full history recorded';
end $$;
select t.reset();

-- ------------------------------------------------ assessment requirements
select t.act_as('00000000-0000-0000-0000-0000000000b2');
do $$
declare app_id uuid; ok boolean := false;
begin
  insert into public.cdl_class_applications (user_id, application_type, first_name, last_name, email, phone, preferred_dates, status, form_data)
  values (auth.uid(), 'ASSESSMENT', 'Ben', 'Baker', 'b@test.local', '4075550199', 'Weekday mornings', 'DRAFT',
    jsonb_build_object(
      'profile', jsonb_build_object('dateOfBirth', '1985-05-05', 'addressLine1', '2 Oak Ave', 'city', 'Orlando', 'state', 'FL', 'zipCode', '32803'),
      'license', jsonb_build_object('licenseType', 'CLP', 'licenseNumber', 'B999-111', 'licenseState', 'FL')))
  returning id into app_id;
  assert (select reference_no from public.cdl_class_applications where id = app_id) like 'ASM-%', 'assessment reference';
  insert into public.cdl_application_documents (application_id, user_id, doc_type, storage_path, file_name, mime_type, size_bytes)
  values (app_id, auth.uid(), 'LICENSE_CLP', auth.uid() || '/' || app_id || '/clp.jpg', 'clp.jpg', 'image/jpeg', 5000);
  begin
    perform public.submit_application(app_id);
  exception when others then ok := sqlerrm = 'missing_assessment_test';
  end;
  assert ok, 'assessment requires the online ELP test';

  -- students cannot write ELP results themselves (server re-scores them)
  ok := false;
  begin
    insert into public.elp_submissions (id, student_id, applicant, responses, evaluation, status, submitted_at, duration)
    values ('ELP-FORGED', auth.uid(), '{}', '{}', '{"score":100,"decision":"PASS"}', 'EVALUATED', now(), '1 minutes');
  exception when others then ok := true;
  end;
  assert ok, 'student cannot insert ELP submissions directly';
end $$;
select t.reset();

-- --------------------------------------------------------- dispatcher gone
do $$
declare ok boolean := false;
begin
  assert to_regclass('public.cdl_dispatcher_registrations') is null, 'dispatcher registrations dropped';
  assert to_regclass('public.cdl_dispatcher_classes') is null, 'dispatcher classes dropped';
  assert to_regclass('public.cdl_dispatcher_classes_public') is null, 'dispatcher view dropped';
  assert not exists (select 1 from information_schema.columns where table_name = 'cdl_payments' and column_name = 'dispatcher_registration_id'), 'FK column dropped';
  begin
    insert into public.cdl_payments (amount_cents, payment_type) values (100, 'dispatcher');
  exception when check_violation then ok := true;
  end;
  assert ok, 'dispatcher payment type no longer allowed';
end $$;

-- ------------------------------------------------- super admin is one email
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'Info@ImanLogistics.com', '{"full_name":"Iman"}', '{}', now(), now(), now()),
  ('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rodriguemedor@yahoo.fr', '{"full_name":"Old"}', '{"role":"super_admin"}', now(), now(), now());

do $$
declare ok boolean := false;
begin
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000f6') = 'super_admin',
    'info@imanlogistics.com is super_admin';
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000f7') <> 'super_admin',
    'old email and app_metadata cannot grant super_admin';
  begin
    update public.profiles set role = 'super_admin' where id = '00000000-0000-0000-0000-0000000000c3';
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'privileged writers cannot make another account super_admin';
  update auth.users set email = 'moved@test.local' where id = '00000000-0000-0000-0000-0000000000f6';
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000f6') <> 'super_admin',
    'super_admin is lost when the email changes';
end $$;

\echo 'ALL PORTAL RLS TESTS PASSED'
rollback;
