import { loadStripe } from '@stripe/stripe-js'
import { getStripePublishableKey } from './supabase'

const publishableKey = getStripePublishableKey()
const stripePromise = publishableKey ? loadStripe(publishableKey) : null

async function getStripe() {
  if (!publishableKey) {
    throw new Error('Stripe is not configured. Add a VITE_STRIPE_PUBLISHABLE_KEY to the environment.')
  }
  if (!stripePromise) {
    throw new Error('Stripe failed to initialize')
  }
  const stripe = await stripePromise
  if (!stripe) throw new Error('Stripe failed to initialize')
  return stripe
}

export async function createRegistrationCheckout(
  studentId: string,
  email: string,
  firstName: string,
  lastName: string,
  paymentPolicyAccepted: boolean,
  paymentPolicySignature: string
) {
  try {
    const response = await fetch('/api/create-registration-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId,
        email,
        firstName,
        lastName,
        paymentPolicyAccepted,
        paymentPolicySignature,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create checkout session')
    }

    const { sessionId, url } = await response.json()
    const stripe = await getStripe()

    // Redirect to Stripe Checkout
    if (url) {
      window.location.href = url
    } else {
      // Fallback: use stripe.redirectToCheckout
      const { error } = await stripe.redirectToCheckout({
        sessionId,
      })

      if (error) {
        throw new Error(error.message || 'Failed to redirect to checkout')
      }
    }
  } catch (error) {
    console.error('Error creating registration checkout:', error)
    throw error
  }
}

export async function createApplicationCheckout(
  applicationId: string,
  email: string,
  firstName: string,
  lastName: string,
  courseId: string,
  paymentPolicyAccepted: boolean,
  paymentPolicySignature: string
) {
  try {
    const response = await fetch('/api/create-application-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        applicationId,
        email,
        firstName,
        lastName,
        courseId,
        paymentPolicyAccepted,
        paymentPolicySignature,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create checkout session')
    }

    const { sessionId, url } = await response.json()
    const stripe = await getStripe()

    // Redirect to Stripe Checkout
    if (url) {
      window.location.href = url
    } else {
      // Fallback: use stripe.redirectToCheckout
      const { error } = await stripe.redirectToCheckout({
        sessionId,
      })

      if (error) {
        throw new Error(error.message || 'Failed to redirect to checkout')
      }
    }
  } catch (error) {
    console.error('Error creating application checkout:', error)
    throw error
  }
}

export async function createDispatcherCheckout(
  registrationId: string,
  email: string,
  firstName: string,
  lastName: string,
  classId: string,
  paymentPolicyAccepted: boolean,
  paymentPolicySignature: string
) {
  try {
    const response = await fetch('/api/create-dispatcher-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registrationId,
        email,
        firstName,
        lastName,
        classId,
        paymentPolicyAccepted,
        paymentPolicySignature,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create checkout session')
    }

    const { sessionId, url } = await response.json()
    const stripe = await getStripe()

    // Redirect to Stripe Checkout
    if (url) {
      window.location.href = url
    } else {
      // Fallback: use stripe.redirectToCheckout
      const { error } = await stripe.redirectToCheckout({
        sessionId,
      })

      if (error) {
        throw new Error(error.message || 'Failed to redirect to checkout')
      }
    }
  } catch (error) {
    console.error('Error creating dispatcher checkout:', error)
    throw error
  }
}

export async function createDispatcherRegistration(registration: {
  firstName: string
  lastName: string
  email: string
  phone: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  classId: string
}) {
  let response: Response
  try {
    response = await fetch('/api/create-dispatcher-registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registration),
    })
  } catch (netErr: any) {
    console.error('Network error during registration submission:', netErr)
    throw new Error('Unable to connect to the registration server. Please ensure the backend service is running.')
  }

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || `Server error (${response.status}). Unable to complete registration.`)
  }
  return result as { id: string; registration_no: string; class_id: string }
}

export type PaymentRegistrationDetails = {
  id: string
  registrationNo: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  className: string
  status: string
  paymentStatus: string
  policyAccepted: boolean
  policySignature?: string
  policyText?: string
}

export type PaymentStatusResponse = {
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'refunded'
  payment_type?: string
  amount_cents?: number
  currency?: string
  registration?: PaymentRegistrationDetails | null
}

export async function getPaymentStatus(sessionId: string): Promise<PaymentStatusResponse> {
  try {
    const response = await fetch(`/api/payment-status/${sessionId}`)

    if (!response.ok) {
      throw new Error('Failed to fetch payment status')
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching payment status:', error)
    throw error
  }
}

