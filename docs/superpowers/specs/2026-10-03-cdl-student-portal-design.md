# CDL Student Portal — Design Spec

Date: 2026-10-03 · Branch: `feature/cdl-student-portal`

## 1. Goal

Turn the IMAN Trucking School site into a professional CDL student portal:
information stays public, every *action* (apply, schedule, upload, track)
requires an account, and the student returns to the action they chose after
signing in. Keep the existing branding (logo, navy `#08085f`, red
`secondary.main`, MUI theme). Remove the Dispatcher Class feature entirely.

Target flow:

```
Public visitor → CDL Training / CDL Assessment info (public)
  → "Apply" → /portal/sign-in?next=/portal/apply/training
  → sign in or create account → back to /portal/apply/training
  → form prefilled from profile → save draft / submit
  → confirmation (reference no.) → optional application fee
  → dashboard: status, documents, schedule
```

## 2. Decisions (confirmed by owner)

| Topic | Decision |
|---|---|
| Dispatcher DB | **Drop everything** — tables, views, FK column, `dispatcher` payment type, and the dispatcher rows in `cdl_payments`. Stripe keeps its own payment records. Irreversible; the migration is a separate file so it can be applied deliberately. |
| CDL Assessment | **Assessment request + online ELP test.** Student submits a request; the existing online ELP test is a step of that application; staff schedule the in-person assessment. |
| Application fee | **Optional after submit.** Offered on the confirmation screen and payable later from the dashboard. |
| Documents | **Driver's license / CLP** and **Other / staff-requested**. |

## 3. Public vs. protected routes

Public (no change in access): `/`, all legacy/program pages, `/cdl-training/`,
`/our-program/`, etc., plus a new **`/cdl-assessment/`** info page (what it is,
requirements, duration, schedule, pricing, "Apply for an assessment" CTA).

Protected (role `student`, active profile):

| Route | Purpose |
|---|---|
| `/portal/` | Dashboard |
| `/portal/apply/training` | New/continue CDL Training application |
| `/portal/apply/assessment` | New/continue CDL Assessment application |
| `/portal/applications/` | My Applications list |
| `/portal/applications/:id` | Detail: status timeline, staff messages, documents, payment, schedule |
| `/portal/documents/` | All my documents |
| `/portal/schedule/` | Scheduled training/assessment dates |
| `/portal/profile/` | Profile & account (reused by forms) |
| `/portal/assessment/test/:applicationId` | Online ELP test (existing component, now tied to an application) |

Auth routes: `/portal/sign-in` and `/portal/register` (one shared component
with tabs). Old URLs redirect: `/cdl-login/` → `/portal/sign-in`,
`/cdl-register/` → `/portal/register`, `/class-application/` →
`/portal/apply/training`, `/cdl-readiness/` → `/cdl-assessment/`,
`/cdl-readiness-results/` → `/portal/applications/`,
`/dispatcher-registration/` → `/`.

### Return-to-action
- `RequireStudent` wrapper: unauthenticated → `/portal/sign-in?next=<path+search>`.
- `next` is sanitized by `safeNextPath()`: must start with `/portal/`, no `//`,
  no scheme, no backslashes; otherwise falls back to `/portal/`.
- Signup with email confirmation: `emailRedirectTo` = `<origin>/portal/sign-in?next=…`
  so the return target survives the email round-trip.
- Staff who sign in through the student page go to `/admin/` (unchanged admin
  login remains at `/admin/login/`).

## 4. Data model (migration `202610030001_cdl_student_portal.sql`)

All additive and idempotent unless stated.

### 4.1 `cdl_students` — profile fields reused by forms
Add: `email`, `phone`, `date_of_birth date`, `address_line1`, `address_line2`,
`city`, `state`, `zip_code`, `license_number`, `license_state`,
`license_type` (`NONE|REGULAR|CLP|CDL`), `updated_at` trigger.
Check constraints: state 2 letters, zip `^\d{5}(-\d{4})?$`, phone 10–15 digits.

### 4.2 `cdl_class_applications` — becomes the single applications table
Add:
- `application_type text not null default 'TRAINING'` check `TRAINING|ASSESSMENT`
- `user_id uuid references auth.users(id) on delete cascade`
- `reference_no text unique` (e.g. `TRN-2026-7F3K9Q`, `ASM-…`), set by trigger
- `form_data jsonb not null default '{}'` (type-specific answers: preferred
  schedule, license info snapshot, ELP submission id, etc.)
