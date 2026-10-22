import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHmac, randomUUID } from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import Stripe from 'stripe'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Started by scripts/test-integration.sh; see tests/integration/seed.sql.
const REST_URL = process.env.IT_REST_URL || ''
const JWT_SECRET = process.env.IT_JWT_SECRET || ''
const WEBHOOK_SECRET = 'whsec_integration_test'
const ACCOUNT = '60000000-0000-0000-0000-000000000001'
const INSTALLMENT_1 = '70000000-0000-0000-0000-000000000001'
const INSTALLMENT_2 = '70000000-0000-0000-0000-000000000002'

// Bearer tokens the stand-in auth endpoint accepts.
const USERS: Record<string, { id: string; email: string }> = {
  'token-student': { id: '50000000-0000-0000-0000-0000000000a1', email: 'student@test.local' },
  'token-other': { id: '50000000-0000-0000-0000-0000000000b2', email: 'other@test.local' },
  'token-admin': { id: '50000000-0000-0000-0000-0000000000c3', email: 'admin@test.local' },
  'token-new': { id: '50000000-0000-0000-0000-0000000000d4', email: 'new@test.local' },
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url')
function signJwt(payload: Record<string, unknown>) {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify(payload))}`
  return `${unsigned}.${base64url(createHmac('sha256', JWT_SECRET).update(unsigned).digest())}`
}

let proxy: http.Server
let api: http.Server
let apiBase = ''
let db: SupabaseClient
const stripe = new Stripe('sk_test_integration')

beforeAll(async () => {
  if (!REST_URL || !JWT_SECRET) throw new Error('Run these tests with scripts/test-integration.sh')

  // supabase-js addresses PostgREST under /rest/v1, as hosted Supabase does.
  proxy = http.createServer(async (req, res) => {
    // Stand-in for Supabase Auth's session lookup (supabase.auth.getUser).
    if (req.url?.startsWith('/auth/v1/user')) {
      const user = USERS[(req.headers.authorization || '').replace(/^Bearer /, '')]
      res.writeHead(user ? 200 : 401, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(user ? { ...user, aud: 'authenticated', role: 'authenticated' } : { message: 'invalid token' }))
    }
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const headers = Object.fromEntries(Object.entries(req.headers)
      .filter(([key]) => !['host', 'connection', 'content-length', 'accept-encoding'].includes(key))) as Record<string, string>
    const upstream = await fetch(`${REST_URL}${(req.url || '/').replace(/^\/rest\/v1/, '')}`, {
      method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined,
    })
    const responseHeaders = Object.fromEntries([...upstream.headers].filter(([key]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(key)))
    res.writeHead(upstream.status, responseHeaders)
    res.end(Buffer.from(await upstream.arrayBuffer()))
  })
  proxy.listen(0)
  await new Promise(resolve => proxy.once('listening', resolve))
  const supabaseUrl = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`
  const serviceKey = signJwt({ role: 'service_role', iss: 'supabase', exp: Math.floor(Date.now() / 1000) + 3600 })

  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'RESEND_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'OPENAI_API_KEY', 'GHL_WEBHOOK_URL']) process.env[key] = ''
  Object.assign(process.env, {
    VITE_SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    STRIPE_SECRET_KEY: 'sk_test_integration', STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, APP_URL: 'https://imantruckingschool.com',
  })
  const { app } = await import('../../server-express.js')
  api = app.listen(0)
  await new Promise(resolve => api.once('listening', resolve))
  apiBase = `http://127.0.0.1:${(api.address() as AddressInfo).port}`
  db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
})

afterAll(async () => {
  await Promise.all([api, proxy].filter(Boolean).map(server => new Promise<void>(resolve => server.close(() => resolve()))))
})

