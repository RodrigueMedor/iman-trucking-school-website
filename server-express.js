import express from 'express'
import cors from 'cors'
import Stripe from 'stripe'
import { Resend } from 'resend'
import twilio from 'twilio'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { z } from 'zod'
import PDFDocument from 'pdfkit'
import { pathToFileURL } from 'node:url'
import { automaticallyEvaluate, validateResponsesShape } from './shared/elpScoring.mjs'
import { cleanContact, cleanMessages, cleanText, generateChatReply, transcriptText } from './shared/admissionsChat.mjs'
import { coursePricing, installmentSchedule, pendingCheckoutAction, pricingTotal, tuitionPaymentAmount } from './shared/tuition.mjs'

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
  process.env.APPLICATION_EMAIL_FROM ||
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

// Staff recipients for website chatbot alerts (new conversations and
// callback requests), so admissions can follow up on what the visitor asked.
const chatAlertEmail = process.env.CHAT_ALERT_EMAIL || 'info@imanlogistics.com'
const chatAlertPhone = process.env.CHAT_ALERT_PHONE || '+18889914776'

const missingServiceError = 'Payments are not configured on the server. Set STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL.'
const missingDatabaseError = 'The student portal is not configured on the server. Set SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL.'

const PAYMENT_POLICY_VERSION = 'v2-case-by-case-refunds'
const TUITION_AGREEMENT_VERSION = 'tuition-v1-2026-10'
const TUITION_AGREEMENT_TEXT = 'I authorize Iman Trucking School to apply this payment to my tuition account. I understand that deposits and installment payments reduce, but may not fully satisfy, my tuition balance. Refund requests are reviewed under the school payment and refund policy. Financing is provided separately by Liberty Career Finance and is subject to the lender’s terms.'

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

