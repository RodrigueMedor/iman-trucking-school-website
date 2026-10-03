import express from 'express'
import cors from 'cors'
import Stripe from 'stripe'
import { Resend } from 'resend'
import twilio from 'twilio'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { z } from 'zod'
import { pathToFileURL } from 'node:url'
import { automaticallyEvaluate, validateResponsesShape } from './shared/elpScoring.mjs'

dotenv.config()

// ---------------------------------------------------------------------------
// Clients - initialised lazily so the site can still boot when payments are
// not configured yet. Missing credentials degrade individual endpoints with a
// clear 503 instead of crashing the whole process.
// ---------------------------------------------------------------------------

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-11-20.acacia' })
  : null

// The API server uses the service-role key to verify student sessions and to
// write payment records and ELP results. The service-role key (and
// STRIPE_SECRET_KEY) must stay server-only and never be prefixed with VITE_
// or shipped to the browser.
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

// Best-effort email sender for payment and admissions notifications.
// Used only if RESEND_API_KEY is configured on the server.
let resend = null
if (process.env.RESEND_API_KEY) {
  try {
    resend = new Resend(process.env.RESEND_API_KEY)
  } catch (error) {
    console.error('Failed to initialize Resend:', error)
  }
}
const emailFrom =
  process.env.EMAIL_FROM ||
  process.env.RESULT_EMAIL_FROM ||
  'Iman Trucking School <info@imanlogistics.com>'

// Best-effort SMS sender for payment notifications. Used only if all three
// Twilio env vars are configured on the server.
let twilioClient = null
const twilioFromNumber = process.env.TWILIO_FROM_NUMBER
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && twilioFromNumber) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  } catch (error) {
    console.error('Failed to initialize Twilio:', error)
  }
}

// Staff recipients for payment notifications. Email defaults to the existing
// admissions address; SMS is skipped entirely (not an error) when unset.
const adminNotificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'info@imantruckingschool.com'
const adminNotificationPhone = process.env.ADMIN_NOTIFICATION_PHONE || null
const admissionsEmail = process.env.APPLICATION_EMAIL_TO || adminNotificationEmail

const missingServiceError = 'Payments are not configured on the server. Set STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL.'
const missingDatabaseError = 'The student portal is not configured on the server. Set SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL.'

const PAYMENT_POLICY_VERSION = 'v2-case-by-case-refunds'

function normalizePersonName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ))
}

function paymentPolicyError(body, firstName, lastName) {
  if (body?.paymentPolicyAccepted !== true) {
    return 'You must read and sign the payment policy before checkout.'
  }
  const expected = normalizePersonName(`${firstName || ''} ${lastName || ''}`)
  const signature = normalizePersonName(body?.paymentPolicySignature)
  if (!expected || signature !== expected) {
    return 'Type your full legal name exactly as it appears on this form to sign the payment policy.'
  }
  return null
}

function paymentPolicyRecord(body) {
  return {
    payment_policy_version: PAYMENT_POLICY_VERSION,
    payment_policy_signature: String(body.paymentPolicySignature).trim(),
    payment_policy_accepted_at: new Date().toISOString(),
  }
}

function stripePolicyCustomText() {
  return {
    submit: {
      message:
        'By paying, you confirm you have signed the Iman Trucking School payment policy. Billing and refund questions can be sent to admissions.',
    },
  }
}

function checkoutReturnUrl(req, pathname, state) {
  const configuredUrl = process.env.APP_URL || process.env.PUBLIC_SITE_URL
  const fallbackUrl = req.headers.origin || 'http://localhost:3000'
  let baseUrl

  try {
    baseUrl = new URL(configuredUrl || fallbackUrl)
  } catch {
    throw new Error('APP_URL must be a valid absolute URL')
  }

  baseUrl.pathname = pathname
  baseUrl.search = `payment=${state}&session_id={CHECKOUT_SESSION_ID}`
  baseUrl.hash = ''
  return baseUrl.toString()
}