async function deliver(type: string, object: Record<string, unknown>, eventId = `evt_${randomUUID()}`) {
  const payload = JSON.stringify({ id: eventId, object: 'event', type, data: { object }, api_version: '2024-11-20.acacia', created: Math.floor(Date.now() / 1000) })
  const res = await fetch(`${apiBase}/api/stripe-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) },
    body: payload,
  })
  return { status: res.status, body: await res.json() }
}

type Pending = { id: string; session: string; amount: number; installmentId: string | null }

async function openCheckout(kind: 'full' | 'deposit' | 'installment', amount: number, installmentId: string | null = null): Promise<Pending> {
  const id = randomUUID()
  const session = `cs_test_${id.replace(/-/g, '')}`
  const { error } = await db.from('cdl_payments').insert({
    id, amount_cents: amount, currency: 'usd', status: 'pending', payment_type: 'tuition', payment_kind: kind,
    tuition_account_id: ACCOUNT, installment_id: installmentId, stripe_checkout_session_id: session, metadata: { expected_amount: amount },
  })
  if (error) throw error
  if (installmentId) await db.from('cdl_tuition_installments').update({ status: 'PENDING' }).eq('id', installmentId)
  return { id, session, amount, installmentId }
}

const checkoutSession = (pending: Pending, overrides: Record<string, unknown> = {}) => ({
  id: pending.session, object: 'checkout.session', status: 'complete', payment_status: 'paid',
  amount_total: pending.amount, currency: 'usd', payment_intent: `pi_${pending.id.slice(0, 8)}`,
  metadata: { payment_id: pending.id, payment_type: 'tuition', tuition_account_id: ACCOUNT, installment_id: pending.installmentId || '' },
  ...overrides,
})

const balance = async () => (await db.from('cdl_tuition_account_balances').select('*').eq('id', ACCOUNT).single()).data
const payment = async (id: string) => (await db.from('cdl_payments').select('*').eq('id', id).single()).data
const installment = async (id: string) => (await db.from('cdl_tuition_installments').select('*').eq('id', id).single()).data

describe('Stripe webhook → tuition ledger', () => {
  let deposit: Pending
  let depositEventId: string

  it('rejects an unsigned event', async () => {
    const res = await fetch(`${apiBase}/api/stripe-webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=1,v1=bad' }, body: '{}' })
    expect(res.status).toBe(400)
  })

  it('marks the account PAYMENT_PENDING while a checkout is open', async () => {
    deposit = await openCheckout('deposit', 100000)
    expect((await balance()).status).toBe('PAYMENT_PENDING')
  })

  it('records a paid checkout once, with a receipt number', async () => {
    depositEventId = `evt_${randomUUID()}`
    const res = await deliver('checkout.session.completed', checkoutSession(deposit), depositEventId)
    expect(res).toEqual({ status: 200, body: { received: true } })
    const row = await payment(deposit.id)
    expect(row.status).toBe('succeeded')
    expect(row.receipt_number).toMatch(/^IMAN-[0-9A-F]{12}$/)
    expect(row.stripe_payment_intent_id).toBe(`pi_${deposit.id.slice(0, 8)}`)
    const b = await balance()
    expect([b.paid_cents, b.remaining_cents, b.status]).toEqual([100000, 400000, 'OPEN'])
    const { data: event } = await db.from('stripe_webhook_events').select('status').eq('event_id', depositEventId).single()
    expect(event?.status).toBe('processed')
  })

  it('ignores replays and duplicate events for the same payment', async () => {
    const before = await payment(deposit.id)
    expect((await deliver('checkout.session.completed', checkoutSession(deposit), depositEventId)).body).toEqual({ received: true, duplicate: true })
    expect((await deliver('checkout.session.completed', checkoutSession(deposit))).status).toBe(200)
    expect((await deliver('payment_intent.succeeded', { id: `pi_${deposit.id.slice(0, 8)}`, object: 'payment_intent', amount: 100000, currency: 'usd' })).status).toBe(200)
    const after = await payment(deposit.id)
    expect(after.succeeded_at).toBe(before.succeeded_at)
    expect((await balance()).paid_cents).toBe(100000)
  })

  it('fails a payment whose amount does not match and frees the installment', async () => {
    const pending = await openCheckout('installment', 200000, INSTALLMENT_1)
    await deliver('checkout.session.completed', checkoutSession(pending, { amount_total: 150 }))
    const row = await payment(pending.id)
    expect(row.status).toBe('failed')
    expect(row.error_message).toMatch(/mismatch/)
    expect((await installment(INSTALLMENT_1)).status).toBe('DUE')
    expect((await balance()).remaining_cents).toBe(400000)
  })

  it('does not let a replaced checkout expiring reset the newer checkout', async () => {
    // The student reopened checkout for the same installment; the server
    // canceled the first attempt before creating the second.
    const replaced = await openCheckout('installment', 200000, INSTALLMENT_1)
    await db.from('cdl_payments').update({ status: 'canceled' }).eq('id', replaced.id)
    const current = await openCheckout('installment', 200000, INSTALLMENT_1)

    await deliver('checkout.session.expired', checkoutSession(replaced, { status: 'expired', payment_status: 'unpaid' }))
    expect((await payment(current.id)).status).toBe('pending')
    expect((await installment(INSTALLMENT_1)).status).toBe('PENDING')

    await deliver('checkout.session.expired', checkoutSession(current, { status: 'expired', payment_status: 'unpaid' }))
    expect((await payment(current.id)).status).toBe('canceled')
    expect((await installment(INSTALLMENT_1)).status).toBe('DUE')
    expect((await balance()).status).toBe('OPEN')
  })

  it('applies a partial refund to the balance, then a full refund', async () => {
    const intent = `pi_${deposit.id.slice(0, 8)}`
    await deliver('charge.refunded', { id: 'ch_partial', object: 'charge', payment_intent: intent, amount_refunded: 25000, refunded: false })
    let row = await payment(deposit.id)
    expect([row.status, row.refunded_cents]).toEqual(['succeeded', 25000])
    let b = await balance()
    expect([b.paid_cents, b.refunded_cents, b.remaining_cents]).toEqual([75000, 25000, 425000])

    await deliver('charge.refunded', { id: 'ch_partial', object: 'charge', payment_intent: intent, amount_refunded: 100000, refunded: true })
    row = await payment(deposit.id)
    expect([row.status, row.refunded_cents]).toEqual(['refunded', 100000])
    b = await balance()
    expect([b.paid_cents, b.refunded_cents, b.remaining_cents]).toEqual([0, 100000, 500000])
  })
})

