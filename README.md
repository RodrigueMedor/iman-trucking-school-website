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
