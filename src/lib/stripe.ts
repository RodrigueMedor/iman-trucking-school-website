// Checkout sessions are started from the student portal (see
// src/portal/api.ts), which sends the student's access token. This module
// only reads a finished checkout's status, which also lets the API reconcile
// the payment when the Stripe webhook is delayed.

export type PaymentStatusResponse = {
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'refunded'
  payment_type?: string
  amount_cents?: number
  currency?: string
}

export async function getPaymentStatus(sessionId: string): Promise<PaymentStatusResponse> {
  const response = await fetch(`/api/payment-status/${encodeURIComponent(sessionId)}`)
  if (!response.ok) throw new Error('Failed to fetch payment status')
  return response.json()
}
