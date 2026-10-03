# CDL Student Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public CDL information + an authenticated student portal (apply for training/assessment, drafts, status tracking, documents, schedule, profile) with server-enforced authorization, and full removal of the Dispatcher Class feature.

**Architecture:** React/MUI SPA talks to Supabase directly for student CRUD, protected by RLS + `security definer` RPCs for status transitions. The Express API (service role) handles Stripe, server-side ELP scoring and admissions email, and now requires a Supabase JWT. A private Storage bucket holds documents under `<uid>/<application_id>/`.

**Tech Stack:** React 19, MUI 7, react-router 7, zod, Supabase (Postgres 15, Auth, Storage), Express 4, Stripe, Vitest (new), Supabase CLI via `npx` for a local stack.

**Spec:** `docs/superpowers/specs/2026-10-03-cdl-student-portal-design.md`

## Global Constraints

- Keep existing theme tokens: navy `#08085f`/`primary.main #071a33`, red `secondary.main #d61f2c`, logo `/images/iman-logo.png`, `theme.ts` unchanged.
- Statuses exactly: `DRAFT, SUBMITTED, UNDER_REVIEW, INFO_REQUIRED, APPROVED, SCHEDULED, COMPLETED, REJECTED`.
- Application types exactly: `TRAINING, ASSESSMENT`. Document types exactly: `LICENSE_CLP, OTHER`.
- Uploads: `application/pdf, image/jpeg, image/png`; max 10 485 760 bytes; path `<uid>/<application_id>/<uuid>.<ext>`.
- `next` redirect targets must start with `/portal/`.
- Never run migrations or create accounts against the production Supabase project in `.env`; all DB/browser testing uses the local Supabase stack.
- Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. `next=//evil.com`, `next=https://…`, `next=/\evil` → must land on `/portal/` (unit test in Task 1).
2. Student B guessing student A's application/document id → empty result / RLS error, never data (SQL test in Task 3).
3. Student editing `status`, `staff_message`, `scheduled_at` via direct PostgREST update → rejected (SQL test in Task 3).
4. Upload of a `.exe` renamed `.pdf` (mime mismatch) or an 11 MB PDF → rejected client-side and by bucket/table checks (unit test Task 1, SQL test Task 3).
5. Session expiring mid-wizard → draft retained; re-login returns to the same wizard (browser check in Task 9).

---

## File map

| File | Responsibility |
|---|---|
| `shared/elpScoring.mjs` + `.d.mts` | Pure ELP question data + scoring, imported by the SPA and Express |
| `src/portal/safeNextPath.ts` | Sanitize return-to paths |
| `src/portal/model.ts` | Status/type/doc constants, labels, colors, transitions |
| `src/portal/schemas.ts` | zod schemas for profile + application steps, file validator |
| `src/portal/api.ts` | Typed Supabase + authed API calls |
| `src/portal/RequireStudent.tsx` | Route guard |
| `src/portal/PortalAuth.tsx` | Sign in / create account / forgot password |
| `src/portal/PortalLayout.tsx` | Sidebar/drawer shell |
| `src/portal/StatusChip.tsx` | Status display (portal + admin) |
| `src/portal/pages/*.tsx` | Dashboard, Wizard, Confirmation, Applications, Detail, Documents, Schedule, Profile, AssessmentTest |
| `src/portal/DocumentUploader.tsx` | Validated upload widget |
| `src/pages/CDLAssessmentInfo.tsx` | Public assessment info page |
| `supabase/migrations/202610030001…0003` | Portal schema, auth hardening, dispatcher drop |
| `supabase/tests/portal_rls.sql` | RLS/RPC assertions |
| `server-express.js` | Auth middleware, CORS, new endpoints, dispatcher removal |
| `tests/*.test.ts` | Vitest unit + API tests |

---

### Task 1: Test tooling + pure portal libraries

**Files:** Create `vitest.config.ts`, `src/portal/safeNextPath.ts`, `src/portal/model.ts`, `src/portal/schemas.ts`, `tests/portal-lib.test.ts`. Modify `package.json` (devDep `vitest`, script `"test": "vitest run"`).