async function requireStudent(req, res, next) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, active')
      .eq('id', req.user.id)
      .maybeSingle()
    if (error) throw error
    if (!profile?.active) return res.status(403).json({ error: 'This account is inactive or has not been verified.' })
    if (profile.role !== 'student') return res.status(403).json({ error: 'Student access required.' })
    next()
  } catch (error) {
    console.error('Failed to authorize student:', error)
    res.status(503).json({ error: 'Could not verify your account access. Try again shortly.' })
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

const studentOnly = [requireUser, requireStudent, rateLimit]

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
  if (!supabase) {
    res.status(503).json({ error: missingDatabaseError })
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
    const { data: prior } = await supabase
      .from('stripe_webhook_events')
      .select('status, attempts')
      .eq('event_id', event.id)
      .maybeSingle()
    if (prior?.status === 'processed') return res.json({ received: true, duplicate: true })
    if (prior) {
      await supabase.from('stripe_webhook_events').update({
        status: 'processing', attempts: Number(prior.attempts || 0) + 1, error: '', updated_at: new Date().toISOString(),
      }).eq('event_id', event.id)
    } else {
      const { error: eventError } = await supabase.from('stripe_webhook_events').insert({ event_id: event.id, event_type: event.type })
      if (eventError && eventError.code !== '23505') throw eventError
    }
    await dispatchWebhookEvent(event)
    await supabase.from('stripe_webhook_events').update({
      status: 'processed', processed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('event_id', event.id)
    res.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    if (supabase && event?.id) await supabase.from('stripe_webhook_events').update({
      status: 'failed', error: error instanceof Error ? error.message : String(error), updated_at: new Date().toISOString(),
    }).eq('event_id', event.id)
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
      chat: !!process.env.OPENAI_API_KEY,
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

// Student tuition ledger. Accounts are created by admissions; this endpoint
// is read-only and returns only rows owned by the signed-in student.
app.get('/api/me/billing', requireUser, requireStudent, async (req, res) => {
  try {
    const { data: accounts, error } = await supabase
      .from('cdl_tuition_account_balances')
      .select('*, course:cdl_courses(name, code), application:cdl_class_applications(reference_no)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    const ids = (accounts || []).map(row => row.id)
    const [{ data: installments }, { data: payments }, { data: agreements }, { data: adjustments }] = ids.length ? await Promise.all([
      supabase.from('cdl_tuition_installments').select('*').in('tuition_account_id', ids).order('installment_no'),
      // Abandoned checkout attempts are noise for students; keep real outcomes.
      supabase.from('cdl_payments').select('id, tuition_account_id, installment_id, payment_kind, payment_method, amount_cents, refunded_cents, currency, status, receipt_number, succeeded_at, refunded_at, created_at').in('tuition_account_id', ids).in('status', ['pending', 'processing', 'succeeded', 'failed', 'refunded']).order('created_at', { ascending: false }),
      supabase.from('cdl_payment_agreements').select('id, tuition_account_id, payment_id, version, signer_name, accepted_at, created_at').in('tuition_account_id', ids).order('created_at', { ascending: false }),
      supabase.from('cdl_tuition_adjustments').select('id, tuition_account_id, installment_id, kind, amount_cents, reason, created_at').in('tuition_account_id', ids).order('created_at', { ascending: false }),
    ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]
    const { data: financing } = await supabase.from('cdl_financing_referrals')
      .select('id, tuition_account_id, status, approved_amount_cents, funded_amount_cents, last_referred_at, updated_at')
      .eq('user_id', req.user.id).maybeSingle()
    const payable = await selfPayOptions(req.user.id, accounts || [])
    res.json({ accounts: accounts || [], installments: installments || [], payments: payments || [], agreements: agreements || [], adjustments: adjustments || [], financing, payable })
  } catch (error) {
    console.error('Error loading tuition billing:', error)
    res.status(500).json({ error: 'Could not load your tuition account.' })
  }
})

// Course columns the itemized price is computed from (see coursePricing).
const COURSE_PRICE_COLUMNS = 'tuition_cents, deposit_cents, installment_count, installments_enabled, training_cents, testing_fee_cents, administrative_fee_cents, materials_fee_cents, housing_fee_cents, currency, pricing_version'

// Training applications a self-paid tuition account can be linked to.
// Drafts and rejections are excluded.
const SELF_PAY_APPLICATION_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED', 'APPROVED', 'SCHEDULED']

// Courses a student may pay for by card right after registering, without
// financing or waiting for admissions. Offered only while the student has no
// open tuition account, so nobody is billed twice.
async function selfPayOptions(userId, accounts) {
  if (accounts.some(row => row.status !== 'CLOSED')) return []
  const [{ data: courses }, { data: applications }] = await Promise.all([
    supabase.from('cdl_courses').select(`id, name, code, ${COURSE_PRICE_COLUMNS}`).eq('active', true).gt('tuition_cents', 0).order('name'),
    supabase.from('cdl_class_applications').select('id, reference_no, course_id').eq('user_id', userId)
      .eq('application_type', 'TRAINING').in('status', SELF_PAY_APPLICATION_STATUSES).order('created_at', { ascending: false }),
  ])
  return (courses || []).map(course => {
    const application = (applications || []).find(row => row.course_id === course.id)
    const { id, name, code, tuition_cents, deposit_cents, installment_count, installments_enabled } = course
    return {
      courseId: id, course: { name, code, tuition_cents, deposit_cents, installment_count, installments_enabled }, pricing: coursePricing(course),
      application: application ? { id: application.id, reference_no: application.reference_no } : null,
    }
  })
}

// Attaches a tuition account the student opened before applying to the
// training application they submit later for the same course.
async function linkSelfPaidAccount(userId, application) {
  if (application.application_type !== 'TRAINING' || !application.course_id) return
  const { error } = await supabase.from('cdl_tuition_accounts').update({ application_id: application.id, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('course_id', application.course_id).is('application_id', null).neq('status', 'CLOSED')
  if (error) console.error('Could not link tuition account to application:', error)
}

// Opens a tuition account at the course's list price so a student who does
// not want financing can pay by card. Admissions can still adjust it later.
app.post('/api/me/tuition-accounts', studentOnly, async (req, res) => {
  try {
    const unavailable = requireClients(res)
    if (unavailable) return res.status(503).json(unavailable)
    const parsed = z.object({ courseId: uuidSchema, housingSelected: z.boolean().optional() }).strict().safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Choose a course to pay for.' })
    const { data: course } = await supabase.from('cdl_courses')
      .select(`id, active, ${COURSE_PRICE_COLUMNS}`).eq('id', parsed.data.courseId).maybeSingle()
    if (!course?.active) return res.status(404).json({ error: 'Course not found.' })
    if (!course.tuition_cents) return res.status(409).json({ error: 'Tuition for this course is not set yet. Contact admissions to pay.' })
    const { data: student } = await supabase.from('cdl_students').select('id').eq('user_id', req.user.id).maybeSingle()
    if (!student) return res.status(404).json({ error: 'Student profile not found.' })

    const { data: open } = await supabase.from('cdl_tuition_accounts').select('id, course_id').eq('user_id', req.user.id).neq('status', 'CLOSED')
    const existing = (open || []).find(row => row.course_id === course.id)
    if (existing) {
      // Returning to an unfinished checkout: apply a changed housing choice.
      if (parsed.data.housingSelected !== undefined) {
        const failure = await changeHousing(existing.id, req.user.id, parsed.data.housingSelected)
        if (failure) return res.status(failure.status).json({ error: failure.error })
      }
      return res.json({ tuitionAccountId: existing.id })
    }
    if (open?.length) return res.status(409).json({ error: 'You already have a tuition account. Contact admissions to change your course.' })

    const { data: linkable } = await supabase.from('cdl_class_applications').select('id').eq('user_id', req.user.id)
      .eq('application_type', 'TRAINING').eq('course_id', course.id).in('status', SELF_PAY_APPLICATION_STATUSES)
      .order('created_at', { ascending: false }).limit(1)
    // Priced on the server from the current course fees; the browser only
    // says whether housing is wanted.
    const pricing = coursePricing(course)
    const housingSelected = Boolean(parsed.data.housingSelected) && pricing.housingFeeCents > 0
    const tuitionCents = pricingTotal(pricing.items, pricing.housingFeeCents, housingSelected)
    const depositCents = Math.min(course.deposit_cents || 0, tuitionCents)
    const installmentCount = course.installments_enabled ? course.installment_count : 1
    // The database links any existing Liberty referral to the new account.
    const { data: account, error } = await supabase.from('cdl_tuition_accounts').insert({
      user_id: req.user.id, student_id: student.id, application_id: linkable?.[0]?.id || null, course_id: course.id,
      tuition_cents: tuitionCents, deposit_cents: depositCents, installment_count: installmentCount,
      installments_enabled: installmentCount > 1, created_by: req.user.id, updated_by: req.user.id, currency: pricing.currency,
      fee_items: pricing.items, housing_fee_cents: pricing.housingFeeCents, housing_selected: housingSelected, pricing_version: pricing.version,
    }).select('id').single()
    if (error) {
      // A concurrent request opened it first (unique indexes on application and self-paid course).
      if (error.code === '23505') {
        const { data: raced } = await supabase.from('cdl_tuition_accounts').select('id').eq('user_id', req.user.id).eq('course_id', course.id).neq('status', 'CLOSED').limit(1).single()
        return res.json({ tuitionAccountId: raced.id })
      }
      throw error
    }
    const installments = installmentSchedule({ tuitionCents, depositCents, installmentCount })
      .map(item => ({ ...item, tuition_account_id: account.id }))
    if (installments.length) {
      const { error: scheduleError } = await supabase.from('cdl_tuition_installments').insert(installments)
      if (scheduleError) console.error('Self-opened tuition account has no installment schedule:', scheduleError)
    }
    res.status(201).json({ tuitionAccountId: account.id })
  } catch (error) {
    console.error('Error opening tuition account:', error)
    res.status(500).json({ error: 'Could not start your tuition payment. Please try again.' })
  }
})

// Adds or removes optional housing on the student's own account. Allowed
// only until money has been applied (payment, financing or waiver); after
// that admissions makes the change. Returns { status, error } on refusal.
async function changeHousing(accountId, userId, housingSelected) {
  const { data: account } = await supabase.from('cdl_tuition_account_balances').select('*')
    .eq('id', accountId).eq('user_id', userId).maybeSingle()
  if (!account || account.status === 'CLOSED') return { status: 404, error: 'Tuition account not found.' }
  if (account.housing_selected === housingSelected) return null
  if (!account.housing_fee_cents || !account.fee_items?.length) return { status: 409, error: 'Housing is not offered on your tuition account. Contact admissions.' }
  const { count: settled } = await supabase.from('cdl_payments').select('id', { count: 'exact', head: true })
    .eq('tuition_account_id', account.id).in('status', ['succeeded', 'refunded'])
  if (settled || account.financing_cents || account.waived_cents) {
    return { status: 409, error: 'A payment has already been applied to your tuition. Contact admissions to change housing.' }
  }
  // An open checkout was priced for the old choice; it is expired first.
  const blocked = await releaseTuitionCheckout(account.id)
  if (blocked) return { status: 409, error: 'Your previous tuition payment is still being processed. Refresh in a moment to see your balance.' }

  const tuitionCents = pricingTotal(account.fee_items, account.housing_fee_cents, housingSelected)
  const depositCents = Math.min(account.deposit_cents, tuitionCents)
  const { data: updated, error } = await supabase.from('cdl_tuition_accounts').update({
    housing_selected: housingSelected, tuition_cents: tuitionCents, deposit_cents: depositCents, updated_by: userId, updated_at: new Date().toISOString(),
  }).eq('id', account.id).eq('housing_selected', !housingSelected).select('id')
  if (error) throw error
  if (!updated?.length) return null // a concurrent request already applied it

  // Nothing was paid, so an installment schedule is rebuilt for the new total.
  if (account.installments_enabled) {
    await supabase.from('cdl_tuition_installments').delete().eq('tuition_account_id', account.id)
    const installments = installmentSchedule({ tuitionCents, depositCents, installmentCount: account.installment_count })
      .map(item => ({ ...item, tuition_account_id: account.id }))
    if (installments.length) {
      const { error: scheduleError } = await supabase.from('cdl_tuition_installments').insert(installments)
      if (scheduleError) console.error('Could not rebuild the installment schedule after a housing change:', scheduleError)
    }
  }
  return null
}

app.patch('/api/me/tuition-accounts/:id/housing', studentOnly, async (req, res) => {
  try {
    const unavailable = requireClients(res)
    if (unavailable) return res.status(503).json(unavailable)
    if (!uuidSchema.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid tuition account.' })
    const parsed = z.object({ housingSelected: z.boolean() }).strict().safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Choose whether to add housing.' })
    const failure = await changeHousing(req.params.id, req.user.id, parsed.data.housingSelected)
    if (failure) return res.status(failure.status).json({ error: failure.error })
    const { data: account } = await supabase.from('cdl_tuition_account_balances')
      .select('id, tuition_cents, remaining_cents, housing_selected, housing_fee_cents').eq('id', req.params.id).single()
    res.json({ account })
  } catch (error) {
    console.error('Error changing housing:', error)
    res.status(500).json({ error: 'Could not update your housing choice. Please try again.' })
  }
})

const tuitionCheckoutSchema = z.object({
  tuitionAccountId: z.string().uuid(),
  kind: z.enum(['full', 'deposit', 'installment']),
  installmentId: z.string().uuid().optional(),
  paymentPolicyAccepted: z.literal(true),
  paymentPolicySignature: z.string().trim().min(1).max(200),
}).strict()

app.post('/api/create-tuition-checkout', studentOnly, async (req, res) => {
  try {
    const unavailable = requireClients(res)
    if (unavailable) return res.status(503).json(unavailable)
    const parsed = tuitionCheckoutSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Choose a valid tuition payment and sign the agreement.' })
    const input = parsed.data
    const { data: student } = await supabase.from('cdl_students').select('id, first_name, last_name, email').eq('user_id', req.user.id).maybeSingle()
    if (!student) return res.status(404).json({ error: 'Student profile not found.' })
    const policyError = paymentPolicyError(input, student.first_name, student.last_name)
    if (policyError) return res.status(400).json({ error: policyError })

    // The balance view is the ledger's single source of truth: it already
    // accounts for refunds, waivers and funded financing.
    const { data: account } = await supabase.from('cdl_tuition_account_balances')
      .select('*, course:cdl_courses(name, code)').eq('id', input.tuitionAccountId).eq('user_id', req.user.id).maybeSingle()
    if (!account || account.status === 'CLOSED') return res.status(404).json({ error: 'Tuition account not found.' })
    const remainingCents = account.remaining_cents
    if (!remainingCents) return res.status(409).json({ error: 'This tuition account is already paid in full.' })

    let installment = null
    let amountCents = remainingCents
    if (input.kind === 'deposit') {
      if (!account.deposit_cents) return res.status(409).json({ error: 'A deposit option is not configured for this tuition account.' })
      amountCents = tuitionPaymentAmount({ kind: 'deposit', remainingCents, depositCents: account.deposit_cents })
    } else if (input.kind === 'installment') {
      if (!account.installments_enabled || !input.installmentId) return res.status(409).json({ error: 'Installments are not available for this tuition account.' })
      const result = await supabase.from('cdl_tuition_installments').select('*').eq('id', input.installmentId).eq('tuition_account_id', account.id).maybeSingle()
      installment = result.data
      // PENDING means this installment's own checkout is still open; the
      // pending-checkout check below reuses or replaces it.
      if (!installment || !['DUE', 'PENDING'].includes(installment.status)) return res.status(409).json({ error: 'That installment is no longer payable.' })
      amountCents = tuitionPaymentAmount({ kind: 'installment', remainingCents, installmentCents: installment.amount_cents })
    }
    if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > remainingCents) return res.status(400).json({ error: 'Invalid tuition payment amount.' })

    // At most one open checkout per account (enforced by a unique index).
    const { data: pending } = await supabase.from('cdl_payments').select('*')
      .eq('tuition_account_id', account.id).in('status', ['pending', 'processing']).maybeSingle()
    if (pending?.status === 'processing') {
      return res.status(409).json({ error: 'Your previous tuition payment is still processing. Check back shortly before paying again.' })
    }
    if (pending) {
      let session = null
      if (pending.stripe_checkout_session_id) {
        try { session = await stripe.checkout.sessions.retrieve(pending.stripe_checkout_session_id) } catch { session = null }
      }
      let action = pendingCheckoutAction({ session, payment: pending, kind: input.kind, installmentId: installment?.id, amountCents })
      if (action === 'reuse') return res.json({ sessionId: session.id, url: session.url, reused: true })
      if (action === 'replace' && session?.status === 'open') {
        try {
          await stripe.checkout.sessions.expire(session.id)
        } catch {
          // The student may have just paid in another tab; never charge twice.
          session = await stripe.checkout.sessions.retrieve(session.id)
          action = pendingCheckoutAction({ session, payment: pending, kind: input.kind, installmentId: installment?.id, amountCents })
        }
      }
      if (action === 'finalize') {
        if (session.payment_status === 'paid') {
          await finalizeSuccessfulPayment(
            { ...pending, stripe_payment_intent_id: session.payment_intent || pending.stripe_payment_intent_id },
            session.amount_total, session.currency,
          )
          return res.status(409).json({ error: 'Your previous tuition payment was received. Refresh to see your updated balance.' })
        }
        return res.status(409).json({ error: 'Your previous tuition payment is still processing. Check back shortly before paying again.' })
      }
      await cancelPendingPayment(pending)
    }

    const acceptedAt = new Date().toISOString()
    const { data: agreement, error: agreementError } = await supabase.from('cdl_payment_agreements').insert({
      user_id: req.user.id, student_id: student.id, tuition_account_id: account.id,
      version: TUITION_AGREEMENT_VERSION, agreement_text: TUITION_AGREEMENT_TEXT,
      signer_name: input.paymentPolicySignature.trim(), accepted_at: acceptedAt,
      ip_address: req.ip || null, user_agent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
    }).select().single()
    if (agreementError) throw agreementError

    const { data: payment, error: paymentError } = await supabase.from('cdl_payments').insert({
      student_id: student.id, tuition_account_id: account.id, installment_id: installment?.id || null, payment_method: 'stripe',
      amount_cents: amountCents, currency: account.currency, status: 'pending', payment_type: 'tuition', payment_kind: input.kind,
      customer_email: student.email || req.user.email, agreement_id: agreement.id,
      metadata: { firstName: student.first_name, lastName: student.last_name, tuitionAccountId: account.id,
        installmentId: installment?.id || null, courseName: account.course?.name || 'CDL Training', expected_amount: amountCents,
        fee_items: account.fee_items || [], housing_selected: account.housing_selected, housing_fee_cents: account.housing_fee_cents,
        pricing_version: account.pricing_version, tuition_cents: account.tuition_cents,
        payment_policy_version: TUITION_AGREEMENT_VERSION, payment_policy_signature: input.paymentPolicySignature.trim(), payment_policy_accepted_at: acceptedAt },
    }).select().single()
    if (paymentError) {
      // A concurrent request opened a checkout first (unique index).
      if (paymentError.code === '23505') return res.status(409).json({ error: 'A tuition checkout is already open. Wait a moment and try again.' })
      throw paymentError
    }
    await supabase.from('cdl_payment_agreements').update({ payment_id: payment.id }).eq('id', agreement.id)

    const label = input.kind === 'full' ? 'Full tuition payment' : input.kind === 'deposit' ? 'Tuition deposit' : installment.label
    let session
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment', payment_method_types: ['card'], customer_email: student.email || req.user.email,
        line_items: [{ price_data: { currency: account.currency, product_data: { name: label, description: tuitionDescription(account) }, unit_amount: amountCents }, quantity: 1 }],
        custom_text: stripePolicyCustomText(),
        // Abandoned checkouts release the account quickly (Stripe minimum is 30 minutes).
        expires_at: Math.floor(Date.now() / 1000) + TUITION_CHECKOUT_TTL_SECONDS,
        success_url: checkoutReturnUrl(req, '/portal/billing/', 'success'), cancel_url: checkoutReturnUrl(req, '/portal/billing/', 'canceled'),
        metadata: {
          payment_id: payment.id, student_id: student.id, tuition_account_id: account.id, installment_id: installment?.id || '', payment_type: 'tuition',
          expected_amount: String(amountCents), agreement_id: agreement.id, enrollment_id: account.application_id || '', program_id: account.course_id || '',
          housing_selected: String(Boolean(account.housing_selected)), pricing_version: String(account.pricing_version || ''),
        },
        payment_intent_data: { metadata: { payment_id: payment.id, payment_type: 'tuition' } },
      }, { idempotencyKey: `tuition-checkout-${payment.id}` })
    } catch (error) {
      // Without a Session the pending row would block the account forever.
      await cancelPendingPayment(payment, 'Stripe Checkout could not be created')
      throw error
    }
    await supabase.from('cdl_payments').update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() }).eq('id', payment.id)
    if (installment) await supabase.from('cdl_tuition_installments').update({ status: 'PENDING', updated_at: new Date().toISOString() }).eq('id', installment.id)
    res.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('Error creating tuition checkout:', error)
    res.status(500).json({ error: 'Failed to create tuition checkout.' })
  }
})

const TUITION_CHECKOUT_TTL_SECONDS = 35 * 60

const usd = cents => `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// One line for the Stripe Checkout page, e.g. "CDL Class A Training — fees
// $3,429.00 + housing $500.00 — Iman Trucking School".
function tuitionDescription(account) {
  const program = account.course?.name || 'CDL Training'
  if (!account.fee_items?.length) return `${program} — Iman Trucking School`
  const fees = pricingTotal(account.fee_items, 0, false)
  return `${program} — fees ${usd(fees)}${account.housing_selected ? ` + housing ${usd(account.housing_fee_cents)}` : ', no housing'} — Iman Trucking School`
}

// Itemized lines for receipts and confirmations: the fee snapshot plus
// housing when chosen, or a single tuition line for older accounts.
function tuitionLines(account) {
  const lines = account.fee_items?.length
    ? account.fee_items.map(item => [item.label, item.amount_cents])
    : [['Tuition', account.tuition_cents]]
  if (account.housing_selected) lines.push(['Optional Housing', account.housing_fee_cents])
  return lines
}

// Cancels a checkout attempt that was never paid and frees its installment.
async function cancelPendingPayment(payment, reason = 'Replaced by a new checkout') {
  const { data: canceled } = await supabase.from('cdl_payments')
    .update({ status: 'canceled', error_message: reason, updated_at: new Date().toISOString() })
    .eq('id', payment.id).in('status', ['pending', 'processing']).select()
  if (canceled?.length) await markRelatedRecord(payment, { registration: 'canceled', application: 'canceled' })
}

// Students may read their own billing documents; tuition admins may read any.
const ADMIN_ROLES = ['admin', 'super_admin']

async function requireStudentOrAdmin(req, res, next) {
  try {
    const { data: profile, error } = await supabase.from('profiles').select('role, active').eq('id', req.user.id).maybeSingle()
    if (error) throw error
    if (!profile?.active || !['student', ...ADMIN_ROLES].includes(profile.role)) return res.status(403).json({ error: 'Access denied.' })
    req.isAdmin = ADMIN_ROLES.includes(profile.role)
    next()
  } catch (error) {
    console.error('Failed to authorize billing document access:', error)
    res.status(503).json({ error: 'Could not verify your account access. Try again shortly.' })
  }
}

async function requireTuitionAdmin(req, res, next) {
  try {
    const { data: profile, error } = await supabase.from('profiles').select('role, active').eq('id', req.user.id).maybeSingle()
    if (error) throw error
    if (!profile?.active || !ADMIN_ROLES.includes(profile.role)) return res.status(403).json({ error: 'Admin access required.' })
    next()
  } catch (error) {
    console.error('Failed to authorize admin:', error)
    res.status(503).json({ error: 'Could not verify your account access. Try again shortly.' })
  }
}

const adminOnly = [requireUser, requireTuitionAdmin, rateLimit]

const PAYMENT_METHOD_LABELS = { stripe: 'Card (Stripe)', cash: 'Cash', check: 'Check', money_order: 'Money order', other: 'Other' }

function receiptNumberFor(paymentId) {
  return `IMAN-${paymentId.replace(/-/g, '').slice(0, 12).toUpperCase()}`
}

function pdfFields(doc, rows) {
  for (const [label, value] of rows) doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(String(value || '—'))
}

app.get('/api/payments/:id/receipt', requireUser, requireStudentOrAdmin, async (req, res) => {
  if (!uuidSchema.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid payment id.' })
  try {
    const { data: payment } = await supabase.from('cdl_payments')
      .select('*, student:cdl_students(first_name, last_name)')
      .eq('id', req.params.id).in('status', ['succeeded', 'refunded']).maybeSingle()
    const { data: account } = payment?.tuition_account_id
      ? await supabase.from('cdl_tuition_account_balances').select('*, course:cdl_courses(name)').eq('id', payment.tuition_account_id).maybeSingle()
      : { data: null }
    if (!payment || !account || (!req.isAdmin && account.user_id !== req.user.id)) return res.status(404).json({ error: 'Receipt not found.' })
    const receipt = payment.receipt_number || receiptNumberFor(payment.id)
    const money = cents => `$${(cents / 100).toFixed(2)} ${String(payment.currency).toUpperCase()}`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${receipt}.pdf"`)
    const doc = new PDFDocument({ size: 'LETTER', margin: 54, info: { Title: `Receipt ${receipt}`, Author: 'Iman Trucking School' } })
    doc.pipe(res)
    doc.fontSize(20).fillColor('#08085f').text('IMAN TRUCKING SCHOOL')
    doc.moveDown().fontSize(16).text('Payment Receipt')
    doc.moveDown().fontSize(11).fillColor('#222')
    const method = payment.payment_method || 'stripe'
    pdfFields(doc, [
      ['Receipt', receipt], ['Student', `${payment.student?.first_name || ''} ${payment.student?.last_name || ''}`.trim()],
      ['Program', account.course?.name || 'CDL Training'],
    ])
    doc.moveDown().font('Helvetica-Bold').text('Program costs')
    doc.font('Helvetica')
    for (const [name, cents] of tuitionLines(account)) doc.text(`${name}: ${money(cents)}`, { indent: 12 })
    doc.moveDown(0.5)
    pdfFields(doc, [
      ['Housing selected', account.housing_selected ? 'Yes' : 'No'],
      ['Total program cost', money(account.tuition_cents)],
      ['Total paid to date', money(account.paid_cents)],
      ...(account.financing_cents > 0 ? [['Financing', money(account.financing_cents)]] : []),
      ...(account.waived_cents > 0 ? [['Waived', money(account.waived_cents)]] : []),
      ['Remaining balance', money(account.remaining_cents)],
    ])
    doc.moveDown()
    pdfFields(doc, [
      ['Amount of this payment', money(payment.amount_cents)],
      ...(payment.refunded_cents > 0 ? [['Refunded', money(payment.refunded_cents)]] : []),
      ['Payment type', payment.payment_kind || 'Tuition'], ['Payment method', PAYMENT_METHOD_LABELS[method] || method],
      ['Payment date', new Date(payment.succeeded_at).toLocaleString('en-US')],
      ['Payment status', payment.status === 'refunded' ? 'Refunded' : payment.refunded_cents > 0 ? 'Partially refunded' : 'Paid'],
      method === 'stripe'
        ? ['Stripe transaction', payment.stripe_payment_intent_id || payment.stripe_checkout_session_id]
        : ['Reference', payment.metadata?.reference],
    ])
    doc.moveDown(2).fillColor('#555').text('Thank you for your payment. Keep this receipt for your records.')
    doc.end()
  } catch (error) {
    console.error('Error generating receipt:', error)
    if (!res.headersSent) res.status(500).json({ error: 'Could not generate the receipt.' })
  }
})

