# Iman Trucking School website

Premium React and Material UI redesign of the owner-authorized website at
`imantruckingschool.com`. The application provides a modern responsive shell
while retaining the full original page content and routes in an isolated legacy
content layer.

## Development

```bash
npm install
npm run dev
```

## Production — Hostinger

### Option 1: Static Hosting (public_html)

**For static hosting, you MUST create a `.env.production` file locally before building:**

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-anon-key
```

Replace with your actual Supabase credentials from your Supabase project dashboard.

Then build and deploy:

```bash
npm run build
```

Upload the contents of `dist/` to Hostinger's `public_html/` directory. The
build includes `.htaccess` for React routes, `api/send-assessment-report.php`
for emailing student assessment attachments, and
`api/send-class-application.php` for notifying admissions of new applications.

**Important:** The Supabase credentials will be baked into the JavaScript bundle. Use the publishable (anon) key, not the service role key.

Configure these as server-side environment variables in Hostinger (never as
`VITE_` variables):

- `RESEND_API_KEY`: Resend API key used by the PHP email endpoint
- `RESULT_EMAIL_FROM`: optional verified sender, for example
  `Iman Trucking School <results@imanlogistics.com>`
- `APPLICATION_EMAIL_TO`: optional; defaults to `info@imantruckingschool.com`
- `APPLICATION_EMAIL_FROM`: optional verified sender for class applications;
  falls back to `RESULT_EMAIL_FROM`

The Hostinger PHP installation must have the cURL extension enabled. Student
report downloads do not require email configuration.

### Option 2: Node.js Deployment

For Hostinger Node.js hosting:

**IMPORTANT:** In Hostinger's Node.js deployment panel, set these environment variables:

- `VITE_SUPABASE_URL`: Your Supabase project URL (e.g., `https://your-project.supabase.co`)
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase publishable (anon) key
- `PORT`: (optional) defaults to 3000

**Build command:** `npm run build`

**Start command:** `npm start`

The custom `server.js` injects the Supabase credentials at runtime from the environment variables, so they don't need to be baked into the build. Just set the env vars in Hostinger and restart the application.
# Iman Trucking School website

## AI admissions chat

The floating **Ask Iman** assistant uses a Netlify Function so the OpenAI key and
GoHighLevel webhook are never exposed in browser code.

Set these environment variables in Netlify under **Site configuration →
Environment variables**, then redeploy:

- `OPENAI_API_KEY`: an OpenAI project API key
- `OPENAI_MODEL`: optional; defaults to `gpt-5.6-luna`
- `GHL_WEBHOOK_URL`: a GoHighLevel inbound-workflow webhook URL

The GoHighLevel workflow should accept `name`, `phone`, `email`, `question`,
`source`, `sessionId`, and `submittedAt`. Use those values to create/update the
contact, add the conversation note, assign the lead, and notify admissions.

Do not put either secret in a `VITE_` environment variable—those values are
included in public browser bundles.

## Stripe payments

Registration and class-application fees are collected with **Stripe Checkout**
(Hosted Checkout Pages). The flow is:

1. Applicant submits the registration or application form.
2. The frontend calls the API (`/api/create-registration-checkout` or
   `/api/create-application-checkout`) which creates a pending payment row in
   `cdl_payments` and a Stripe Checkout Session.
3. After payment, Stripe redirects the applicant back with
   `?payment=success&session_id=...` and a `PaymentStatus` screen shows the
   result.
4. Stripe webhooks (`/api/stripe-webhook`) update the payment status and the
   related student or application row. `charge.refunded` marks payments as
   refunded.

### Dispatcher class registrations

Public registrations at `/dispatcher-registration/` follow the same pipeline
with `/api/create-dispatcher-checkout`:

1. The registrant completes the form (name, email, phone, address, preferred
   class) and reviews the class price.
2. On "Proceed to Payment", a row in `cdl_dispatcher_registrations` (with a
   unique `registration_no`) is linked to a `cdl_payments` row
   (`payment_type = 'dispatcher'`) and a Stripe Checkout Session.
3. The same webhooks update `payment_status` (pending, processing, paid,
   failed, canceled, refunded) and, on success, mark the registration
   `CONFIRMED` and send a confirmation email via Resend
   (`RESEND_API_KEY` + optional `DISPATCHER_EMAIL_FROM`).
4. Admin reviews registrations and payment status at
   `/admin/dispatcher-registrations/`.

The dispatcher class fee is **$520.00**. Before Stripe Checkout, the registrant
must read the payment policy, check the agreement box, and type their full
legal name as an electronic signature. The signature and timestamp are stored
on the registration. The policy does not describe payments as non-refundable;
billing and refund questions go to admissions.

### Environment variables (server-only, never `VITE_` prefixed)

- `STRIPE_SECRET_KEY` — `sk_test_...` (test) or `sk_live_...` (production)
- `STRIPE_WEBHOOK_SECRET` — `whsec_...` from the webhook endpoint
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key used by the API server
  to write payment rows (found under Supabase → Settings → API)