function requireClients(res) {
  if (!stripe) return { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' }
  if (!supabase) return { error: missingServiceError }
  return null
}

async function getSetting(key, fallback) {
  if (!supabase) return fallback
  const { data } = await supabase
    .from('cdl_application_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  const number = Number(data?.value?.amount)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

// ---------------------------------------------------------------------------
// CORS: only the site itself (and local dev servers) may call the API from a
// browser. The www/non-www variant of each configured URL is allowed too.
// ---------------------------------------------------------------------------

function allowedOrigins() {
  const origins = new Set(['http://localhost:5173', 'http://localhost:3000'])
  for (const value of [process.env.APP_URL, process.env.PUBLIC_SITE_URL]) {
    if (!value) continue
    try {
      const url = new URL(value)
      origins.add(url.origin)
      const host = url.hostname.startsWith('www.') ? url.hostname.slice(4) : `www.${url.hostname}`
      origins.add(`${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`)
    } catch {
      console.error(`Ignoring invalid site URL for CORS: ${value}`)
    }
  }
  return origins
}
const corsOrigins = allowedOrigins()

// ---------------------------------------------------------------------------
// Student authentication: every student endpoint requires the caller's
// Supabase access token (Authorization: Bearer <jwt>), verified server-side.
// ---------------------------------------------------------------------------

async function requireUser(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '')
  if (!match) return res.status(401).json({ error: 'Sign in required.' })
  if (!supabase) return res.status(503).json({ error: missingDatabaseError })

  try {
    const { data, error } = await supabase.auth.getUser(match[1])
    if (error || !data?.user) return res.status(401).json({ error: 'Your session has expired. Sign in again.' })
    req.user = { id: data.user.id, email: data.user.email || '' }
    next()
  } catch (error) {
    console.error('Failed to verify session:', error)
    res.status(503).json({ error: 'Could not verify your session. Try again shortly.' })
  }
}

// Simple fixed-window limiter for authenticated POSTs: 20 requests per minute
// per user. In-memory, which is sufficient for the single Node process.
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60 * 1000
const rateBuckets = new Map()

function rateLimit(req, res, next) {
  const now = Date.now()
  const bucket = rateBuckets.get(req.user.id)
  if (!bucket || now - bucket.start >= RATE_WINDOW_MS) {
    rateBuckets.set(req.user.id, { start: now, count: 1 })
    if (rateBuckets.size > 10000) {
      for (const [key, value] of rateBuckets) if (now - value.start >= RATE_WINDOW_MS) rateBuckets.delete(key)
    }
    return next()
  }
  bucket.count += 1
  if (bucket.count > RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests. Wait a minute and try again.' })
  }
  next()
}

const studentOnly = [requireUser, rateLimit]

// ---------------------------------------------------------------------------
// Middleware. The Stripe webhook must receive the *raw* request body so the
// signature can be verified, so its raw parser is registered before the global
// JSON parser. Other routes parse JSON normally.
// ---------------------------------------------------------------------------

const app = express()

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || corsOrigins.has(origin))
  },
}))

// Stripe webhook - raw body required for signature verification
// Registered at both path styles so the dashboard URL (/api/stripe/webhook)
// and the original (/api/stripe-webhook) both verify correctly.
async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature']

  if (!webhookSecret) {
    res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET is not configured on the server.' })
    return
  }
  if (!stripe) {
    res.status(500).json({ error: 'Stripe is not configured on the server.' })
    return
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    res.status(400).json({ error: 'Invalid signature' })
    return
  }

  try {
    await dispatchWebhookEvent(event)
    res.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
}

// Register the webhook at both path styles so the dashboard URL
// (/api/stripe/webhook) and the original (/api/stripe-webhook) both verify.
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), handleStripeWebhook)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook)

app.use(express.json())

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
      timestamp: new Date().toISOString(),
      stripe: !!stripe,
      webhook: !!webhookSecret,
      database: !!supabase,
      email: !!resend,
      sms: !!twilioClient,
  })
})

// Get payment status by checkout session ID
app.get('/api/payment-status/:sessionId', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: missingServiceError })
    }

    const { sessionId } = req.params
    let { data: payment } = await supabase
      .from('cdl_payments')
      .select('*')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle()

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    // Synchronous fallback reconciliation:
    // If webhook is delayed or testing locally without a tunnel, check Stripe directly
    // when status is still pending or processing.
    if (stripe && ['pending', 'processing'].includes(payment.status)) {
      try {
        const stripeSession = await stripe.checkout.sessions.retrieve(sessionId)
        if (stripeSession.payment_status === 'paid') {
          await finalizeSuccessfulPayment(
            { ...payment, stripe_payment_intent_id: stripeSession.payment_intent || payment.stripe_payment_intent_id },
            stripeSession.amount_total,
            stripeSession.currency
          )
          const { data: refreshed } = await supabase
            .from('cdl_payments')
            .select('*')
            .eq('id', payment.id)
            .maybeSingle()
          if (refreshed) payment = refreshed
        } else if (stripeSession.status === 'expired') {
          await supabase
            .from('cdl_payments')
            .update({ status: 'canceled', updated_at: new Date().toISOString() })
            .eq('id', payment.id)
          await markRelatedRecord(payment, { registration: 'canceled', application: 'canceled' })
          payment.status = 'canceled'
        }
      } catch (err) {
        console.warn('Could not reconcile Stripe session during status check:', err?.message)
      }
    }

    res.json({
      status: payment.status,
      payment_type: payment.payment_type,
      amount_cents: payment.amount_cents,
      currency: payment.currency,
    })
  } catch (error) {
    console.error('Error fetching payment status:', error)
    res.status(500).json({ error: 'Failed to fetch payment status' })
  }
})

