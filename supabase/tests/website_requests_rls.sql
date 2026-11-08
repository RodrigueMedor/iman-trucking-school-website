-- Website request access tests. Run against a LOCAL database only
-- (scripts/test-db.sh). One transaction, rolled back, so it is repeatable.
\set ON_ERROR_STOP on
begin;

create schema wr;
create function wr.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function wr.reset() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
grant usage on schema wr to authenticated, anon;
grant execute on all functions in schema wr to authenticated, anon;

-- S is a student, A an admin, I an instructor.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
values
  ('40000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wr-student@test.local', '{"first_name":"Sam","last_name":"Student"}', '{}', now(), now(), now()),
  ('40000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wr-admin@test.local', '{"full_name":"Ann Admin"}', '{"role":"admin"}', now(), now(), now()),
  ('40000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wr-instructor@test.local', '{"full_name":"Ian Instructor"}', '{"role":"instructor"}', now(), now(), now());

-- The API server (service role, bypasses RLS) writes requests.
insert into public.cdl_website_requests (id, request_type, full_name, email, message, details)
values ('50000000-0000-0000-0000-000000000001', 'STUDENT_COMPLAINT', 'Sam Student', 'wr-student@test.local', 'Something went wrong.', '{"complainantStatus":"CURRENT"}');

do $$ begin
  if (select reference_no from public.cdl_website_requests where id = '50000000-0000-0000-0000-000000000001') !~ '^WR-[0-9A-F]{10}$' then
    raise exception 'reference number was not generated';
  end if;
end $$;

-- ------------------------------------------------ anon: no access at all
set local role anon;
do $$ begin
  begin
    insert into public.cdl_website_requests (request_type, full_name, email, message) values ('CAREERS', 'x', 'x@x.co', 'x');
    raise exception 'anon inserted a website request';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.cdl_website_requests;
    raise exception 'anon read website requests';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ------------------------------------------- student: cannot see or write
select wr.act_as('40000000-0000-0000-0000-0000000000a1');
do $$ begin
  if (select count(*) from public.cdl_website_requests) <> 0 then raise exception 'student can read website requests'; end if;
  begin
    insert into public.cdl_website_requests (request_type, full_name, email, message) values ('CAREERS', 'x', 'x@x.co', 'x');
    raise exception 'student inserted a website request';
  exception when insufficient_privilege then null;
  end;
end $$;
select wr.reset();

-- --------------------------------------------- instructor: no visibility
select wr.act_as('40000000-0000-0000-0000-0000000000d4');
do $$ begin
  if (select count(*) from public.cdl_website_requests) <> 0 then raise exception 'instructor can read website requests'; end if;
end $$;
select wr.reset();

-- ------------------------------------------------- admin: read + triage
select wr.act_as('40000000-0000-0000-0000-0000000000c3');
do $$ begin
  if (select count(*) from public.cdl_website_requests) <> 1 then raise exception 'admin cannot read website requests'; end if;
end $$;
update public.cdl_website_requests set status = 'RESOLVED', staff_notes = 'Called back.' where id = '50000000-0000-0000-0000-000000000001';
do $$ begin
  -- What the visitor sent is immutable, even for admins.
  begin
    update public.cdl_website_requests set message = 'edited' where id = '50000000-0000-0000-0000-000000000001';
    raise exception 'admin edited the visitor message';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.cdl_website_requests where id = '50000000-0000-0000-0000-000000000001';
    raise exception 'admin deleted a website request';
  exception when insufficient_privilege then null;
  end;
end $$;
select wr.reset();

do $$
declare r record;
begin
  select * into r from public.cdl_website_requests where id = '50000000-0000-0000-0000-000000000001';
  if r.status <> 'RESOLVED' or r.resolved_at is null or r.updated_by <> '40000000-0000-0000-0000-0000000000c3' then
    raise exception 'triage did not stamp status, resolved_at and updated_by';
  end if;
end $$;

-- Re-opening clears resolved_at.
update public.cdl_website_requests set status = 'IN_PROGRESS' where id = '50000000-0000-0000-0000-000000000001';
do $$ begin
  if (select resolved_at from public.cdl_website_requests where id = '50000000-0000-0000-0000-000000000001') is not null then
    raise exception 'reopening kept resolved_at';
  end if;
end $$;

select 'website_requests_rls: all assertions passed' as result;
rollback;