- `preferred_dates text`, `scheduled_at timestamptz`, `scheduled_location text`
- `staff_message text` (visible to the student; `staff_notes` stays internal)
- `elp_submission_id text references elp_submissions(id)`
- `course_id`, `session_id` become **nullable** (an ASSESSMENT has no course;
  a TRAINING draft may not have chosen yet). `submit_application()` enforces
  them for TRAINING.

Status check replaced with:
`DRAFT, SUBMITTED, UNDER_REVIEW, INFO_REQUIRED, APPROVED, SCHEDULED, COMPLETED, REJECTED`.
Existing rows keep their values (all are in the new set).

Backfill: `user_id` from `cdl_students.user_id` where `student_id` is set,
otherwise by matching `email` to `auth.users.email` (case-insensitive).

New table `cdl_application_events` (status history / timeline):
`id, application_id fk cascade, from_status, to_status, message, actor_id, created_at`.
Written only by the RPCs below.

Partial unique index: one open `DRAFT` per `(user_id, application_type)` so
"Continue draft" is unambiguous.

### 4.3 Documents
- Storage bucket `student-documents`: **private**, `file_size_limit = 10 MB`,
  `allowed_mime_types = {application/pdf, image/jpeg, image/png}`.
- Object path: `<auth.uid()>/<application_id>/<uuid>.<ext>`.
- `storage.objects` policies: authenticated user may `insert/select/delete`
  only where `(storage.foldername(name))[1] = auth.uid()::text`; staff
  (`is_iman_staff()`) may `select` all in the bucket.
- Table `cdl_application_documents`:
  `id, application_id fk cascade, user_id, doc_type (LICENSE_CLP|OTHER),
  storage_path unique, file_name, mime_type, size_bytes, status
  (UPLOADED|ACCEPTED|REJECTED), created_at`.
  Checks: mime in the allowed set, `size_bytes between 1 and 10485760`,
  `storage_path like user_id || '/' || application_id || '/%'`.
- Students can insert/delete their own document rows only while the parent
  application is `DRAFT` or `INFO_REQUIRED`; downloads use short-lived signed
  URLs (60 s).

### 4.4 RLS on applications (replaces existing policies)
- Drop `"Anyone can create applications"` and the email-matching select policy;
  revoke `insert` from `anon`.
- Student `select`: `user_id = auth.uid()`.
- Student `insert`: `user_id = auth.uid() and status = 'DRAFT'`.
- Student `update`: `user_id = auth.uid() and status in ('DRAFT','INFO_REQUIRED')`
  — with check keeps `user_id` and forbids changing `status`, `staff_*`,
  `reviewed_*`, `scheduled_*`, `reference_no` (enforced by a `BEFORE UPDATE`
  trigger that rejects changes to protected columns unless the caller is staff
  or the transaction-local setting `iman.rpc = 'on'`, which only the RPCs in
  4.5 set).
- Student `delete`: own `DRAFT` only.
- Staff: select/update all (existing behaviour, via `is_iman_staff()`).

### 4.5 RPCs (`security definer`, `search_path = public`)
- `submit_application(p_id uuid)`: caller owns row; status `DRAFT` or
  `INFO_REQUIRED`; validates required fields server-side (name, email, phone,
  DOB 18+, address; TRAINING needs course+session; ASSESSMENT needs
  preferred_dates and a completed ELP submission; at least one LICENSE_CLP
  document); sets `SUBMITTED`, `submitted_at`, writes an event.
- `set_application_status(p_id, p_status, p_message, p_scheduled_at, p_location)`:
  staff only; validates allowed transitions; writes event.

Allowed transitions:
```
DRAFT → SUBMITTED (student)
SUBMITTED → UNDER_REVIEW | INFO_REQUIRED | REJECTED
UNDER_REVIEW → INFO_REQUIRED | APPROVED | REJECTED
INFO_REQUIRED → SUBMITTED (student resubmits)
APPROVED → SCHEDULED (requires scheduled_at)
SCHEDULED → COMPLETED | SCHEDULED (reschedule)
```

### 4.6 Security fixes (migration `202610030002_auth_hardening.sql`)
- `iman_role_for_user()` ignores `user_metadata.role`; only
  `app_metadata.role` (not user-writable) or the super-admin email.