// Create Stripe Checkout Session for the signed-in student's registration fee
app.post('/api/create-registration-checkout', studentOnly, async (req, res) => {
  try {
    const unavailable = requireClients(res)
    if (unavailable) return res.status(503).json(unavailable)

    // The student is always the caller; a client-supplied id is never trusted.
    const { data: studentRow } = await supabase
      .from('cdl_students')
      .select('id, user_id, first_name, last_name, email')
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!studentRow) {
      return res.status(404).json({ error: 'Student profile not found' })
    }
    const studentId = studentRow.id
    const email = studentRow.email || req.user.email

    // Check if student already has a successful registration payment
    const { data: existingPayment } = await supabase
      .from('cdl_payments')
      .select('id')
      .eq('student_id', studentId)
      .eq('payment_type', 'registration')
      .eq('status', 'succeeded')
      .maybeSingle()

    if (existingPayment) {
      return res.status(400).json({ error: 'Student already has a successful registration payment' })
    }

    // Check for pending/processing payments to prevent duplicates
    const { data: pendingPayment, error: pendingError } = await supabase
      .from('cdl_payments')
      .select('id, status, created_at')
      .eq('student_id', studentId)
      .eq('payment_type', 'registration')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!pendingError && pendingPayment) {
      const paymentAge = Date.now() - new Date(pendingPayment.created_at).getTime()
      if (paymentAge < 30 * 60 * 1000) {
        return res.status(400).json({ error: 'Payment already in progress. Please complete it or wait 30 minutes.' })
      }
      // Stale pending payment - cancel it and create a fresh session
      await supabase
        .from('cdl_payments')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', pendingPayment.id)
    }

    // Get registration fee from application settings or use the default
    const registrationFeeCents = await getSetting('registration_fee_cents', 5000)

    // Validate payment amount
    if (!Number.isInteger(registrationFeeCents) || registrationFeeCents < 0 || registrationFeeCents > 1000000) {
      return res.status(400).json({ error: 'Invalid payment amount' })
    }

    const policyError = paymentPolicyError(req.body, studentRow.first_name, studentRow.last_name)
    if (policyError) {
      return res.status(400).json({ error: policyError })
    }

    const policy = paymentPolicyRecord(req.body)

    // Create pending payment record
    const { data: payment, error: paymentError } = await supabase
      .from('cdl_payments')
      .insert({
        student_id: studentId,
        amount_cents: registrationFeeCents,
        currency: 'usd',
        status: 'pending',
        payment_type: 'registration',
        customer_email: email,
        metadata: {
          firstName: studentRow.first_name || '',
          lastName: studentRow.last_name || '',
          studentId,
          expected_amount: registrationFeeCents,
          ...policy,
        },
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Error creating payment record:', paymentError)
      return res.status(500).json({ error: 'Failed to create payment record' })
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'CDL Student Registration',
              description: 'Registration fee for Iman Trucking School',
            },
            unit_amount: registrationFeeCents,
          },
          quantity: 1,
        },
      ],
      customer_email: email,
      mode: 'payment',
      custom_text: stripePolicyCustomText(),
      success_url: checkoutReturnUrl(req, '/portal/', 'success'),
      cancel_url: checkoutReturnUrl(req, '/portal/', 'canceled'),
      metadata: {
        payment_id: payment.id,
        student_id: studentId,
        payment_type: 'registration',
        expected_amount: registrationFeeCents.toString(),
        app_email: email,
        payment_policy_version: PAYMENT_POLICY_VERSION,
      },
    })

    await supabase
      .from('cdl_students')
      .update(policy)
      .eq('id', studentId)

    // Update payment with Stripe session ID
    await supabase
      .from('cdl_payments')
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)

    res.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

const uuidSchema = z.string().uuid()

// Load an application for the caller. Responds and returns null when it does
// not exist (404) or belongs to someone else (403).
async function loadOwnApplication(req, res, id, columns) {
  if (!uuidSchema.safeParse(id).success) {
    res.status(400).json({ error: 'Invalid application id.' })
    return null
  }
  const { data: application, error } = await supabase
    .from('cdl_class_applications')
    .select(`id, user_id, status, ${columns}`)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('Failed to load application:', error)
    res.status(500).json({ error: 'Could not load the application.' })
    return null
  }
  if (!application) {
    res.status(404).json({ error: 'Application not found.' })
    return null
  }
  if (application.user_id !== req.user.id) {
    res.status(403).json({ error: 'This application belongs to another account.' })
    return null
  }
  return application
}

