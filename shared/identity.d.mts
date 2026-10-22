export const IDENTITY_CONSENT_VERSION: string
export const DOCUMENT_TYPES: Record<'DRIVING_LICENSE' | 'GREEN_CARD', { label: string; stripeTypes: string[] }>
export function studentReason(code: string, fallback?: string): string
export function namesMatch(account: { first_name?: string | null; last_name?: string | null }, document: { first_name?: string | null; last_name?: string | null }): boolean
export function verificationOutcome(input: {
  session: { status?: string; last_error?: { code?: string; reason?: string } | null } | null
  document?: { first_name?: string | null; last_name?: string | null } | null
  student: { first_name?: string | null; last_name?: string | null }
}): { status: 'PENDING' | 'VERIFIED' | 'FAILED' | 'MANUAL_REVIEW'; failureCode: string; nameMatches?: boolean; reason?: string; retryable?: boolean }
export const REDACT_AFTER_DAYS: number
export function dueForRedaction(row: { provider_session_id?: string | null; redacted_at?: string | null; decided_at?: string | null; status?: string }, now?: Date): boolean
