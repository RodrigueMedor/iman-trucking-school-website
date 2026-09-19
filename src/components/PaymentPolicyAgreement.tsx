import { Alert, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material'
import {
  PAYMENT_POLICY_PARAGRAPHS,
  PAYMENT_POLICY_TITLE,
  expectedSignatureName,
} from '../lib/paymentPolicy'

type PaymentPolicyAgreementProps = {
  firstName: string
  lastName: string
  accepted: boolean
  signature: string
  onAcceptedChange: (accepted: boolean) => void
  onSignatureChange: (signature: string) => void
}

export function PaymentPolicyAgreement({
  firstName,
  lastName,
  accepted,
  signature,
  onAcceptedChange,
  onSignatureChange,
}: PaymentPolicyAgreementProps) {
  const expectedName = expectedSignatureName(firstName, lastName)

  return (
    <Stack spacing={2} sx={{ textAlign: 'left' }}>
      <Typography fontWeight={900}>{PAYMENT_POLICY_TITLE}</Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          maxHeight: 220,
          overflow: 'auto',
          bgcolor: '#fafbfe',
          borderRadius: 2,
        }}
      >
        <Stack spacing={1.5}>
          {PAYMENT_POLICY_PARAGRAPHS.map(paragraph => (
            <Typography key={paragraph} variant="body2">
              {paragraph}
            </Typography>
          ))}
        </Stack>
      </Paper>
      <FormControlLabel
        control={
          <Checkbox
            checked={accepted}
            onChange={event => onAcceptedChange(event.target.checked)}
          />
        }
        label="I have read this payment policy and agree to it."
      />
      <TextField
        fullWidth
        label="Electronic signature (full legal name)"
        value={signature}
        onChange={event => onSignatureChange(event.target.value)}
        required
        helperText={
          expectedName
            ? `Type ${expectedName} exactly as it appears on this form.`
            : 'Type your full legal name to sign.'
        }
      />
      <Alert severity="info">
        Payments are processed securely by Stripe. We never store your card details. Refund and billing questions can be sent to admissions.
      </Alert>
    </Stack>
  )
}

export default PaymentPolicyAgreement
