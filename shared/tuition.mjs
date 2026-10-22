export function tuitionBalance(tuitionCents, financingCents, successfulPayments) {
  const tuition = Number(tuitionCents)
  const financing = Number(financingCents || 0)
  const paid = (successfulPayments || []).reduce((sum, value) => sum + Number(value || 0), 0)
  if (![tuition, financing, paid].every(Number.isFinite) || tuition < 0 || financing < 0 || paid < 0) throw new Error('Invalid tuition ledger values')
  return { tuitionCents: tuition, financingCents: financing, paidCents: paid, remainingCents: Math.max(tuition - financing - paid, 0) }
}

export function tuitionPaymentAmount({ kind, remainingCents, depositCents = 0, installmentCents = 0 }) {
  const remaining = Number(remainingCents)
  if (!Number.isInteger(remaining) || remaining <= 0) throw new Error('No tuition balance is due')
  const requested = kind === 'full' ? remaining : kind === 'deposit' ? Number(depositCents) : kind === 'installment' ? Number(installmentCents) : 0
  if (!Number.isInteger(requested) || requested <= 0) throw new Error('Payment option is unavailable')
  return Math.min(requested, remaining)
}

// What to do with a tuition checkout that is still pending when the student
// starts another one. Only an open Session for the same choice and amount is
// reused; a paid Session must be finalized instead of charging again; anything
// else is expired and replaced.
export function pendingCheckoutAction({ session, payment, kind, installmentId, amountCents }) {
  if (session?.payment_status === 'paid' || session?.status === 'complete') return 'finalize'
  const sameChoice = payment?.payment_kind === kind
    && (payment?.installment_id || null) === (installmentId || null)
    && payment?.amount_cents === amountCents
  if (session?.status === 'open' && session?.url && sameChoice) return 'reuse'
  return 'replace'
}

// Splits the balance after the deposit into equal installments; the last one
// absorbs the rounding remainder. Empty when the account is paid in one go.
export function installmentSchedule({ tuitionCents, depositCents = 0, installmentCount = 1 }) {
  if (installmentCount <= 1) return []
  const balance = tuitionCents - depositCents
  const base = Math.floor(balance / installmentCount)
  return Array.from({ length: installmentCount }, (_, index) => ({
    installment_no: index + 1, label: `Installment ${index + 1} of ${installmentCount}`,
    amount_cents: base + (index === installmentCount - 1 ? balance - base * installmentCount : 0),
  })).filter(item => item.amount_cents > 0)
}