const call = (token: string, method: string, path: string, body?: unknown) => fetch(`${apiBase}${path}`, {
  method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
})

describe('admin tuition actions', () => {
  let checkPaymentId = ''

  it('are refused to students', async () => {
    const res = await call('token-student', 'POST', `/api/admin/tuition-accounts/${ACCOUNT}/payments`, { amountCents: 1000, method: 'cash' })
    expect(res.status).toBe(403)
  })

  it('records an offline payment with a receipt and audit trail', async () => {
    const before = await balance()
    const res = await call('token-admin', 'POST', `/api/admin/tuition-accounts/${ACCOUNT}/payments`, { amountCents: 150000, method: 'check', reference: 'Check #1042' })
    expect(res.status).toBe(201)
    const { payment: row } = await res.json()
    checkPaymentId = row.id
    expect([row.status, row.payment_method, row.recorded_by]).toEqual(['succeeded', 'check', USERS['token-admin'].id])
    expect(row.receipt_number).toMatch(/^IMAN-/)
    expect((await balance()).remaining_cents).toBe(before.remaining_cents - 150000)
  })

  it('rejects an offline payment above the remaining balance', async () => {
    const { remaining_cents } = await balance()
    const res = await call('token-admin', 'POST', `/api/admin/tuition-accounts/${ACCOUNT}/payments`, { amountCents: remaining_cents + 1, method: 'cash' })
    expect(res.status).toBe(409)
  })

  it('requires an installment payment to match the installment', async () => {
    const res = await call('token-admin', 'POST', `/api/admin/tuition-accounts/${ACCOUNT}/payments`, { amountCents: 1000, method: 'cash', installmentId: INSTALLMENT_1 })
    expect(res.status).toBe(400)
  })

  it('serves receipts only to the owner and admins', async () => {
    const path = `/api/payments/${checkPaymentId}/receipt`
    const own = await call('token-student', 'GET', path)
    expect(own.status).toBe(200)
    expect(own.headers.get('content-type')).toBe('application/pdf')
    expect((await call('token-other', 'GET', path)).status).toBe(404)
    expect((await call('token-admin', 'GET', path)).status).toBe(200)
  })

  it('voids an offline payment but never a card payment', async () => {
    const before = await balance()
    const res = await call('token-admin', 'POST', `/api/admin/tuition-payments/${checkPaymentId}/void`, { reason: 'Check bounced' })
    expect(res.status).toBe(200)
    expect((await payment(checkPaymentId)).status).toBe('canceled')
    expect((await balance()).remaining_cents).toBe(before.remaining_cents + 150000)
    expect((await call('token-admin', 'POST', `/api/admin/tuition-payments/${checkPaymentId}/void`, { reason: 'again' })).status).toBe(409)

    const { data: card } = await db.from('cdl_payments').select('id').eq('tuition_account_id', ACCOUNT).eq('payment_method', 'stripe').limit(1).single()
    expect((await call('token-admin', 'POST', `/api/admin/tuition-payments/${card!.id}/void`, { reason: 'nope' })).status).toBe(409)
  })

  it('waives a due installment once', async () => {
    const before = await balance()
    const res = await call('token-admin', 'POST', `/api/admin/tuition-installments/${INSTALLMENT_2}/waive`, { reason: 'Scholarship' })
    expect(res.status).toBe(201)
    expect((await installment(INSTALLMENT_2)).status).toBe('WAIVED')
    const after = await balance()
    expect([after.waived_cents, after.remaining_cents]).toEqual([200000, before.remaining_cents - 200000])
    expect((await call('token-admin', 'POST', `/api/admin/tuition-installments/${INSTALLMENT_2}/waive`, { reason: 'Scholarship' })).status).toBe(409)
  })

  it('serves signed agreements only to the signer and admins', async () => {
    const { data: agreement } = await db.from('cdl_payment_agreements').insert({
      user_id: USERS['token-student'].id, student_id: (await balance()).student_id, tuition_account_id: ACCOUNT,
      version: 'tuition-v1-2026-10', agreement_text: 'I agree.', signer_name: 'Tia Able', accepted_at: new Date().toISOString(),
    }).select('id').single()
    const path = `/api/agreements/${agreement!.id}/pdf`
    expect((await call('token-student', 'GET', path)).status).toBe(200)
    expect((await call('token-other', 'GET', path)).status).toBe(404)
    expect((await call('token-admin', 'GET', path)).status).toBe(200)
  })
})