// Signed tuition agreement, rendered from the stored snapshot exactly as the
// student accepted it.
app.get('/api/agreements/:id/pdf', requireUser, requireStudentOrAdmin, async (req, res) => {
  if (!uuidSchema.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid agreement id.' })
  try {
    const { data: agreement } = await supabase.from('cdl_payment_agreements')
      .select('*, payment:cdl_payments!payment_id(amount_cents, currency, payment_kind, receipt_number)')
      .eq('id', req.params.id).maybeSingle()
    if (!agreement || (!req.isAdmin && agreement.user_id !== req.user.id)) return res.status(404).json({ error: 'Agreement not found.' })
    const name = `IMAN-AGREEMENT-${agreement.id.slice(0, 8).toUpperCase()}`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${name}.pdf"`)
    const doc = new PDFDocument({ size: 'LETTER', margin: 54, info: { Title: 'Tuition payment agreement', Author: 'Iman Trucking School' } })
    doc.pipe(res)
    doc.fontSize(20).fillColor('#08085f').text('IMAN TRUCKING SCHOOL')
    doc.moveDown().fontSize(16).text('Tuition Payment Agreement')
    doc.moveDown().fontSize(11).fillColor('#222').font('Helvetica').text(agreement.agreement_text, { align: 'left' })
    doc.moveDown(1.5)
    pdfFields(doc, [
      ['Signed by', agreement.signer_name], ['Accepted', new Date(agreement.accepted_at).toLocaleString('en-US')],
      ['Agreement version', agreement.version],
      ...(agreement.payment ? [['Payment', `$${(agreement.payment.amount_cents / 100).toFixed(2)} ${String(agreement.payment.currency).toUpperCase()} (${agreement.payment.payment_kind || 'tuition'})`]] : []),
      ...(agreement.payment?.receipt_number ? [['Receipt', agreement.payment.receipt_number]] : []),
      ['Agreement ID', agreement.id],
    ])
    doc.moveDown(2).fillColor('#555').text('The signer typed their full legal name as an electronic signature before checkout.')
    doc.end()
  } catch (error) {
    console.error('Error generating agreement:', error)
    if (!res.headersSent) res.status(500).json({ error: 'Could not generate the agreement.' })
  }
})

// ---------------------------------------------------------------------------
// Admin tuition actions. Written with the service role so every change is
// validated and audited here; clients cannot write payments or waivers.
// ---------------------------------------------------------------------------

const manualPaymentSchema = z.object({
  amountCents: z.number().int().positive().max(10000000),
  method: z.enum(['cash', 'check', 'money_order', 'other']),
  installmentId: z.string().uuid().optional(),
  reference: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
}).strict()

const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict()

// An admin action must not race a student's open Stripe checkout: an open
// one is expired first, and one that was already paid is finalized instead.
async function releaseTuitionCheckout(accountId) {
  const { data: pending } = await supabase.from('cdl_payments').select('*')
    .eq('tuition_account_id', accountId).in('status', ['pending', 'processing']).maybeSingle()
  if (!pending) return null
  if (pending.status === 'processing') return 'A student payment is still processing. Try again once it completes.'
  let session = null
  if (pending.stripe_checkout_session_id && stripe) {
    try { session = await stripe.checkout.sessions.retrieve(pending.stripe_checkout_session_id) } catch { session = null }
    if (session?.status === 'open') {
      try { await stripe.checkout.sessions.expire(session.id) } catch { session = await stripe.checkout.sessions.retrieve(session.id) }
    }
  }
  if (session?.payment_status === 'paid') {
    await finalizeSuccessfulPayment({ ...pending, stripe_payment_intent_id: session.payment_intent || pending.stripe_payment_intent_id }, session.amount_total, session.currency)
    return 'The student just paid online. Review the updated balance before recording anything else.'
  }
  if (session?.status === 'complete') return 'A student payment is still processing. Try again once it completes.'
  await cancelPendingPayment(pending, 'Canceled by an admin action')
  return null
}

app.post('/api/admin/tuition-accounts/:id/payments', adminOnly, async (req, res) => {
  if (!uuidSchema.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid tuition account.' })
  const parsed = manualPaymentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid amount and payment method.' })
  const input = parsed.data
  try {
    const { data: account } = await supabase.from('cdl_tuition_account_balances')
      .select('*, student:cdl_students(first_name, last_name, email), course:cdl_courses(name)').eq('id', req.params.id).maybeSingle()
    if (!account || account.status === 'CLOSED') return res.status(404).json({ error: 'Tuition account not found.' })
    const blocked = await releaseTuitionCheckout(account.id)
    if (blocked) return res.status(409).json({ error: blocked })
    const { data: current } = await supabase.from('cdl_tuition_account_balances').select('remaining_cents').eq('id', account.id).single()
    if (input.amountCents > current.remaining_cents) return res.status(409).json({ error: 'The amount is more than the remaining balance.' })

    let installment = null
    if (input.installmentId) {
      const { data } = await supabase.from('cdl_tuition_installments').select('*').eq('id', input.installmentId).eq('tuition_account_id', account.id).maybeSingle()
      installment = data
      if (!installment || installment.status !== 'DUE') return res.status(409).json({ error: 'That installment is not due.' })
      if (input.amountCents !== Math.min(installment.amount_cents, current.remaining_cents)) return res.status(400).json({ error: 'The amount must match the installment.' })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const { data: payment, error } = await supabase.from('cdl_payments').insert({
      id, student_id: account.student_id, tuition_account_id: account.id, installment_id: installment?.id || null,
      amount_cents: input.amountCents, currency: account.currency, status: 'succeeded', succeeded_at: now,
      payment_type: 'tuition', payment_kind: installment ? 'installment' : null, payment_method: input.method,
      receipt_number: receiptNumberFor(id), recorded_by: req.user.id, customer_email: account.student?.email || null,
      metadata: {
        firstName: account.student?.first_name || '', lastName: account.student?.last_name || '', courseName: account.course?.name || 'CDL Training',
        reference: input.reference || null, note: input.note || null, recorded_by_email: req.user.email,
      },
    }).select().single()
    if (error) throw error
    if (installment) await supabase.from('cdl_tuition_installments').update({ status: 'PAID', updated_at: now }).eq('id', installment.id)
    await sendPaymentNotifications(payment)
    res.status(201).json({ payment })
  } catch (error) {
    console.error('Error recording offline tuition payment:', error)
    res.status(500).json({ error: 'Could not record the payment.' })
  }
})

// Offline payments entered by mistake are voided, never deleted.
app.post('/api/admin/tuition-payments/:id/void', adminOnly, async (req, res) => {
  if (!uuidSchema.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid payment.' })
  const parsed = reasonSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a reason of at least 3 characters.' })
  try {
    const { data: payment } = await supabase.from('cdl_payments').select('*').eq('id', req.params.id).eq('payment_type', 'tuition').maybeSingle()
    if (!payment) return res.status(404).json({ error: 'Payment not found.' })
    if (payment.payment_method === 'stripe') return res.status(409).json({ error: 'Card payments are refunded in Stripe, not voided.' })
    const now = new Date().toISOString()
    const { data: voided } = await supabase.from('cdl_payments').update({
      status: 'canceled', error_message: `Voided: ${parsed.data.reason}`, updated_at: now,
      metadata: { ...(payment.metadata || {}), voided_by: req.user.id, voided_by_email: req.user.email, voided_at: now, void_reason: parsed.data.reason },
    }).eq('id', payment.id).eq('status', 'succeeded').select()
    if (!voided?.length) return res.status(409).json({ error: 'Only a recorded payment can be voided.' })
    if (payment.installment_id) await supabase.from('cdl_tuition_installments').update({ status: 'DUE', updated_at: now }).eq('id', payment.installment_id).eq('status', 'PAID')
    res.json({ payment: voided[0] })
  } catch (error) {
    console.error('Error voiding tuition payment:', error)
    res.status(500).json({ error: 'Could not void the payment.' })
  }
})

app.post('/api/admin/tuition-installments/:id/waive', adminOnly, async (req, res) => {
  if (!uuidSchema.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid installment.' })
  const parsed = reasonSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a reason of at least 3 characters.' })
  try {
    const { data: installment } = await supabase.from('cdl_tuition_installments').select('*').eq('id', req.params.id).maybeSingle()
    if (!installment) return res.status(404).json({ error: 'Installment not found.' })
    if (installment.status !== 'DUE') return res.status(409).json({ error: 'Only a due installment can be waived.' })
    const { data: account } = await supabase.from('cdl_tuition_account_balances').select('id, remaining_cents, status').eq('id', installment.tuition_account_id).single()
    const amountCents = Math.min(installment.amount_cents, account.remaining_cents)
    if (account.status === 'CLOSED' || amountCents <= 0) return res.status(409).json({ error: 'Nothing is left to waive on this account.' })
    const { data: adjustment, error } = await supabase.from('cdl_tuition_adjustments').insert({
      tuition_account_id: account.id, installment_id: installment.id, amount_cents: amountCents, reason: parsed.data.reason, created_by: req.user.id,
    }).select().single()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'This installment was already waived.' })
      throw error
    }
    await supabase.from('cdl_tuition_installments').update({ status: 'WAIVED', updated_at: new Date().toISOString() }).eq('id', installment.id)
    res.status(201).json({ adjustment })
  } catch (error) {
    console.error('Error waiving installment:', error)
    res.status(500).json({ error: 'Could not waive the installment.' })
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
      'application_type, reference_no, course_id, first_name, last_name, email, phone, statement, preferred_dates, form_data, submitted_at, course:cdl_courses(name), session:cdl_academic_sessions(name)'
    )
    if (!application) return
    if (application.status !== 'SUBMITTED') {
      return res.status(409).json({ error: 'Only submitted applications are sent to admissions.' })
    }
    await linkSelfPaidAccount(req.user.id, application)

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
// The signed-in student's own cdl_students row. Served here rather than read
// from the browser so the portal does not depend on cdl_students RLS. The
// service role bypasses cdl_students_guard, so only the student-editable
// fields below are accepted (.strict() rejects payment and owner fields).
// ---------------------------------------------------------------------------

const optionalText = (max) => z.string().trim().max(max).nullable().optional()
const studentProfilePatchSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required.').max(100).optional(),
  last_name: z.string().trim().min(1, 'Last name is required.').max(100).optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254).nullable().optional(),
  phone: optionalText(30),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date of birth.').nullable().optional(),
  address_line1: optionalText(200),
  address_line2: optionalText(200),
  city: optionalText(100),
  state: z.string().regex(/^[A-Z]{2}$/, 'Choose a state.').nullable().optional(),
  zip_code: z.string().regex(/^\d{5}(-\d{4})?$/, 'Enter a valid ZIP code.').nullable().optional(),
  license_type: z.enum(['NONE', 'REGULAR', 'CLP', 'CDL']).nullable().optional(),
  license_number: optionalText(30),
  license_state: z.string().regex(/^([A-Z]{2})?$/, 'Choose the state that issued your license.').nullable().optional(),
}).strict()

app.get('/api/me/student', requireUser, requireStudent, async (req, res) => {
  try {
    const { data, error } = await supabase.from('cdl_students').select('*').eq('user_id', req.user.id).maybeSingle()
    if (error) throw error
    res.json({ student: data })
  } catch (error) {
    console.error('Error loading student profile:', error)
    res.status(500).json({ error: 'Could not load your profile. Try again shortly.' })
  }
})

app.patch('/api/me/student', studentOnly, async (req, res) => {
  const parsed = studentProfilePatchSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check your answers and try again.' })
  }
  try {
    const { data, error } = await supabase
      .from('cdl_students')
      .update(parsed.data)
      .eq('user_id', req.user.id)
      .select('*')
      .maybeSingle()
    if (error) {
      if (error.code === '23514') return res.status(400).json({ error: 'Some information isn\'t in the expected format. Check your answers and try again.' })
      throw error
    }
    if (!data) return res.status(404).json({ error: 'We couldn\'t find your student profile. Please contact admissions.' })
    res.json({ student: data })
  } catch (error) {
    console.error('Error saving student profile:', error)
    res.status(500).json({ error: 'Could not save your profile. Try again shortly.' })
  }
})

