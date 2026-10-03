import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'

// Blank every credential before the server module loads. dotenv never
// overrides variables that already exist, so the real .env is ignored and the
// API runs with no Supabase/Stripe/Resend clients.
for (const key of [
  'VITE_SUPABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER',
]) process.env[key] = ''
process.env.APP_URL = 'https://imantruckingschool.com'

let server: Server
let base = ''

beforeAll(async () => {
  const { app } = await import('../server-express.js')
  server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())))

const post = (path: string, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{}' })

const authed = [
  '/api/create-application-checkout',
  '/api/create-registration-checkout',
  '/api/elp-submissions',
  '/api/applications/00000000-0000-0000-0000-000000000001/notify',
  '/api/admin/instructors',
]

describe('student API authorization', () => {
  it.each(authed)('%s requires a bearer token', async path => {
    const res = await post(path)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Sign in required.' })
  })

  it.each(authed)('%s returns 503 when the database is not configured', async path => {
    const res = await post(path, { Authorization: 'Bearer x' })
    expect(res.status).toBe(503)
  })

  it('rejects a malformed Authorization header', async () => {
    const res = await post('/api/elp-submissions', { Authorization: 'Basic abc' })
    expect(res.status).toBe(401)
  })
})

describe('CORS', () => {
  it('does not allow an unknown origin', async () => {
    const res = await fetch(`${base}/api/elp-submissions`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('allows the configured site origin and its www variant', async () => {
    for (const origin of ['https://imantruckingschool.com', 'https://www.imantruckingschool.com']) {
      const res = await fetch(`${base}/api/elp-submissions`, {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
      })
      expect(res.headers.get('access-control-allow-origin')).toBe(origin)
    }
  })
})

describe('dispatcher removal', () => {
  it.each(['/api/create-dispatcher-checkout', '/api/create-dispatcher-registration'])('%s is gone', async path => {
    expect((await post(path)).status).toBe(404)
  })
})

describe('health', () => {
  it('still responds', async () => {
    const res = await fetch(`${base}/api/health`)
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('ok')
  })
})
