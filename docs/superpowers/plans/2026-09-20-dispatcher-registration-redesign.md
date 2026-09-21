# Dispatcher Class Registration Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Dispatcher Class Registration flow with scheduled class sessions (dates, location, seats), a strengthened refund/cancellation policy, richer confirmation emails, a new department notification email, and SMS-ready notification plumbing — without breaking the existing Stripe payment flow.

**Architecture:** Additive changes only. A new Supabase migration adds `location`/`schedule_notes`/`seat_capacity` columns plus two read-only views (`cdl_dispatcher_classes_public` for anonymous visitors, `cdl_dispatcher_classes_admin` for staff) that compute live seat availability. The Express API (`server-express.js`) gains a seat-capacity check at checkout time and two new notification functions; the existing webhook/finalize/Stripe logic is untouched. The public registration page and a new admin CRUD page are extended in React/MUI following existing patterns in this codebase.

**Tech Stack:** React 19 + MUI 7 + TypeScript (Vite), Express 4 + Stripe SDK + Supabase JS + Resend, PostgreSQL (Supabase) migrations, Twilio REST API via native `fetch` (Node ≥18, no new dependency).

**Spec:** `docs/superpowers/specs/2026-09-20-dispatcher-registration-redesign-design.md`

## Global Constraints

- **No test framework exists in this repo** (no jest/vitest, no `test` script in `package.json`, zero `*.test.*`/`*.spec.*` files anywhere). Verification steps in this plan use `tsc -b` / `vite build` for frontend correctness, `node --check` for backend syntax, and manual SQL/curl/browser walkthroughs for behavior — this matches how the rest of the codebase is currently verified. Do not introduce a test framework as part of this feature; that would be unrelated scope.
- **Extend, never replace** the existing Stripe checkout/webhook/policy-signature flow described in the spec's "Current state" section. Do not change the meaning of existing columns, existing payment statuses, or the webhook dispatch table.
- Server-only secrets (`STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) must never be prefixed with `VITE_` and must never be read from `src/` (browser) code — only from `server-express.js`. This matches the existing convention documented in `.env.example`.
- Node `>=18.0.0` is the repo's floor (`package.json` `engines.node`) — the Twilio helper relies on native `fetch`, which is available from Node 18 onward, so no new dependency is added.
- Applying the new Supabase migration to the live project database is a **manual, user-confirmed step** (via the Supabase SQL editor or CLI with real credentials) — no task in this plan executes it automatically against production.
- `seat_capacity` is nullable and null means **unlimited seats** — every query/check that uses it must treat null as "no limit," not zero.

---

## Task 1: Database migration — schedule/location/seats + availability views

**Files:**
- Create: `supabase/migrations/202609200001_dispatcher_classes_schedule_seats.sql`

**Interfaces:**
- Produces: columns `cdl_dispatcher_classes.location`, `.schedule_notes`, `.seat_capacity`; views `public.cdl_dispatcher_classes_public` (columns: `id, name, description, price_cents, starts_at, ends_at, location, schedule_notes, seat_capacity, seats_taken, seats_remaining`) and `public.cdl_dispatcher_classes_admin` (same columns plus `open, created_at`). Later tasks query these by exact name and column list.

- [ ] **Step 1: Write the migration file**

```sql
-- Dispatcher class scheduling, location, and seat capacity.
--
-- Adds location/schedule/seat fields to cdl_dispatcher_classes and two
-- read-only views that compute live seat availability:
--   - cdl_dispatcher_classes_public: OPEN classes only, for the public
--     registration page. Never exposes registration rows/PII, only an
--     aggregated count.
--   - cdl_dispatcher_classes_admin: ALL classes (open + closed), for the
--     staff class-management page.
--
-- A plain Postgres view executes with the privileges of its OWNER for
-- permission checks, not the querying role, so relying on the base
-- table's RLS ("open = true") to filter a view's output is unreliable.
-- Both views instead bake their access rule directly into the view's
-- WHERE clause, so the result is correct regardless of who owns the view.
--
-- Idempotent and safe to re-run.

alter table public.cdl_dispatcher_classes
  add column if not exists location text,
  add column if not exists schedule_notes text,
  add column if not exists seat_capacity integer;

alter table public.cdl_dispatcher_classes drop constraint if exists cdl_dispatcher_classes_seat_capacity_check;
alter table public.cdl_dispatcher_classes
  add constraint cdl_dispatcher_classes_seat_capacity_check
  check (seat_capacity is null or seat_capacity >= 0);

create index if not exists idx_cdl_dispatcher_registrations_class_id
  on public.cdl_dispatcher_registrations(class_id);

-- Public-facing view: OPEN classes only, computed seat availability.
create or replace view public.cdl_dispatcher_classes_public as
select
  c.id,
  c.name,
  c.description,
  c.price_cents,
  c.starts_at,
  c.ends_at,
  c.location,
  c.schedule_notes,
  c.seat_capacity,
  coalesce(r.seats_taken, 0) as seats_taken,
  case
    when c.seat_capacity is null then null
    else greatest(c.seat_capacity - coalesce(r.seats_taken, 0), 0)
  end as seats_remaining
from public.cdl_dispatcher_classes c
left join (
  select class_id, count(*) as seats_taken
  from public.cdl_dispatcher_registrations
  where payment_status = 'paid' and status <> 'CANCELED'
  group by class_id
) r on r.class_id = c.id
where c.open = true;

grant select on public.cdl_dispatcher_classes_public to anon, authenticated;

-- Staff-facing view: ALL classes, same seat math. Access is enforced in
-- the WHERE clause itself (same staff-role check used elsewhere).
create or replace view public.cdl_dispatcher_classes_admin as
select
  c.id,
  c.name,
  c.description,
  c.price_cents,
  c.starts_at,
  c.ends_at,
  c.location,
  c.schedule_notes,
  c.seat_capacity,
  c.open,
  c.created_at,
  coalesce(r.seats_taken, 0) as seats_taken,
  case
    when c.seat_capacity is null then null
    else greatest(c.seat_capacity - coalesce(r.seats_taken, 0), 0)
  end as seats_remaining
from public.cdl_dispatcher_classes c
left join (
  select class_id, count(*) as seats_taken
  from public.cdl_dispatcher_registrations
  where payment_status = 'paid' and status <> 'CANCELED'
  group by class_id
) r on r.class_id = c.id
where public.is_super_admin() or exists (
  select 1 from public.profiles
  where id = auth.uid() and role in ('admin', 'instructor', 'super_admin') and active = true
);

grant select on public.cdl_dispatcher_classes_admin to authenticated;

-- Staff CRUD on the base table. The admin page writes through this table
-- directly and reads through cdl_dispatcher_classes_admin above.
drop policy if exists "Staff can insert dispatcher classes" on public.cdl_dispatcher_classes;
create policy "Staff can insert dispatcher classes" on public.cdl_dispatcher_classes for insert with check (
  public.is_super_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'instructor', 'super_admin') and active = true
  )
);
drop policy if exists "Staff can update dispatcher classes" on public.cdl_dispatcher_classes;
create policy "Staff can update dispatcher classes" on public.cdl_dispatcher_classes for update using (
  public.is_super_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'instructor', 'super_admin') and active = true
  )
);
drop policy if exists "Staff can delete dispatcher classes" on public.cdl_dispatcher_classes;
create policy "Staff can delete dispatcher classes" on public.cdl_dispatcher_classes for delete using (
  public.is_super_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'instructor', 'super_admin') and active = true
  )
);