- `profiles`: `BEFORE UPDATE/INSERT` trigger rejects changes to `role`/`active`
  unless the caller is super admin / service role; insert policy limited to
  `role = 'student'`. Same for `cdl_users.role`.
- `elp_submissions`: the student insert policy is dropped. Submissions are
  written only by the Express endpoint `POST /api/elp-submissions`, which
  re-scores the responses server-side with the same scoring module the client
  uses and writes with the service role, so a client cannot forge a score.
- Remove the client-side "create profile from metadata" fallbacks in
  `AuthContext` and `CDLLogin`.

### 4.7 Dispatcher drop (migration `202610030003_drop_dispatcher.sql`)
```
drop view if exists cdl_dispatcher_classes_public, cdl_dispatcher_classes_admin;
delete from cdl_payments where payment_type = 'dispatcher';
alter table cdl_payments drop column if exists dispatcher_registration_id;
alter table cdl_payments drop constraint cdl_payments_payment_type_check,
  add constraint ... check (payment_type in ('registration','application'));
drop table if exists cdl_dispatcher_registrations, cdl_dispatcher_classes;
```
**Data loss:** all dispatcher registrations, classes, and their `cdl_payments`
rows. Recommended: export them from the Supabase dashboard before applying.

## 5. Backend API (`server-express.js`)

- New `requireUser` middleware: reads `Authorization: Bearer <supabase JWT>`,
  verifies with `supabase.auth.getUser(token)`, attaches `req.user`.
- `POST /api/create-application-checkout`: requires auth; application must
  have `user_id = req.user.id` and status not `DRAFT`. Email/name come from the
  row, not the body.
- `POST /api/create-registration-checkout`: requires auth; `studentId` must
  belong to `req.user`.
- `POST /api/elp-submissions`: requires auth; validates shape with zod,
  re-scores server-side, links to the caller's ASSESSMENT application.
- `POST /api/applications/:id/notify`: requires auth + ownership; sends the
  admissions email (replaces the anonymous call to `send-class-application.php`).
- CORS restricted to `APP_URL`/`PUBLIC_SITE_URL` (+ localhost in dev).
- Simple in-memory rate limiter on auth-required POSTs (per user, 20/min).
- Removed: `/api/create-dispatcher-registration`, `/api/create-dispatcher-checkout`,
  dispatcher policy helpers/constants, all `dispatcher` branches in webhook,
  `markRelatedRecord`, `payment-status`, notifications.
- PHP: `send-class-application.php` deleted (replaced by the Express notify
  endpoint). `send-assessment-report.php` requires a valid Supabase JWT
  (verified via `GET <supabase>/auth/v1/user`) and only sends to the
  account's own email.

> Hosting note: the static-only Hostinger option cannot run Express. The
> portal's payments/notify/ELP endpoints already depend on Express today, so
> this spec assumes the Node.js deployment (Option 2). Student CRUD itself
> uses Supabase directly with RLS and works on either.

## 6. Frontend

New files (under `src/portal/`):
- `RequireStudent.tsx`, `safeNextPath.ts`
- `PortalLayout.tsx` — sidebar (desktop ≥ md), top bar + drawer (mobile); items:
  Dashboard, Apply for Training, Apply for Assessment, My Applications,
  Documents, Schedule, Profile, Logout.
- `PortalAuth.tsx` — sign in / create account tabs, field-level errors,
  password rules (≥ 10 chars), "forgot password" via Supabase reset.
- `Dashboard.tsx` — greeting, action cards, "Continue draft" banner, recent
  applications with `StatusChip`, next scheduled date, documents needing action.
- `ApplicationWizard.tsx` — shared stepper for TRAINING/ASSESSMENT:
  1 Personal info (prefilled from profile; "save to my profile" checkbox),
  2 License, 3 Program & session (TRAINING) / Preferred dates (ASSESSMENT),
  4 Documents, 5 Online ELP test (ASSESSMENT only, links to test step),
  6 Review & submit. Autosaves the draft on step change.
- `Confirmation.tsx` — reference number, next steps, optional fee payment
  (existing `PaymentPolicyAgreement` + `createApplicationCheckout`).
- `ApplicationsList.tsx`, `ApplicationDetail.tsx` (timeline from
  `cdl_application_events`, staff message, documents, payment, schedule).
- `DocumentsPage.tsx`, `DocumentUploader.tsx` (client check: type, size,
  extension; upload to Storage then insert row; rollback object on row failure).
