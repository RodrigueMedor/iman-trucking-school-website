// Identity verification rules shared by the API server and its tests.

export const IDENTITY_CONSENT_VERSION = 'identity-v1-2026-10'

// Stripe Identity document types for each choice. A US Green Card is a
// government-issued ID card; anything Stripe cannot classify goes to manual
// review rather than being rejected outright.
export const DOCUMENT_TYPES = {
  DRIVING_LICENSE: { label: "Driver's License", stripeTypes: ['driving_license'] },
  GREEN_CARD: { label: 'Green Card (Permanent Resident Card)', stripeTypes: ['id_card'] },
}

// Provider errors a person can resolve (a better photo, a matching face):
// the student may try again. Anything suspicious goes to manual review.
const RETRYABLE = new Set([
  'document_expired', 'document_unverified_other', 'document_type_not_supported',
  'selfie_document_missing_photo', 'selfie_face_mismatch', 'selfie_unverified_other',
  'consent_declined', 'device_not_supported', 'under_supported_age', 'abandoned',
])
const NEEDS_REVIEW = new Set(['selfie_manipulated'])

const STUDENT_REASONS = {
  document_expired: 'Your document has expired. Use a document that is still valid.',
  document_unverified_other: 'We could not verify your document. Retake clear photos of the front and back in good light.',
  document_type_not_supported: 'That document type is not accepted. Use the document you selected.',
  selfie_document_missing_photo: 'Your document does not show a photo of your face. Use a photo ID.',
  selfie_face_mismatch: 'Your selfie did not match the photo on your document. Try again in good light without glasses or a hat.',
  selfie_unverified_other: 'We could not verify your selfie. Try again in good light, facing the camera.',
  selfie_manipulated: 'Your selfie could not be accepted. Admissions will review your verification.',
  consent_declined: 'Verification needs your consent to continue.',
  device_not_supported: 'Your device could not use its camera for verification. Try another device or request in-person verification.',
  under_supported_age: 'You must be at least 18 to verify your identity online.',
  abandoned: 'Verification was not finished. Start again when you are ready.',
}

export function studentReason(code, fallback = '') {
  return STUDENT_REASONS[code] || fallback || 'Verification did not succeed. Try again or request in-person verification.'
}

const normalizeName = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z]+/g, ' ').trim()

// The verified document name must match the name on the student account.
// Middle names and order of extra given names are tolerated: every word of
// the account's first and last name must appear on the document.
export function namesMatch(account, document) {
  const docWords = new Set(`${normalizeName(document.first_name)} ${normalizeName(document.last_name)}`.split(' ').filter(Boolean))
  const wanted = `${normalizeName(account.first_name)} ${normalizeName(account.last_name)}`.split(' ').filter(Boolean)
  return wanted.length > 0 && docWords.size > 0 && wanted.every(word => docWords.has(word))
}

/**
 * Our status for a Stripe VerificationSession.
 * session: { status, last_error: { code, reason } }
 * report: the last VerificationReport's document section, when verified.
 */
export function verificationOutcome({ session, document, student }) {
  const status = session?.status
  if (status === 'verified') {
    const matches = document ? namesMatch(student, document) : false
    return matches
      ? { status: 'VERIFIED', failureCode: '', nameMatches: true }
      : { status: 'MANUAL_REVIEW', failureCode: 'name_mismatch', nameMatches: false, reason: 'The name on the document does not match the name on the student account.' }
  }
  if (status === 'requires_input' && session.last_error?.code) {
    const code = session.last_error.code
    if (NEEDS_REVIEW.has(code)) return { status: 'MANUAL_REVIEW', failureCode: code, reason: session.last_error.reason || '' }
    return { status: 'FAILED', failureCode: code, reason: session.last_error.reason || '', retryable: RETRYABLE.has(code) }
  }
  if (status === 'canceled') return { status: 'FAILED', failureCode: 'abandoned', reason: '', retryable: true }
  return { status: 'PENDING', failureCode: '' }
}

// Verification records whose biometrics should be redacted at the provider.
export const REDACT_AFTER_DAYS = 30
export function dueForRedaction(row, now = new Date()) {
  if (!row?.provider_session_id || row.redacted_at || !row.decided_at) return false
  if (!['VERIFIED', 'FAILED'].includes(row.status)) return false
  return now.getTime() - new Date(row.decided_at).getTime() >= REDACT_AFTER_DAYS * 86400000
}
