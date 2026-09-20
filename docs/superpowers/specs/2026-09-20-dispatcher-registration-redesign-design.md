# Dispatcher Class Registration Redesign — Design

Date: 2026-09-20
Status: Approved by user, pending implementation plan

## Summary

Extend the existing Dispatcher Class Registration flow (frontend, backend,
database, Stripe, email) to add: multiple upcoming class sessions with
dates/schedule/location/seats, a strengthened payment/refund/cancellation
policy, a full audit trail of policy acceptance, richer confirmation emails,
a new department notification email, and a pluggable notification layer
that is SMS-ready (Twilio) without requiring SMS credentials today.

This is an **extension** of the current implementation, not a rewrite.
Nothing about the current Stripe checkout/webhook flow, registration
creation, or policy-signature enforcement is being replaced — only added to.

## Current state (baseline, do not regress)

- `cdl_dispatcher_classes` / `cdl_dispatcher_registrations` tables
  (`supabase/migrations/202609180004_dispatcher_registration.sql`,
  `202609190001_dispatcher_price_and_payment_policy.sql`,
  `202609190002_payment_policy_signature.sql`).
- Registration rows are created server-side only
  (`POST /api/create-dispatcher-registration` in `server-express.js`), using
  the Supabase service-role key. Anon/authenticated roles cannot insert.
- Stripe Checkout session created server-side
  (`POST /api/create-dispatcher-checkout`), with the price sourced from the
  database row (`cdl_dispatcher_classes.price_cents`), not the client.
- Required electronic policy signature enforced both client-side
  (`DispatcherPolicyAgreement.tsx`, `isPaymentPolicySigned`) and
  server-side (`dispatcherPolicyError` in `server-express.js`) before
  checkout session creation.
- Stripe webhook (`checkout.session.completed` /
  `payment_intent.succeeded` / etc.) finalizes payment status
  idempotently in `finalizeSuccessfulPayment`, validates amount/currency,
  and on dispatcher success calls `sendDispatcherConfirmation` (Resend) to
  the student.
- Admin page `src/pages/admin/DispatcherRegistrations.tsx` lets staff
  review/update registration status.

## Decisions (confirmed with user)

1. **Seats**: auto-computed. `seat_capacity` is set per class; "seats
   remaining" is always derived live from paid/confirmed registrations,
   never manually decremented.
2. **Class session management**: a new simple admin CRUD page, not manual
   SQL/Supabase-table-editor management.
3. **Department notification recipient**: `info@imantruckingschool.com` by
   default, overridable via `DISPATCHER_NOTIFY_EMAIL`.
4. **SMS**: build the plumbing only. A pluggable Twilio-backed `sendSms`
   helper that is a safe no-op until `TWILIO_ACCOUNT_SID` /
   `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` are configured — no code
   changes needed to activate it later.

## 1. Database schema

New migration: `supabase/migrations/202609200001_dispatcher_classes_schedule_seats.sql`