**Interfaces (produces):**
- `safeNextPath(raw: string | null | undefined, fallback = '/portal/'): string`
- `model.ts`: `APPLICATION_STATUSES`, `type ApplicationStatus`, `APPLICATION_TYPES`, `type ApplicationType`, `DOC_TYPES`, `type DocType`, `STATUS_META: Record<ApplicationStatus,{label:string;color:'default'|'info'|'warning'|'success'|'error'|'primary'|'secondary';description:string}>`, `STAFF_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]>`, `isEditableByStudent(s): boolean`, `TYPE_LABEL`, `DOC_LABEL`.
- `schemas.ts`: `profileSchema`, `licenseSchema`, `trainingChoiceSchema`, `assessmentChoiceSchema`, `type ProfileInput`, `validateUploadFile(file: {name:string;type:string;size:number}): string | null`, `MAX_UPLOAD_BYTES`, `ALLOWED_MIME`.

- [ ] Step 1: write `tests/portal-lib.test.ts` covering: `safeNextPath` accepts `/portal/apply/training?x=1`; rejects `//evil.com`, `https://evil.com`, `/\\evil`, `/admin/`, `''`, `null` → `/portal/`. `validateUploadFile` rejects `.exe` with pdf mime, `a.pdf` with `application/x-msdownload`, size 0, size 10 485 761; accepts `a.PDF` pdf mime 1 MB, `a.jpeg` jpeg. `profileSchema` rejects age < 18, bad zip `1234`, bad state `Florida`, phone `12`; accepts a valid profile. `STAFF_TRANSITIONS.APPROVED` equals `['SCHEDULED']`, `STAFF_TRANSITIONS.SCHEDULED` equals `['COMPLETED','SCHEDULED']`; `isEditableByStudent('INFO_REQUIRED') === true`, `('SUBMITTED') === false`.
- [ ] Step 2: `npm test` → fails (modules missing).
- [ ] Step 3: implement the three modules.
- [ ] Step 4: `npm test` → pass.
- [ ] Step 5: commit `Add portal model, validation schemas and Vitest`.

### Task 2: Shared ELP scoring module

**Files:** Create `shared/elpScoring.mjs`, `shared/elpScoring.d.mts`, `tests/elp-scoring.test.ts`. Modify `src/lib/elpAssessment.ts` to re-export data + `automaticallyEvaluate`/`calculateEvaluation` from the shared module (keep existing export names so `CDLReadinessAssessment` and admin pages compile). Modify `tsconfig.app.json` include `shared`.

**Produces:** `automaticallyEvaluate(responses, evaluatorName, evaluatorTitle): ElpEvaluation`, `validateResponsesShape(x: unknown): x is ElpResponses`.

- [ ] Test: all-correct answers → `PASS`, score 100; all-blank → `NOT YET QUALIFIED`, 0; one critical sign wrong with otherwise perfect → `NOT YET QUALIFIED`; `validateResponsesShape` rejects wrong array lengths.
- [ ] Fail → implement (move code, no behaviour change) → pass → commit `Extract ELP scoring into shared module`.

### Task 3: Database migrations + RLS tests

**Files:** Create `supabase/migrations/202610030001_cdl_student_portal.sql`, `202610030002_auth_hardening.sql`, `202610030003_drop_dispatcher.sql`, `supabase/tests/portal_rls.sql`, `scripts/test-db.sh`, `supabase/config.toml` (local stack only; via `npx supabase init`).

**Produces (DB contract used by Tasks 4–9):**
- `cdl_students` new cols per spec 4.1.
- `cdl_class_applications` new cols per spec 4.2; `reference_no` trigger; draft unique index `uq_one_draft_per_type`.
- `cdl_application_events`, `cdl_application_documents`, bucket `student-documents`.
- RPC `submit_application(p_id uuid) returns cdl_class_applications`.
- RPC `set_application_status(p_id uuid, p_status text, p_message text default null, p_scheduled_at timestamptz default null, p_location text default null) returns cdl_class_applications`.
- Protected-column trigger `cdl_applications_guard`; profile role guard `profiles_role_guard`, `cdl_users_role_guard`.

