import express from 'express'
import cors from 'cors'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { pathToFileURL } from 'node:url'

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

// The API server uses the service-role key for payments so it can write the
// payment records on behalf of unauthenticated applicants. The service-role
// key (and STRIPE_SECRET_KEY) must stay server-only and never be prefixed
// with VITE_ or shipped to the browser.
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

// Best-effort confirmation email sender for dispatcher registrations.
// Used only if RESEND_API_KEY is configured on the server.
let resend = null
if (process.env.RESEND_API_KEY) {
  try {
    resend = new Resend(process.env.RESEND_API_KEY)
  } catch (error) {
    console.error('Failed to initialize Resend:', error)
  }
}
const dispatcherEmailFrom =
  process.env.DISPATCHER_EMAIL_FROM ||
  process.env.RESULT_EMAIL_FROM ||
  'Iman Trucking School <info@imanlogistics.com>'

const missingServiceError = 'Payments are not configured on the server. Set STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL.'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAYMENT_POLICY_VERSION = 'v2-case-by-case-refunds'
const DISPATCHER_PAYMENT_POLICY_VERSION = 'v2-dispatcher-nonrefundable-credit-schoolcancel'
const DISPATCHER_PAYMENT_POLICY_TEXT =
  'All registration payments are non-refundable. If the student cannot attend the class, the payment remains as a credit on their student account and can be used for a future dispatcher class. If Iman Trucking School cancels or reschedules this class session, the student may choose a full refund or a credit toward a future dispatcher class.'

function normalizePersonName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
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