// ---------------------------------------------------------------------------
// Accounts created before roles were locked down can carry a legacy role
// ('admin', 'employee') or have no profile at all. Neither has staff access,
// so when such an account signs in to the student portal it is turned into
// the student account the portal expects. Staff and students are untouched.
// ---------------------------------------------------------------------------

const PORTAL_ROLES = new Set(['student', 'super_admin', 'instructor'])
// The only account allowed to be super admin (also enforced in the database).
const SUPER_ADMIN_EMAIL = 'info@imanlogistics.com'

app.post('/api/me/student-account', requireUser, rateLimit, async (req, res) => {
  try {
    const { data: profile, error } = await supabase.from('profiles').select('role, active').eq('id', req.user.id).maybeSingle()
    if (error) throw error
    if (profile && PORTAL_ROLES.has(profile.role)) return res.json({ role: profile.role, repaired: false })
    if (req.user.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL) {
      return res.status(409).json({ error: 'This account is managed by the super administrator.' })
    }

    const { data: found, error: userError } = await supabase.auth.admin.getUserById(req.user.id)
    if (userError || !found?.user) throw userError || new Error('Auth user not found')
    const user = found.user
    const meta = user.user_metadata || {}
    const verified = Boolean(user.email_confirmed_at)
    const email = user.email || req.user.email
    const localPart = email.split('@')[0] || 'Student'

    // Recording the role in app_metadata stops the auth trigger from ever
    // restoring the legacy role.
    const { error: metaError } = await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata || {}), role: 'student' },
    })
    if (metaError) throw metaError

    const { error: profileError } = profile
      ? await supabase.from('profiles').update({ role: 'student', active: verified }).eq('id', user.id)
      : await supabase.from('profiles').upsert({ id: user.id, full_name: meta.full_name || localPart, role: 'student', active: verified })
    if (profileError) throw profileError

    const { error: usersError } = await supabase.from('cdl_users')
      .upsert({ id: user.id, role: 'student', email, updated_at: new Date().toISOString() })
    if (usersError) throw usersError

    const { error: studentError } = await supabase.from('cdl_students').upsert({
      user_id: user.id,
      first_name: meta.first_name || localPart,
      last_name: meta.last_name || '',
      email,
    }, { onConflict: 'user_id', ignoreDuplicates: true })
    if (studentError) throw studentError

    console.info(`Converted account ${user.id} (role ${profile?.role ?? 'none'}) to a student account.`)
    res.json({ role: 'student', repaired: true })
  } catch (error) {
    console.error('Error setting up student account:', error)
    res.status(500).json({ error: 'Your student account could not be set up. Please contact admissions.' })
  }
})