// Create Stripe Checkout Session for the optional application fee
app.post('/api/create-application-checkout', studentOnly, async (req, res) => {
  try {
    const unavailable = requireClients(res)
    if (unavailable) return res.status(503).json(unavailable)

    const applicationRow = await loadOwnApplication(
      req, res, req.body?.applicationId,
      'application_type, reference_no, course_id, email, first_name, last_name'
    )
    if (!applicationRow) return
    if (applicationRow.status === 'DRAFT') {
      return res.status(409).json({ error: 'Submit your application before paying the application fee.' })
    }
    const applicationId = applicationRow.id
    const email = applicationRow.email

    // Check if the application already has a successful payment
    const { data: existingPayment } = await supabase
      .from('cdl_payments')
      .select('id')
      .eq('application_id', applicationId)
      .eq('payment_type', 'application')
      .eq('status', 'succeeded')
      .maybeSingle()

    if (existingPayment) {
      return res.status(400).json({ error: 'Application already has a successful payment' })
    }

    const policyError = paymentPolicyError(req.body, applicationRow.first_name, applicationRow.last_name)
    if (policyError) {
      return res.status(400).json({ error: policyError })
    }

    const policy = paymentPolicyRecord(req.body)

    // Check for pending/processing payments to prevent duplicates
    const { data: pendingPayment, error: pendingError } = await supabase
      .from('cdl_payments')
      .select('id, status, created_at')
      .eq('application_id', applicationId)
      .eq('payment_type', 'application')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!pendingError && pendingPayment) {
      const paymentAge = Date.now() - new Date(pendingPayment.created_at).getTime()
      if (paymentAge < 30 * 60 * 1000) {
        return res.status(400).json({ error: 'Payment already in progress. Please complete it or wait 30 minutes.' })
      }
      // Stale pending payment - cancel it and create a fresh session
      await supabase
        .from('cdl_payments')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', pendingPayment.id)
    }

    // The fee always comes from the course stored on the application.
    const { data: course } = applicationRow.course_id
      ? await supabase
          .from('cdl_courses')
          .select('application_fee_cents, name')
          .eq('id', applicationRow.course_id)
          .maybeSingle()
      : { data: null }

    const applicationFeeCents = Number(course?.application_fee_cents) > 0
      ? Number(course.application_fee_cents)
      : 2500
    const courseName = course?.name
      || (applicationRow.application_type === 'ASSESSMENT' ? 'CDL Assessment' : 'CDL Training Course')

    // Validate payment amount
    if (!Number.isInteger(applicationFeeCents) || applicationFeeCents < 0 || applicationFeeCents > 1000000) {
      return res.status(400).json({ error: 'Invalid payment amount' })
    }

    // Create pending payment record
    const { data: payment, error: paymentError } = await supabase
      .from('cdl_payments')
      .insert({
        application_id: applicationId,
        amount_cents: applicationFeeCents,
        currency: 'usd',
        status: 'pending',
        payment_type: 'application',
        customer_email: email,
        metadata: {
          firstName: applicationRow.first_name || '',
          lastName: applicationRow.last_name || '',
          applicationId,
          referenceNo: applicationRow.reference_no,
          courseId: applicationRow.course_id,
          courseName,
          expected_amount: applicationFeeCents,
          ...policy,
        },
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Error creating payment record:', paymentError)
      return res.status(500).json({ error: 'Failed to create payment record' })
    }

    const returnPath = `/portal/applications/${applicationId}`
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Application Fee - ${courseName}`,
              description: `Application ${applicationRow.reference_no} - Iman Trucking School`,
            },
            unit_amount: applicationFeeCents,
          },
          quantity: 1,
        },
      ],
      customer_email: email,
      mode: 'payment',
      custom_text: stripePolicyCustomText(),
      success_url: checkoutReturnUrl(req, returnPath, 'success'),
      cancel_url: checkoutReturnUrl(req, returnPath, 'canceled'),
      metadata: {
        payment_id: payment.id,
        application_id: applicationId,
        payment_type: 'application',
        expected_amount: applicationFeeCents.toString(),
        app_email: email,
        payment_policy_version: PAYMENT_POLICY_VERSION,
      },
    })

    await supabase
      .from('cdl_class_applications')
      .update(policy)
      .eq('id', applicationId)

    // Update payment with Stripe session ID
    await supabase
      .from('cdl_payments')
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)

    res.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// ---------------------------------------------------------------------------
// Online ELP test for a CDL Assessment application. The score is always
// computed here from the raw answers, so a client cannot submit its own score.
// ---------------------------------------------------------------------------

const elpSubmissionSchema = z.object({
  applicationId: z.string().uuid(),
  responses: z.unknown().refine(validateResponsesShape, 'Invalid answers.'),
  startedAt: z.string().datetime().optional(),
})

function testDuration(startedAt) {
  const started = startedAt ? new Date(startedAt).getTime() : NaN
  const minutes = Math.round((Date.now() - started) / 60000)
  return Number.isFinite(minutes) && minutes >= 0 && minutes <= 24 * 60
    ? `${Math.max(1, minutes)} minutes`
    : 'Not recorded'
}

app.post('/api/elp-submissions', studentOnly, async (req, res) => {
  try {
    const parsed = elpSubmissionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'The test answers are incomplete or invalid.' })
    }
    const { applicationId, responses, startedAt } = parsed.data

    const application = await loadOwnApplication(
      req, res, applicationId,
      'application_type, first_name, last_name, email, phone, form_data'
    )
    if (!application) return
    if (application.application_type !== 'ASSESSMENT') {
      return res.status(409).json({ error: 'The online test belongs to a CDL Assessment application.' })
    }
    if (!['DRAFT', 'INFO_REQUIRED'].includes(application.status)) {
      return res.status(409).json({ error: 'This application can no longer be changed.' })
    }

    const profile = application.form_data?.profile || {}
    const license = application.form_data?.license || {}
    const now = new Date()
    const applicant = {
      fullName: `${application.first_name} ${application.last_name}`.trim(),
      address: [profile.addressLine1, profile.addressLine2].filter(Boolean).join(', '),
      cityStateZip: [profile.city, [profile.state, profile.zipCode].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      phone: application.phone || '',
      email: application.email,
      licenseNumber: license.licenseNumber || '',
      licenseState: license.licenseState || '',
      program: 'CDL Assessment',
      evaluatorName: 'Automated scoring system',
      evaluatorTitle: 'Preliminary evaluator',
      assessmentDate: now.toISOString().slice(0, 10),
      assessmentTime: now.toISOString().slice(11, 16),
    }
    const evaluation = automaticallyEvaluate(responses, applicant.evaluatorName, applicant.evaluatorTitle)
    const id = `ELP-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    const { error: insertError } = await supabase.from('elp_submissions').insert({
      id,
      student_id: req.user.id,
      applicant,
      responses,
      evaluation,
      status: 'EVALUATED',
      submitted_at: now.toISOString(),
      duration: testDuration(startedAt),
    })
    if (insertError) {
      console.error('Failed to save ELP submission:', insertError)
      return res.status(500).json({ error: 'Your test could not be saved. Try again.' })
    }

    const { data: linked, error: linkError } = await supabase
      .from('cdl_class_applications')
      .update({ elp_submission_id: id })
      .eq('id', application.id)
      .eq('user_id', req.user.id)
      .in('status', ['DRAFT', 'INFO_REQUIRED'])
      .select('id')
    if (linkError || !linked?.length) {
      console.error('Failed to link ELP submission:', linkError)
      return res.status(409).json({ error: 'This application can no longer be changed.' })
    }

    res.status(201).json({ id, evaluation })
  } catch (error) {
    console.error('Error saving ELP submission:', error)
    res.status(500).json({ error: 'Your test could not be saved. Try again.' })
  }
})