```sql
alter table public.cdl_dispatcher_classes
  add column if not exists location text,
  add column if not exists schedule_notes text,
  add column if not exists seat_capacity integer;

-- seat_capacity is nullable: null means uncapped/unlimited.
alter table public.cdl_dispatcher_classes
  add constraint cdl_dispatcher_classes_seat_capacity_check
  check (seat_capacity is null or seat_capacity >= 0);

create index if not exists idx_cdl_dispatcher_registrations_class_id
  on public.cdl_dispatcher_registrations(class_id);

-- A plain Postgres view executes with the privileges of its OWNER for
-- permission checks, not the querying role — so relying on the base
-- table's RLS ("open = true") to filter a view's output is unreliable and
-- has a known history of leaking rows through Supabase views. Both views
-- below instead bake their access rule directly into the view's WHERE
-- clause, so the result is correct regardless of who owns the view.

-- Public-facing view: OPEN classes only, computed seat availability.
-- Never exposes registration rows/PII — only an aggregated count.
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

-- Staff-facing view: ALL classes (open and closed), same seat math, for
-- the admin class-management page. Access is enforced in the WHERE clause
-- itself (same staff-role check used elsewhere), not by grant alone.
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

-- Staff CRUD on the base table (mirrors the existing staff-update policy
-- pattern already used for cdl_dispatcher_registrations). The admin page
-- writes through this table directly; it reads through the admin view.
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

The existing seeded class gets `seat_capacity = null` (unlimited) —
no capacity number is invented; staff sets real numbers via the new admin
page.

## 2. Backend (`server-express.js`)

### 2.1 Seat-capacity enforcement (new)

In `POST /api/create-dispatcher-checkout`, before creating the Stripe
session, the server (using its service-role Supabase client, which
bypasses RLS) reads the class's `seat_capacity` and runs the same
paid/not-canceled count query used by the views in §1 for that
`class_id`. If `seat_capacity` is not null and the count has reached it,
respond `409 { error: 'This class is full.' }`. This closes the race
between browsing and paying — the client-shown seat count is
informational only; this is the actual gate. This check also naturally
catches the edge case where a class was closed after the registrant
started but before they paid.

### 2.2 Department notification (new)

New function `sendDispatcherDepartmentNotification(payment, registration)`,
called from `finalizeSuccessfulPayment` right next to the existing
`sendDispatcherConfirmation(payment)` call, for `payment.payment_type ===
'dispatcher'`. Independent try/catch so a failure here never blocks the
student email or payment finalization (same pattern as the existing
confirmation email).

Recipient: `process.env.DISPATCHER_NOTIFY_EMAIL || 'info@imantruckingschool.com'`.

Content: registrant name/email/phone/address, class name, dates,
location, registration number, amount paid, and the accepted policy
(signature, accepted-at timestamp, version).

### 2.3 Student receipt enhancement (extend existing)

Extend `sendDispatcherConfirmation` to also include: class location,
schedule notes, end date (currently only start date is shown), and the
accepted-policy audit line (signature name, accepted-at timestamp, policy
version) — so the receipt documents exactly what was agreed to, not just
that a policy existed.

### 2.4 Policy text update (extend existing)

`DISPATCHER_PAYMENT_POLICY_TEXT` (server) and `DISPATCHER_POLICY_TEXT`
(client, `DispatcherPolicyAgreement.tsx`) both gain a clause covering
school-initiated cancellation/rescheduling (full refund or credit,
registrant's choice, if Iman Trucking School cancels or reschedules the
session). `DISPATCHER_PAYMENT_POLICY_VERSION` bumps from
`v1-dispatcher-nonrefundable-credit` to
`v2-dispatcher-nonrefundable-credit-schoolcancel`. Existing signed rows
keep their stored version string — no historical data is altered or
reinterpreted.

### 2.5 Notification plumbing (new, SMS-ready)

New module-level helper in `server-express.js`:

```js
const twilioConfigured =
  !!process.env.TWILIO_ACCOUNT_SID &&
  !!process.env.TWILIO_AUTH_TOKEN &&
  !!process.env.TWILIO_FROM_NUMBER

