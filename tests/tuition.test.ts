import { describe, expect, it } from 'vitest'
import { coursePricing, installmentSchedule, pendingCheckoutAction, pricingTotal, tuitionBalance, tuitionPaymentAmount } from '../shared/tuition.mjs'

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

describe('CDL Training special pricing', () => {
  const course = { training_cents: 259900, testing_fee_cents: 60000, administrative_fee_cents: 8000, materials_fee_cents: 15000, housing_fee_cents: 50000, currency: 'usd', pricing_version: 3 }

  it('itemizes the fees and totals them without housing', () => {
    const pricing = coursePricing(course)
    expect(pricing.items).toEqual([
      { code: 'training', label: 'CDL Training - Sale Price', amount_cents: 259900 },
      { code: 'testing', label: 'Testing Fee', amount_cents: 60000 },
      { code: 'administrative', label: 'Administrative Fee', amount_cents: 8000 },
      { code: 'materials', label: 'Materials Fee', amount_cents: 15000 },
    ])
    expect(pricing).toMatchObject({ currency: 'usd', version: 3, housingFeeCents: 50000, totalWithoutHousingCents: 342900, totalWithHousingCents: 392900 })
  })
  it('adds housing only when it is selected', () => {
    const { items, housingFeeCents } = coursePricing(course)
    expect(pricingTotal(items, housingFeeCents, false)).toBe(342900)
    expect(pricingTotal(items, housingFeeCents, true)).toBe(392900)
    expect(pricingTotal(items, housingFeeCents, false)).toBe(342900) // removing housing returns to the base total
  })
  it('ignores a housing choice when housing is not offered', () => {
    const { items } = coursePricing({ ...course, housing_fee_cents: 0 })
    expect(pricingTotal(items, 0, true)).toBe(342900)
  })
  it('follows a later price change without touching an earlier snapshot', () => {
    const before = coursePricing(course)
    const after = coursePricing({ ...course, training_cents: 279900 })
    expect(after.totalWithoutHousingCents).toBe(362900)
    expect(pricingTotal(before.items, before.housingFeeCents, true)).toBe(392900)
  })
  it('lists only charged fees and treats an unitemized course as its training price', () => {
    expect(coursePricing({ training_cents: 500000 }).items).toEqual([{ code: 'training', label: 'CDL Training - Sale Price', amount_cents: 500000 }])
  })
  it('rejects fractional or negative cents', () => {
    expect(() => coursePricing({ ...course, testing_fee_cents: 600.5 })).toThrow()
    expect(() => pricingTotal([{ code: 'x', label: 'X', amount_cents: -1 }], 0, false)).toThrow()
  })
})