// ---------------------------------------------------------------------------
// Admissions notification after a student submits. Best-effort and sent at
// most once per submission.
// ---------------------------------------------------------------------------

const notifiedSubmissions = new Set()

function admissionsEmailHtml(application) {
  const profile = application.form_data?.profile || {}
  const license = application.form_data?.license || {}
  const type = application.application_type === 'ASSESSMENT' ? 'CDL Assessment' : 'CDL Training'
  const rows = [
    ['Reference', application.reference_no],
    ['Type', type],
    ['Name', `${application.first_name} ${application.last_name}`],
    ['Email', application.email],
    ['Phone', application.phone],
    ['Address', [profile.addressLine1, profile.addressLine2, profile.city, profile.state, profile.zipCode].filter(Boolean).join(', ')],
    ['License', [license.licenseType, license.licenseNumber, license.licenseState].filter(Boolean).join(' / ')],
    ['Program', application.course?.name],
    ['Start session', application.session?.name],
    ['Preferred dates', application.preferred_dates],
    ['Statement', application.statement],
  ].filter(([, value]) => value)
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2 style="color: #08085f;">New ${type} application</h2>
      <table style="border-collapse: collapse; width: 100%;">
        ${rows.map(([label, value]) => `
          <tr>
            <td style="padding: 6px 12px 6px 0; font-weight: bold; vertical-align: top;">${escapeHtml(label)}</td>
            <td style="padding: 6px 0;">${escapeHtml(value)}</td>
          </tr>`).join('')}
      </table>
      <p>Review it in the admin dashboard under Applications.</p>
    </div>
  `
}

app.post('/api/applications/:id/notify', studentOnly, async (req, res) => {
  try {
    const application = await loadOwnApplication(
      req, res, req.params.id,
      'application_type, reference_no, first_name, last_name, email, phone, statement, preferred_dates, form_data, submitted_at, course:cdl_courses(name), session:cdl_academic_sessions(name)'
    )
    if (!application) return
    if (application.status !== 'SUBMITTED') {
      return res.status(409).json({ error: 'Only submitted applications are sent to admissions.' })
    }

    const key = `${application.id}:${application.submitted_at}`
    if (!resend || notifiedSubmissions.has(key)) return res.json({ sent: false })
    notifiedSubmissions.add(key)

    try {
      await resend.emails.send({
        from: emailFrom,
        to: admissionsEmail,
        replyTo: application.email,
        subject: `New application ${application.reference_no} - ${application.first_name} ${application.last_name}`,
        html: admissionsEmailHtml(application),
      })
      res.json({ sent: true })
    } catch (error) {
      notifiedSubmissions.delete(key)
      console.error('Failed to send admissions email:', error)
      res.json({ sent: false })
    }
  } catch (error) {
    console.error('Error notifying admissions:', error)
    res.status(500).json({ error: 'Could not notify admissions.' })
  }
})

// ---------------------------------------------------------------------------
// Webhook event dispatch
// ---------------------------------------------------------------------------

async function dispatchWebhookEvent(event) {
  if (!supabase) {
    console.error(`Ignoring ${event.type}: database is not configured on the server.`)
    return
  }

  const map = {
    'checkout.session.completed': handleCheckoutSessionCompleted,
    'checkout.session.async_payment_succeeded': handleCheckoutSessionAsyncPaymentSucceeded,
    'checkout.session.async_payment_failed': handleCheckoutSessionAsyncPaymentFailed,
    'checkout.session.expired': handleCheckoutSessionExpired,
    'payment_intent.succeeded': handlePaymentIntentSucceeded,
    'payment_intent.payment_failed': handlePaymentIntentFailed,
    'charge.refunded': handleChargeRefunded,
  }

  const handler = map[event.type]
  if (!handler) {
    console.log(`Unhandled Stripe webhook event: ${event.type}`)
    return
  }
  await handler(event.data.object)
}

async function markRelatedRecord(payment, statusFieldMap) {
  if (!payment || !payment.payment_type) return

  if (payment.payment_type === 'registration' && payment.student_id) {
    await supabase
      .from('cdl_students')
      .update({ registration_payment_status: statusFieldMap.registration })
      .eq('id', payment.student_id)
  } else if (payment.payment_type === 'application' && payment.application_id) {
    await supabase
      .from('cdl_class_applications')
      .update({ payment_status: statusFieldMap.application })
      .eq('id', payment.application_id)
  }
}

async function getPayment(event) {
  return supabase
    .from('cdl_payments')
    .select('*')
    .eq('stripe_payment_intent_id', event.id)
    .maybeSingle()
}

// PaymentIntent events can arrive before the matching checkout.session.completed
// event stores the intent id. As a fallback, resolve the session by intent id.
async function findPaymentByIntent(stripe, paymentIntent) {
  const { data: direct } = await getPayment(paymentIntent)
  if (direct) return direct

  if (!stripe) return null
  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent.id, limit: 1 })
  const session = sessions?.data?.[0]
  if (!session?.metadata?.payment_id) return null

  const { data: byId } = await supabase
    .from('cdl_payments')
    .select('*')
    .eq('id', session.metadata.payment_id)
    .maybeSingle()

  if (byId && !byId.stripe_payment_intent_id) {
    await supabase
      .from('cdl_payments')
      .update({ stripe_payment_intent_id: paymentIntent.id, updated_at: new Date().toISOString() })
      .eq('id', byId.id)
    byId.stripe_payment_intent_id = paymentIntent.id
  }

  return byId
}

async function handleCheckoutSessionCompleted(session) {
  const { payment_id, payment_type } = session.metadata || {}
  if (!payment_id) {
    console.error('No payment_id in checkout session metadata')
    return
  }

  // Idempotency: never regress an already-final payment
  const { data: existing } = await supabase
    .from('cdl_payments')
    .select('*')
    .eq('id', payment_id)
    .maybeSingle()

  if (existing && ['succeeded', 'refunded'].includes(existing.status)) return

  await supabase
    .from('cdl_payments')
    .update({
      status: 'processing',
      stripe_payment_intent_id: session.payment_intent || undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment_id)

  if (payment_type === 'registration' && session.metadata?.student_id) {
    await supabase
      .from('cdl_students')
      .update({ registration_payment_status: 'processing', registration_payment_id: payment_id })
      .eq('id', session.metadata.student_id)
  } else if (payment_type === 'application' && session.metadata?.application_id) {
    await supabase
      .from('cdl_class_applications')
      .update({ payment_status: 'processing', payment_id })
      .eq('id', session.metadata.application_id)
  }

  // For immediate payment methods, Checkout already confirms that the Session
  // is paid. Finalize from the Session too, so a delayed or missing
  // payment_intent.succeeded delivery cannot leave the record in processing.
  if (session.payment_status === 'paid') {
    await finalizeSuccessfulPayment(
      { ...existing, stripe_payment_intent_id: session.payment_intent || existing?.stripe_payment_intent_id },
      session.amount_total,
      session.currency
    )
  }
}

async function handleCheckoutSessionAsyncPaymentSucceeded(session) {
  await handleCheckoutSessionCompleted({ ...session, payment_status: 'paid' })
}

async function handleCheckoutSessionAsyncPaymentFailed(session) {
  const { payment_id } = session.metadata || {}
  if (!payment_id) return

  const { data: payment } = await supabase
    .from('cdl_payments')
    .select('*')
    .eq('id', payment_id)
    .maybeSingle()

  if (!payment || ['succeeded', 'refunded'].includes(payment.status)) return

  await supabase
    .from('cdl_payments')
    .update({
      status: 'failed',
      error_message: 'Stripe reported that the delayed payment failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.id)

  await markRelatedRecord(payment, { registration: 'failed', application: 'failed' })
}

async function handleCheckoutSessionExpired(session) {
  const { payment_id } = session.metadata || {}
  if (!payment_id) return

  const { data: existing } = await supabase
    .from('cdl_payments')
    .select('*')
    .eq('id', payment_id)
    .maybeSingle()

  if (existing && ['succeeded', 'refunded'].includes(existing.status)) return

  await supabase
    .from('cdl_payments')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('id', payment_id)

  await markRelatedRecord(existing, { registration: 'canceled', application: 'canceled' })
}

async function handlePaymentIntentSucceeded(paymentIntent) {
  const payment = await findPaymentByIntent(stripe, paymentIntent)
  if (!payment) return

  if (payment.status === 'succeeded' || payment.status === 'refunded') return

  await finalizeSuccessfulPayment(payment, paymentIntent.amount, paymentIntent.currency)
}

async function finalizeSuccessfulPayment(payment, paidAmount, paidCurrency) {
  if (!payment?.id || payment.status === 'succeeded' || payment.status === 'refunded') return

  // Validate the amount and currency the user actually paid on the backend
  const expectedAmount = typeof payment.metadata?.expected_amount === 'number'
    ? payment.metadata.expected_amount
    : payment.amount_cents
  const expectedCurrency = payment.currency || 'usd'

  if (paidAmount !== expectedAmount || paidCurrency !== expectedCurrency) {
    console.error(
      `Payment amount/currency mismatch: expected ${expectedAmount} ${expectedCurrency}, received ${paidAmount} ${paidCurrency}`
    )
    await supabase
      .from('cdl_payments')
      .update({
        status: 'failed',
        error_message: `Payment mismatch: expected ${expectedAmount} ${expectedCurrency}, received ${paidAmount} ${paidCurrency}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
    await markRelatedRecord(payment, { registration: 'failed', application: 'failed' })
    return
  }

  // Atomic state transition: the UPDATE's WHERE clause only matches a row
  // that is not already succeeded/refunded, so two webhook deliveries racing
  // on the same payment can never both "win" this update. Only the caller
  // that receives a row back is responsible for marking related records and
  // sending notifications - this is what makes retries/duplicate Stripe
  // events safe against duplicate emails/SMS.
  const succeededAt = new Date().toISOString()
  const { data: updatedRows } = await supabase
    .from('cdl_payments')
    .update({
      status: 'succeeded',
      succeeded_at: succeededAt,
      updated_at: succeededAt,
    })
    .eq('id', payment.id)
    .neq('status', 'succeeded')
    .neq('status', 'refunded')
    .select()

  const updated = updatedRows?.[0]
  if (!updated) return // already finalized by a concurrent/earlier webhook delivery

  const finalizedPayment = { ...payment, ...updated }

  await markRelatedRecord(finalizedPayment, { registration: 'paid', application: 'paid' })
  await sendPaymentNotifications(finalizedPayment)
}

