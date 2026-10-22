export function tuitionBalance(tuitionCents: number, financingCents: number, successfulPayments: number[]): {
  tuitionCents: number; financingCents: number; paidCents: number; remainingCents: number
}
export function tuitionPaymentAmount(input: {
  kind: 'full' | 'deposit' | 'installment'; remainingCents: number; depositCents?: number; installmentCents?: number
}): number
export function pendingCheckoutAction(input: {
  session: { status?: string | null; payment_status?: string | null; url?: string | null } | null
  payment: { payment_kind?: string | null; installment_id?: string | null; amount_cents?: number } | null
  kind: 'full' | 'deposit' | 'installment'; installmentId?: string | null; amountCents: number
}): 'reuse' | 'finalize' | 'replace'
export function installmentSchedule(input: { tuitionCents: number; depositCents?: number; installmentCount?: number }): {
  installment_no: number; label: string; amount_cents: number
}[]
