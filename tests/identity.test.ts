import { describe, expect, it } from 'vitest'
import { dueForRedaction, namesMatch, studentReason, verificationOutcome } from '../shared/identity.mjs'

const student = { first_name: 'Rodrigue', last_name: 'Medor' }

describe('identity verification outcome', () => {
  it('verifies a matching document and selfie', () => {
    expect(verificationOutcome({ session: { status: 'verified' }, document: { first_name: 'RODRIGUE', last_name: 'MEDOR' }, student }))
      .toEqual({ status: 'VERIFIED', failureCode: '', nameMatches: true })
  })
  it('sends a verified document with a different name to manual review', () => {
    expect(verificationOutcome({ session: { status: 'verified' }, document: { first_name: 'Jane', last_name: 'Doe' }, student }))
      .toMatchObject({ status: 'MANUAL_REVIEW', failureCode: 'name_mismatch', nameMatches: false })
  })
  it('fails a mismatched face so the student can retake it', () => {
    expect(verificationOutcome({ session: { status: 'requires_input', last_error: { code: 'selfie_face_mismatch' } }, student }))
      .toMatchObject({ status: 'FAILED', failureCode: 'selfie_face_mismatch', retryable: true })
  })
  it('fails an expired document', () => {
    expect(verificationOutcome({ session: { status: 'requires_input', last_error: { code: 'document_expired' } }, student }))
      .toMatchObject({ status: 'FAILED', failureCode: 'document_expired' })
  })
  it('sends a manipulated selfie (failed liveness) to manual review', () => {
    expect(verificationOutcome({ session: { status: 'requires_input', last_error: { code: 'selfie_manipulated' } }, student }).status).toBe('MANUAL_REVIEW')
  })
  it('treats a camera that cannot be used as a retryable failure', () => {
    expect(verificationOutcome({ session: { status: 'requires_input', last_error: { code: 'device_not_supported' } }, student }))
      .toMatchObject({ status: 'FAILED', retryable: true })
  })
  it('stays pending while the student is capturing or Stripe is processing', () => {
    expect(verificationOutcome({ session: { status: 'requires_input', last_error: null }, student }).status).toBe('PENDING')
    expect(verificationOutcome({ session: { status: 'processing' }, student }).status).toBe('PENDING')
  })
  it('fails a canceled session', () => {
    expect(verificationOutcome({ session: { status: 'canceled' }, student })).toMatchObject({ status: 'FAILED', failureCode: 'abandoned' })
  })
})

describe('name matching', () => {
  it('ignores case, accents, punctuation and extra middle names', () => {
    expect(namesMatch({ first_name: 'José', last_name: "O'Neil" }, { first_name: 'JOSE MARIA', last_name: 'O NEIL' })).toBe(true)
  })
  it('requires every word of the account name', () => {
    expect(namesMatch({ first_name: 'Ana', last_name: 'Lopez Garcia' }, { first_name: 'Ana', last_name: 'Lopez' })).toBe(false)
  })
  it('never matches empty names', () => expect(namesMatch({ first_name: '', last_name: '' }, { first_name: '', last_name: '' })).toBe(false))
})

describe('student messages', () => {
  it('explains known failures and falls back for unknown ones', () => {
    expect(studentReason('document_expired')).toMatch(/expired/)
    expect(studentReason('something_new')).toMatch(/Try again/)
  })
})

describe('biometric redaction', () => {
  const decided = (days: number) => new Date(Date.now() - days * 86400000).toISOString()
  it('redacts decided sessions after 30 days', () => {
    expect(dueForRedaction({ provider_session_id: 'vs_1', status: 'VERIFIED', decided_at: decided(31) })).toBe(true)
    expect(dueForRedaction({ provider_session_id: 'vs_1', status: 'VERIFIED', decided_at: decided(29) })).toBe(false)
  })
  it('keeps sessions under review, undecided, already redacted or without a provider session', () => {
    expect(dueForRedaction({ provider_session_id: 'vs_1', status: 'MANUAL_REVIEW', decided_at: decided(60) })).toBe(false)
    expect(dueForRedaction({ provider_session_id: 'vs_1', status: 'FAILED', decided_at: null })).toBe(false)
    expect(dueForRedaction({ provider_session_id: 'vs_1', status: 'FAILED', decided_at: decided(60), redacted_at: decided(1) })).toBe(false)
    expect(dueForRedaction({ provider_session_id: null, status: 'VERIFIED', decided_at: decided(60) })).toBe(false)
  })
})
