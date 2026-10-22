import { describe, expect, it } from 'vitest'
import { installmentSchedule, pendingCheckoutAction, tuitionBalance, tuitionPaymentAmount } from '../shared/tuition.mjs'

describe('tuition ledger', () => {
  it('subtracts successful payments and funded financing', () => {
    expect(tuitionBalance(700000, 200000, [100000, 50000])).toEqual({ tuitionCents: 700000, financingCents: 200000, paidCents: 150000, remainingCents: 350000 })
  })
  it('never exposes a negative balance', () => expect(tuitionBalance(10000, 8000, [5000]).remainingCents).toBe(0))
  it('caps deposits and installments at the remaining balance', () => {
    expect(tuitionPaymentAmount({ kind: 'deposit', remainingCents: 30000, depositCents: 50000 })).toBe(30000)
    expect(tuitionPaymentAmount({ kind: 'installment', remainingCents: 25000, installmentCents: 40000 })).toBe(25000)
  })
  it('rejects unavailable or zero-value choices', () => expect(() => tuitionPaymentAmount({ kind: 'deposit', remainingCents: 30000 })).toThrow())
})

describe('pending tuition checkout', () => {
  const payment = { payment_kind: 'deposit', installment_id: null, amount_cents: 100000 }
  const open = { status: 'open', payment_status: 'unpaid', url: 'https://checkout.stripe.com/x' }

  it('reuses an open session for the same choice and amount', () => {
    expect(pendingCheckoutAction({ session: open, payment, kind: 'deposit', amountCents: 100000 })).toBe('reuse')
  })
  it('replaces an open session when the student picks a different option', () => {
    expect(pendingCheckoutAction({ session: open, payment, kind: 'full', amountCents: 100000 })).toBe('replace')
  })
  it('replaces an open session when the amount changed', () => {
    expect(pendingCheckoutAction({ session: open, payment, kind: 'deposit', amountCents: 90000 })).toBe('replace')
  })
  it('replaces a different installment', () => {
    const p = { payment_kind: 'installment', installment_id: 'a', amount_cents: 5000 }
    expect(pendingCheckoutAction({ session: open, payment: p, kind: 'installment', installmentId: 'b', amountCents: 5000 })).toBe('replace')
  })
  it('replaces an expired or missing session', () => {
    expect(pendingCheckoutAction({ session: { status: 'expired' }, payment, kind: 'deposit', amountCents: 100000 })).toBe('replace')
    expect(pendingCheckoutAction({ session: null, payment, kind: 'deposit', amountCents: 100000 })).toBe('replace')
  })
  it('never charges again when the pending session was already paid', () => {
    expect(pendingCheckoutAction({ session: { status: 'complete', payment_status: 'paid' }, payment, kind: 'full', amountCents: 1 })).toBe('finalize')
  })
})

describe('installment schedule', () => {
  it('splits the post-deposit balance and puts the remainder last', () => {
    expect(installmentSchedule({ tuitionCents: 500000, depositCents: 100001, installmentCount: 4 }).map(item => item.amount_cents)).toEqual([99999, 99999, 99999, 100002])
  })
  it('labels each installment', () => expect(installmentSchedule({ tuitionCents: 2000, installmentCount: 2 })[1]).toEqual({ installment_no: 2, label: 'Installment 2 of 2', amount_cents: 1000 }))
  it('is empty for a single payment', () => expect(installmentSchedule({ tuitionCents: 500000, installmentCount: 1 })).toEqual([]))
})