async function sendSms(to, body) {
  if (!twilioConfigured || !to) return { skipped: true }
  const sid = process.env.TWILIO_ACCOUNT_SID
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  const params = new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER, Body: body })
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  if (!res.ok) throw new Error(`Twilio SMS failed: ${res.status}`)
  return { skipped: false }
}
```

Called (best-effort, own try/catch, never blocks the rest of
`finalizeSuccessfulPayment`) right after the student email, texting the
registrant's phone a short confirmation with the registration number and
class start date. Uses `fetch`, already available on Node ≥18 (see
`package.json` `engines.node`), so no new dependency is added.

### 2.6 Bug fix (adjacent to this code, in scope)

`DispatcherRegistration.tsx` currently overwrites every fetched class's
real price with a hardcoded `52000` cents
(`setClasses(data.map(item => ({ ...item, price_cents: 52000 })))`).
Now that multiple sessions with independent prices are a real scenario,
this hardcode is removed so each class displays/charges its own
`price_cents`. The `/api/create-dispatcher-checkout` price lookup already
correctly reads from the database row and is unaffected.

## 3. Frontend — public registration page redesign

`src/pages/DispatcherRegistration.tsx`:

- Fetch from `cdl_dispatcher_classes_public` instead of
  `cdl_dispatcher_classes`, selecting the new fields
  (`location, schedule_notes, seat_capacity, seats_remaining, starts_at,
  ends_at`).
- Replace the plain MUI `<Select>` with a card-based session picker: each
  open, upcoming class rendered as a selectable card showing name,
  description, start/end dates, schedule notes, location, price, and a
  seats-remaining chip. A class with `seats_remaining === 0` (capacity
  set and exhausted) is disabled and labeled "Class full."
- Review step and success screen gain the selected class's
  location/schedule alongside the existing summary fields.
- `DispatcherPolicyAgreement.tsx` policy paragraph text updated to match
  the new server copy (§2.4).

## 4. New admin page — class session management

`src/pages/admin/DispatcherClasses.tsx`, added to `AdminLayout` nav next
to "Dispatcher Registrations":

- Table listing all sessions (open + closed), reading from
  `cdl_dispatcher_classes_admin` (§1) so seats taken/remaining are shown
  for every session regardless of open/closed state.
- Create/edit dialog (mirrors the existing review-dialog pattern in
  `DispatcherRegistrations.tsx`) for: name, description, price (dollars,
  converted to cents on save), start/end date-times, location, schedule
  notes, seat capacity (blank = unlimited), open/closed toggle.
- Writes go directly to the `cdl_dispatcher_classes` base table through
  the Supabase client as the authenticated staff user, relying on the new
  RLS policies in §1 — no new API endpoints needed for this CRUD,
  consistent with how the existing registrations admin page updates rows
  directly.

## 5. Configuration / environment variables

New:
- `DISPATCHER_NOTIFY_EMAIL` — department notification recipient.
  Optional; defaults to `info@imantruckingschool.com`.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` — all
  optional. SMS stays dormant (silently skipped) until all three are set.

No existing env vars change meaning. `.env.example` gets these four new
entries with comments, following the file's existing style.

## 6. Testing plan

Manual end-to-end walkthrough (Stripe test mode, Resend in whatever mode
is configured — mock/log if `RESEND_API_KEY` unset):

1. Seed at least two dispatcher classes via the new admin page: one with
   a small `seat_capacity` (e.g. 1) to exercise the full-class path, one
   uncapped.
2. Public flow: pick a class on the redesigned registration page →
   submit registrant info → accept policy + sign → pay with a Stripe
   test card → land on success screen with correct class
   details/location/schedule shown.
3. Confirm: student confirmation email content (location, schedule,
   policy signature/timestamp/version) and department notification email
   arrive (or are logged, if Resend isn't configured locally) for the
   same successful payment.
4. Confirm: registering a second time for the 1-seat class after the
   first payment succeeds is rejected at checkout with "This class is
   full."
5. Confirm: existing CDL registration-fee and class-application Stripe
   flows are unaffected (regression check on shared webhook/finalize
   code path).
6. If Twilio env vars are left unset, confirm SMS sending is silently
   skipped with no errors thrown.

## Manual configuration required from the user (not code)

- Set `DISPATCHER_NOTIFY_EMAIL` in the deployment environment if
  `info@imantruckingschool.com` is not the desired department inbox.
- Run the new Supabase migration
  (`202609200001_dispatcher_classes_schedule_seats.sql`) against the
  project database.
- Use the new admin page to set real `location`, `schedule_notes`, and
  `seat_capacity` values for upcoming sessions — these are not invented
  by this change.
- Optional, only if SMS is wanted now: create a Twilio account, buy/verify
  a sending number, and set `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` /
  `TWILIO_FROM_NUMBER`. Until then, SMS is inert and nothing else needs to
  change.
