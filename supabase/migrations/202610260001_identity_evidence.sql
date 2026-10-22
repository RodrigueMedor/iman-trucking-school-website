-- Copies of identity evidence kept by the school: document images, the
-- selfie, date of birth and document number. Additive only.
--
-- Everything is encrypted by the API server (AES-256-GCM, key held only by
-- the server) before it is written here or to storage, is readable only
-- through the API by the super administrator (every view is audited), and is
-- deleted 30 days after the verification is decided. Stripe's own copy is
-- still redacted 30 days after the decision. Stripe does not export face
-- templates, so none are stored.
--
-- Rollback: delete the identity-evidence bucket objects, drop
-- cdl_identity_evidence, and restore the event action check from
-- 202610250001.

create table if not exists public.cdl_identity_evidence (
  verification_id uuid primary key references public.cdl_identity_verifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Encrypted values (base64). Null after deletion.
  date_of_birth_enc text,
  document_number_enc text,
  -- [{kind: document_front|document_back|selfie, path, mime, size}]
  files jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array'),
  copied_at timestamptz not null default now(),
  purged_at timestamptz
);
create index if not exists idx_cdl_identity_evidence_unpurged on public.cdl_identity_evidence(copied_at) where purged_at is null;

-- No client access at all: the API server (service role) reads it for the
-- super administrator and records each view.
alter table public.cdl_identity_evidence enable row level security;
revoke all on public.cdl_identity_evidence from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('identity-evidence', 'identity-evidence', false, 15728640)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
-- No storage policies: only the service role can read or write this bucket.

alter table public.cdl_identity_events drop constraint if exists cdl_identity_events_action_check;
alter table public.cdl_identity_events add constraint cdl_identity_events_action_check
  check (action in ('STARTED', 'PROVIDER_UPDATE', 'ALTERNATIVE_REQUESTED', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUESTED',
                    'REDACTED', 'EXEMPTED', 'EVIDENCE_COPIED', 'EVIDENCE_VIEWED', 'EVIDENCE_PURGED'));

notify pgrst, 'reload schema';