// ---------------------------------------------------------------------------
// Payment notifications - email (Resend) and SMS (Twilio) for both the
// paying student/applicant and school admissions staff. Best-effort: a
// failure here never fails the webhook response or blocks the payment
// record from being marked succeeded.
// ---------------------------------------------------------------------------

function buildNotificationContext(payment) {
  const md = payment.metadata || {}
  const firstName = md.firstName || ''
  const lastName = md.lastName || ''
  const name = `${firstName} ${lastName}`.trim() || 'Customer'
  const amount = `$${((payment.amount_cents || 0) / 100).toFixed(2)}`
  const program =
    payment.payment_type === 'application'
      ? md.courseName || 'CDL Training Course'
      : 'CDL Student Registration'
  const transactionId = payment.stripe_payment_intent_id || payment.stripe_checkout_session_id || payment.id
  const date = new Date(payment.succeeded_at || Date.now()).toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
  return {
    firstName,
    name,
    amount,
    program,
    referenceNo: md.referenceNo || null,
    transactionId,
    date,
    status: 'Paid',
  }
}

// Payment rows only carry a phone number indirectly, via the linked
// student/application row, so SMS looks it up
// on demand rather than storing a copy on cdl_payments.
async function getRecipientPhone(payment) {
  try {
    if (payment.payment_type === 'registration' && payment.student_id) {
      const { data } = await supabase.from('cdl_students').select('phone').eq('id', payment.student_id).maybeSingle()
      return data?.phone || null
    }
    if (payment.payment_type === 'application' && payment.application_id) {
      const { data } = await supabase
        .from('cdl_class_applications')
        .select('phone')
        .eq('id', payment.application_id)
        .maybeSingle()
      return data?.phone || null
    }
  } catch (error) {
    console.error('Failed to look up recipient phone for SMS:', error)
  }
  return null
}