// ---------------------------------------------------------------------------
// Instructor accounts are created server-side by a super admin. The role is
// set in app_metadata, which only the service role can write; the database
// ignores roles in user-editable metadata.
// ---------------------------------------------------------------------------

const instructorSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(100),
  lastName: z.string().trim().min(1, 'Last name is required.').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  password: z.string().min(10, 'Password must be at least 10 characters.').max(72),
})

async function requireSuperAdmin(req, res, next) {
  try {
    const { data: caller, error } = await supabase.from('profiles').select('role, active').eq('id', req.user.id).maybeSingle()
    if (error) throw error
    if (!caller?.active || caller.role !== 'super_admin' || req.user.email.trim().toLowerCase() !== SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Only super administrators can manage course pricing.' })
    }
    next()
  } catch (error) {
    console.error('Failed to authorize super admin:', error)
    res.status(503).json({ error: 'Could not verify your account access. Try again shortly.' })
  }
}

const superAdminOnly = [requireUser, requireSuperAdmin, rateLimit]
const COURSE_PRICING_COLUMNS = `id, code, name, active, installments_enabled, updated_at, pricing_effective_at, ${COURSE_PRICE_COLUMNS}`

app.get('/api/admin/courses', superAdminOnly, async (req, res) => {
  try {
    const { data, error } = await supabase.from('cdl_courses').select(COURSE_PRICING_COLUMNS).order('name')
    if (error) throw error
    res.json({ courses: data || [] })
  } catch (error) {
    console.error('Error loading course pricing:', error)
    res.status(500).json({ error: 'Could not load course pricing.' })
  }
})

