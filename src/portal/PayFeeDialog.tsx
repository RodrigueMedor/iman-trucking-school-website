import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { PaymentPolicyAgreement } from '../components/PaymentPolicyAgreement'
import { isPaymentPolicySigned } from '../lib/paymentPolicy'
import { toMessage } from './api'

/** Signs the payment policy and hands off to Stripe Checkout. */
export function PayFeeDialog({ open, onClose, title, description, firstName, lastName, onPay }: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  firstName: string
  lastName: string
  onPay: (accepted: boolean, signature: string) => Promise<void>
}) {
  const [accepted, setAccepted] = useState(false)
  const [signature, setSignature] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const signed = isPaymentPolicySigned(accepted, signature, firstName, lastName)

  const pay = async () => {
    setError('')
    setBusy(true)
    try {
      await onPay(accepted, signature)
    } catch (err) {
      setError(toMessage(err))
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" scroll="body">
      <DialogTitle fontWeight={900}>{title}</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>{description}</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }} role="alert">{error}</Alert>}
        <PaymentPolicyAgreement
          firstName={firstName}
          lastName={lastName}
          accepted={accepted}
          signature={signature}
          onAcceptedChange={setAccepted}
          onSignatureChange={setSignature}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={busy}>Not now</Button>
        <Button variant="contained" color="secondary" onClick={() => void pay()} disabled={!signed || busy}>
          {busy ? 'Opening secure checkout…' : 'Continue to secure payment'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