function paymentNotificationEmailHtml(rawCtx, { forAdmin }) {
  const ctx = Object.fromEntries(Object.entries(rawCtx).map(([key, value]) => [key, value == null ? value : escapeHtml(value)]))
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #08085f;">${forAdmin ? 'New Payment Received' : 'Payment Confirmation'}</h2>
      <p>${
        forAdmin
          ? `A payment was received from <strong>${ctx.name}</strong>.`
          : `Dear ${ctx.firstName || 'Student'}, thank you for your payment to Iman Trucking School.`
      }</p>
      <div style="background: #f5f7fb; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Name:</strong> ${ctx.name}</p>
        <p style="margin: 8px 0 0 0;"><strong>Program/Class:</strong> ${ctx.program}</p>
        <p style="margin: 8px 0 0 0;"><strong>Amount:</strong> ${ctx.amount}</p>
        <p style="margin: 8px 0 0 0;"><strong>Payment Status:</strong> ${ctx.status}</p>
        <p style="margin: 8px 0 0 0;"><strong>Transaction ID:</strong> ${ctx.transactionId}</p>
        <p style="margin: 8px 0 0 0;"><strong>Date:</strong> ${ctx.date}</p>
        ${ctx.referenceNo ? `<p style="margin: 8px 0 0 0;"><strong>Application Reference:</strong> ${ctx.referenceNo}</p>` : ''}
      </div>
      <p>Best regards,<br>Iman Trucking School</p>
    </div>
  `
}

function paymentNotificationSmsText(ctx, { forAdmin }) {
  return forAdmin
    ? `Iman Trucking School: payment received from ${ctx.name} for ${ctx.program}, ${ctx.amount}. Txn ${ctx.transactionId}.`
    : `Iman Trucking School: your payment of ${ctx.amount} for ${ctx.program} was received. Thank you, ${ctx.firstName || 'there'}!`
}

async function sendPaymentNotifications(payment) {
  const ctx = buildNotificationContext(payment)

  if (resend && payment.customer_email) {
    try {
      await resend.emails.send({
        from: emailFrom,
        to: payment.customer_email,
        subject: `Payment Confirmed${ctx.referenceNo ? ` - ${ctx.referenceNo}` : ''}`,
        html: paymentNotificationEmailHtml(ctx, { forAdmin: false }),
      })
    } catch (error) {
      console.error('Failed to send student confirmation email:', error)
    }
  }

  if (resend) {
    try {
      await resend.emails.send({
        from: emailFrom,
        to: adminNotificationEmail,
        subject: `New payment received - ${ctx.program}`,
        html: paymentNotificationEmailHtml(ctx, { forAdmin: true }),
      })
    } catch (error) {
      console.error('Failed to send admin payment notification email:', error)
    }
  }

  if (twilioClient) {
    const phone = await getRecipientPhone(payment)
    if (phone) {
      try {
        await twilioClient.messages.create({
          to: phone,
          from: twilioFromNumber,
          body: paymentNotificationSmsText(ctx, { forAdmin: false }),
        })
      } catch (error) {
        console.error('Failed to send student payment SMS:', error)
      }
    }

    if (adminNotificationPhone) {
      try {
        await twilioClient.messages.create({
          to: adminNotificationPhone,
          from: twilioFromNumber,
          body: paymentNotificationSmsText(ctx, { forAdmin: true }),
        })
      } catch (error) {
        console.error('Failed to send admin payment SMS:', error)
      }
    }
  }
}

async function handlePaymentIntentFailed(paymentIntent) {
  const payment = await findPaymentByIntent(stripe, paymentIntent)
  if (!payment) return

  if (['succeeded', 'refunded'].includes(payment.status)) return

  await supabase
    .from('cdl_payments')
    .update({
      status: 'failed',
      error_message: paymentIntent.last_payment_error?.message || 'Payment failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.id)

  await markRelatedRecord(payment, { registration: 'failed', application: 'failed' })
}

async function handleChargeRefunded(charge) {
  const payment = await findPaymentByIntent(stripe, { id: charge.payment_intent })
  if (!payment) return

  await supabase
    .from('cdl_payments')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.id)

  await markRelatedRecord(payment, { registration: 'refunded', application: 'refunded' })
}

// ---------------------------------------------------------------------------
// Start-up: listen only when this file is executed directly.
// When imported (e.g. by server.js) the caller mounts the app itself.
// ---------------------------------------------------------------------------

export { app }

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const PORT = process.env.PORT || 3001
  app.listen(PORT, () => {
    console.log(`Stripe payment API server running on port ${PORT}`)
    console.log(`Stripe configured: ${!!stripe}`)
    console.log(`Database configured: ${!!supabase}`)
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  })
}
