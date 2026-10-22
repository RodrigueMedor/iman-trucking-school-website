-- Student identity verification (Stripe Identity: document + live selfie).
-- Additive only. Document images and biometrics stay with the provider; this
-- schema keeps the outcome, the document type and expiry, the provider
-- reference, consent and an audit trail.
--
-- Statuses shown to students and staff:
--   PENDING        a session was started or is being processed
--   VERIFIED       the provider verified the document and selfie and the name
--                  matches, an administrator approved the student, or the
--                  student already existed when verification was introduced
--   FAILED         the provider could not verify, or staff asked for a new
--                  attempt (the student can try again)
--   MANUAL_REVIEW  needs a person: name mismatch, alternative (in-person)
--                  verification requested, or the provider flagged it
-- A verification only clears identity; it does not prove current DMV license
-- or USCIS immigration status.
--
-- Rollback: drop the trigger on cdl_class_applications, the functions, then
-- cdl_identity_events and cdl_identity_verifications.

create table if not exists public.cdl_identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.cdl_students(id) on delete cascade,
  method text not null default 'PROVIDER' check (method in ('PROVIDER', 'ALTERNATIVE', 'EXEMPT')),
  provider text not null default 'stripe_identity' check (provider in ('stripe_identity', 'none')),
  provider_session_id text unique,
  -- Null only for students exempted when verification was introduced.
  document_type text check (document_type in ('DRIVING_LICENSE', 'GREEN_CARD')),
  status text not null default 'PENDING' check (status in ('PENDING', 'VERIFIED', 'FAILED', 'MANUAL_REVIEW')),
  provider_status text not null default '',
  -- Outcome details. No document images, numbers or biometrics are stored.
  provider_document_type text,
  document_issuing_country text,
  document_expires_on date,
  name_matches boolean,
  failure_code text not null default '',
  failure_reason text not null default '',
  -- Consent to biometric processing, captured before the session is created.
  consent_version text not null,
  consent_at timestamptz not null,
  consent_ip text,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decision_note text not null default '',
  -- Why the status last changed; copied into the audit trail.
  last_action text not null default 'STARTED' check (last_action in ('STARTED', 'PROVIDER_UPDATE', 'ALTERNATIVE_REQUESTED',
    'APPROVED', 'REJECTED', 'RESUBMISSION_REQUESTED', 'REDACTED', 'EXEMPTED')),
  redacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cdl_identity_verifications_document_required check (method = 'EXEMPT' or document_type is not null)
);
create index if not exists idx_cdl_identity_verifications_user on public.cdl_identity_verifications(user_id, created_at desc);
create index if not exists idx_cdl_identity_verifications_status on public.cdl_identity_verifications(status, updated_at desc);
-- One attempt in progress per student, so a double click cannot open two.
create unique index if not exists uq_cdl_identity_verification_open
  on public.cdl_identity_verifications(user_id) where status = 'PENDING';

create table if not exists public.cdl_identity_events (
  id bigint generated always as identity primary key,
  verification_id uuid not null references public.cdl_identity_verifications(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('STARTED', 'PROVIDER_UPDATE', 'ALTERNATIVE_REQUESTED', 'APPROVED', 'REJECTED',
                                         'RESUBMISSION_REQUESTED', 'REDACTED', 'EXEMPTED')),
  from_status text,
  to_status text,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_cdl_identity_events_verification on public.cdl_identity_events(verification_id, created_at);

-- Every status change is recorded, whoever makes it.
create or replace function public.audit_identity_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status and new.last_action is not distinct from old.last_action
     and new.redacted_at is not distinct from old.redacted_at then return null; end if;
  insert into public.cdl_identity_events (verification_id, actor_id, action, from_status, to_status, detail)
  values (new.id, coalesce(new.decided_by, auth.uid()),
    new.last_action,
    case when tg_op = 'UPDATE' then old.status end, new.status,
    left(coalesce(nullif(new.decision_note, ''), nullif(new.failure_reason, ''), ''), 500));
  return null;
end $$;
drop trigger if exists cdl_identity_verifications_audit on public.cdl_identity_verifications;
create trigger cdl_identity_verifications_audit
after insert or update of status, last_action, redacted_at on public.cdl_identity_verifications
for each row execute procedure public.audit_identity_verification();

-- Written only by the API server (service role); students and staff read.
alter table public.cdl_identity_verifications enable row level security;
alter table public.cdl_identity_events enable row level security;
drop policy if exists "Students read own identity verifications" on public.cdl_identity_verifications;
create policy "Students read own identity verifications" on public.cdl_identity_verifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Admins read identity verifications" on public.cdl_identity_verifications;
create policy "Admins read identity verifications" on public.cdl_identity_verifications
  for select to authenticated using (public.is_super_admin());
drop policy if exists "Admins read identity events" on public.cdl_identity_events;
create policy "Admins read identity events" on public.cdl_identity_events
  for select to authenticated using (public.is_super_admin());
revoke all on public.cdl_identity_verifications, public.cdl_identity_events from anon, authenticated;
grant select on public.cdl_identity_verifications, public.cdl_identity_events to authenticated;

-- True once the student's identity is cleared (provider or administrator).
create or replace function public.identity_verified(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cdl_identity_verifications where user_id = p_user_id and status = 'VERIFIED')
$$;
revoke all on function public.identity_verified(uuid) from public;
grant execute on function public.identity_verified(uuid) to authenticated;

-- Applications cannot be submitted until identity is cleared. Keyed on the
-- caller (submit_application runs as its owner), so staff edits and server
-- writes are not affected.
create or replace function public.require_identity_for_submission()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() = new.user_id
     and new.status = 'SUBMITTED' and old.status is distinct from 'SUBMITTED'
     and not public.is_iman_staff()
     and not public.identity_verified(new.user_id) then
    raise exception 'identity_not_verified' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists cdl_class_applications_identity on public.cdl_class_applications;
create trigger cdl_class_applications_identity
before update of status on public.cdl_class_applications
for each row execute procedure public.require_identity_for_submission();

revoke all on function public.audit_identity_verification(), public.require_identity_for_submission() from public;

-- Students who already exist when verification is introduced are exempt;
-- everyone who registers afterwards must verify. Accounts still waiting for
-- email confirmation are not exempt. Audited like any other decision.
insert into public.cdl_identity_verifications (user_id, student_id, method, provider, document_type, status,
  last_action, consent_version, consent_at, decided_at, decision_note)
select s.user_id, s.id, 'EXEMPT', 'none', null, 'VERIFIED', 'EXEMPTED', 'exempt', now(), now(),
  'Existing student when identity verification was introduced.'
from public.cdl_students s
join auth.users u on u.id = s.user_id
where u.email_confirmed_at is not null
  and not exists (select 1 from public.cdl_identity_verifications v where v.user_id = s.user_id);

notify pgrst, 'reload schema';
