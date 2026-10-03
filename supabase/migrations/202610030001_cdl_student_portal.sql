-- CDL student portal: one applications table for CDL Training and CDL
-- Assessment requests, owned by the student's auth user, with a status
-- history, private document uploads and server-side status transitions.
--
-- Students write through RLS (drafts only) and the submit_application() RPC.
-- Staff change status through set_application_status(). Both RPCs are
-- security definer, so they run as the function owner; the column guard below
-- only restricts the client roles (anon/authenticated).

create extension if not exists pgcrypto;

create or replace function public.iman_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Student profile fields reused by the application forms
-- ---------------------------------------------------------------------------
alter table public.cdl_students
  add column if not exists email text,
  add column if not exists date_of_birth date,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip_code text,
  add column if not exists license_number text,
  add column if not exists license_state text,
  add column if not exists license_type text;

-- NOT VALID: enforced for new writes without failing on legacy rows.
alter table public.cdl_students drop constraint if exists cdl_students_state_check;
alter table public.cdl_students add constraint cdl_students_state_check
  check (state is null or state ~ '^[A-Z]{2}$') not valid;
alter table public.cdl_students drop constraint if exists cdl_students_zip_check;
alter table public.cdl_students add constraint cdl_students_zip_check
  check (zip_code is null or zip_code ~ '^\d{5}(-\d{4})?$') not valid;
alter table public.cdl_students drop constraint if exists cdl_students_phone_check;
alter table public.cdl_students add constraint cdl_students_phone_check
  check (phone is null or phone = '' or length(regexp_replace(phone, '\D', '', 'g')) between 10 and 15) not valid;
alter table public.cdl_students drop constraint if exists cdl_students_license_type_check;
alter table public.cdl_students add constraint cdl_students_license_type_check
  check (license_type is null or license_type in ('NONE', 'REGULAR', 'CLP', 'CDL')) not valid;
alter table public.cdl_students drop constraint if exists cdl_students_license_state_check;
alter table public.cdl_students add constraint cdl_students_license_state_check
  check (license_state is null or license_state = '' or license_state ~ '^[A-Z]{2}$') not valid;

drop trigger if exists cdl_students_touch_updated_at on public.cdl_students;
create trigger cdl_students_touch_updated_at
before update on public.cdl_students
for each row execute procedure public.iman_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Applications
-- ---------------------------------------------------------------------------
alter table public.cdl_class_applications
  add column if not exists application_type text not null default 'TRAINING',
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists reference_no text,
  add column if not exists form_data jsonb not null default '{}'::jsonb,
  add column if not exists preferred_dates text,
  add column if not exists scheduled_at timestamptz,
  add column if not exists scheduled_location text,
  add column if not exists staff_message text,
  add column if not exists elp_submission_id text references public.elp_submissions(id) on delete set null;

alter table public.cdl_class_applications alter column course_id drop not null;
alter table public.cdl_class_applications alter column session_id drop not null;
-- Drafts are not submitted yet; submit_application() sets this.
alter table public.cdl_class_applications alter column submitted_at drop default;

alter table public.cdl_class_applications drop constraint if exists cdl_class_applications_application_type_check;
alter table public.cdl_class_applications add constraint cdl_class_applications_application_type_check
  check (application_type in ('TRAINING', 'ASSESSMENT'));

