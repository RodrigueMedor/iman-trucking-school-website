import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import ErrorIcon from '@mui/icons-material/Error'
import { useLocation, useNavigate } from 'react-router-dom'
import { getPaymentStatus, type PaymentStatusResponse } from '../lib/stripe'

type Status = 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'refunded'

export function PaymentStatus({
  onContinue,
  onRetry,
  continueLabel = 'Continue',
}: {
  onContinue?: (result?: PaymentStatusResponse) => void
  onRetry?: () => void
  continueLabel?: string
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const returnState = params.get('payment')
  const sessionId = params.get('session_id')

  const [status, setStatus] = useState<Status | null>(null)
  const [amount, setAmount] = useState<number | null>(null)
  const [result, setResult] = useState<PaymentStatusResponse | null>(null)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    const currentSessionId = sessionId
    let cancelled = false
    let attempts = 0

    const settled = ['succeeded', 'failed', 'canceled', 'refunded']

    // If the user was redirected away from checkout, treat it as canceled.
    if (returnState === 'canceled' || returnState === 'failed') {
      setStatus(returnState === 'failed' ? 'failed' : 'canceled')
      return
    }

    async function poll() {
      attempts += 1
      try {
        const res = await getPaymentStatus(currentSessionId)
        if (cancelled) return
        setResult(res)
        setAmount(res.amount_cents ?? null)
        setStatus(res.status)
        if (!settled.includes(res.status) && attempts < 12) {
          setPolling(true)
          window.setTimeout(poll, 2000)
        } else {
          setPolling(false)
        }
      } catch {
        if (cancelled) return
        // Status endpoint may not be reachable or ready yet
        if (attempts < 6) {
          setPolling(true)
          window.setTimeout(poll, 2000)
        } else {
          setPolling(false)
          setStatus(returnState === 'success' ? 'processing' : null)
        }
      }
    }

    void poll()
    return () => {
      cancelled = true
    }
  }, [sessionId, returnState])

  function clearParams() {
    navigate(location.pathname, { replace: true })
  }

  function handleContinue() {
    clearParams()
    onContinue?.(result ?? undefined)
  }

  function handleRetry() {
    clearParams()
    if (onRetry) {
      onRetry()
    } else {
      onContinue?.(result ?? undefined)
    }
  }

  const isProcessing = status === null || status === 'pending' || status === 'processing'

  let icon
  let title
  let message
  let tone: 'success' | 'error' | 'warning' | 'info' | 'default' = 'info'

  if (isProcessing) {
    title = 'Processing your payment'
    message = 'We are confirming your payment with the bank. This usually takes a few seconds.'
  } else {
    const dollars = amount != null ? `$${(amount / 100).toFixed(2)}` : null
    switch (status) {
      case 'succeeded':
        icon = <CheckCircleIcon sx={{ fontSize: 64, color: '#4caf50', mb: 3 }} />
        title = 'Payment successful'
        message = dollars
          ? `Your ${dollars} payment was received. Your registration is complete.`
          : 'Your payment was received. Your registration is complete.'
        tone = 'success'
        break
      case 'refunded':
        icon = <CheckCircleIcon sx={{ fontSize: 64, color: '#8a5700', mb: 3 }} />
        title = 'Payment refunded'
        message = dollars
          ? `Your ${dollars} payment has been refunded.`
          : 'Your payment has been refunded.'
        tone = 'warning'
        break
      case 'failed':
        icon = <ErrorIcon sx={{ fontSize: 64, color: '#d61f2c', mb: 3 }} />
        title = 'Payment failed'
        message = 'Your payment could not be processed. Please try again or contact admissions for help.'
        tone = 'error'
        break
      case 'canceled':
        icon = <CancelIcon sx={{ fontSize: 64, color: '#8a8f9c', mb: 3 }} />
        title = 'Payment canceled'
        message = 'You canceled the payment session. Your registration details have been saved, and you can try paying again whenever you are ready.'
        tone = 'warning'
        break
      default:
        title = 'Payment'
        message = 'We could not verify the payment status. Contact admissions if you were charged.'
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f5f7fb' }}>
      <Container maxWidth="md">
        <Card sx={{ boxShadow: '0 25px 50px rgba(8,8,95,.15)', borderRadius: 4 }}>
          <CardContent sx={{ p: { xs: 4, md: 6 }, textAlign: 'center' }}>
            {isProcessing ? (
              <>
                <CircularProgress size={64} sx={{ mb: 3 }} />
                <Typography variant="h3" fontWeight={900} gutterBottom>
                  {title}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 4 }}>
                  {message}
                </Typography>
                <Alert severity="info" sx={{ textAlign: 'left' }}>
                  You can close this page and check the admin area later; the payment record is updated by the bank webhook.
                </Alert>
              </>
            ) : (
              <>
                {icon}
                <Typography variant="h3" fontWeight={900} gutterBottom>
                  {title}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 4 }}>
                  {message}
                </Typography>
                <Alert severity={tone} sx={{ textAlign: 'left' }}>
                  {status === 'succeeded'
                    ? 'A confirmation is on file. Staff can see the paid status in the admin dashboard.'
                    : status === 'refunded'
                      ? 'If you believe this is an error, contact admissions.'
                      : status === 'canceled'
                        ? 'No charge was made. Your registration is preserved so you can complete payment.'
                        : 'Need help? Contact admissions at (888) 991-4776 or info@imanlogistics.com.'}
                </Alert>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" gap={2} sx={{ mt: 4 }}>
                  {status === 'succeeded' ? (
                    <Button variant="contained" color="secondary" size="large" onClick={handleContinue}>
                      {continueLabel}
                    </Button>
                  ) : (
                    <>
                      {onRetry && (
                        <Button variant="contained" color="primary" size="large" onClick={handleRetry}>
                          {status === 'canceled' ? 'Try payment again' : 'Retry payment'}
                        </Button>
                      )}
                      <Button variant="outlined" size="large" onClick={clearParams}>
                        Review registration details
                      </Button>
                    </>
                  )}
                </Stack>
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}

export default PaymentStatus