// Every price version, newest first, with who set it.
app.get('/api/admin/courses/:id/pricing-history', superAdminOnly, async (req, res) => {
  try {
    if (!uuidSchema.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid course id.' })
    const { data, error } = await supabase.from('cdl_course_pricing_versions').select('*')
      .eq('course_id', req.params.id).order('version', { ascending: false }).limit(50)
    if (error) throw error
    const editors = [...new Set((data || []).map(row => row.created_by).filter(Boolean))]
    const { data: profiles } = editors.length ? await supabase.from('profiles').select('id, full_name').in('id', editors) : { data: [] }
    const byId = Object.fromEntries((profiles || []).map(row => [row.id, row.full_name]))
    res.json({ versions: (data || []).map(row => ({ ...row, created_by_name: byId[row.created_by] || null })) })
  } catch (error) {
    console.error('Error loading pricing history:', error)
    res.status(500).json({ error: 'Could not load the pricing history.' })
  }
})

const priceCents = z.number().int().min(0).max(10000000)
const coursePricingSchema = z.object({
  trainingCents: priceCents,
  testingFeeCents: priceCents,
  administrativeFeeCents: priceCents,
  materialsFeeCents: priceCents,
  housingFeeCents: priceCents,
  depositCents: priceCents,
  installmentCount: z.number().int().min(1).max(24),
}).strict()
  .refine(input => input.trainingCents + input.testingFeeCents + input.administrativeFeeCents + input.materialsFeeCents <= 10000000, 'The total is too large.')
  .refine(input => input.depositCents <= input.trainingCents + input.testingFeeCents + input.administrativeFeeCents + input.materialsFeeCents, 'The deposit cannot be more than the total.')

// New prices apply to tuition accounts opened afterwards; existing accounts
// keep the fee snapshot the student agreed to. The database derives the
// total, bumps the pricing version and records it in the history.
app.patch('/api/admin/courses/:id/pricing', superAdminOnly, async (req, res) => {
  try {
    if (!uuidSchema.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid course id.' })
    const parsed = coursePricingSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Enter valid fees, deposit and installment count.' })
    const input = parsed.data
    const { data, error } = await supabase.from('cdl_courses').update({
      training_cents: input.trainingCents, testing_fee_cents: input.testingFeeCents, administrative_fee_cents: input.administrativeFeeCents,
      materials_fee_cents: input.materialsFeeCents, housing_fee_cents: input.housingFeeCents, deposit_cents: input.depositCents,
      installment_count: input.installmentCount, installments_enabled: input.installmentCount > 1,
      pricing_updated_by: req.user.id, updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).select(COURSE_PRICING_COLUMNS).maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Course not found.' })
    console.info(`Course pricing updated by ${req.user.email}: ${data.code} v${data.pricing_version} training=${input.trainingCents} testing=${input.testingFeeCents} admin=${input.administrativeFeeCents} materials=${input.materialsFeeCents} housing=${input.housingFeeCents} deposit=${input.depositCents} installments=${input.installmentCount}`)
    res.json({ course: data })
  } catch (error) {
    console.error('Error updating course pricing:', error)
    res.status(500).json({ error: 'Could not update course pricing.' })
  }
})

app.post('/api/admin/instructors', requireUser, rateLimit, async (req, res) => {
  try {
    const { data: caller } = await supabase
      .from('profiles')
      .select('role, active')
      .eq('id', req.user.id)
      .maybeSingle()
    if (!caller?.active || caller.role !== 'super_admin' || req.user.email.trim().toLowerCase() !== SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Only super administrators can create instructor accounts.' })
    }

    const parsed = instructorSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid instructor details.' })
    }
    const { firstName, lastName, email, password } = parsed.data

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}` },
      app_metadata: { role: 'instructor' },
    })
    if (error) {
      if (/already/i.test(error.message)) return res.status(409).json({ error: 'An account with this email already exists.' })
      console.error('Failed to create instructor:', error)
      return res.status(500).json({ error: 'The instructor account could not be created.' })
    }
    res.status(201).json({ id: data.user.id })
  } catch (error) {
    console.error('Error creating instructor:', error)
    res.status(500).json({ error: 'The instructor account could not be created.' })
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
  } else if (payment.payment_type === 'tuition' && payment.tuition_account_id) {
    if (payment.installment_id) {
      const next = statusFieldMap.registration === 'paid' ? 'PAID'
        : statusFieldMap.registration === 'processing' ? 'PENDING'
          : ['failed', 'canceled', 'refunded'].includes(statusFieldMap.registration) ? 'DUE' : null
      if (next) await supabase.from('cdl_tuition_installments').update({ status: next, updated_at: new Date().toISOString() }).eq('id', payment.installment_id)
    }
    await supabase.rpc('sync_tuition_account', { p_account_id: payment.tuition_account_id })
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
  } else if (payment_type === 'tuition' && session.metadata?.tuition_account_id) {
    if (session.metadata?.installment_id) await supabase.from('cdl_tuition_installments').update({ status: 'PENDING', updated_at: new Date().toISOString() }).eq('id', session.metadata.installment_id)
    await supabase.rpc('sync_tuition_account', { p_account_id: session.metadata.tuition_account_id })
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

  if (!payment || ['succeeded', 'refunded', 'canceled'].includes(payment.status)) return

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

  // Only an open attempt can expire. A replaced tuition checkout was already
  // canceled, and its installment may now belong to a newer checkout.
  if (!existing || !['pending', 'processing'].includes(existing.status)) return

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
  const receiptNumber = payment.receipt_number || `IMAN-${payment.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`
  const { data: updatedRows } = await supabase
    .from('cdl_payments')
    .update({
      status: 'succeeded',
      succeeded_at: succeededAt,
      receipt_number: receiptNumber,
      // Callers that reconcile from a Checkout Session pass the intent here.
      ...(payment.stripe_payment_intent_id ? { stripe_payment_intent_id: payment.stripe_payment_intent_id } : {}),
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
  if (finalizedPayment.tuition_account_id) await alertTuitionCredit(finalizedPayment.tuition_account_id)
}

// A payment can land after financing was funded (or vice versa) and leave the
// account overpaid. Tell admissions so the credit can be refunded.
async function alertTuitionCredit(accountId) {
  try {
    const { data: account } = await supabase.from('cdl_tuition_account_balances')
      .select('id, credit_cents, currency, student:cdl_students(first_name, last_name, email)').eq('id', accountId).maybeSingle()
    if (!account?.credit_cents || !resend) return
    const name = `${account.student?.first_name || ''} ${account.student?.last_name || ''}`.trim() || 'A student'
    const amount = `$${(account.credit_cents / 100).toFixed(2)}`
    await resend.emails.send({
      from: emailFrom,
      to: adminNotificationEmail,
      subject: `Tuition credit due - ${name}`,
      html: `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(account.student?.email || 'no email')}) has paid ${amount} more than the remaining tuition after financing.</p><p>Review the account under Admin &rarr; Tuition accounts and refund the credit in Stripe if appropriate.</p>`,
    })
  } catch (error) {
    console.error('Failed to send tuition credit alert:', error)
  }
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
  const program = payment.payment_type === 'application'
    ? md.courseName || 'CDL Training Course'
    : payment.payment_type === 'tuition' ? `${md.courseName || 'CDL Training'} tuition` : 'CDL Student Registration'
  const transactionId = payment.stripe_payment_intent_id || payment.stripe_checkout_session_id || payment.receipt_number || payment.id
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
    if (['registration', 'tuition'].includes(payment.payment_type) && payment.student_id) {
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

function tuitionEmailHtml(tuition) {
  if (!tuition) return ''
  const row = (name, value, bold = false) => `<tr><td style="padding: 4px 0;">${escapeHtml(name)}</td><td style="padding: 4px 0; text-align: right;${bold ? ' font-weight: bold;' : ''}">${escapeHtml(value)}</td></tr>`
  return `
      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
        ${tuition.lines.map(([name, value]) => row(name, value)).join('')}
        ${row('Housing selected', tuition.housing)}
        ${row('Total program cost', tuition.total, true)}
        ${row('Total paid', tuition.paid)}
        ${row('Remaining balance', tuition.remaining, true)}
        ${tuition.receiptNumber ? row('Receipt', tuition.receiptNumber) : ''}
      </table>`
}

function paymentNotificationEmailHtml(rawCtx, { forAdmin }) {
  const { tuition, ...plain } = rawCtx
  const ctx = Object.fromEntries(Object.entries(plain).map(([key, value]) => [key, value == null ? value : escapeHtml(value)]))
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
      </div>${tuitionEmailHtml(tuition)}
      <p>Best regards,<br>Iman Trucking School</p>
    </div>
  `
}

function paymentNotificationSmsText(ctx, { forAdmin }) {
  return forAdmin
    ? `Iman Trucking School: payment received from ${ctx.name} for ${ctx.program}, ${ctx.amount}. Txn ${ctx.transactionId}.`
    : `Iman Trucking School: your payment of ${ctx.amount} for ${ctx.program} was received.${ctx.tuition ? ` Remaining balance: ${ctx.tuition.remaining}.` : ''} Thank you, ${ctx.firstName || 'there'}!`
}

// Itemized program costs and the balance after this payment, for tuition
// confirmations. Null for other payment types or if the account is missing.
async function tuitionNotificationContext(payment) {
  if (payment.payment_type !== 'tuition' || !payment.tuition_account_id) return null
  const { data: account } = await supabase.from('cdl_tuition_account_balances').select('*').eq('id', payment.tuition_account_id).maybeSingle()
  if (!account) return null
  return {
    lines: tuitionLines(account).map(([name, cents]) => [name, usd(cents)]),
    housing: account.housing_selected ? 'Yes' : 'No', total: usd(account.tuition_cents), paid: usd(account.paid_cents),
    remaining: usd(account.remaining_cents), receiptNumber: payment.receipt_number || '',
  }
}

async function sendPaymentNotifications(payment) {
  const ctx = buildNotificationContext(payment)
  try {
    ctx.tuition = await tuitionNotificationContext(payment)
  } catch (error) {
    console.error('Could not load the tuition breakdown for the confirmation:', error)
  }

  const logDelivery = async (channel, audience, recipient, status, providerId = '', error = '') => {
    try {
      await supabase.from('cdl_notification_log').upsert({
        payment_id: payment.id, channel, audience, recipient: recipient || '', template: 'payment.confirmed', status,
        provider_id: providerId || '', error: String(error || '').slice(0, 1000),
      }, { onConflict: 'payment_id,channel,audience,template', ignoreDuplicates: true })
    } catch (caught) { console.error('Failed to record notification delivery:', caught) }
  }

  if (resend && payment.customer_email) {
    try {
      const delivery = await resend.emails.send({
        from: emailFrom,
        to: payment.customer_email,
        subject: `Payment Confirmed${ctx.referenceNo ? ` - ${ctx.referenceNo}` : ''}`,
        html: paymentNotificationEmailHtml(ctx, { forAdmin: false }),
      })
      await logDelivery('email', 'student', payment.customer_email, 'sent', delivery?.data?.id)
    } catch (error) {
      console.error('Failed to send student confirmation email:', error)
      await logDelivery('email', 'student', payment.customer_email, 'failed', '', error?.message)
    }
  }

  if (resend) {
    try {
      const delivery = await resend.emails.send({
        from: emailFrom,
        to: adminNotificationEmail,
        subject: `New payment received - ${ctx.program}`,
        html: paymentNotificationEmailHtml(ctx, { forAdmin: true }),
      })
      await logDelivery('email', 'admin', adminNotificationEmail, 'sent', delivery?.data?.id)
    } catch (error) {
      console.error('Failed to send admin payment notification email:', error)
      await logDelivery('email', 'admin', adminNotificationEmail, 'failed', '', error?.message)
    }
  }

  if (twilioClient) {
    const phone = await getRecipientPhone(payment)
    if (phone) {
      try {
        const delivery = await twilioClient.messages.create({
          to: phone,
          from: twilioFromNumber,
          body: paymentNotificationSmsText(ctx, { forAdmin: false }),
        })
        await logDelivery('sms', 'student', phone, 'sent', delivery.sid)
      } catch (error) {
        console.error('Failed to send student payment SMS:', error)
        await logDelivery('sms', 'student', phone, 'failed', '', error?.message)
      }
    }

    if (adminNotificationPhone) {
      try {
        const delivery = await twilioClient.messages.create({
          to: adminNotificationPhone,
          from: twilioFromNumber,
          body: paymentNotificationSmsText(ctx, { forAdmin: true }),
        })
        await logDelivery('sms', 'admin', adminNotificationPhone, 'sent', delivery.sid)
      } catch (error) {
        console.error('Failed to send admin payment SMS:', error)
        await logDelivery('sms', 'admin', adminNotificationPhone, 'failed', '', error?.message)
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
  if (!payment || payment.status === 'refunded') return

  // amount_refunded is cumulative, so replaying this event is harmless. A
  // partial refund keeps the payment succeeded but reduces what counts as
  // paid toward tuition (see cdl_tuition_account_balances).
  const refundedCents = Math.min(Number(charge.amount_refunded) || 0, payment.amount_cents)
  const now = new Date().toISOString()
  if (!charge.refunded) {
    await supabase.from('cdl_payments').update({
      refunded_cents: refundedCents,
      metadata: { ...(payment.metadata || {}), amount_refunded: charge.amount_refunded }, updated_at: now,
    }).eq('id', payment.id)
    return
  }
  await supabase.from('cdl_payments').update({ status: 'refunded', refunded_cents: payment.amount_cents, refunded_at: now, updated_at: now }).eq('id', payment.id)
  await markRelatedRecord(payment, { registration: 'refunded', application: 'refunded' })
}

// ---------------------------------------------------------------------------
// Website admissions chatbot. Visitors are anonymous, so requests are limited
// per client IP, and staff alerts (email via Resend, SMS via Twilio) are sent
// once per chat session plus on every callback request, under an hourly cap
// so a scripted client cannot flood the admissions inbox or phone.
// ---------------------------------------------------------------------------

const CHAT_RATE_LIMIT = 15
const chatRateBuckets = new Map()
const CHAT_ALERT_LIMIT_PER_HOUR = 40
let chatAlertWindow = { start: 0, count: 0 }
const alertedChatSessions = new Set()

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return forwarded || req.socket.remoteAddress || 'unknown'
}

function chatRateLimit(req, res, next) {
  const now = Date.now()
  const key = clientIp(req)
  const bucket = chatRateBuckets.get(key)
  if (!bucket || now - bucket.start >= RATE_WINDOW_MS) {
    chatRateBuckets.set(key, { start: now, count: 1 })
    if (chatRateBuckets.size > 10000) {
      for (const [k, value] of chatRateBuckets) if (now - value.start >= RATE_WINDOW_MS) chatRateBuckets.delete(k)
    }
    return next()
  }
  bucket.count += 1
  if (bucket.count > CHAT_RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many messages. Wait a minute and try again.' })
  }
  next()
}

function takeChatAlertSlot() {
  const now = Date.now()
  if (now - chatAlertWindow.start >= 60 * 60 * 1000) chatAlertWindow = { start: now, count: 0 }
  if (chatAlertWindow.count >= CHAT_ALERT_LIMIT_PER_HOUR) return false
  chatAlertWindow.count += 1
  return true
}

function chatAlertEmailHtml({ heading, intro, contact, messages }) {
  const rows = contact
    ? [['Name', contact.name], ['Phone', contact.phone], ['Email', contact.email || '—'], ['Request', contact.question || '—']]
        .map(([label, value]) => `<p style="margin: 6px 0;"><strong>${label}:</strong> ${escapeHtml(value)}</p>`).join('')
    : ''
  const transcript = messages.length
    ? messages.map(message => `
        <p style="margin: 10px 0;"><strong>${message.role === 'assistant' ? 'Assistant' : 'Visitor'}:</strong><br>
        ${escapeHtml(message.content).replace(/\n/g, '<br>')}</p>`).join('')
    : '<p>No chat messages were sent before this request.</p>'
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #08085f;">${heading}</h2>
      <p>${intro}</p>
      ${rows ? `<div style="background: #f5f7fb; padding: 16px 20px; border-radius: 8px; margin: 16px 0;">${rows}</div>` : ''}
      <h3 style="color: #08085f;">Conversation</h3>
      ${transcript}
    </div>
  `
}

// Best-effort: returns how many channels (email, SMS) accepted the alert.
async function sendChatAlert({ subject, html, text, sms }) {
  let delivered = 0
  if (resend) {
    try {
      const { error } = await resend.emails.send({ from: emailFrom, to: chatAlertEmail, subject, html, text })
      if (error) throw error
      delivered += 1
    } catch (error) {
      console.error('Failed to send chat alert email:', error)
    }
  }
  if (twilioClient && chatAlertPhone) {
    try {
      await twilioClient.messages.create({ to: chatAlertPhone, from: twilioFromNumber, body: sms })
      delivered += 1
    } catch (error) {
      console.error('Failed to send chat alert SMS:', error)
    }
  }
  return delivered
}

app.post('/api/chat', chatRateLimit, async (req, res) => {
  const body = req.body || {}
  const sessionId = cleanText(body.sessionId, 100)

  if (body.action === 'handoff') {
    const contact = cleanContact(body.contact)
    if (!contact.name || !contact.phone) return res.status(400).json({ error: 'Name and phone number are required.' })

    const messages = cleanMessages(body.messages)
    let delivered = 0

    if (process.env.GHL_WEBHOOK_URL) {
      try {
        const response = await fetch(process.env.GHL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'Iman website AI chat', sessionId, ...contact, submittedAt: new Date().toISOString() }),
        })
        if (response.ok) delivered += 1
        else console.error('GoHighLevel webhook rejected chat handoff:', response.status)
      } catch (error) {
        console.error('Failed to send chat handoff to GoHighLevel:', error)
      }
    }

    if (takeChatAlertSlot()) {
      delivered += await sendChatAlert({
        subject: `Callback request from ${contact.name} (website chat)`,
        html: chatAlertEmailHtml({
          heading: 'Callback request from the website chat',
          intro: 'A visitor asked admissions to follow up. Please contact them.',
          contact,
          messages,
        }),
        text: `Callback request from ${contact.name}, ${contact.phone}${contact.email ? `, ${contact.email}` : ''}\n\n${contact.question}\n\n${transcriptText(messages)}`,
        sms: `Iman chat: callback request from ${contact.name}, ${contact.phone}${contact.email ? `, ${contact.email}` : ''}. ${contact.question}`.slice(0, 320),
      })
    }

    if (!delivered) {
      return res.status(503).json({ error: 'Admissions could not receive the request right now.' })
    }
    return res.json({ ok: true })
  }

  if (body.action !== 'chat') return res.status(400).json({ error: 'Unknown action.' })

  const messages = cleanMessages(body.messages)
  if (!messages.length) return res.status(400).json({ error: 'Please enter a message.' })

  try {
    const result = await generateChatReply(messages, sessionId, {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL,
    })
    if (result.error) return res.status(result.status).json({ error: result.error })

    // Tell staff about each new conversation once, with the visitor's
    // question and the assistant's answer, so they can follow up.
    if (sessionId && !alertedChatSessions.has(sessionId) && takeChatAlertSlot()) {
      alertedChatSessions.add(sessionId)
      if (alertedChatSessions.size > 5000) alertedChatSessions.clear()
      const conversation = [...messages, { role: 'assistant', content: result.reply }]
      const question = messages.filter(message => message.role === 'user').at(-1)?.content || ''
      void sendChatAlert({
        subject: 'New website chat conversation',
        html: chatAlertEmailHtml({
          heading: 'New website chat conversation',
          intro: 'A visitor started a conversation with the admissions chatbot.',
          messages: conversation,
        }),
        text: transcriptText(conversation),
        sms: `Iman chat: new visitor asked "${question}"`.slice(0, 320),
      })
    }

    res.json({ reply: result.reply })
  } catch (error) {
    console.error('Chat request failed:', error)
    res.status(502).json({ error: 'The AI assistant is temporarily unavailable.' })
  }
})

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
