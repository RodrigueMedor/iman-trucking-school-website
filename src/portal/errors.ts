/** An error returned by our own API, whose message is already student-facing. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

const FIELD_LABELS: Record<string, string> = {
  first_name: 'your first name',
  last_name: 'your last name',
  email: 'your email address',
  phone: 'your phone number',
  date_of_birth: 'your date of birth (you must be at least 18)',
  address_line1: 'your street address',
  city: 'your city',
  state: 'your state',
  zip_code: 'your ZIP code',
  license_type: 'your current license type',
  license_number: 'your license number',
  license_state: 'the state that issued your license',
  course_id: 'the program you chose',
  session_id: 'the start session you chose',
  preferred_dates: 'your preferred assessment dates',
  scheduled_at: 'the scheduled date',
  message: 'the message to the student',
}

const GENERIC = 'Something went wrong. Please try again.'

/**
 * Maps Supabase, storage, network and API errors to a message a student can
 * act on. Raw database text is never shown; it goes to the console instead.
 */
export function toMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) {
    return 'We couldn\'t reach the server. Check your connection and try again.'
  }

  const { code, message } = (typeof error === 'object' && error !== null ? error : { message: String(error ?? '') }) as {
    code?: string
    message?: string
  }
  const text = message ?? ''

  if (text === 'missing_document') return 'Upload your driver\'s license or CLP before submitting.'
  if (text === 'missing_assessment_test') return 'Complete the online English test before submitting your assessment request.'
  if (text === 'invalid_transition') return 'This application can\'t be changed right now. Refresh the page to see its latest status.'
  if (text.startsWith('invalid_field:')) {
    const field = text.slice('invalid_field:'.length)
    return `Check ${FIELD_LABELS[field] ?? 'the highlighted information'} and try again.`
  }
  if (text === 'not_found' || code === 'P0002') return 'We couldn\'t find that application.'
  if (code === 'PGRST301' || /jwt expired|invalid jwt|session.*(expired|missing)/i.test(text)) {
    return 'Your session has expired. Sign in again.'
  }
  if (code === '42501' || text === 'protected_field' || text === 'not_allowed' || /row-level security/i.test(text)) {
    return 'You don\'t have permission to do that.'
  }
  if (code === '23505') {
    return /draft/i.test(text)
      ? 'You already have a draft of this application. Continue it from your dashboard.'
      : 'This record already exists.'
  }
  if (code === '23514' || code === '22P02' || code === '22007' || code === '22008') {
    return 'Some information isn\'t in the expected format. Check your answers and try again.'
  }
  if (/payload too large|exceeded the maximum allowed size/i.test(text)) return 'Files must be 10 MB or smaller.'
  if (/mime type .* is not supported|invalid mime/i.test(text)) return 'Upload a PDF, JPG or PNG file.'

  console.error('Unexpected portal error:', error)
  return GENERIC
}