grant insert, update, delete on public.cdl_dispatcher_classes to authenticated;
```

- [ ] **Step 2: Review the SQL for syntax and idempotency**

Read the file back and confirm every `create`/`alter` uses `if not exists` / `or replace` / `drop ... if exists` first, matching the style of every other file in `supabase/migrations/`. This file is not applied to any database by this task — do not run it against Supabase yet.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202609200001_dispatcher_classes_schedule_seats.sql
git commit -m "$(cat <<'EOF'
Add dispatcher class schedule/location/seats migration

Adds location, schedule_notes, and nullable seat_capacity to
cdl_dispatcher_classes, plus public/admin views that compute live seat
availability without exposing registration PII.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Backend — strengthen the dispatcher payment policy text and bump its version

**Files:**
- Modify: `server-express.js`

**Interfaces:**
- Consumes: none (self-contained constant change).
- Produces: `DISPATCHER_PAYMENT_POLICY_VERSION = 'v2-dispatcher-nonrefundable-credit-schoolcancel'`, updated `DISPATCHER_PAYMENT_POLICY_TEXT`. Consumed by Task 4 and Task 5's email bodies, and already consumed by the existing `dispatcherPolicyRecord()`/`dispatcherStripePolicyCustomText()` functions (no changes needed there — they read the constants).

- [ ] **Step 1: Update the policy constants**

Find in `server-express.js`:

```js
const DISPATCHER_PAYMENT_POLICY_VERSION = 'v1-dispatcher-nonrefundable-credit'
const DISPATCHER_PAYMENT_POLICY_TEXT =
  'All registration payments are non-refundable. If the student cannot attend the class, the payment remains as a credit on their student account and can be used for a future dispatcher class.'
```

Replace with:

```js
const DISPATCHER_PAYMENT_POLICY_VERSION = 'v2-dispatcher-nonrefundable-credit-schoolcancel'
const DISPATCHER_PAYMENT_POLICY_TEXT =
  'All registration payments are non-refundable. If the student cannot attend the class, the payment remains as a credit on their student account and can be used for a future dispatcher class. If Iman Trucking School cancels or reschedules this class session, the student may choose a full refund or a credit toward a future dispatcher class.'
```

Existing rows keep whatever version string was stamped on them at signature time (`payment_policy_version` on `cdl_dispatcher_registrations`) — this change only affects new signatures going forward.

- [ ] **Step 2: Verify syntax**

Run: `node --check server-express.js`
Expected: no output (syntax OK).

- [ ] **Step 3: Commit**

```bash
git add server-express.js
git commit -m "$(cat <<'EOF'
Add school-cancellation clause to dispatcher payment policy

Bumps the policy version so new signatures are distinguishable from the
prior non-refundable-only wording; existing signed rows are unaffected.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Backend — enforce seat capacity at checkout time

**Files:**
- Modify: `server-express.js` (`POST /api/create-dispatcher-checkout`)

**Interfaces:**
- Consumes: `supabase` (module-level service-role client, already defined), `registrationRow.class_id` (already selected by the existing query in this endpoint).
- Produces: a `409 { error: 'This class is full.' }` response path. No new exported symbols.

- [ ] **Step 1: Insert the seat-capacity check**

Find this exact block inside the `/api/create-dispatcher-checkout` handler:

```js
    // The price must come from the class stored on the registration, never from
    // the client-supplied classId, so the amount cannot be tampered with.
    if (classId && classId !== registrationRow.class_id) {
      return res.status(409).json({ error: 'Class does not match the registration' })
    }

    const policyError = dispatcherPolicyError(
```

Replace with:

```js
    // The price must come from the class stored on the registration, never from
    // the client-supplied classId, so the amount cannot be tampered with.
    if (classId && classId !== registrationRow.class_id) {
      return res.status(409).json({ error: 'Class does not match the registration' })
    }

    // Enforce seat capacity at the moment of payment, not just at browse
    // time. seat_capacity is nullable (null = unlimited), so only enforce
    // when a real capacity is set. This also catches the edge case where
    // a class was closed/filled after the registrant started but before
    // they paid.
    if (registrationRow.class_id) {
      const { data: capacityClass } = await supabase
        .from('cdl_dispatcher_classes')
        .select('seat_capacity')
        .eq('id', registrationRow.class_id)
        .maybeSingle()

      if (capacityClass?.seat_capacity != null) {
        const { count: seatsTaken } = await supabase
          .from('cdl_dispatcher_registrations')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', registrationRow.class_id)
          .eq('payment_status', 'paid')
          .neq('status', 'CANCELED')

        if ((seatsTaken || 0) >= capacityClass.seat_capacity) {
          return res.status(409).json({ error: 'This class is full.' })
        }
      }
    }

    const policyError = dispatcherPolicyError(
```

- [ ] **Step 2: Verify syntax**

Run: `node --check server-express.js`
Expected: no output.

- [ ] **Step 3: Verify behavior manually (requires real Supabase + Stripe test-mode credentials in `.env`)**

1. Start the API: `npm run start:api`
2. In the Supabase SQL editor for the actual project (after Task 1's migration has been applied there), create a test class with `seat_capacity = 0` and `open = true`.
3. Create a registration against it via `POST /api/create-dispatcher-registration`, then attempt `POST /api/create-dispatcher-checkout` for that registration.
4. Expected: HTTP 409 with body `{ "error": "This class is full." }`.
5. Delete the test class row afterward.

This step depends on live credentials this coding session does not have — record the result when run with real credentials; do not skip it silently.

- [ ] **Step 4: Commit**

```bash
git add server-express.js
git commit -m "$(cat <<'EOF'
Enforce dispatcher class seat capacity at checkout

Re-checks paid/non-canceled registration count against seat_capacity
immediately before creating the Stripe session, closing the race between
browsing and paying.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Backend — department notification email on successful registration

**Files:**
- Modify: `server-express.js`

**Interfaces:**
- Consumes: `resend`, `supabase`, `dispatcherEmailFrom`, `DISPATCHER_PAYMENT_POLICY_VERSION` (Task 2), `finalizeSuccessfulPayment` (existing function, call site edited here).
- Produces: `dispatcherNotifyEmail` (module constant), `sendDispatcherDepartmentNotification(payment)` (async, no return value used). Called from `finalizeSuccessfulPayment`; Task 6 will add one more call in the same block.

- [ ] **Step 1: Add the recipient constant**

Find:

```js
const dispatcherEmailFrom =
  process.env.DISPATCHER_EMAIL_FROM ||
  process.env.RESULT_EMAIL_FROM ||
  'Iman Trucking School <info@imanlogistics.com>'
```

Add immediately after it:

```js
const dispatcherNotifyEmail = process.env.DISPATCHER_NOTIFY_EMAIL || 'info@imantruckingschool.com'
```

- [ ] **Step 2: Wire the call site in `finalizeSuccessfulPayment`**

Find:

```js
  // Send a confirmation email for successful dispatcher registrations
  if (payment.payment_type === 'dispatcher') {
    await sendDispatcherConfirmation(payment)
  }
```

Replace with:

```js
  // Send confirmation + department notification emails for successful
  // dispatcher registrations. Each call is independently guarded so a
  // failure in one never blocks the other or payment finalization.
  if (payment.payment_type === 'dispatcher') {
    await sendDispatcherConfirmation(payment)
    await sendDispatcherDepartmentNotification(payment)
  }
```

- [ ] **Step 3: Add the new function**

Find the end of `sendDispatcherConfirmation` (the block ending right before `async function handlePaymentIntentFailed`):

```js
  } catch (error) {
    console.error('Failed to send dispatcher confirmation email:', error)
  }
}

async function handlePaymentIntentFailed(paymentIntent) {
```

Replace with:

```js
  } catch (error) {
    console.error('Failed to send dispatcher confirmation email:', error)
  }
}

