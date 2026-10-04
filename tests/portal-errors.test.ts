import { describe, expect, it } from 'vitest'
import { ApiError, isEmailRateLimited, toMessage } from '../src/portal/errors'

describe('toMessage', () => {
  it('explains a missing license document', () => {
    expect(toMessage({ code: 'P0001', message: 'missing_document' })).toMatch(/driver's license or CLP/i)
  })
  it('explains a missing assessment test', () => {
    expect(toMessage({ code: 'P0001', message: 'missing_assessment_test' })).toMatch(/online English test/i)
  })
  it('names the field for invalid_field errors', () => {
    expect(toMessage({ code: 'P0001', message: 'invalid_field:date_of_birth' })).toMatch(/date of birth/i)
    expect(toMessage({ code: 'P0001', message: 'invalid_field:session_id' })).toMatch(/start session/i)
  })
  it('explains an invalid status transition', () => {
    expect(toMessage({ code: 'P0001', message: 'invalid_transition' })).toMatch(/latest status/i)
  })
  it('maps check-constraint violations to a format message', () => {
    expect(toMessage({ code: '23514', message: 'new row violates check constraint "cdl_students_zip_check"' })).toMatch(/format/i)
  })
  it('maps a duplicate draft to a continue-draft message', () => {
    expect(toMessage({ code: '23505', message: 'duplicate key value violates unique constraint "uq_one_draft_per_type"' })).toMatch(/already have a draft/i)
  })
  it('maps permission errors', () => {
    expect(toMessage({ code: '42501', message: 'new row violates row-level security policy' })).toMatch(/permission/i)
    expect(toMessage({ code: '42501', message: 'protected_field' })).toMatch(/permission/i)
  })
  it('maps network failures', () => {
    expect(toMessage(new TypeError('Failed to fetch'))).toMatch(/connection/i)
  })
  it('maps expired sessions', () => {
    expect(toMessage({ code: 'PGRST301', message: 'JWT expired' })).toMatch(/sign in again/i)
  })
  it('passes through API error messages written for students', () => {
    expect(toMessage(new ApiError('Submit your application before paying the application fee.', 409)))
      .toBe('Submit your application before paying the application fee.')
  })
  it('never leaks raw database text for unknown errors', () => {
    const message = toMessage({ code: 'XX000', message: 'relation "x" does not exist' })
    expect(message).not.toMatch(/relation/)
    expect(message).toMatch(/try again/i)
  })
})

describe('isEmailRateLimited', () => {
  it('detects the Supabase email rate-limit error', () => {
    expect(isEmailRateLimited({ code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' })).toBe(true)
    expect(isEmailRateLimited({ status: 429, message: 'email rate limit exceeded' })).toBe(true)
  })
  it('ignores other auth errors', () => {
    expect(isEmailRateLimited({ status: 429, message: 'Request rate limit reached' })).toBe(false)
    expect(isEmailRateLimited({ status: 400, message: 'Invalid login credentials' })).toBe(false)
    expect(isEmailRateLimited(null)).toBe(false)
  })
})
