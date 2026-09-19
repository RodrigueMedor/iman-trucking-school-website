import { loadStripe } from '@stripe/stripe-js'
import { getStripePublishableKey } from './supabase'
import { getApiUrl } from './api'

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
    const response = await fetch(getApiUrl('/api/create-registration-checkout'), {
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
      const contentType = response.headers.get('content-type') || ''
      let errorBody: any = {}
      if (contentType.includes('application/json')) {
        try {
          errorBody = await response.json()
        } catch (e) {
          errorBody = { error: await response.text() }
        }
      } else {
        const text = await response.text()
        errorBody = { error: text }
      }
      throw new Error(errorBody.error || 'Failed to create checkout session')
    }

    // Safely parse JSON response, but tolerate non-JSON (e.g., HTML 404 pages)
    let responseData: any
    const ct = response.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      responseData = await response.json().catch(() => ({}))
    } else {
      const text = await response.text()
      try {
        responseData = JSON.parse(text)
      } catch {
        responseData = { url: undefined, sessionId: undefined, raw: text }
      }
    }

    const { sessionId, url } = responseData
    const stripe = await getStripe()

    // Redirect to Stripe Checkout
    if (url) {
      window.location.href = url
    } else {
      // Fallback: use stripe.redirectToCheckout
      if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
        console.error('No valid sessionId returned from checkout API', responseData)
        throw new Error('Checkout session not returned or invalid. Check network/server logs for the API response.')
      }
      try {
        const { error } = await stripe.redirectToCheckout({ sessionId })
        if (error) {
          console.error('stripe.redirectToCheckout returned an error', error, { sessionId, responseData })
          throw new Error(error.message || 'Failed to redirect to checkout')
        }
      } catch (err: any) {
        console.error('stripe.redirectToCheckout failed', err, { sessionId, responseData })
        throw err
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
    const response = await fetch(getApiUrl('/api/create-application-checkout'), {
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
      const contentType = response.headers.get('content-type') || ''
      let errorBody: any = {}
      if (contentType.includes('application/json')) {
        try {
          errorBody = await response.json()
        } catch (e) {
          errorBody = { error: await response.text() }
        }
      } else {
        const text = await response.text()
        errorBody = { error: text }
      }
      throw new Error(errorBody.error || 'Failed to create checkout session')
    }

    // Safely parse JSON response, but tolerate non-JSON (e.g., HTML 404 pages)
    let responseData: any
    const ct = response.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      responseData = await response.json().catch(() => ({}))
    } else {
      const text = await response.text()
      try {
        responseData = JSON.parse(text)
      } catch {
        responseData = { url: undefined, sessionId: undefined, raw: text }
      }
    }

    const { sessionId, url } = responseData
    const stripe = await getStripe()

    // Redirect to Stripe Checkout
    if (url) {
      window.location.href = url
    } else {
      // Fallback: use stripe.redirectToCheckout
      if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
        console.error('No valid sessionId returned from checkout API', responseData)
        throw new Error('Checkout session not returned or invalid. Check network/server logs for the API response.')
      }
      try {
        const { error } = await stripe.redirectToCheckout({ sessionId })
        if (error) {
          console.error('stripe.redirectToCheckout returned an error', error, { sessionId, responseData })
          throw new Error(error.message || 'Failed to redirect to checkout')
        }
      } catch (err: any) {
        console.error('stripe.redirectToCheckout failed', err, { sessionId, responseData })
        throw err
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
    const response = await fetch(getApiUrl('/api/create-dispatcher-checkout'), {
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
      const contentType = response.headers.get('content-type') || ''
      let errorBody: any = {}
      if (contentType.includes('application/json')) {
        try {
          errorBody = await response.json()
        } catch (e) {
          errorBody = { error: await response.text() }
        }
      } else {
        const text = await response.text()
        errorBody = { error: text }
      }
      throw new Error(errorBody.error || 'Failed to create checkout session')
    }

    // Safely parse JSON response, but tolerate non-JSON (e.g., HTML 404 pages)
    let responseData: any
    const ct = response.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      responseData = await response.json().catch(() => ({}))
    } else {
      const text = await response.text()
      try {
        responseData = JSON.parse(text)
      } catch {
        responseData = { url: undefined, sessionId: undefined, raw: text }
      }
    }

    const { sessionId, url } = responseData
    const stripe = await getStripe()

    // Redirect to Stripe Checkout
    if (url) {
      window.location.href = url
    } else {
      // Fallback: use stripe.redirectToCheckout
      if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
        console.error('No valid sessionId returned from checkout API', responseData)
        throw new Error('Checkout session not returned or invalid. Check network/server logs for the API response.')
      }
      try {
        const { error } = await stripe.redirectToCheckout({ sessionId })
        if (error) {
          console.error('stripe.redirectToCheckout returned an error', error, { sessionId, responseData })
          throw new Error(error.message || 'Failed to redirect to checkout')
        }
      } catch (err: any) {
        console.error('stripe.redirectToCheckout failed', err, { sessionId, responseData })
        throw err
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
    response = await fetch(getApiUrl('/api/create-dispatcher-registration'), {
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

