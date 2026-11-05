-- Requests submitted from public website pages: graduate verification,
-- student complaints, careers and prior ELDT training. Additive only.
--
-- Rows are written only by the API server (service role) after validation,
-- rate limiting and spam checks, so anon and authenticated roles cannot
-- insert. Requests can hold personal information (complaints, verification
-- of former students), so only administrators (is_super_admin(): admin or
-- super_admin) can read or triage them. Instructors and students have no
-- access.
--
-- Rollback: drop table public.cdl_website_requests cascade;
--           drop function public.touch_cdl_website_request();

create table if not exists public.cdl_website_requests (
  id uuid primary key default gen_random_uuid(),
  reference_no text not null unique default ('WR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  request_type text not null check (request_type in ('GRADUATE_VERIFICATION', 'STUDENT_COMPLAINT', 'CAREERS', 'ELDT_TRANSFER')),
  status text not null default 'NEW' check (status in ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  full_name text not null check (char_length(full_name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (phone is null or char_length(phone) <= 40),
  message text not null check (char_length(message) between 1 and 4000),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  source_page text check (source_page is null or char_length(source_page) <= 200),
  staff_notes text check (staff_notes is null or char_length(staff_notes) <= 8000),
  updated_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cdl_website_requests_status_idx on public.cdl_website_requests (status, created_at desc);
create index if not exists cdl_website_requests_type_idx on public.cdl_website_requests (request_type, created_at desc);
-- Duplicate-submission check in the API looks up recent rows by email.
create index if not exists cdl_website_requests_email_idx on public.cdl_website_requests (lower(email), created_at desc);

-- Staff edits stamp who and when; resolved_at follows the status.
create or replace function public.touch_cdl_website_request()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if new.status in ('RESOLVED', 'CLOSED') and old.status not in ('RESOLVED', 'CLOSED') then
    new.resolved_at := now();
  elsif new.status in ('NEW', 'IN_PROGRESS') then
    new.resolved_at := null;
  end if;
  return new;
end $$;

drop trigger if exists cdl_website_requests_touch on public.cdl_website_requests;
create trigger cdl_website_requests_touch before update on public.cdl_website_requests
  for each row execute function public.touch_cdl_website_request();

alter table public.cdl_website_requests enable row level security;

revoke all on public.cdl_website_requests from anon, authenticated;
grant select on public.cdl_website_requests to authenticated;
-- Staff may change only the triage fields; what the visitor sent is immutable.
grant update (status, staff_notes) on public.cdl_website_requests to authenticated;

drop policy if exists "Admins read website requests" on public.cdl_website_requests;
create policy "Admins read website requests" on public.cdl_website_requests
  for select to authenticated using (public.is_super_admin());

drop policy if exists "Admins triage website requests" on public.cdl_website_requests;
create policy "Admins triage website requests" on public.cdl_website_requests
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