describe('CDL Training pricing with optional housing', () => {
  const OTHER = USERS['token-other'].id
  let courseId = ''
  let accountId = ''
  const account = async () => (await db.from('cdl_tuition_account_balances').select('*').eq('id', accountId).single()).data

  beforeAll(async () => {
    courseId = (await db.from('cdl_courses').select('id').eq('code', 'CDL-A').single()).data!.id
  })

  it('offers the itemized price, $3,429 without and $3,929 with housing', async () => {
    const res = await call('token-other', 'GET', '/api/me/billing')
    expect(res.status).toBe(200)
    const option = (await res.json()).payable.find((item: { courseId: string }) => item.courseId === courseId)
    expect(option.pricing).toMatchObject({ totalWithoutHousingCents: 342900, totalWithHousingCents: 392900, housingFeeCents: 50000 })
    expect(option.pricing.items.map((item: { amount_cents: number }) => item.amount_cents)).toEqual([259900, 60000, 8000, 15000])
  })

  it('rejects prices sent by the browser', async () => {
    expect((await call('token-other', 'POST', '/api/me/tuition-accounts', { courseId, housingSelected: false, tuitionCents: 100 })).status).toBe(400)
  })

  it('opens the account without housing by default, with a fee snapshot', async () => {
    const res = await call('token-other', 'POST', '/api/me/tuition-accounts', { courseId })
    expect(res.status).toBe(201)
    accountId = (await res.json()).tuitionAccountId
    const row = await account()
    expect([row.tuition_cents, row.housing_selected, row.housing_fee_cents, row.fee_items.length, row.remaining_cents]).toEqual([342900, false, 50000, 4, 342900])
  })

  it('adds and removes housing, recalculated on the server', async () => {
    const path = `/api/me/tuition-accounts/${accountId}/housing`
    expect((await call('token-other', 'PATCH', path, { housingSelected: true, tuitionCents: 1 })).status).toBe(400)
    const added = await call('token-other', 'PATCH', path, { housingSelected: true })
    expect(added.status).toBe(200)
    expect((await added.json()).account).toMatchObject({ tuition_cents: 392900, housing_selected: true })
    expect((await call('token-other', 'PATCH', path, { housingSelected: false })).status).toBe(200)
    expect((await account()).tuition_cents).toBe(342900)
  })

  it('keeps the choice when the student returns to the checkout', async () => {
    await call('token-other', 'PATCH', `/api/me/tuition-accounts/${accountId}/housing`, { housingSelected: true })
    const billing = await (await call('token-other', 'GET', '/api/me/billing')).json()
    expect(billing.accounts[0]).toMatchObject({ id: accountId, housing_selected: true, remaining_cents: 392900 })
    // Reopening for the same course applies the choice sent with it.
    const reopened = await call('token-other', 'POST', '/api/me/tuition-accounts', { courseId, housingSelected: false })
    expect((await reopened.json()).tuitionAccountId).toBe(accountId)
    expect((await account()).tuition_cents).toBe(342900)
  })

  it("refuses another student's account", async () => {
    expect((await call('token-student', 'PATCH', `/api/me/tuition-accounts/${accountId}/housing`, { housingSelected: true })).status).toBe(404)
    expect((await account()).housing_selected).toBe(false)
  })

  it('cancels an unpaid checkout priced for the old choice', async () => {
    const { data: pending } = await db.from('cdl_payments').insert({
      amount_cents: 342900, currency: 'usd', status: 'pending', payment_type: 'tuition', payment_kind: 'full', tuition_account_id: accountId, metadata: { expected_amount: 342900 },
    }).select('id').single()
    expect((await call('token-other', 'PATCH', `/api/me/tuition-accounts/${accountId}/housing`, { housingSelected: true })).status).toBe(200)
    expect((await payment(pending!.id)).status).toBe('canceled')
    expect((await account()).tuition_cents).toBe(392900)
  })

  it('leaves existing accounts and their price untouched when the price changes', async () => {
    const { data: before } = await db.from('cdl_courses').select('pricing_version').eq('id', courseId).single()
    await db.from('cdl_courses').update({ training_cents: 279900 }).eq('id', courseId)
    const { data: course } = await db.from('cdl_courses').select('tuition_cents, pricing_version').eq('id', courseId).single()
    expect(course).toEqual({ tuition_cents: 362900, pricing_version: before!.pricing_version + 1 })
    const { data: history } = await db.from('cdl_course_pricing_versions').select('version, tuition_cents').eq('course_id', courseId).order('version')
    expect(history!.at(-1)).toEqual({ version: before!.pricing_version + 1, tuition_cents: 362900 })
    const row = await account()
    expect([row.tuition_cents, row.fee_items[0].amount_cents]).toEqual([392900, 259900])
    await db.from('cdl_courses').update({ training_cents: 259900 }).eq('id', courseId)
  })

  it('lets only the super administrator change course prices', async () => {
    const res = await call('token-admin', 'PATCH', `/api/admin/courses/${courseId}/pricing`, { trainingCents: 1, testingFeeCents: 0, administrativeFeeCents: 0, materialsFeeCents: 0, housingFeeCents: 0, depositCents: 0, installmentCount: 1 })
    expect(res.status).toBe(403)
  })

  it('does not mark the account paid when the payment fails', async () => {
    const { data: pending } = await db.from('cdl_payments').insert({
      amount_cents: 392900, currency: 'usd', status: 'pending', payment_type: 'tuition', payment_kind: 'full', tuition_account_id: accountId,
      stripe_checkout_session_id: `cs_test_failed_${accountId.slice(0, 8)}`, metadata: { expected_amount: 392900 },
    }).select('id').single()
    await deliver('checkout.session.async_payment_failed', { id: `cs_test_failed_${accountId.slice(0, 8)}`, object: 'checkout.session', status: 'complete', payment_status: 'unpaid', amount_total: 392900, currency: 'usd', metadata: { payment_id: pending!.id, payment_type: 'tuition', tuition_account_id: accountId } })
    expect((await payment(pending!.id)).status).toBe('failed')
    const row = await account()
    expect([row.paid_cents, row.remaining_cents, row.status]).toEqual([0, 392900, 'OPEN'])
  })

  it('records the full payment with housing and then locks the housing choice', async () => {
    const id = randomUUID()
    const session = `cs_test_${id.replace(/-/g, '')}`
    await db.from('cdl_payments').insert({
      id, amount_cents: 392900, currency: 'usd', status: 'pending', payment_type: 'tuition', payment_kind: 'full', tuition_account_id: accountId,
      stripe_checkout_session_id: session, metadata: { expected_amount: 392900 },
    })
    await deliver('checkout.session.completed', { id: session, object: 'checkout.session', status: 'complete', payment_status: 'paid', amount_total: 392900, currency: 'usd', payment_intent: `pi_${id.slice(0, 8)}`, metadata: { payment_id: id, payment_type: 'tuition', tuition_account_id: accountId } })
    const row = await account()
    expect([row.paid_cents, row.remaining_cents, row.status]).toEqual([392900, 0, 'PAID'])
    const locked = await call('token-other', 'PATCH', `/api/me/tuition-accounts/${accountId}/housing`, { housingSelected: false })
    expect(locked.status).toBe(409)
    expect((await account()).tuition_cents).toBe(392900)
    const receipt = await call('token-other', 'GET', `/api/payments/${id}/receipt`)
    expect([receipt.status, receipt.headers.get('content-type')]).toEqual([200, 'application/pdf'])
  })
})