async function sendDispatcherDepartmentNotification(payment) {
  if (!resend) return
  try {
    const { data: registration } = await supabase
      .from('cdl_dispatcher_registrations')
      .select('*, class:cdl_dispatcher_classes(name, starts_at, ends_at, location, schedule_notes)')
      .eq('id', payment.dispatcher_registration_id)
      .maybeSingle()

    if (!registration) return

    const registrationNo = registration.registration_no || payment.metadata?.registration_no || ''
    const className = registration.class?.name || payment.metadata?.className || 'Dispatcher Training'
    const amount = `$${((payment.amount_cents || 0) / 100).toFixed(2)}`
    const startDate = registration.class?.starts_at
      ? new Date(registration.class.starts_at).toLocaleDateString('en-US', { dateStyle: 'long' })
      : 'Rolling enrollment'
    const endDate = registration.class?.ends_at
      ? new Date(registration.class.ends_at).toLocaleDateString('en-US', { dateStyle: 'long' })
      : null
    const location = registration.class?.location || 'Not specified'
    const scheduleNotes = registration.class?.schedule_notes || 'Not specified'
    const signedAt = registration.payment_policy_accepted_at
      ? new Date(registration.payment_policy_accepted_at).toLocaleString('en-US')
      : 'Not recorded'

    await resend.emails.send({
      from: dispatcherEmailFrom,
      to: dispatcherNotifyEmail,
      subject: `New Dispatcher Registration Paid - ${registrationNo}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #08085f;">New Paid Dispatcher Registration</h2>
          <div style="background: #f5f7fb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Registration Number:</strong> ${registrationNo}</p>
            <p style="margin: 8px 0 0 0;"><strong>Student:</strong> ${registration.first_name} ${registration.last_name}</p>
            <p style="margin: 8px 0 0 0;"><strong>Email:</strong> ${registration.email}</p>
            <p style="margin: 8px 0 0 0;"><strong>Phone:</strong> ${registration.phone || 'Not provided'}</p>
            <p style="margin: 8px 0 0 0;"><strong>Address:</strong> ${registration.address_line1}${registration.address_line2 ? `, ${registration.address_line2}` : ''}, ${registration.city}, ${registration.state} ${registration.zip_code}</p>
          </div>
          <div style="background: #f5f7fb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Class:</strong> ${className}</p>
            <p style="margin: 8px 0 0 0;"><strong>Starts:</strong> ${startDate}</p>
            ${endDate ? `<p style="margin: 8px 0 0 0;"><strong>Ends:</strong> ${endDate}</p>` : ''}
            <p style="margin: 8px 0 0 0;"><strong>Location:</strong> ${location}</p>
            <p style="margin: 8px 0 0 0;"><strong>Schedule:</strong> ${scheduleNotes}</p>
            <p style="margin: 8px 0 0 0;"><strong>Amount Paid:</strong> ${amount}</p>
          </div>
          <div style="background: #fff9e6; border-left: 4px solid #ffb300; padding: 12px 16px; margin: 16px 0; font-size: 14px; color: #5d4037;">
            <strong>Policy signature:</strong> ${registration.payment_policy_signature || 'Not recorded'}<br>
            <strong>Accepted at:</strong> ${signedAt}<br>
            <strong>Policy version:</strong> ${registration.payment_policy_version || DISPATCHER_PAYMENT_POLICY_VERSION}
          </div>
          <p>Review this registration in the <a href="${process.env.APP_URL || process.env.PUBLIC_SITE_URL || ''}/admin/dispatcher-registrations/">admin dashboard</a>.</p>
        </div>
      `,
    })
  } catch (error) {
    console.error('Failed to send dispatcher department notification email:', error)
  }
}

