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