- [ ] Step 1: write `supabase/tests/portal_rls.sql` (runs as `postgres`, impersonates via `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'`), with `do $$ … assert … $$` blocks:
  - A creates a TRAINING draft; B `select` sees 0 rows; B `update` affects 0 rows.
  - A `update … set status='APPROVED'` raises.
  - A `update … set staff_message='x'` raises.
  - A `submit_application` with no license doc raises `missing_document`; after inserting a LICENSE_CLP doc row and required fields → status `SUBMITTED`, one event row.
  - A update after submit affects 0 rows.
  - anon insert into `cdl_class_applications` raises.
  - A `update profiles set role='super_admin'` raises; signup trigger with `raw_user_meta_data.role='super_admin'` yields `student`.
  - doc row with `mime_type='application/x-msdownload'` raises; `size_bytes=10485761` raises; `storage_path` outside own folder raises.
  - staff `set_application_status(…,'SCHEDULED')` from `SUBMITTED` raises `invalid_transition`; APPROVED→SCHEDULED without date raises; with date succeeds.
  - dispatcher tables do not exist; `cdl_payments` check rejects `payment_type='dispatcher'`.
- [ ] Step 2: `scripts/test-db.sh` = `npx supabase db reset --local` then `psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/portal_rls.sql`. Run → fails (objects missing).
- [ ] Step 3: write the three migrations per spec §4.
- [ ] Step 4: run → all assertions pass; also confirm earlier migrations still apply cleanly from zero.
- [ ] Step 5: commit `Add student portal schema, RLS, auth hardening and dispatcher drop migrations`.

### Task 4: Express API — auth, ownership, new endpoints, dispatcher removal

**Files:** Modify `server-express.js`. Create `tests/api.test.ts`.

**Produces:**
- `requireUser(req,res,next)` → `req.user = { id, email }` or 401 `{error:'Sign in required.'}`.
- `POST /api/create-application-checkout` body `{applicationId, paymentPolicyAccepted, paymentPolicySignature}` (auth). 403 if not owner, 409 if DRAFT. Success/cancel URL `/portal/applications/<id>`.
- `POST /api/create-registration-checkout` body `{paymentPolicyAccepted, paymentPolicySignature}` (auth; student resolved from `req.user`). Return URL `/portal/`.
- `POST /api/elp-submissions` body `{applicationId, responses, startedAt}` (auth) → `{ id, evaluation }`; links `elp_submission_id` on the caller's ASSESSMENT application in `DRAFT|INFO_REQUIRED`.
- `POST /api/applications/:id/notify` (auth, owner, status SUBMITTED) → sends admissions email via Resend; 200 `{sent:boolean}`.
- CORS allow-list: `APP_URL`, `PUBLIC_SITE_URL`, `http://localhost:5173`, `http://localhost:3000`.
- Rate limit: 20 req/min per user on the authed POSTs → 429.
- All dispatcher endpoints/helpers/branches removed.

- [ ] Test (Vitest, `app.listen(0)`, no env → supabase null): each authed endpoint without `Authorization` → 401; with `Bearer x` and no Supabase configured → 503; `OPTIONS` from `https://evil.example` gets no `access-control-allow-origin`; `POST /api/create-dispatcher-checkout` → 404; `/api/health` still 200.
- [ ] Fail → implement → pass → commit `Require auth on student API endpoints and remove dispatcher API`.

### Task 5: PHP mail endpoints

**Files:** Delete `public/api/send-class-application.php`. Modify `public/api/send-assessment-report.php`: require `Authorization: Bearer`, verify via `GET {SUPABASE_URL}/auth/v1/user` with `apikey` = `SUPABASE_PUBLISHABLE_KEY` env; recipient forced to the verified user's email; 401 otherwise.
- [ ] Manual check: `php -l`; curl without token → 401.
- [ ] Commit `Require authentication for assessment report email`.

### Task 6: Auth context + portal API + guard + auth page

**Files:** Modify `src/contexts/AuthContext.tsx` (drop metadata-role profile insert; add `signUp(input): Promise<{error?:string; needsConfirmation?:boolean}>`, `resetPassword(email)`, `refreshProfile()`), create `src/portal/api.ts`, `src/portal/RequireStudent.tsx`, `src/portal/PortalAuth.tsx`.

**Produces (`api.ts`):**
`getMyStudent()`, `updateMyStudent(patch)`, `listMyApplications()`, `getApplication(id)`, `getOrCreateDraft(type)`, `saveDraft(id, patch)`, `submitApplication(id)`, `listEvents(id)`, `listDocuments(applicationId?)`, `uploadDocument(applicationId, docType, file)`, `deleteDocument(doc)`, `documentUrl(doc)`, `authedFetch(path, init)`, `toMessage(err): string`, types `StudentProfile`, `Application`, `ApplicationEvent`, `ApplicationDocument`.