async function handlePaymentIntentFailed(paymentIntent) {
```

- [ ] **Step 4: Verify syntax**

Run: `node --check server-express.js`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add server-express.js
git commit -m "$(cat <<'EOF'
Notify the department by email on every paid dispatcher registration

Sends a second, independent email (student + class + payment + signed
policy details) to DISPATCHER_NOTIFY_EMAIL alongside the existing student
confirmation, guarded so a failure here never blocks the student email or
payment finalization.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Backend — enrich the student confirmation email with location/schedule/policy audit

**Files:**
- Modify: `server-express.js` (`sendDispatcherConfirmation`)

**Interfaces:**
- Consumes: `DISPATCHER_PAYMENT_POLICY_VERSION` (Task 2), `DISPATCHER_PAYMENT_POLICY_TEXT` (Task 2).
- Produces: no signature change to `sendDispatcherConfirmation(payment)` — same call site as before.

- [ ] **Step 1: Replace the function body**

Find:

```js
async function sendDispatcherConfirmation(payment) {
  if (!resend || !payment?.customer_email) return
  try {
    const { data: registration } = await supabase
      .from('cdl_dispatcher_registrations')
      .select('*, class:cdl_dispatcher_classes(name, starts_at)')
      .eq('id', payment.dispatcher_registration_id)
      .maybeSingle()

    const registrationNo = registration?.registration_no || payment.metadata?.registration_no || ''
    const className = registration?.class?.name || payment.metadata?.className || 'Dispatcher Training'
    const amount = `$${((payment.amount_cents || 0) / 100).toFixed(2)}`
    const startDate = registration?.class?.starts_at
      ? new Date(registration.class.starts_at).toLocaleDateString('en-US', { dateStyle: 'long' })
      : 'Rolling enrollment'

    await resend.emails.send({
      from: dispatcherEmailFrom,
      to: payment.customer_email,
      subject: `Dispatcher Class Registration Confirmed - ${registrationNo}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #08085f;">Dispatcher Class Registration Confirmed</h2>
          <p>Dear ${registration?.first_name || 'Student'},</p>
          <p>Thank you for registering for <strong>${className}</strong> at Iman Trucking School. Your registration is confirmed.</p>
          <div style="background: #f5f7fb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Registration Number:</strong> ${registrationNo}</p>
            <p style="margin: 8px 0 0 0;"><strong>Class:</strong> ${className}</p>
            <p style="margin: 8px 0 0 0;"><strong>Starts:</strong> ${startDate}</p>
            <p style="margin: 8px 0 0 0;"><strong>Amount Paid:</strong> ${amount}</p>
            <p style="margin: 8px 0 0 0;"><strong>Payment Status:</strong> Paid</p>
          </div>
          <div style="background: #fff9e6; border-left: 4px solid #ffb300; padding: 12px 16px; margin: 16px 0; font-size: 14px; color: #5d4037;">
            <strong>Registration Policy:</strong> ${DISPATCHER_PAYMENT_POLICY_TEXT}
          </div>
          <p>Please keep this email for your records. Admissions will contact you with class logistics before the session begins.</p>
          <p>Best regards,<br>Iman Trucking School</p>
        </div>
      `,
    })
  } catch (error) {
    console.error('Failed to send dispatcher confirmation email:', error)
  }
}
```

Replace with:

```js
async function sendDispatcherConfirmation(payment) {
  if (!resend || !payment?.customer_email) return
  try {
    const { data: registration } = await supabase
      .from('cdl_dispatcher_registrations')
      .select('*, class:cdl_dispatcher_classes(name, starts_at, ends_at, location, schedule_notes)')
      .eq('id', payment.dispatcher_registration_id)
      .maybeSingle()

    const registrationNo = registration?.registration_no || payment.metadata?.registration_no || ''
    const className = registration?.class?.name || payment.metadata?.className || 'Dispatcher Training'
    const amount = `$${((payment.amount_cents || 0) / 100).toFixed(2)}`
    const startDate = registration?.class?.starts_at
      ? new Date(registration.class.starts_at).toLocaleDateString('en-US', { dateStyle: 'long' })
      : 'Rolling enrollment'
    const endDate = registration?.class?.ends_at
      ? new Date(registration.class.ends_at).toLocaleDateString('en-US', { dateStyle: 'long' })
      : null
    const location = registration?.class?.location || 'To be announced'
    const scheduleNotes = registration?.class?.schedule_notes
    const signedAt = registration?.payment_policy_accepted_at
      ? new Date(registration.payment_policy_accepted_at).toLocaleString('en-US')
      : null

    await resend.emails.send({
      from: dispatcherEmailFrom,
      to: payment.customer_email,
      subject: `Dispatcher Class Registration Confirmed - ${registrationNo}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #08085f;">Dispatcher Class Registration Confirmed</h2>
          <p>Dear ${registration?.first_name || 'Student'},</p>
          <p>Thank you for registering for <strong>${className}</strong> at Iman Trucking School. Your registration is confirmed.</p>
          <div style="background: #f5f7fb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Registration Number:</strong> ${registrationNo}</p>
            <p style="margin: 8px 0 0 0;"><strong>Class:</strong> ${className}</p>
            <p style="margin: 8px 0 0 0;"><strong>Starts:</strong> ${startDate}</p>
            ${endDate ? `<p style="margin: 8px 0 0 0;"><strong>Ends:</strong> ${endDate}</p>` : ''}
            <p style="margin: 8px 0 0 0;"><strong>Location:</strong> ${location}</p>
            ${scheduleNotes ? `<p style="margin: 8px 0 0 0;"><strong>Schedule:</strong> ${scheduleNotes}</p>` : ''}
            <p style="margin: 8px 0 0 0;"><strong>Amount Paid:</strong> ${amount}</p>
            <p style="margin: 8px 0 0 0;"><strong>Payment Status:</strong> Paid</p>
          </div>
          <div style="background: #fff9e6; border-left: 4px solid #ffb300; padding: 12px 16px; margin: 16px 0; font-size: 14px; color: #5d4037;">
            <strong>Registration Policy:</strong> ${DISPATCHER_PAYMENT_POLICY_TEXT}
            ${signedAt ? `<br><br><strong>Electronically signed by:</strong> ${registration.payment_policy_signature || ''} on ${signedAt} (policy version ${registration.payment_policy_version || DISPATCHER_PAYMENT_POLICY_VERSION})` : ''}
          </div>
          <p>Please keep this email for your records. Admissions will contact you with class logistics before the session begins.</p>
          <p>Best regards,<br>Iman Trucking School</p>
        </div>
      `,
    })
  } catch (error) {
    console.error('Failed to send dispatcher confirmation email:', error)
  }
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check server-express.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add server-express.js
git commit -m "$(cat <<'EOF'
Add class location/schedule and policy audit trail to student receipt

The confirmation email now documents exactly what was agreed to
(signature, accepted-at timestamp, policy version) plus the session's
location, schedule, and end date.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Backend — SMS-ready notification plumbing (Twilio, env-gated no-op)

**Files:**
- Modify: `server-express.js`

**Interfaces:**
- Consumes: `finalizeSuccessfulPayment`'s dispatcher branch (edited by Task 4; edited again here).
- Produces: `twilioConfigured` (boolean constant), `sendSms(to, body)` (async, throws on non-2xx Twilio response, returns `{ skipped: true }` when not configured or `to` is falsy), `sendDispatcherSmsConfirmation(payment)` (async, best-effort, never throws).

- [ ] **Step 1: Add the Twilio config flag and `sendSms` helper**

Find:

```js
const dispatcherNotifyEmail = process.env.DISPATCHER_NOTIFY_EMAIL || 'info@imantruckingschool.com'
```

Add immediately after it:

```js

// Optional SMS notifications via Twilio's REST API directly (no SDK
// dependency — uses the native fetch available on Node >= 18). Safe
// no-op until all three env vars are set; nothing else needs to change
// to activate it later.
const twilioConfigured =
  !!process.env.TWILIO_ACCOUNT_SID &&
  !!process.env.TWILIO_AUTH_TOKEN &&
  !!process.env.TWILIO_FROM_NUMBER

async function sendSms(to, body) {
  if (!twilioConfigured || !to) return { skipped: true }
  const sid = process.env.TWILIO_ACCOUNT_SID
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  const params = new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER, Body: body })
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  if (!response.ok) {
    throw new Error(`Twilio SMS failed with status ${response.status}`)
  }
  return { skipped: false }
}
```

- [ ] **Step 2: Wire the call site in `finalizeSuccessfulPayment`**

Find (this is Task 4's edited version of the block):

```js
  if (payment.payment_type === 'dispatcher') {
    await sendDispatcherConfirmation(payment)
    await sendDispatcherDepartmentNotification(payment)
  }
```

Replace with:

```js
  if (payment.payment_type === 'dispatcher') {
    await sendDispatcherConfirmation(payment)
    await sendDispatcherDepartmentNotification(payment)
    await sendDispatcherSmsConfirmation(payment)
  }
```

- [ ] **Step 3: Add `sendDispatcherSmsConfirmation`**

Find the end of `sendDispatcherDepartmentNotification` (added in Task 4, immediately before `async function handlePaymentIntentFailed`):

```js
  } catch (error) {
    console.error('Failed to send dispatcher department notification email:', error)
  }
}

async function handlePaymentIntentFailed(paymentIntent) {
```

Replace with:

```js
  } catch (error) {
    console.error('Failed to send dispatcher department notification email:', error)
  }
}

async function sendDispatcherSmsConfirmation(payment) {
  if (!twilioConfigured) return
  try {
    const { data: registration } = await supabase
      .from('cdl_dispatcher_registrations')
      .select('phone, registration_no, class:cdl_dispatcher_classes(name, starts_at)')
      .eq('id', payment.dispatcher_registration_id)
      .maybeSingle()

    if (!registration?.phone) return

    const registrationNo = registration.registration_no || payment.metadata?.registration_no || ''
    const className = registration.class?.name || payment.metadata?.className || 'Dispatcher Training'
    const startDate = registration.class?.starts_at
      ? new Date(registration.class.starts_at).toLocaleDateString('en-US', { dateStyle: 'medium' })
      : 'rolling enrollment'

    await sendSms(
      registration.phone,
      `Iman Trucking School: Your registration ${registrationNo} for ${className} is confirmed. Class starts ${startDate}. Check your email for the full receipt.`
    )
  } catch (error) {
    console.error('Failed to send dispatcher SMS confirmation:', error)
  }
}

async function handlePaymentIntentFailed(paymentIntent) {
```

- [ ] **Step 4: Verify syntax**

Run: `node --check server-express.js`
Expected: no output.

- [ ] **Step 5: Verify the no-op path**

Run: `node -e "process.env.TWILIO_ACCOUNT_SID=''; import('./server-express.js').then(() => console.log('loaded OK, Twilio disabled as expected'))"`
Expected: prints `loaded OK, Twilio disabled as expected` and nothing throws (module load alone does not send anything, but confirms the file still parses/imports cleanly with Twilio env vars unset).

- [ ] **Step 6: Commit**

```bash
git add server-express.js
git commit -m "$(cat <<'EOF'
Add Twilio-ready SMS plumbing for dispatcher confirmations

sendSms() is a safe no-op until TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER
are all set. When configured, a short SMS confirmation is sent to the
registrant's phone alongside the existing email notifications.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Frontend — mirror the strengthened policy text in the client component

**Files:**
- Modify: `src/components/DispatcherPolicyAgreement.tsx`

**Interfaces:**
- Consumes: none.
- Produces: updated `DISPATCHER_POLICY_TEXT` export (same name/type — `string` — consumed by `DispatcherRegistration.tsx`'s success screen, unchanged call sites).

- [ ] **Step 1: Update the exported policy text**

Find:

```tsx
export const DISPATCHER_POLICY_TEXT =
  'All registration payments are non-refundable. If the student cannot attend the class, the payment remains as a credit on their student account and can be used for a future dispatcher class.'
```

Replace with:

```tsx
export const DISPATCHER_POLICY_TEXT =
  'All registration payments are non-refundable. If the student cannot attend the class, the payment remains as a credit on their student account and can be used for a future dispatcher class. If Iman Trucking School cancels or reschedules this class session, the student may choose a full refund or a credit toward a future dispatcher class.'
```

- [ ] **Step 2: Update the checkbox affirmation label to match**

Find:

```tsx
          label={
            <Typography variant="body2" fontWeight={700}>
              I have read and agree to the Dispatcher Class Registration Policy: All registration payments are non-refundable. If I cannot attend the class, my payment remains as a credit on my student account and can be used for a future dispatcher class.
            </Typography>
          }
```

Replace with:

```tsx
          label={
            <Typography variant="body2" fontWeight={700}>
              I have read and agree to the Dispatcher Class Registration Policy: All registration payments are non-refundable. If I cannot attend the class, my payment remains as a credit on my student account and can be used for a future dispatcher class. If the school cancels or reschedules this session, I may choose a full refund or a credit toward a future class.
            </Typography>
          }
```

- [ ] **Step 3: Verify the frontend still type-checks and builds**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/DispatcherPolicyAgreement.tsx
git commit -m "$(cat <<'EOF'
Mirror the school-cancellation policy clause in the client component

Keeps the checkbox affirmation and the server's DISPATCHER_PAYMENT_POLICY_TEXT
in sync (see server-express.js from the prior task).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Frontend — redesign the class picker (dates/schedule/location/seats), fetch from the public view, fix the price-override bug

**Files:**
- Modify: `src/pages/DispatcherRegistration.tsx`

**Interfaces:**
- Consumes: `cdl_dispatcher_classes_public` view (Task 1: columns `id, name, description, price_cents, starts_at, ends_at, location, schedule_notes, seat_capacity, seats_remaining`).
- Produces: extended `DispatcherClass` type (adds `starts_at?`, `ends_at?`, `location?`, `schedule_notes?`, `seat_capacity?`, `seats_remaining?`) — consumed by Task 9 in the same file.

- [ ] **Step 1: Extend the `DispatcherClass` type and imports**

Find:

```tsx
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Alert,
  Paper,
  Stack,
  CircularProgress,
  Divider,
} from '@mui/material'
```

Replace with (drops the now-unused `Select`/`MenuItem`/`FormControl`/`InputLabel`, adds `Chip`):

```tsx
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  TextField,
  Typography,
  Alert,
  Paper,
  Stack,
  CircularProgress,
  Divider,
  Chip,
} from '@mui/material'
```

Find:

```tsx
type DispatcherClass = { id: string; name: string; description?: string; price_cents?: number }
```

Replace with:

```tsx
type DispatcherClass = {
  id: string
  name: string
  description?: string
  price_cents?: number
  starts_at?: string
  ends_at?: string
  location?: string
  schedule_notes?: string
  seat_capacity?: number | null
  seats_remaining?: number | null
}
```

Find:

```tsx
const fallbackClasses: DispatcherClass[] = [
  {
    id: '1c13132a-6e4d-4004-9894-8ccf88bb46c6',
    name: 'Dispatcher Training — Rolling Enrollment 2026',
    description: 'Entry-level freight and fleet dispatcher certification training.',
    price_cents: 52000,
  },
]
```

Replace with:

```tsx
const fallbackClasses: DispatcherClass[] = [
  {
    id: '1c13132a-6e4d-4004-9894-8ccf88bb46c6',
    name: 'Dispatcher Training — Rolling Enrollment 2026',
    description: 'Entry-level freight and fleet dispatcher certification training.',
    price_cents: 52000,
    starts_at: '2026-01-01T00:00:00Z',
    ends_at: '2026-12-31T23:59:59Z',
    location: 'Iman Trucking School — Orlando, FL Campus',
    schedule_notes: 'Rolling enrollment — contact admissions for the next start date.',
    seat_capacity: null,
    seats_remaining: null,
  },
]
```

- [ ] **Step 2: Fetch from the public view and remove the price-override bug**

Find:

```tsx
  useEffect(() => {
    if (!isMock) {
      supabase!
        .from('cdl_dispatcher_classes')
        .select('id, name, description, price_cents')
        .eq('open', true)
        .order('name')
        .then(({ data, error }) => {
          if (!error && data?.length) {
            setClasses(data.map(item => ({ ...item, price_cents: 52000 })) as DispatcherClass[])
          }
        })
    }
  }, [isMock])
```

Replace with:

```tsx
  useEffect(() => {
    if (!isMock) {
      supabase!
        .from('cdl_dispatcher_classes_public')
        .select('id, name, description, price_cents, starts_at, ends_at, location, schedule_notes, seat_capacity, seats_remaining')
        .order('starts_at')
        .then(({ data, error }) => {
          if (!error && data?.length) {
            setClasses(data as DispatcherClass[])
          }
        })
    }
  }, [isMock])
```

`cdl_dispatcher_classes_public` (Task 1) already filters to `open = true` and does not expose an `open` column, so the old `.eq('open', true)` is removed — that filter now lives in the view. The old code's `price_cents: 52000` override hid each class's real price; every class in the view already carries its own correct `price_cents`, so no override is needed.

- [ ] **Step 3: Replace the plain dropdown with a card-based session picker**

Find:

```tsx
                <Grid size={12}>
                  <FormControl fullWidth required>
                    <InputLabel>Dispatcher class</InputLabel>
                    <Select
                      value={formData.classId}
                      onChange={e => setFormData({ ...formData, classId: e.target.value })}
                      label="Dispatcher class"
                    >
                      {classes.map(c => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name} — ${(c.price_cents != null ? c.price_cents / 100 : 520).toFixed(2)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
```

Replace with:

```tsx
                <Grid size={12}>
                  <Typography fontWeight={900} sx={{ mb: 1.5 }}>Select a class session</Typography>
                  <Stack spacing={2}>
                    {classes.map(c => {
                      const classPrice = c.price_cents != null ? c.price_cents / 100 : 520
                      const isFull = c.seat_capacity != null && (c.seats_remaining ?? 0) <= 0
                      const isSelected = formData.classId === c.id
                      const startLabel = c.starts_at
                        ? new Date(c.starts_at).toLocaleDateString('en-US', { dateStyle: 'medium' })
                        : 'Rolling enrollment'
                      const endLabel = c.ends_at
                        ? new Date(c.ends_at).toLocaleDateString('en-US', { dateStyle: 'medium' })
                        : null
                      return (
                        <Paper
                          key={c.id}
                          variant="outlined"
                          onClick={() => !isFull && setFormData({ ...formData, classId: c.id })}
                          sx={{
                            p: 2.5,
                            borderRadius: 3,
                            cursor: isFull ? 'not-allowed' : 'pointer',
                            opacity: isFull ? 0.55 : 1,
                            borderColor: isSelected ? 'secondary.main' : 'divider',
                            borderWidth: isSelected ? 2 : 1,
                            bgcolor: isSelected ? '#fff5f5' : 'transparent',
                          }}
                        >
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
                            <Box>
                              <Typography fontWeight={900}>{c.name}</Typography>
                              {c.description && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                  {c.description}
                                </Typography>
                              )}
                              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                                <Chip size="small" label={endLabel ? `${startLabel} – ${endLabel}` : startLabel} />
                                {c.location && <Chip size="small" label={c.location} />}
                                {c.schedule_notes && <Chip size="small" label={c.schedule_notes} />}
                                {c.seat_capacity != null && (
                                  <Chip
                                    size="small"
                                    color={isFull ? 'error' : 'success'}
                                    label={isFull ? 'Class full' : `${c.seats_remaining} seat${c.seats_remaining === 1 ? '' : 's'} left`}
                                  />
                                )}
                              </Stack>
                            </Box>
                            <Typography variant="h6" fontWeight={950} color="secondary.main" whiteSpace="nowrap">
                              ${classPrice.toFixed(2)}
                            </Typography>
                          </Stack>
                        </Paper>
                      )
                    })}
                  </Stack>
                </Grid>
```

- [ ] **Step 4: Verify the frontend type-checks and builds**

Run: `npx tsc -b`
Expected: no errors. If `Select`/`MenuItem`/`FormControl`/`InputLabel` are reported as unused anywhere else in this file, that means they were used elsewhere — re-check before removing them from imports (this file's only other MUI form controls used are `TextField`, so this should not happen).

- [ ] **Step 5: Manually verify in the browser (mock mode, no Supabase needed)**

1. Run `npm run dev`.
2. Visit `/dispatcher-registration/`.
3. Confirm the class picker renders as a card (not a dropdown) showing the fallback class's dates, location, and schedule note, and that selecting it and submitting the form still proceeds to the review step as before.

- [ ] **Step 6: Commit**

```bash
git add src/pages/DispatcherRegistration.tsx
git commit -m "$(cat <<'EOF'
Redesign the dispatcher class picker with dates/location/seats

Replaces the plain price/name dropdown with session cards sourced from
cdl_dispatcher_classes_public, and removes a latent bug that force-
overwrote every class's displayed price to a hardcoded $520.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Frontend — show class location/schedule and policy audit trail on the review and success screens

**Files:**
- Modify: `server-express.js` (`GET /api/payment-status/:sessionId`)
- Modify: `src/lib/stripe.ts` (`PaymentRegistrationDetails` type)
- Modify: `src/pages/DispatcherRegistration.tsx` (review step + success screen)

**Interfaces:**
- Consumes: `DispatcherClass` type from Task 8 (`selectedClass.location`, `.schedule_notes`, `.starts_at`, `.ends_at`).
- Produces: extended `PaymentRegistrationDetails` type (adds `classStartsAt`, `classEndsAt`, `classLocation`, `classScheduleNotes`, `policyAcceptedAt`, `policyVersion`) — this is the only place these fields are produced; no other task reads them.

- [ ] **Step 1: Extend the payment-status endpoint's registration query and response shape**

In `server-express.js`, find:

```js
      const { data: reg } = await supabase
        .from('cdl_dispatcher_registrations')
        .select(`
          id,
          registration_no,
          first_name,
          last_name,
          email,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          zip_code,
          status,
          payment_status,
          payment_policy_accepted_at,
          payment_policy_signature,
          class:cdl_dispatcher_classes(name, starts_at, ends_at)
        `)
        .eq('id', payment.dispatcher_registration_id)
        .maybeSingle()

      if (reg) {
        registrationDetails = {
          id: reg.id,
          registrationNo: reg.registration_no,
          firstName: reg.first_name,
          lastName: reg.last_name,
          email: reg.email,
          phone: reg.phone,
          address: `${reg.address_line1}${reg.address_line2 ? `, ${reg.address_line2}` : ''}`,
          city: reg.city,
          state: reg.state,
          zip: reg.zip_code,
          className: reg.class?.name || payment.metadata?.className || 'Dispatcher Training',
          status: reg.status,
          paymentStatus: reg.payment_status,
          policyAccepted: !!reg.payment_policy_accepted_at,
          policySignature: reg.payment_policy_signature,
          policyText: DISPATCHER_PAYMENT_POLICY_TEXT,
        }
      }
```

Replace with:

```js
      const { data: reg } = await supabase
        .from('cdl_dispatcher_registrations')
        .select(`
          id,
          registration_no,
          first_name,
          last_name,
          email,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          zip_code,
          status,
          payment_status,
          payment_policy_accepted_at,
          payment_policy_signature,
          payment_policy_version,
          class:cdl_dispatcher_classes(name, starts_at, ends_at, location, schedule_notes)
        `)
        .eq('id', payment.dispatcher_registration_id)
        .maybeSingle()

      if (reg) {
        registrationDetails = {
          id: reg.id,
          registrationNo: reg.registration_no,
          firstName: reg.first_name,
          lastName: reg.last_name,
          email: reg.email,
          phone: reg.phone,
          address: `${reg.address_line1}${reg.address_line2 ? `, ${reg.address_line2}` : ''}`,
          city: reg.city,
          state: reg.state,
          zip: reg.zip_code,
          className: reg.class?.name || payment.metadata?.className || 'Dispatcher Training',
          classStartsAt: reg.class?.starts_at || null,
          classEndsAt: reg.class?.ends_at || null,
          classLocation: reg.class?.location || null,
          classScheduleNotes: reg.class?.schedule_notes || null,
          status: reg.status,
          paymentStatus: reg.payment_status,
          policyAccepted: !!reg.payment_policy_accepted_at,
          policySignature: reg.payment_policy_signature,
          policyAcceptedAt: reg.payment_policy_accepted_at,
          policyVersion: reg.payment_policy_version,
          policyText: DISPATCHER_PAYMENT_POLICY_TEXT,
        }
      }
```

- [ ] **Step 2: Extend the `PaymentRegistrationDetails` type**

In `src/lib/stripe.ts`, find:

```tsx
export type PaymentRegistrationDetails = {
  id: string
  registrationNo: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  className: string
  status: string
  paymentStatus: string
  policyAccepted: boolean
  policySignature?: string
  policyText?: string
}
```

Replace with:

```tsx
export type PaymentRegistrationDetails = {
  id: string
  registrationNo: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  className: string
  classStartsAt?: string | null
  classEndsAt?: string | null
  classLocation?: string | null
  classScheduleNotes?: string | null
  status: string
  paymentStatus: string
  policyAccepted: boolean
  policySignature?: string
  policyAcceptedAt?: string | null
  policyVersion?: string | null
  policyText?: string
}
```

- [ ] **Step 3: Compute display values and extend the review step in `DispatcherRegistration.tsx`**

Find:

```tsx
    const regNo = confirmedRegistration?.registrationNo || registration?.registration_no || 'DSP-CONFIRMED'
    const studentFirstName = confirmedRegistration?.firstName || formData.firstName || 'Student'
    const studentLastName = confirmedRegistration?.lastName || formData.lastName || ''
    const studentEmail = confirmedRegistration?.email || formData.email || '—'
    const studentPhone = confirmedRegistration?.phone || formData.phone || '—'
    const studentAddress =
      confirmedRegistration?.address ||
      (formData.address1
        ? `${formData.address1}${formData.address2 ? `, ${formData.address2}` : ''}, ${formData.city}, ${formData.state} ${formData.zip}`
        : '—')
    const className = confirmedRegistration?.className || selectedClass?.name || 'Dispatcher Training'
    const total = price || 520
```

Replace with:

```tsx
    const regNo = confirmedRegistration?.registrationNo || registration?.registration_no || 'DSP-CONFIRMED'
    const studentFirstName = confirmedRegistration?.firstName || formData.firstName || 'Student'
    const studentLastName = confirmedRegistration?.lastName || formData.lastName || ''
    const studentEmail = confirmedRegistration?.email || formData.email || '—'
    const studentPhone = confirmedRegistration?.phone || formData.phone || '—'
    const studentAddress =
      confirmedRegistration?.address ||
      (formData.address1
        ? `${formData.address1}${formData.address2 ? `, ${formData.address2}` : ''}, ${formData.city}, ${formData.state} ${formData.zip}`
        : '—')
    const className = confirmedRegistration?.className || selectedClass?.name || 'Dispatcher Training'
    const total = price || 520
    const classLocation = confirmedRegistration?.classLocation || selectedClass?.location || null
    const classScheduleNotes = confirmedRegistration?.classScheduleNotes || selectedClass?.schedule_notes || null
    const classStartsAt = confirmedRegistration?.classStartsAt || selectedClass?.starts_at || null
    const classEndsAt = confirmedRegistration?.classEndsAt || selectedClass?.ends_at || null
    const classDatesLabel = classStartsAt
      ? `${new Date(classStartsAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}${classEndsAt ? ` – ${new Date(classEndsAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}` : ''}`
      : null
```

- [ ] **Step 4: Add the new rows to the success-screen summary grid**

Find:

```tsx
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">Class Enrolled</Typography>
                    <Typography variant="body2" fontWeight={700}>{className}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">Amount Paid</Typography>
                    <Typography variant="body2" fontWeight={800} color="success.main">
                      ${total.toFixed(2)} USD (Paid via Stripe)
                    </Typography>
                  </Grid>
```

Replace with:

```tsx
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">Class Enrolled</Typography>
                    <Typography variant="body2" fontWeight={700}>{className}</Typography>
                  </Grid>
                  {classDatesLabel && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">Class Dates</Typography>
                      <Typography variant="body2" fontWeight={700}>{classDatesLabel}</Typography>
                    </Grid>
                  )}
                  {classLocation && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">Location</Typography>
                      <Typography variant="body2" fontWeight={700}>{classLocation}</Typography>
                    </Grid>
                  )}
                  {classScheduleNotes && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">Schedule</Typography>
                      <Typography variant="body2" fontWeight={700}>{classScheduleNotes}</Typography>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">Amount Paid</Typography>
                    <Typography variant="body2" fontWeight={800} color="success.main">
                      ${total.toFixed(2)} USD (Paid via Stripe)
                    </Typography>
                  </Grid>
```

- [ ] **Step 5: Add the policy signature/timestamp line to the success screen**

Find:

```tsx
              <Alert
                severity="warning"
                icon={<PolicyIcon />}
                sx={{
                  mb: 4,
                  textAlign: 'left',
                  bgcolor: '#fff9e6',
                  color: '#3e2723',
                  border: '1px solid #ffe082',
                }}
              >
                <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                  Registration Policy Acknowledged
                </Typography>
                <Typography variant="body2">
                  {DISPATCHER_POLICY_TEXT}
                </Typography>
              </Alert>
```

Replace with:

```tsx
              <Alert
                severity="warning"
                icon={<PolicyIcon />}
                sx={{
                  mb: 4,
                  textAlign: 'left',
                  bgcolor: '#fff9e6',
                  color: '#3e2723',
                  border: '1px solid #ffe082',
                }}
              >
                <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                  Registration Policy Acknowledged
                </Typography>
                <Typography variant="body2">
                  {DISPATCHER_POLICY_TEXT}
                </Typography>
                {(confirmedRegistration?.policySignature || paymentPolicySignature) && (
                  <Typography variant="caption" display="block" sx={{ mt: 1.5, fontStyle: 'italic' }}>
                    Electronically signed by {confirmedRegistration?.policySignature || paymentPolicySignature}
                    {confirmedRegistration?.policyAcceptedAt
                      ? ` on ${new Date(confirmedRegistration.policyAcceptedAt).toLocaleString('en-US')}`
                      : ''}
                  </Typography>
                )}
              </Alert>
```

- [ ] **Step 6: Add location/schedule/dates to the review step's "Selected class" card**

Find:

```tsx
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                  <Typography fontWeight={900} gutterBottom>Selected class</Typography>
                  <Typography variant="body2"><strong>{selectedClass?.name || 'Dispatcher Training'}</strong></Typography>
                  {selectedClass?.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {selectedClass.description}
                    </Typography>
                  )}
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 3, pt: 2, borderTop: '1px dashed', borderColor: 'divider' }}>
                    <Typography fontWeight={900}>Tuition / Total due</Typography>
                    <Typography variant="h4" fontWeight={950} color="secondary.main">${price.toFixed(2)}</Typography>
                  </Stack>
                </Paper>
              </Grid>
```

Replace with:

```tsx
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                  <Typography fontWeight={900} gutterBottom>Selected class</Typography>
                  <Typography variant="body2"><strong>{selectedClass?.name || 'Dispatcher Training'}</strong></Typography>
                  {selectedClass?.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {selectedClass.description}
                    </Typography>
                  )}
                  {selectedClass?.starts_at && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>Dates:</strong> {new Date(selectedClass.starts_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                      {selectedClass.ends_at ? ` – ${new Date(selectedClass.ends_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}` : ''}
                    </Typography>
                  )}
                  {selectedClass?.location && (
                    <Typography variant="body2"><strong>Location:</strong> {selectedClass.location}</Typography>
                  )}
                  {selectedClass?.schedule_notes && (
                    <Typography variant="body2"><strong>Schedule:</strong> {selectedClass.schedule_notes}</Typography>
                  )}
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 3, pt: 2, borderTop: '1px dashed', borderColor: 'divider' }}>
                    <Typography fontWeight={900}>Tuition / Total due</Typography>
                    <Typography variant="h4" fontWeight={950} color="secondary.main">${price.toFixed(2)}</Typography>
                  </Stack>
                </Paper>
              </Grid>
```

- [ ] **Step 7: Verify syntax and types**

Run: `node --check server-express.js`
Run: `npx tsc -b`
Expected: no errors from either command.

- [ ] **Step 8: Commit**

```bash
git add server-express.js src/lib/stripe.ts src/pages/DispatcherRegistration.tsx
git commit -m "$(cat <<'EOF'
Show class location/schedule and policy signature on review + success

The payment-status API now returns class location/schedule and the
policy acceptance timestamp/version so the on-screen confirmation
documents the same details as the emailed receipt.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Frontend — admin page to manage class sessions

**Files:**
- Create: `src/pages/admin/DispatcherClasses.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/admin/AdminLayout.tsx`

**Interfaces:**
- Consumes: `cdl_dispatcher_classes_admin` view and `cdl_dispatcher_classes` base table (Task 1), `supabase` client from `../../lib/supabase`.
- Produces: route `/admin/dispatcher-classes/`, nav entry "Dispatcher Classes".

- [ ] **Step 1: Create the admin page**

Create `src/pages/admin/DispatcherClasses.tsx`:

```tsx
import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type DispatcherClassRow = {
  id: string
  name: string
  description: string | null
  price_cents: number
  starts_at: string
  ends_at: string
  location: string | null
  schedule_notes: string | null
  seat_capacity: number | null
  open: boolean
  seats_taken: number
  seats_remaining: number | null
}

type ClassFormState = {
  id: string | null
  name: string
  description: string
  priceDollars: string
  startsAt: string
  endsAt: string
  location: string
  scheduleNotes: string
  seatCapacity: string
  open: boolean
}

const emptyForm: ClassFormState = {
  id: null,
  name: '',
  description: '',
  priceDollars: '520',
  startsAt: '',
  endsAt: '',
  location: '',
  scheduleNotes: '',
  seatCapacity: '',
  open: true,
}

function toDatetimeLocalValue(iso: string) {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function DispatcherClasses() {
  const [rows, setRows] = useState<DispatcherClassRow[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<ClassFormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const isMock = !supabase

  useEffect(() => {
    if (!isMock) loadData()
  }, [isMock])

  async function loadData() {
    setLoading(true)
    try {
      const { data, error: loadError } = await supabase!
        .from('cdl_dispatcher_classes_admin')
        .select('*')
        .order('starts_at', { ascending: false })

      if (loadError) throw loadError
      setRows((data || []) as DispatcherClassRow[])
    } catch (err: any) {
      setError(err?.message || 'Unable to load dispatcher classes.')
    }
    setLoading(false)
  }

  function openCreate() {
    setForm(emptyForm)
    setError('')
    setDialogOpen(true)
  }

  function openEdit(row: DispatcherClassRow) {
    setForm({
      id: row.id,
      name: row.name,
      description: row.description || '',
      priceDollars: (row.price_cents / 100).toFixed(2),
      startsAt: toDatetimeLocalValue(row.starts_at),
      endsAt: toDatetimeLocalValue(row.ends_at),
      location: row.location || '',
      scheduleNotes: row.schedule_notes || '',
      seatCapacity: row.seat_capacity != null ? String(row.seat_capacity) : '',
      open: row.open,
    })
    setError('')
    setDialogOpen(true)
  }

  async function save() {
    if (!form.name.trim() || !form.startsAt || !form.endsAt) {
      setError('Class name, start date, and end date are required.')
      return
    }

    const priceCents = Math.round(Number(form.priceDollars) * 100)
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setError('Enter a valid price.')
      return
    }

    let seatCapacity: number | null = null
    if (form.seatCapacity.trim() !== '') {
      const parsed = Number(form.seatCapacity)
      if (!Number.isInteger(parsed) || parsed < 0) {
        setError('Seat capacity must be a whole number, or left blank for unlimited seats.')
        return
      }
      seatCapacity = parsed
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price_cents: priceCents,
        starts_at: new Date(form.startsAt).toISOString(),
        ends_at: new Date(form.endsAt).toISOString(),
        location: form.location.trim() || null,
        schedule_notes: form.scheduleNotes.trim() || null,
        seat_capacity: seatCapacity,
        open: form.open,
        updated_at: new Date().toISOString(),
      }

      if (form.id) {
        const { error: updateError } = await supabase!
          .from('cdl_dispatcher_classes')
          .update(payload)
          .eq('id', form.id)
        if (updateError) throw updateError
        setNotice('Class session updated.')
      } else {
        const { error: insertError } = await supabase!
          .from('cdl_dispatcher_classes')
          .insert(payload)
        if (insertError) throw insertError
        setNotice('Class session created.')
      }

      setDialogOpen(false)
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Unable to save this class session.')
    }
    setSaving(false)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: 6 }}>
      <Container maxWidth="xl">
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4 }}>
          <Box>
            <Button component={Link} to="/admin/" sx={{ mb: 2 }}>
              ← Dashboard
            </Button>
            <Typography variant="h3" fontWeight={900}>Dispatcher Class Sessions</Typography>
          </Box>
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={openCreate}>
            New class session
          </Button>
        </Stack>

        {notice && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice('')}>{notice}</Alert>}

        <Paper sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Class</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Dates</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Location</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Price</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Seats</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">Loading...</TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">No dispatcher class sessions yet.</TableCell>
                  </TableRow>
                ) : (
                  rows.map(row => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Typography fontWeight="bold">{row.name}</Typography>
                        {row.schedule_notes && (
                          <Typography variant="body2" color="text.secondary">{row.schedule_notes}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(row.starts_at).toLocaleDateString()} – {new Date(row.ends_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{row.location || '—'}</TableCell>
                      <TableCell>${(row.price_cents / 100).toFixed(2)}</TableCell>
                      <TableCell>
                        {row.seat_capacity == null
                          ? 'Unlimited'
                          : `${row.seats_remaining ?? 0} of ${row.seat_capacity} left`}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.open ? 'Open' : 'Closed'}
                          color={row.open ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{form.id ? 'Edit class session' : 'New class session'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Class name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                multiline
                rows={2}
                fullWidth
              />
              <TextField
                label="Price (USD)"
                type="number"
                value={form.priceDollars}
                onChange={e => setForm({ ...form, priceDollars: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Starts at"
                type="datetime-local"
                value={form.startsAt}
                onChange={e => setForm({ ...form, startsAt: e.target.value })}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Ends at"
                type="datetime-local"
                value={form.endsAt}
                onChange={e => setForm({ ...form, endsAt: e.target.value })}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Location"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Iman Trucking School — Orlando, FL Campus"
                fullWidth
              />
              <TextField
                label="Schedule notes"
                value={form.scheduleNotes}
                onChange={e => setForm({ ...form, scheduleNotes: e.target.value })}
                placeholder="e.g. Mon–Fri, 9am–3pm"
                fullWidth
              />
              <TextField
                label="Seat capacity (blank = unlimited)"
                type="number"
                value={form.seatCapacity}
                onChange={e => setForm({ ...form, seatCapacity: e.target.value })}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.open}
                    onChange={e => setForm({ ...form, open: e.target.checked })}
                  />
                }
                label="Open for registration"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" color="secondary" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  )
}

export default DispatcherClasses
```

- [ ] **Step 2: Add the route**

In `src/App.tsx`, find:

```tsx
import { DispatcherRegistrations } from './pages/admin/DispatcherRegistrations'
```

Replace with:

```tsx
import { DispatcherRegistrations } from './pages/admin/DispatcherRegistrations'
import { DispatcherClasses } from './pages/admin/DispatcherClasses'
```

Find:

```tsx
            <Route path="dispatcher-registrations/" element={<DispatcherRegistrations />} />
```

Replace with:

```tsx
            <Route path="dispatcher-registrations/" element={<DispatcherRegistrations />} />
            <Route path="dispatcher-classes/" element={<DispatcherClasses />} />
```

- [ ] **Step 3: Add the nav link**

In `src/components/admin/AdminLayout.tsx`, find:

```tsx
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
```

Replace with:

```tsx
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded'
```

Find:

```tsx
  ['Dispatcher Registrations', '/admin/dispatcher-registrations/', <BadgeRoundedIcon />],
] as const
```

Replace with:

```tsx
  ['Dispatcher Registrations', '/admin/dispatcher-registrations/', <BadgeRoundedIcon />],
  ['Dispatcher Classes', '/admin/dispatcher-classes/', <EventAvailableRoundedIcon />],
] as const
```

- [ ] **Step 4: Verify types and build**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Manually verify in the browser**

1. Run `npm run dev` and log in as a staff/admin user (requires real Supabase credentials and an existing admin account, per this repo's existing admin auth setup).
2. Visit `/admin/dispatcher-classes/`.
3. Create a class session with a small seat capacity, confirm it appears in the table with "X of Y left".
4. Edit it, toggle it closed, confirm the change persists after reload.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/DispatcherClasses.tsx src/App.tsx src/components/admin/AdminLayout.tsx
git commit -m "$(cat <<'EOF'
Add admin page for managing dispatcher class sessions

Staff can now create/edit sessions (dates, location, schedule notes,
price, seat capacity, open/closed) directly, instead of needing direct
database access.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Configuration — document the new environment variables

**Files:**
- Modify: `.env.example`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Add the new env vars**

Find:

```
# Server-side email used by the Node payment API (webhook) for confirmation
# emails, e.g. dispatcher class registrations. Optional; emails are skipped
# when RESEND_API_KEY is not set.
RESEND_API_KEY=your-resend-api-key
DISPATCHER_EMAIL_FROM=Iman Trucking School <info@imanlogistics.com>
```

Replace with:

```
# Server-side email used by the Node payment API (webhook) for confirmation
# emails, e.g. dispatcher class registrations. Optional; emails are skipped
# when RESEND_API_KEY is not set.
RESEND_API_KEY=your-resend-api-key
DISPATCHER_EMAIL_FROM=Iman Trucking School <info@imanlogistics.com>

# Department inbox notified by email on every successfully paid dispatcher
# class registration. Optional; defaults to info@imantruckingschool.com.
DISPATCHER_NOTIFY_EMAIL=info@imantruckingschool.com

# Optional SMS notifications for dispatcher registrations, sent via
# Twilio's REST API directly (no SDK). Leave all three unset to keep SMS
# disabled — email confirmations keep working either way.
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

- [ ] **Step 2: Verify**

Run: `cat .env.example` and confirm the file still parses as plain `KEY=value` lines (no syntax errors), and that no real secret values were introduced (all new values are either a public-looking default email or blank).

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
Document DISPATCHER_NOTIFY_EMAIL and optional Twilio env vars

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: End-to-end verification of the full flow

**Files:** none (verification only — no code changes).

**Interfaces:** none.

- [ ] **Step 1: Apply the migration to the real Supabase project (manual, user-run)**

This step requires the project's real Supabase credentials/dashboard access, which this plan's automated tasks do not have. The user (or whoever holds Supabase project access) runs `supabase/migrations/202609200001_dispatcher_classes_schedule_seats.sql` via the Supabase SQL editor or `supabase db push`, then confirms with:

```sql
select column_name from information_schema.columns
where table_name = 'cdl_dispatcher_classes' and column_name in ('location', 'schedule_notes', 'seat_capacity');

select * from cdl_dispatcher_classes_public limit 5;
select * from cdl_dispatcher_classes_admin limit 5;
```

Expected: the three new columns exist, and both views return rows (the admin view only when queried as an authenticated staff user, per its RLS-equivalent WHERE clause).

- [ ] **Step 2: Seed two test class sessions via the new admin page**

Using `/admin/dispatcher-classes/`: one class with `seat_capacity = 1`, one with no capacity set (unlimited). Both `open = true`, dates in the future.

- [ ] **Step 3: Run the full public flow on the 1-seat class**

1. In Stripe test mode with `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`RESEND_API_KEY` configured, visit `/dispatcher-registration/`.
2. Pick the 1-seat class card, fill out the form, continue to review.
3. Accept the policy, type the matching electronic signature, click "Proceed to Stripe Payment."
4. Complete payment with Stripe's test card `4242 4242 4242 4242`.
5. Expected: redirected to the success screen showing the registration number, the class's dates/location/schedule, amount paid, and "Electronically signed by ... on ...".

- [ ] **Step 4: Confirm both emails were sent**

Check the Resend dashboard (or server logs if `RESEND_API_KEY` is unset and sends are mocked) for:
- A student confirmation email containing location, schedule, and the policy signature/timestamp/version line.
- A department notification email to `DISPATCHER_NOTIFY_EMAIL` (or the default) containing the same registration/class/payment details plus the policy audit block.

- [ ] **Step 5: Confirm the class-full rejection**

Attempt a second full registration + checkout against the same 1-seat class (now filled by Step 3). Expected: `POST /api/create-dispatcher-checkout` responds `409 { error: 'This class is full.' }`, and the registration page surfaces that message to the user via the existing `paymentError` state.

- [ ] **Step 6: Confirm SMS stays inert without Twilio credentials**

With `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER` unset, repeat Step 3 on the unlimited-seats class and confirm no errors are thrown and no SMS send is attempted (server logs show no Twilio-related error).

- [ ] **Step 7: Regression-check the unrelated Stripe flows**

Run the existing CDL registration-fee checkout (`/cdl-readiness/` flow that hits `/api/create-registration-checkout`) and the class-application checkout (`/class-application/` flow that hits `/api/create-application-checkout`) end to end once each, confirming both still complete successfully. These share `finalizeSuccessfulPayment`/`markRelatedRecord` with the dispatcher flow, so this confirms the dispatcher-specific additions in Tasks 3–6 did not regress them.

- [ ] **Step 8: Record results**

Report back: which steps passed, which emails/SMS were observed (with message IDs from Resend/Twilio if available), and any deviations from the expected behavior above.

---

## Manual configuration required from the user (not covered by any task's code)

- Run the new migration (`202609200001_dispatcher_classes_schedule_seats.sql`) against the live Supabase project (Task 12, Step 1).
- Set `DISPATCHER_NOTIFY_EMAIL` in the deployment environment if `info@imantruckingschool.com` is not the desired department inbox.
- Use `/admin/dispatcher-classes/` to enter real `location`, `schedule_notes`, and `seat_capacity` values for upcoming sessions — this plan does not invent real-world scheduling data.
- Optional: to activate SMS, create a Twilio account, obtain a sending number, and set `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` in the deployment environment. Until then, SMS stays inert and nothing else needs to change.