- `APP_URL` — canonical public origin used for Checkout return URLs, for example
  `https://imantruckingschool.com`

Frontend key (may be `VITE_` prefixed):

- `VITE_STRIPE_PUBLISHABLE_KEY` — `pk_test_...` or `pk_live_...`

### Database

Run the migrations in `supabase/migrations/` (three Stripe files are included).
They create the `cdl_payments` table, add `registration_fee_cents` /
`application_fee_cents` / `payment_required` to `cdl_courses`, and add
`payment_status` / `payment_id` to `cdl_class_applications` and
`registration_payment_status` / `registration_payment_id` to `cdl_students`.
The dispatcher migration adds `cdl_dispatcher_classes` and
`cdl_dispatcher_registrations` and links them to `cdl_payments`
(`dispatcher_registration_id`, `payment_type = 'dispatcher'`).
Payment rows are written by the server with the service-role key only; client
roles are read-only.

### Webhook

In Stripe Dashboard → Developers → Webhooks, create an endpoint pointing to:

```
https://YOUR-DOMAIN/api/stripe-webhook
```

Select these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

### Testing in Stripe Test Mode

Set test keys (`sk_test_...`, `pk_test_...`, `whsec_test_...`) in a local `.env`
file, run `node server-express.js` (API) and `npm run dev` (site), then pay
with these test cards:

- `4242 4242 4242 4242` — success
- `4000 0000 0000 0002` — declined (failed)
- `4000 0000 0000 9995` — canceled (wallet auth required)

Any future expiry / any CVC works. Refunds can be triggered from the Stripe
Dashboard under Payments → the charge → Refund, which fires `charge.refunded`.
If you need the Webhook CLI locally:

```
stripe login
stripe listen --forward-to localhost:3001/api/stripe-webhook
```

### Deployment

`npm start` (Hostinger Node) serves the static build **and** all `/api/*`
routes from the same process via `server.js`, so payments work out of the box
once the environment variables above are set. Static-only hosts (e.g. Netlify
or plain `public_html`) cannot run the Node API endpoints; deploy the Node
server or an API host for payments.

### Tuition billing and Liberty financing

Apply these migrations, in order, before deploying this version:
`202610210001_tuition_billing.sql`, then `202610220001_tuition_billing_hardening.sql`.
Both are additive; existing students, applications and payments are preserved.

**Tuition accounts (admins).** Admissions creates a tuition account for an
approved training application under **Admin → Tuition accounts**. Amounts are
stored in cents and Stripe Checkout always prices them on the server. Clicking
an account opens its ledger: installment schedule, payment history with
receipts, signed agreements, waivers and the email/SMS confirmations sent.
From there an admin can:

- record an offline payment (cash, check, money order) — the student receives
  the usual confirmation and a receipt;
- void an offline payment entered by mistake (card payments are refunded in
  the Stripe Dashboard instead; the refund is applied automatically);
- waive a due installment, with a reason kept in the audit record.

**Students.** **Portal → Tuition & Payments** offers two choices side by side:
*Pay with Stripe* (full remaining balance, the deposit, or a due installment)
or *Apply for financing* through Liberty Career Finance. Students download
receipts and their signed agreements as PDFs, and the dashboard shows the
remaining balance.

**Ledger rules.** The balance is computed by the `cdl_tuition_account_balances`
view, never stored: tuition − funded financing − (succeeded payments − refunds)
− waivers. Partial refunds reduce the amount paid. Database triggers keep the
account status current (`OPEN`, `PAYMENT_PENDING`, `FINANCING_PENDING`,
`PAID`). An account that ends up overpaid shows a credit and admissions is
emailed.

**Duplicate-payment protection.** One open checkout per account (unique
index). Starting a different option expires the open Stripe Session first; an
abandoned one expires after 35 minutes; a Session that was already paid is
recorded instead of charging again. Webhook events are processed once
(`stripe_webhook_events`), and a payment's amount and currency are verified
before it is marked paid.

**Financing (super admin only).** Liberty Career Finance remains a
privacy-safe external referral; credit application data stays with Liberty.
Only the super administrator can update **Admin → Financing referrals**. Marking
a referral `FUNDED` with the funded amount applies it to the linked tuition
balance automatically; moving it out of `FUNDED` removes it again.

**Confirmations.** Payment emails (Resend) and SMS (Twilio) are sent only when
`RESEND_API_KEY` and the three `TWILIO_*` variables are set on the server.
Check `GET /api/health`: `email` and `sms` must both be `true` in production.

### Tests

```bash
npm test                          # unit and API authorization tests
bash scripts/test-db.sh --docker  # every migration + RLS and ledger tests (Docker)
bash scripts/test-integration.sh  # Stripe webhook and admin API against a real schema (Docker)
```

The Docker suites use throwaway containers and never contact Stripe or a
hosted Supabase project. CI runs all three before deploying.