function dispatcherPolicyError(body, firstName, lastName) {
  if (body?.paymentPolicyAccepted !== true) {
    return 'You must accept the Dispatcher Class non-refundable registration policy before checkout.'
  }
  const expected = normalizePersonName(`${firstName || ''} ${lastName || ''}`)
  const signature = normalizePersonName(body?.paymentPolicySignature)
  if (body?.paymentPolicySignature && signature && signature !== expected) {
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

function dispatcherPolicyRecord(body, firstName, lastName) {
  const sig = body?.paymentPolicySignature
    ? String(body.paymentPolicySignature).trim()
    : `${firstName || ''} ${lastName || ''}`.trim()
  return {
    payment_policy_version: DISPATCHER_PAYMENT_POLICY_VERSION,
    payment_policy_signature: sig,
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

function dispatcherStripePolicyCustomText() {
  return {
    submit: {
      message:
        'All registration payments are non-refundable. If the student cannot attend the class, the payment remains as a credit on their student account and can be used for a future dispatcher class.',
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

function makeDispatcherRegistrationNo() {
  const stamp = Date.now().toString(36).toUpperCase()
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `DSP-${new Date().getFullYear()}-${stamp}${suffix}`
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
// Middleware. The Stripe webhook must receive the *raw* request body so the
// signature can be verified, so its raw parser is registered before the global
// JSON parser. Other routes parse JSON normally.
// ---------------------------------------------------------------------------

const app = express()

app.use(cors())

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
          await markRelatedRecord(payment, { registration: 'canceled', application: 'canceled', dispatcher: 'canceled' })
          payment.status = 'canceled'
        }
      } catch (err) {
        console.warn('Could not reconcile Stripe session during status check:', err?.message)
      }
    }

    let registrationDetails = null
    if (payment.payment_type === 'dispatcher' && payment.dispatcher_registration_id) {
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
    }

    res.json({
      status: payment.status,
      payment_type: payment.payment_type,
      amount_cents: payment.amount_cents,
      currency: payment.currency,
      registration: registrationDetails,
    })
  } catch (error) {
    console.error('Error fetching payment status:', error)
    res.status(500).json({ error: 'Failed to fetch payment status' })
  }
})

// Create Stripe Checkout Session for Registration Payment
app.post('/api/create-registration-checkout', async (req, res) => {
  try {
    const unavailable = requireClients(res)
    if (unavailable) return res.status(503).json(unavailable)

    const { studentId, email, firstName, lastName } = req.body

    if (!studentId || !email) {
      return res.status(400).json({ error: 'Missing required fields: studentId, email' })
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' })
    }

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

    // Verify the underlying student exists
    const { data: studentRow } = await supabase
      .from('cdl_students')
      .select('id, user_id, first_name, last_name')
      .eq('id', studentId)
      .maybeSingle()

    if (!studentRow) {
      return res.status(404).json({ error: 'Student not found' })
    }

    const policyError = paymentPolicyError(
      req.body,
      studentRow.first_name || firstName,
      studentRow.last_name || lastName
    )
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
          firstName: firstName || studentRow.first_name || '',
          lastName: lastName || studentRow.last_name || '',
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
      success_url: checkoutReturnUrl(req, '/cdl-readiness', 'success'),
      cancel_url: checkoutReturnUrl(req, '/cdl-readiness', 'canceled'),
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

// Create Stripe Checkout Session for Application Payment
app.post('/api/create-application-checkout', async (req, res) => {
  try {
    const unavailable = requireClients(res)
    if (unavailable) return res.status(503).json(unavailable)

    const { applicationId, email, firstName, lastName, courseId } = req.body

    if (!applicationId || !email || !courseId) {
      return res.status(400).json({ error: 'Missing required fields: applicationId, email, courseId' })
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' })
    }

    // Verify the application exists and belongs to this email
    const { data: applicationRow } = await supabase
      .from('cdl_class_applications')
      .select('id, course_id, email, first_name, last_name')
      .eq('id', applicationId)
      .maybeSingle()

    if (!applicationRow) {
      return res.status(404).json({ error: 'Application not found' })
    }
    if (!applicationRow.email || applicationRow.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({ error: 'Email does not match the application' })
    }

    // The fee must come from the course stored on the application, never from
    // the client-supplied courseId, so the amount cannot be tampered with.
    // Reject when a courseId is supplied but conflicts with the application.
    if (courseId && courseId !== applicationRow.course_id) {
      return res.status(409).json({ error: 'Course does not match the application' })
    }
    const feeCourseId = applicationRow.course_id || courseId

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

    const policyError = paymentPolicyError(
      req.body,
      applicationRow.first_name || firstName,
      applicationRow.last_name || lastName
    )
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

    // Fee comes from the course the applicant chose
    const { data: course } = await supabase
      .from('cdl_courses')
      .select('application_fee_cents, name')
      .eq('id', feeCourseId)
      .maybeSingle()

    const applicationFeeCents = Number(course?.application_fee_cents) > 0
      ? Number(course.application_fee_cents)
      : 2500
    const courseName = course?.name || 'CDL Training Course'

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
          firstName: firstName || applicationRow.first_name || '',
          lastName: lastName || applicationRow.last_name || '',
          applicationId,
          courseId: feeCourseId,
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

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Application Fee - ${courseName}`,
              description: 'Application fee for Iman Trucking School',
            },
            unit_amount: applicationFeeCents,
          },
          quantity: 1,
        },
      ],
      customer_email: email,
      mode: 'payment',
      custom_text: stripePolicyCustomText(),
      success_url: checkoutReturnUrl(req, '/class-application', 'success'),
      cancel_url: checkoutReturnUrl(req, '/class-application', 'canceled'),
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
// Create a dispatcher registration server-side. Anonymous browser inserts
// cannot safely SELECT the inserted row under RLS, so the payment flow must use
// the service-role API and return the canonical database id.
// ---------------------------------------------------------------------------
app.post('/api/create-dispatcher-registration', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: missingServiceError })

    const { firstName, lastName, email, phone, address1, address2, city, state, zip, classId } = req.body
    if (!firstName || !lastName || !email || !address1 || !city || !state || !zip || !classId) {
      return res.status(400).json({ error: 'Complete every required registration field.' })
    }
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' })

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId)

    let dispatcherClass = null
    if (isUuid) {
      const { data: foundClass, error: classError } = await supabase
        .from('cdl_dispatcher_classes')
        .select('id, name, price_cents')
        .eq('id', classId)
        .eq('open', true)
        .maybeSingle()

      if (!classError && foundClass) {
        dispatcherClass = foundClass
      }
    }

    // Fallback: If not a valid UUID (e.g. demo-dispatcher-class-1) or not found, resolve to the current active open dispatcher class
    if (!dispatcherClass) {
      const { data: fallbackClass, error: fallbackError } = await supabase
        .from('cdl_dispatcher_classes')
        .select('id, name, price_cents')
        .eq('open', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (fallbackError) throw fallbackError
      dispatcherClass = fallbackClass
    }

    if (!dispatcherClass) {
      return res.status(404).json({ error: 'The selected dispatcher class is not available.' })
    }

    const resolvedClassId = dispatcherClass.id

    const { data, error } = await supabase
      .from('cdl_dispatcher_registrations')
      .insert({
        registration_no: makeDispatcherRegistrationNo(),
        first_name: String(firstName).trim(),
        last_name: String(lastName).trim(),
        email: String(email).trim().toLowerCase(),
        phone: phone ? String(phone).trim() : null,
        address_line1: String(address1).trim(),
        address_line2: address2 ? String(address2).trim() : null,
        city: String(city).trim(),
        state: String(state).trim(),
        zip_code: String(zip).trim(),
        class_id: resolvedClassId,
        status: 'SUBMITTED',
        payment_status: 'pending',
      })
      .select('id, registration_no, class_id')
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    console.error('Error creating dispatcher registration:', error)
    res.status(500).json({ error: 'Unable to save registration. Please try again.' })
  }
})

// Create Stripe Checkout Session for Dispatcher Class Registration
app.post('/api/create-dispatcher-checkout', async (req, res) => {
  try {
    const unavailable = requireClients(res)
    if (unavailable) return res.status(503).json(unavailable)

    const { registrationId, email, firstName, lastName, classId } = req.body

    if (!registrationId || !email || !classId) {
      return res.status(400).json({ error: 'Missing required fields: registrationId, email, classId' })
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' })
    }
    // Verify the registration exists and belongs to this email
    const { data: registrationRow } = await supabase
      .from('cdl_dispatcher_registrations')
      .select('id, class_id, email, registration_no, first_name, last_name, payment_status')
      .eq('id', registrationId)
      .maybeSingle()

    if (!registrationRow) {
      return res.status(404).json({ error: 'Registration not found' })
    }
    if (!registrationRow.email || registrationRow.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({ error: 'Email does not match the registration' })
    }

    if (registrationRow.payment_status === 'paid') {
      return res.status(400).json({ error: 'This registration has already been paid and confirmed.' })
    }

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
      req.body,
      registrationRow.first_name || firstName,
      registrationRow.last_name || lastName
    )
    if (policyError) {
      return res.status(400).json({ error: policyError })
    }

    const policy = dispatcherPolicyRecord(
      req.body,
      registrationRow.first_name || firstName,
      registrationRow.last_name || lastName
    )
    const feeClassId = registrationRow.class_id || classId

    // Check if the registration already has a successful payment
    const { data: existingPayment } = await supabase
      .from('cdl_payments')
      .select('id')
      .eq('dispatcher_registration_id', registrationId)
      .eq('payment_type', 'dispatcher')
      .eq('status', 'succeeded')
      .maybeSingle()

    if (existingPayment) {
      return res.status(400).json({ error: 'Registration already has a successful payment' })
    }

    // Check for pending/processing payments to prevent duplicates without locking out user
    const { data: pendingPayment, error: pendingError } = await supabase
      .from('cdl_payments')
      .select('id, status, created_at, stripe_checkout_session_id')
      .eq('dispatcher_registration_id', registrationId)
      .eq('payment_type', 'dispatcher')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!pendingError && pendingPayment) {
      // If previous Stripe session is still open, expire it so user cannot be double-charged
      if (stripe && pendingPayment.stripe_checkout_session_id) {
        try {
          await stripe.checkout.sessions.expire(pendingPayment.stripe_checkout_session_id)
        } catch (e) {
          // Ignore if already completed/expired
        }
      }
      // Cancel stale pending payment record so a fresh session can be created
      await supabase
        .from('cdl_payments')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', pendingPayment.id)
    }

    // Fee comes from the dispatcher class the registrant chose
    let dispatcherClass = null
    const isFeeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(feeClassId)
    if (isFeeUuid) {
      const { data } = await supabase
        .from('cdl_dispatcher_classes')
        .select('price_cents, name')
        .eq('id', feeClassId)
        .maybeSingle()
      dispatcherClass = data
    }

    // Dispatcher tuition is fixed by current school policy ($520.00). Do not trust a
    // stale client value or a database row that has not received the migration.
    const dispatcherFeeCents = 52000
    const className = dispatcherClass?.name || 'Dispatcher Training'

    // Validate payment amount
    if (!Number.isInteger(dispatcherFeeCents) || dispatcherFeeCents < 0 || dispatcherFeeCents > 1000000) {
      return res.status(400).json({ error: 'Invalid payment amount' })
    }

    // Create pending payment record
    const { data: payment, error: paymentError } = await supabase
      .from('cdl_payments')
      .insert({
        dispatcher_registration_id: registrationId,
        amount_cents: dispatcherFeeCents,
        currency: 'usd',
        status: 'pending',
        payment_type: 'dispatcher',
        customer_email: email,
        metadata: {
          firstName: firstName || registrationRow.first_name || '',
          lastName: lastName || registrationRow.last_name || '',
          registrationId,
          registration_no: registrationRow.registration_no,
          classId: feeClassId,
          className,
          expected_amount: dispatcherFeeCents,
          policy_text: DISPATCHER_PAYMENT_POLICY_TEXT,
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
      client_reference_id: registrationRow.registration_no,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Dispatcher Class Registration - ${className}`,
              description: `Registration ${registrationRow.registration_no} for Dispatcher Class at Iman Trucking School`,
            },
            unit_amount: dispatcherFeeCents,
          },
          quantity: 1,
        },
      ],
      customer_email: email,
      mode: 'payment',
      custom_text: dispatcherStripePolicyCustomText(),
      success_url: checkoutReturnUrl(req, '/dispatcher-registration', 'success'),
      cancel_url: checkoutReturnUrl(req, '/dispatcher-registration', 'canceled'),
      metadata: {
        payment_id: payment.id,
        dispatcher_registration_id: registrationId,
        registration_no: registrationRow.registration_no,
        payment_type: 'dispatcher',
        expected_amount: dispatcherFeeCents.toString(),
        app_email: email,
        payment_policy_version: DISPATCHER_PAYMENT_POLICY_VERSION,
      },
    })

    // Immediately link payment_id and pending status to the registration row
    await supabase
      .from('cdl_dispatcher_registrations')
      .update({
        ...policy,
        payment_id: payment.id,
        payment_status: 'pending',
        refund_policy_accepted_at: policy.payment_policy_accepted_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)

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
    console.error('Error creating dispatcher checkout session:', error)
    res.status(500).json({ error: 'Failed to create checkout session' })
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
  } else if (payment.payment_type === 'dispatcher' && payment.dispatcher_registration_id) {
    const update = {
      payment_status: statusFieldMap.dispatcher,
      payment_id: payment.id,
      updated_at: new Date().toISOString(),
    }
    if (statusFieldMap.dispatcher === 'paid') {
      update.status = 'CONFIRMED'
    }
    await supabase
      .from('cdl_dispatcher_registrations')
      .update(update)
      .eq('id', payment.dispatcher_registration_id)
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
  } else if (payment_type === 'dispatcher' && session.metadata?.dispatcher_registration_id) {
    await supabase
      .from('cdl_dispatcher_registrations')
      .update({ payment_status: 'processing', payment_id, updated_at: new Date().toISOString() })
      .eq('id', session.metadata.dispatcher_registration_id)
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

  await markRelatedRecord(payment, { registration: 'failed', application: 'failed', dispatcher: 'failed' })
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

  await markRelatedRecord(existing, { registration: 'canceled', application: 'canceled', dispatcher: 'canceled' })
}

async function handlePaymentIntentSucceeded(paymentIntent) {
  const payment = await findPaymentByIntent(stripe, paymentIntent)
  if (!payment) return

  if (payment.status === 'succeeded' || payment.status === 'refunded') return

  await finalizeSuccessfulPayment(payment, paymentIntent.amount, paymentIntent.currency)
}

async function finalizeSuccessfulPayment(payment, paidAmount, paidCurrency) {
  if (!payment || payment.status === 'succeeded' || payment.status === 'refunded') return

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
    await markRelatedRecord(payment, { registration: 'failed', application: 'failed', dispatcher: 'failed' })
    return
  }

  await supabase
    .from('cdl_payments')
    .update({
      status: 'succeeded',
      succeeded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.id)

  await markRelatedRecord(payment, { registration: 'paid', application: 'paid', dispatcher: 'paid' })

  // Send a confirmation email for successful dispatcher registrations
  if (payment.payment_type === 'dispatcher') {
    await sendDispatcherConfirmation(payment)
  }
}

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

  await markRelatedRecord(payment, { registration: 'failed', application: 'failed', dispatcher: 'failed' })
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

  await markRelatedRecord(payment, { registration: 'refunded', application: 'refunded', dispatcher: 'refunded' })
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
