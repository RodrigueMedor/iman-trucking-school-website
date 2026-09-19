export const PAYMENT_POLICY_VERSION = 'v2-case-by-case-refunds'

export const PAYMENT_POLICY_TITLE = 'Iman Trucking School Payment Policy'

export const PAYMENT_POLICY_PARAGRAPHS = [
  'By continuing to payment, you confirm that the name, contact information, and program details on this form are accurate.',
  'Card payments are processed securely by Stripe. Iman Trucking School does not store your full card number.',
  'After payment, admissions may contact you about enrollment, scheduling, documents, and class start dates.',
  'If you have a billing question or want to request a refund, contact admissions. Requests are reviewed case by case under school procedures and applicable law.',
  'Typing your full legal name below is your electronic signature of this policy.',
]

export function normalizePersonName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function expectedSignatureName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim()
}

export function isPaymentPolicySigned(
  accepted: boolean,
  signature: string,
  firstName: string,
  lastName: string
) {
  const expected = normalizePersonName(expectedSignatureName(firstName, lastName))
  return accepted && Boolean(expected) && normalizePersonName(signature) === expected
}