describe('identity verification', () => {
  const NEW = USERS['token-new'].id
  let studentId = ''
  let courseId = ''
  const latest = async () => (await db.from('cdl_identity_verifications').select('*').eq('user_id', NEW).order('created_at', { ascending: false }).limit(1).single()).data
  const pending = async (sessionId: string, documentType = 'DRIVING_LICENSE') => {
    const { data, error } = await db.from('cdl_identity_verifications').insert({
      user_id: NEW, student_id: studentId, document_type: documentType, provider_session_id: sessionId, provider_status: 'requires_input',
      consent_version: 'identity-v1-2026-10', consent_at: new Date().toISOString(),
    }).select().single()
    if (error) throw error
    return data
  }
  const session = (id: string, status: string, extra: Record<string, unknown> = {}) => ({ id, object: 'identity.verification_session', status, last_error: null, ...extra })

  beforeAll(async () => {
    studentId = (await db.from('cdl_students').select('id').eq('user_id', NEW).single()).data!.id
    courseId = (await db.from('cdl_courses').select('id').eq('code', 'CDL-B').single()).data!.id
  })

  it('starts unverified without blocking payments', async () => {
    expect(await (await call('token-new', 'GET', '/api/me/identity')).json()).toMatchObject({ status: 'NOT_STARTED', canStart: true })
    // Identity gates application submission (database trigger), not payments.
    expect((await call('token-new', 'POST', '/api/me/tuition-accounts', { courseId })).status).toBe(201)
  })

  it('requires consent before starting', async () => {
    expect((await call('token-new', 'POST', '/api/me/identity/sessions', { documentType: 'GREEN_CARD' })).status).toBe(400)
    expect((await call('token-new', 'POST', '/api/me/identity/sessions', { documentType: 'PASSPORT', biometricConsent: true, consentVersion: 'identity-v2-2026-10' })).status).toBe(400)
  })

  it('records a mismatched face as failed, once, and lets the student retake', async () => {
    await pending('vs_test_face')
    const eventId = `evt_${randomUUID()}`
    const failed = session('vs_test_face', 'requires_input', { last_error: { code: 'selfie_face_mismatch', reason: 'mismatch' } })
    expect((await deliver('identity.verification_session.requires_input', failed, eventId)).status).toBe(200)
    const row = await latest()
    expect([row.status, row.failure_code]).toEqual(['FAILED', 'selfie_face_mismatch'])
    expect(row.failure_reason).toMatch(/did not match/)
    expect((await deliver('identity.verification_session.requires_input', failed, eventId)).body).toEqual({ received: true, duplicate: true })
    const { count } = await db.from('cdl_identity_events').select('id', { count: 'exact', head: true }).eq('verification_id', row.id)
    expect(count).toBe(2) // started, failed
    expect(await (await call('token-new', 'GET', '/api/me/identity')).json()).toMatchObject({ status: 'FAILED', canStart: true })
  })

  it('sends a manipulated selfie (failed liveness) to manual review and stops new attempts', async () => {
    await pending('vs_test_spoof', 'GREEN_CARD')
    await deliver('identity.verification_session.requires_input', session('vs_test_spoof', 'requires_input', { last_error: { code: 'selfie_manipulated' } }))
    expect((await latest()).status).toBe('MANUAL_REVIEW')
    const res = await call('token-new', 'POST', '/api/me/identity/sessions', { documentType: 'GREEN_CARD', biometricConsent: true, consentVersion: 'identity-v2-2026-10' })
    expect(res.status).toBe(409)
  })

  it('lets only admins review, and records the decision', async () => {
    const row = await latest()
    const path = `/api/admin/identity-verifications/${row.id}/decision`
    expect((await call('token-new', 'POST', path, { action: 'APPROVE', reason: 'self approval' })).status).toBe(403)
    expect((await call('token-new', 'GET', '/api/admin/identity-verifications')).status).toBe(403)
    expect((await call('token-admin', 'POST', path, { action: 'REQUEST_RESUBMISSION', reason: 'Glare on the card' })).status).toBe(200)
    const after = await latest()
    expect([after.status, after.failure_code, after.decided_by]).toEqual(['FAILED', 'resubmission_requested', USERS['token-admin'].id])
    expect(after.failure_reason).toMatch(/Glare on the card/)
  })

  it('shows stored ID images only to the super administrator', async () => {
    const row = await latest()
    for (const token of ['token-admin', 'token-new']) {
      expect((await call(token, 'GET', `/api/admin/identity-verifications/${row.id}/evidence`)).status).toBe(403)
      expect((await call(token, 'GET', `/api/admin/identity-verifications/${row.id}/evidence/selfie`)).status).toBe(403)
    }
  })

  it('never lets a late provider result overwrite a staff decision', async () => {
    const before = await latest()
    await deliver('identity.verification_session.verified', session('vs_test_spoof', 'verified', { last_verification_report: { document: { first_name: 'Nia', last_name: 'Newman', type: 'id_card' } } }))
    expect((await latest()).status).toBe(before.status)
  })

  it('offers in-person verification without biometrics, approved by an admin', async () => {
    const res = await call('token-new', 'POST', '/api/me/identity/alternative', { documentType: 'GREEN_CARD', reason: 'No camera' })
    expect(res.status).toBe(201)
    const row = await latest()
    expect([row.method, row.status, row.provider_session_id]).toEqual(['ALTERNATIVE', 'MANUAL_REVIEW', null])
    expect((await call('token-admin', 'POST', `/api/admin/identity-verifications/${row.id}/decision`, { action: 'APPROVE', reason: 'Checked Green Card at the front desk' })).status).toBe(200)
    expect((await latest()).status).toBe('VERIFIED')
    const events = (await (await call('token-admin', 'GET', `/api/admin/identity-verifications/${row.id}/events`)).json()).events
    expect(events.map((event: { action: string }) => event.action)).toEqual(['ALTERNATIVE_REQUESTED', 'APPROVED'])
    expect(events[1].detail).toMatch(/front desk/)
  })

  it('sends a provider-verified document with another name to manual review', async () => {
    // A different student whose document shows someone else's name.
    const { data: other } = await db.from('cdl_students').select('id').eq('user_id', USERS['token-student'].id).single()
    const { data: row } = await db.from('cdl_identity_verifications').insert({
      user_id: USERS['token-student'].id, student_id: other!.id, document_type: 'DRIVING_LICENSE', provider_session_id: 'vs_test_name',
      consent_version: 'identity-v1-2026-10', consent_at: new Date().toISOString(),
    }).select().single()
    await deliver('identity.verification_session.verified', session('vs_test_name', 'verified', { last_verification_report: { document: { first_name: 'Someone', last_name: 'Else', type: 'driving_license', issuing_country: 'US', expiration_date: { day: 1, month: 2, year: 2030 } } } }))
    const { data: after } = await db.from('cdl_identity_verifications').select('*').eq('id', row!.id).single()
    expect([after!.status, after!.failure_code, after!.name_matches, after!.document_expires_on]).toEqual(['MANUAL_REVIEW', 'name_mismatch', false, '2030-02-01'])
  })
})
