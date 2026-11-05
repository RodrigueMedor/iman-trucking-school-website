import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { describeRequestDetails, parseWebsiteRequest, REQUEST_STATUSES, REQUEST_TYPES } from '../shared/websiteRequests.mjs'

const valid = {
  GRADUATE_VERIFICATION: { organization: 'Acme Freight', graduateName: 'Jamie Driver', trainingDates: 'Spring 2026', hasGraduateRelease: true },
  STUDENT_COMPLAINT: { complainantStatus: 'FORMER', incidentDate: 'October 2026', desiredOutcome: 'A call back' },
  CAREERS: { position: 'CDL_INSTRUCTOR', cdlClass: 'A', yearsExperience: '6' },
  ELDT_TRANSFER: { providerName: 'Another School', completedParts: 'THEORY', completionDate: '2026-09-01' },
} as const

const request = (requestType: keyof typeof valid, overrides: Record<string, unknown> = {}) => ({
  requestType, fullName: 'Pat Sample', email: 'Pat@Example.com', phone: '(407) 555-0100', message: 'Please help with this.', website: '', sourcePage: '/careers/',
  details: valid[requestType], ...overrides,
})

describe('website request validation', () => {
  it.each(REQUEST_TYPES)('accepts a complete %s request and normalizes the email', type => {
    const result = parseWebsiteRequest(request(type as keyof typeof valid))
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('pat@example.com')
  })

  it('rejects unknown types, extra fields and missing type-specific fields', () => {
    expect(parseWebsiteRequest(request('CAREERS', { requestType: 'REFUND' })).success).toBe(false)
    expect(parseWebsiteRequest({ ...request('CAREERS'), status: 'RESOLVED' }).success).toBe(false)
    const missing = parseWebsiteRequest(request('GRADUATE_VERIFICATION', { details: { organization: 'Acme' } }))
    expect(missing.success).toBe(false)
    if (!missing.success) expect(missing.error.issues.map(issue => issue.path.join('.'))).toContain('details.graduateName')
  })

  it('validates email, phone and lengths', () => {
    expect(parseWebsiteRequest(request('CAREERS', { email: 'not-an-email' })).success).toBe(false)
    expect(parseWebsiteRequest(request('CAREERS', { phone: '123' })).success).toBe(false)
    expect(parseWebsiteRequest(request('CAREERS', { phone: '' })).success).toBe(true)
    expect(parseWebsiteRequest(request('CAREERS', { message: 'x'.repeat(4001) })).success).toBe(false)
    expect(parseWebsiteRequest(request('CAREERS', { message: '   ' })).success).toBe(false)
  })

  it('flags the honeypot', () => {
    expect(parseWebsiteRequest(request('CAREERS', { website: 'http://spam' })).success).toBe(false)
  })

  it('describes details for staff without empty rows', () => {
    expect(describeRequestDetails('CAREERS', { position: 'CDL_INSTRUCTOR', cdlClass: '', yearsExperience: '' })).toEqual([['Position', 'CDL instructor']])
    expect(describeRequestDetails('GRADUATE_VERIFICATION', valid.GRADUATE_VERIFICATION)).toContainEqual(['Graduate release on file', 'Yes'])
  })

  it('matches the database check constraints', () => {
    const sql = readFileSync('supabase/migrations/202611050001_website_requests.sql', 'utf8')
    for (const value of [...REQUEST_TYPES, ...REQUEST_STATUSES]) expect(sql).toContain(`'${value}'`)
  })
})

describe('POST /api/website-requests', () => {
  for (const key of ['VITE_SUPABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'STRIPE_SECRET_KEY', 'RESEND_API_KEY', 'TWILIO_ACCOUNT_SID', 'OPENAI_API_KEY', 'GHL_WEBHOOK_URL']) process.env[key] = ''
  let server: Server
  let base = ''
  beforeAll(async () => {
    const { app } = await import('../server-express.js')
    server = app.listen(0)
    await new Promise(resolve => server.once('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(() => new Promise<void>(resolve => server.close(() => resolve())))

  const send = (body: unknown, ip: string) => fetch(`${base}/api/website-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify(body) })

  it('is public but needs the database', async () => {
    const res = await send(request('CAREERS'), '203.0.113.1')
    expect(res.status).toBe(503)
  })

  it('limits each visitor to 5 requests per 10 minutes', async () => {
    const statuses = []
    for (let i = 0; i < 7; i++) statuses.push((await send(request('CAREERS'), '203.0.113.2')).status)
    expect(statuses.slice(0, 5).every(status => status !== 429)).toBe(true)
    expect(statuses.slice(5)).toEqual([429, 429])
  })
})