- `SchedulePage.tsx`, `ProfilePage.tsx`.
- `StatusChip.tsx` — one color/icon/label map for all statuses, reused by the
  admin applications page.
- `src/lib/portalSchemas.ts` — zod schemas shared by forms (and mirrored in SQL).
- `src/lib/portalApi.ts` — typed Supabase calls (drafts, submit RPC, documents,
  profile) + authed `fetch` helper adding the bearer token.

Changed:
- `App.tsx` — portal routes, redirects, remove dispatcher routes.
- `Header.tsx` — remove "Dispatcher Class"; "Apply for Training" →
  `/portal/apply/training`; "CDL Assessment" → `/cdl-assessment/`; add
  "Sign in" / "My Portal" button (desktop + drawer).
- `navigation.ts` — titles for new pages, remove dispatcher.
- `AuthContext.tsx` — remove metadata-role fallback; expose `signUp`,
  `refreshProfile`; keep local dev accounts.
- `CDLReadinessAssessment.tsx` — becomes the test step: takes `applicationId`,
  submits via `POST /api/elp-submissions`, returns to the wizard; draft key
  scoped per user.
- `CDLReadinessResults.tsx` — folded into `ApplicationDetail` (result section).
- Admin `CDLApplications.tsx` — type filter, new statuses via
  `set_application_status` RPC, scheduling fields, student-visible message,
  document list with signed-URL view, uses `StatusChip`.
- `AdminLayout.tsx`, `AdminDashboard.tsx` — remove dispatcher items.
- `lib/stripe.ts` — remove dispatcher functions; send bearer token.
- Training/program public pages: CTAs point to `/portal/apply/training`.

Deleted: `DispatcherRegistration.tsx`, `DispatcherPolicyAgreement.tsx`,
`admin/DispatcherRegistrations.tsx`, `admin/DispatcherClasses.tsx`,
`CDLLogin.tsx`, `CDLRegister.tsx`, `ClassApplication.tsx` (replaced by portal).

`CDLRegister`'s registration-fee checkout is preserved as an optional action on
the dashboard ("Pay registration fee") for students without a succeeded
registration payment.

### UI standards
Existing theme tokens only; 8-px spacing scale; cards with 12-px radius and the
existing soft navy shadow; one primary (red) action per screen; buttons ≥ 44 px
tall; inline field errors + top summary `Alert` on submit failure; success
`Alert`/snackbar for saves; skeleton loaders; empty states with a CTA; tested
at 360, 768, 1280 px.

## 7. Error handling
- Supabase/API errors mapped to friendly messages (`portalApi.toMessage`);
  raw messages only in `console.error`.
- Network failure during autosave → non-blocking warning, retry on next step.
- Upload failure → per-file error with retry; partially uploaded objects removed.
- Session expiry mid-form → draft already saved; redirect to sign-in with `next`.

## 8. Testing
- Add Vitest (dev dependency): `safeNextPath`, zod schemas, status transition
  map, document validator, ELP scoring parity (client vs server module).
- RLS/RPC tests: SQL script run against Postgres in Docker with a minimal
  `auth` schema stub (`auth.uid()` from a GUC) + all migrations; asserts
  student A cannot read/update student B's application/doc rows, cannot
  escalate role, cannot change status directly, anon cannot insert.
- `npm run build` (tsc + vite) must pass.
- Browser walkthroughs (Chrome) at desktop + mobile widths: public pages
  load without login; Apply → sign-in → register → returns to wizard;
  draft save/continue; submit → confirmation; dashboard status; documents
  upload/view; profile reuse; logout; admin login and applications page still
  work; dispatcher routes redirect home; no dispatcher links remain.
- Live Supabase/Stripe paths that require production credentials are
  verified with local dev accounts and documented as "needs staging check".

## 9. Rollout
1. Export dispatcher data (optional, recommended).
2. Apply migrations in order: `…0001_cdl_student_portal`,
   `…0002_auth_hardening`, `…0003_drop_dispatcher`.
3. Deploy Node server with `APP_URL` set (CORS).
4. Merge `feature/cdl-student-portal` → `main` (triggers Hostinger deploy).

## 10. Out of scope
Instructor-side schedule management beyond setting `scheduled_at`/location on
an application; SMS notifications for status changes; multi-language portal
copy beyond the existing Google-Translate selector.