alter table public.cdl_class_applications drop constraint if exists cdl_class_applications_status_check;
alter table public.cdl_class_applications add constraint cdl_class_applications_status_check
  check (status in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED', 'APPROVED', 'SCHEDULED', 'COMPLETED', 'REJECTED'));

alter table public.cdl_class_applications drop constraint if exists cdl_class_applications_form_data_check;
alter table public.cdl_class_applications add constraint cdl_class_applications_form_data_check
  check (jsonb_typeof(form_data) = 'object' and pg_column_size(form_data) <= 65536);

create or replace function public.cdl_new_reference_no(p_type text)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := (case p_type when 'ASSESSMENT' then 'ASM' else 'TRN' end)
      || '-' || to_char(now(), 'YYYY') || '-'
      || (select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
          from generate_series(1, 6));
    exit when not exists (select 1 from public.cdl_class_applications where reference_no = candidate);
  end loop;
  return candidate;
end;
$$;

-- Backfill owner and reference numbers for existing rows (before the guard
-- trigger exists, so legacy rows keep their timestamps).
update public.cdl_class_applications a
set user_id = s.user_id
from public.cdl_students s
where a.user_id is null and a.student_id = s.id and s.user_id is not null;

update public.cdl_class_applications a
set user_id = u.id
from auth.users u
where a.user_id is null
  and u.email_confirmed_at is not null
  and lower(a.email) = lower(u.email);

update public.cdl_class_applications
set reference_no = public.cdl_new_reference_no(application_type)
where reference_no is null;

alter table public.cdl_class_applications alter column reference_no set not null;
create unique index if not exists uq_cdl_class_applications_reference_no
  on public.cdl_class_applications(reference_no);
create unique index if not exists uq_one_draft_per_type
  on public.cdl_class_applications(user_id, application_type) where status = 'DRAFT';
create index if not exists idx_cdl_class_applications_user
  on public.cdl_class_applications(user_id, created_at desc);

-- Internal staff notes move to a staff-only table: a student can read every
-- column of their own application row, so notes cannot live there.
create table if not exists public.cdl_application_staff_notes (
  application_id uuid primary key references public.cdl_class_applications(id) on delete cascade,
  notes text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'cdl_class_applications' and column_name = 'staff_notes') then
    insert into public.cdl_application_staff_notes (application_id, notes)
    select id, staff_notes from public.cdl_class_applications
    where coalesce(staff_notes, '') <> ''
    on conflict (application_id) do nothing;
    alter table public.cdl_class_applications drop column staff_notes;
  end if;
end $$;

alter table public.cdl_application_staff_notes enable row level security;
drop policy if exists "Staff manage staff notes" on public.cdl_application_staff_notes;
create policy "Staff manage staff notes" on public.cdl_application_staff_notes
  for all to authenticated using (public.is_iman_staff()) with check (public.is_iman_staff());
revoke all on public.cdl_application_staff_notes from anon;
grant select, insert, update, delete on public.cdl_application_staff_notes to authenticated;

-- Column guard. Client roles that are not staff may only edit the
-- student-owned answer fields; everything else is set by the RPCs, staff or
-- the API server (service role).
create or replace function public.cdl_applications_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    if new.reference_no is null or current_user in ('authenticated', 'anon') then
      new.reference_no := public.cdl_new_reference_no(new.application_type);
    end if;
  end if;

  if current_user not in ('authenticated', 'anon') or public.is_iman_staff() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'DRAFT' then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    new.student_id := (select id from public.cdl_students where user_id = auth.uid());
    new.submitted_at := null;
    new.staff_message := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.scheduled_at := null;
    new.scheduled_location := null;
    new.elp_submission_id := null;
    new.payment_status := 'not_required';
    new.payment_id := null;
    new.payment_policy_accepted_at := null;
    new.payment_policy_signature := null;
    new.payment_policy_version := null;
    return new;
  end if;

  if (new.id, new.status, new.user_id, new.application_type, new.reference_no, new.student_id,
      new.staff_message, new.reviewed_at, new.reviewed_by, new.scheduled_at, new.scheduled_location,
      new.submitted_at, new.elp_submission_id, new.payment_status, new.payment_id,
      new.payment_policy_accepted_at, new.payment_policy_signature, new.payment_policy_version, new.created_at)
     is distinct from
     (old.id, old.status, old.user_id, old.application_type, old.reference_no, old.student_id,
      old.staff_message, old.reviewed_at, old.reviewed_by, old.scheduled_at, old.scheduled_location,
      old.submitted_at, old.elp_submission_id, old.payment_status, old.payment_id,
      old.payment_policy_accepted_at, old.payment_policy_signature, old.payment_policy_version, old.created_at)
  then
    raise exception 'protected_field' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists cdl_applications_guard on public.cdl_class_applications;
create trigger cdl_applications_guard
before insert or update on public.cdl_class_applications
for each row execute procedure public.cdl_applications_guard();

-- RLS: replace every earlier policy on the table.
drop policy if exists "Students can read own applications" on public.cdl_class_applications;
drop policy if exists "Admins can read all applications" on public.cdl_class_applications;
drop policy if exists "Anyone can create applications" on public.cdl_class_applications;
drop policy if exists "Admins can update applications" on public.cdl_class_applications;
drop policy if exists "Staff can read applications" on public.cdl_class_applications;
drop policy if exists "Staff can update applications" on public.cdl_class_applications;
drop policy if exists "Students read own applications" on public.cdl_class_applications;
drop policy if exists "Students create draft applications" on public.cdl_class_applications;
drop policy if exists "Students update editable applications" on public.cdl_class_applications;
drop policy if exists "Students delete own drafts" on public.cdl_class_applications;
drop policy if exists "Staff read applications" on public.cdl_class_applications;
drop policy if exists "Staff update applications" on public.cdl_class_applications;

create policy "Students read own applications" on public.cdl_class_applications
  for select to authenticated using (user_id = auth.uid());
create policy "Staff read applications" on public.cdl_class_applications
  for select to authenticated using (public.is_iman_staff());
create policy "Students create draft applications" on public.cdl_class_applications
  for insert to authenticated with check (user_id = auth.uid() and status = 'DRAFT');
create policy "Students update editable applications" on public.cdl_class_applications
  for update to authenticated
  using (user_id = auth.uid() and status in ('DRAFT', 'INFO_REQUIRED'))
  with check (user_id = auth.uid() and status in ('DRAFT', 'INFO_REQUIRED'));
create policy "Staff update applications" on public.cdl_class_applications
  for update to authenticated using (public.is_iman_staff()) with check (public.is_iman_staff());
create policy "Students delete own drafts" on public.cdl_class_applications
  for delete to authenticated using (user_id = auth.uid() and status = 'DRAFT');

revoke all on public.cdl_class_applications from anon;
grant select, insert, update, delete on public.cdl_class_applications to authenticated;

-- Payments for an application are visible to the application's owner.
drop policy if exists "Students read payments for own applications" on public.cdl_payments;
create policy "Students read payments for own applications" on public.cdl_payments
  for select to authenticated using (
    application_id in (select id from public.cdl_class_applications where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Status history
-- ---------------------------------------------------------------------------
create table if not exists public.cdl_application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.cdl_class_applications(id) on delete cascade,
  from_status text,
  to_status text not null,
  message text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_cdl_application_events_app
  on public.cdl_application_events(application_id, created_at);

alter table public.cdl_application_events enable row level security;
drop policy if exists "Students read own application events" on public.cdl_application_events;
create policy "Students read own application events" on public.cdl_application_events
  for select to authenticated using (
    exists (select 1 from public.cdl_class_applications a where a.id = application_id and a.user_id = auth.uid())
  );
drop policy if exists "Staff read application events" on public.cdl_application_events;
create policy "Staff read application events" on public.cdl_application_events
  for select to authenticated using (public.is_iman_staff());
revoke all on public.cdl_application_events from anon, authenticated;
grant select on public.cdl_application_events to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Documents (private bucket + metadata table)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-documents', 'student-documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.cdl_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.cdl_class_applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null check (doc_type in ('LICENSE_CLP', 'OTHER')),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  status text not null default 'UPLOADED' check (status in ('UPLOADED', 'ACCEPTED', 'REJECTED')),
  created_at timestamptz not null default now(),
  constraint cdl_application_documents_path_check check (
    storage_path like user_id::text || '/' || application_id::text || '/%'
    and storage_path !~ '(\.\.|//|\\)'
  )
);
create index if not exists idx_cdl_application_documents_app
  on public.cdl_application_documents(application_id);
create index if not exists idx_cdl_application_documents_user
  on public.cdl_application_documents(user_id);

alter table public.cdl_application_documents enable row level security;
drop policy if exists "Students read own documents" on public.cdl_application_documents;
create policy "Students read own documents" on public.cdl_application_documents
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Staff read documents" on public.cdl_application_documents;
create policy "Staff read documents" on public.cdl_application_documents
  for select to authenticated using (public.is_iman_staff());
drop policy if exists "Students add documents to editable applications" on public.cdl_application_documents;
create policy "Students add documents to editable applications" on public.cdl_application_documents
  for insert to authenticated with check (
    user_id = auth.uid()
    and status = 'UPLOADED'
    and exists (
      select 1 from public.cdl_class_applications a
      where a.id = application_id and a.user_id = auth.uid() and a.status in ('DRAFT', 'INFO_REQUIRED')
    )
  );
drop policy if exists "Students remove documents from editable applications" on public.cdl_application_documents;
create policy "Students remove documents from editable applications" on public.cdl_application_documents
  for delete to authenticated using (
    user_id = auth.uid()
    and exists (
      select 1 from public.cdl_class_applications a
      where a.id = application_id and a.user_id = auth.uid() and a.status in ('DRAFT', 'INFO_REQUIRED')
    )
  );
drop policy if exists "Staff review documents" on public.cdl_application_documents;
create policy "Staff review documents" on public.cdl_application_documents
  for update to authenticated using (public.is_iman_staff()) with check (public.is_iman_staff());
revoke all on public.cdl_application_documents from anon;
grant select, insert, update, delete on public.cdl_application_documents to authenticated;

-- Storage objects: <uid>/<application_id>/<file>. A student writes and reads
-- only inside their own folder; staff read everything in the bucket. A file
-- still attached to a locked (submitted) application cannot be deleted.
drop policy if exists "Students upload own documents" on storage.objects;
create policy "Students upload own documents" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'student-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "Students and staff read documents" on storage.objects;
create policy "Students and staff read documents" on storage.objects
  for select to authenticated using (
    bucket_id = 'student-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_iman_staff())
  );
drop policy if exists "Students delete own unlocked documents" on storage.objects;
create policy "Students delete own unlocked documents" on storage.objects
  for delete to authenticated using (
    bucket_id = 'student-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1
      from public.cdl_application_documents d
      join public.cdl_class_applications a on a.id = d.application_id
      where d.storage_path = objects.name
        and a.status not in ('DRAFT', 'INFO_REQUIRED')
    )
  );

-- ---------------------------------------------------------------------------
-- 5. RPCs
-- ---------------------------------------------------------------------------
create or replace function public.submit_application(p_id uuid)
returns public.cdl_class_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.cdl_class_applications;
  profile jsonb;
  license jsonb;
  dob date;
  previous text;
begin
  select * into app from public.cdl_class_applications where id = p_id for update;
  if not found or app.user_id is distinct from auth.uid() then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if app.status not in ('DRAFT', 'INFO_REQUIRED') then
    raise exception 'invalid_transition';
  end if;
  previous := app.status;

  profile := coalesce(app.form_data -> 'profile', '{}'::jsonb);
  license := coalesce(app.form_data -> 'license', '{}'::jsonb);

  if btrim(coalesce(app.first_name, '')) = '' then raise exception 'invalid_field:first_name'; end if;
  if btrim(coalesce(app.last_name, '')) = '' then raise exception 'invalid_field:last_name'; end if;
  if coalesce(app.email, '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_field:email'; end if;
  if length(regexp_replace(coalesce(app.phone, ''), '\D', '', 'g')) not between 10 and 15 then
    raise exception 'invalid_field:phone';
  end if;

  begin
    dob := (profile ->> 'dateOfBirth')::date;
  exception when others then
    dob := null;
  end;
  if dob is null or dob > (current_date - interval '18 years')::date or dob < (current_date - interval '100 years')::date then
    raise exception 'invalid_field:date_of_birth';
  end if;
  if btrim(coalesce(profile ->> 'addressLine1', '')) = '' then raise exception 'invalid_field:address_line1'; end if;
  if btrim(coalesce(profile ->> 'city', '')) = '' then raise exception 'invalid_field:city'; end if;
  if coalesce(profile ->> 'state', '') !~ '^[A-Z]{2}$' then raise exception 'invalid_field:state'; end if;
  if coalesce(profile ->> 'zipCode', '') !~ '^\d{5}(-\d{4})?$' then raise exception 'invalid_field:zip_code'; end if;

  if coalesce(license ->> 'licenseType', '') not in ('NONE', 'REGULAR', 'CLP', 'CDL') then
    raise exception 'invalid_field:license_type';
  end if;
  if license ->> 'licenseType' <> 'NONE' then
    if coalesce(license ->> 'licenseNumber', '') !~* '^[A-Z0-9-]{4,30}$' then raise exception 'invalid_field:license_number'; end if;
    if coalesce(license ->> 'licenseState', '') !~ '^[A-Z]{2}$' then raise exception 'invalid_field:license_state'; end if;
  end if;

  if app.application_type = 'TRAINING' then
    if app.course_id is null then raise exception 'invalid_field:course_id'; end if;
    if app.session_id is null then raise exception 'invalid_field:session_id'; end if;
  else
    if length(btrim(coalesce(app.preferred_dates, ''))) < 3 then raise exception 'invalid_field:preferred_dates'; end if;
  end if;

  if not exists (
    select 1 from public.cdl_application_documents
    where application_id = app.id and doc_type = 'LICENSE_CLP' and status <> 'REJECTED'
  ) then
    raise exception 'missing_document';
  end if;

  if app.application_type = 'ASSESSMENT' and not exists (
    select 1 from public.elp_submissions e
    where e.id = app.elp_submission_id and e.student_id = app.user_id and e.evaluation is not null
  ) then
    raise exception 'missing_assessment_test';
  end if;

  update public.cdl_class_applications
  set status = 'SUBMITTED', submitted_at = now()
  where id = app.id
  returning * into app;

  insert into public.cdl_application_events (application_id, from_status, to_status, actor_id)
  values (app.id, previous, 'SUBMITTED', auth.uid());

  return app;
end;
$$;

create or replace function public.set_application_status(
  p_id uuid,
  p_status text,
  p_message text default null,
  p_scheduled_at timestamptz default null,
  p_location text default null
)
returns public.cdl_class_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.cdl_class_applications;
  previous text;
  allowed text[];
begin
  if not public.is_iman_staff() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into app from public.cdl_class_applications where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  previous := app.status;

  allowed := case previous
    when 'SUBMITTED' then array['UNDER_REVIEW', 'INFO_REQUIRED', 'REJECTED']
    when 'UNDER_REVIEW' then array['INFO_REQUIRED', 'APPROVED', 'REJECTED']
    when 'APPROVED' then array['SCHEDULED']
    when 'SCHEDULED' then array['COMPLETED', 'SCHEDULED']
    else array[]::text[]
  end;
  if not (p_status = any(allowed)) then
    raise exception 'invalid_transition';
  end if;
  if p_status = 'SCHEDULED' and p_scheduled_at is null then
    raise exception 'invalid_field:scheduled_at';
  end if;
  if p_status = 'INFO_REQUIRED' and btrim(coalesce(p_message, '')) = '' then
    raise exception 'invalid_field:message';
  end if;

  update public.cdl_class_applications
  set status = p_status,
      staff_message = coalesce(nullif(btrim(p_message), ''), staff_message),
      reviewed_at = now(),
      reviewed_by = (select id from public.cdl_users where id = auth.uid()),
      scheduled_at = case when p_status = 'SCHEDULED' then p_scheduled_at else scheduled_at end,
      scheduled_location = case when p_status = 'SCHEDULED' then nullif(btrim(p_location), '') else scheduled_location end
  where id = app.id
  returning * into app;

  insert into public.cdl_application_events (application_id, from_status, to_status, message, actor_id)
  values (app.id, previous, p_status, nullif(btrim(p_message), ''), auth.uid());

  return app;
end;
$$;

revoke all on function public.submit_application(uuid) from public, anon;
grant execute on function public.submit_application(uuid) to authenticated;
revoke all on function public.set_application_status(uuid, text, text, timestamptz, text) from public, anon;
grant execute on function public.set_application_status(uuid, text, text, timestamptz, text) to authenticated;

notify pgrst, 'reload schema';