- [ ] Unit test `toMessage` maps Postgres codes/messages (`missing_document`, `invalid_transition`, `23514`, `42501`, network `TypeError`) to friendly text.
- [ ] Implement; `npm run build` passes; commit `Add student auth flow, route guard and portal data layer`.

### Task 7: Portal shell, dashboard, status chip

**Files:** Create `src/portal/PortalLayout.tsx`, `src/portal/StatusChip.tsx`, `src/portal/pages/Dashboard.tsx`.
- Dashboard: greeting; 2 primary action cards (Apply Training / Apply Assessment — shows "Continue draft" when a draft exists); "Needs your attention" list (INFO_REQUIRED apps, drafts); recent applications with `StatusChip`; next scheduled item; registration-fee card when unpaid.
- [ ] Build passes; commit `Add student portal layout and dashboard`.

### Task 8: Application wizard, documents, confirmation

**Files:** Create `src/portal/pages/ApplicationWizard.tsx`, `src/portal/DocumentUploader.tsx`, `src/portal/pages/Confirmation.tsx`.
- Steps per spec §6; prefill from `getMyStudent()`; "Save to my profile" default on; autosave on step change; per-field errors from zod; `submitApplication` then `authedFetch('/api/applications/:id/notify')` (non-blocking); navigate to `/portal/applications/:id/confirmation`.
- Confirmation: reference number, next steps, optional fee (existing `PaymentPolicyAgreement`, new `createApplicationCheckout(applicationId, accepted, signature)`).
- [ ] Build passes; commit `Add application wizard, document upload and confirmation`.

### Task 9: Applications, detail, documents, schedule, profile, assessment test

**Files:** Create `src/portal/pages/{ApplicationsList,ApplicationDetail,DocumentsPage,SchedulePage,ProfilePage,AssessmentTest}.tsx`. `AssessmentTest` wraps the existing assessment steps from `CDLReadinessAssessment.tsx` (refactor that file to export `ElpTestForm({ applicant, onSubmit })`), submits via `/api/elp-submissions`, returns to the wizard. Draft key scoped `iman-elp-draft:<uid>:<applicationId>`.
- [ ] Build passes; commit `Add applications, documents, schedule, profile and assessment test pages`.

### Task 10: Routing, header, public assessment page, dispatcher frontend removal, admin updates

**Files:** Modify `src/App.tsx`, `src/components/Header.tsx`, `src/navigation.ts`, `src/components/InternalPage.tsx` (CTA), `src/components/admin/AdminLayout.tsx`, `src/pages/AdminDashboard.tsx`, `src/pages/admin/CDLApplications.tsx` (types, new statuses via `set_application_status`, schedule fields, student message, documents with signed URLs, `StatusChip`), `src/lib/stripe.ts` (remove dispatcher fns; new checkout signatures with bearer). Create `src/pages/CDLAssessmentInfo.tsx`. Delete `DispatcherRegistration.tsx`, `DispatcherPolicyAgreement.tsx`, `admin/DispatcherRegistrations.tsx`, `admin/DispatcherClasses.tsx`, `CDLLogin.tsx`, `CDLRegister.tsx`, `ClassApplication.tsx`, `CDLReadinessResults.tsx`.
- [ ] `grep -ri dispatcher src server-express.js public/api` → no matches.
- [ ] Build + tests pass; commit `Wire portal routes, public assessment page; remove dispatcher UI`.

### Task 11: End-to-end verification

- [ ] Local stack: `npx supabase start`; run app against it (`VITE_SUPABASE_URL=http://127.0.0.1:54321`, local anon key, local service-role key) with `npm run dev`.
- [ ] Chrome walkthrough at 1280 px and 390 px: public pages without login; `/cdl-training/` → Apply → sign-in with `next`; create account → returns to wizard; save draft, leave, "Continue draft"; upload license (valid + invalid file); submit → confirmation; dashboard shows SUBMITTED; staff account sets INFO_REQUIRED with message → student sees it, edits, resubmits; staff APPROVED → SCHEDULED → student schedule page shows date; assessment flow incl. ELP test; second student cannot open first student's `/portal/applications/<id>`; logout; old URLs redirect; admin pages load; no dispatcher links.
- [ ] `npm test`, `scripts/test-db.sh`, `npm run build` all green.
- [ ] Final whole-branch review, then summary to owner.
