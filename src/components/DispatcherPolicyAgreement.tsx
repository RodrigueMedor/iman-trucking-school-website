import { Alert, Box, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material'
import PolicyIcon from '@mui/icons-material/Policy'
import { expectedSignatureName, normalizePersonName } from '../lib/paymentPolicy'

export const DISPATCHER_POLICY_TEXT =
  'All registration payments are non-refundable. If the student cannot attend the class, the payment remains as a credit on their student account and can be used for a future dispatcher class. If Iman Trucking School cancels or reschedules this class session, the student may choose a full refund or a credit toward a future dispatcher class.'

type DispatcherPolicyAgreementProps = {
  firstName: string
  lastName: string
  accepted: boolean
  signature: string
  onAcceptedChange: (accepted: boolean) => void
  onSignatureChange: (signature: string) => void
}

export function DispatcherPolicyAgreement({
  firstName,
  lastName,
  accepted,
  signature,
  onAcceptedChange,
  onSignatureChange,
}: DispatcherPolicyAgreementProps) {
  const expectedName = expectedSignatureName(firstName, lastName)
  const isSignatureValid =
    Boolean(expectedName) && normalizePersonName(signature) === normalizePersonName(expectedName)

  return (
    <Stack spacing={2.5} sx={{ textAlign: 'left' }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <PolicyIcon color="primary" />
        <Typography variant="h6" fontWeight={800}>
          Required Payment Policy
        </Typography>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          p: 3,
          bgcolor: '#fff9e6',
          borderColor: '#ffe082',
          borderRadius: 2,
        }}
      >
        <Typography variant="subtitle2" fontWeight={800} color="#b78103" gutterBottom>
          DISPATCHER CLASS NON-REFUNDABLE POLICY
        </Typography>
        <Typography variant="body1" fontWeight={600} color="#3e2723" sx={{ lineHeight: 1.6 }}>
          {DISPATCHER_POLICY_TEXT}
        </Typography>
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #ffe57f' }}>
          <Typography variant="caption" color="text.secondary">
            Payments are securely processed by Stripe. Once confirmed, tuition credits may be applied toward any future scheduled dispatcher class session.
          </Typography>
        </Box>
      </Paper>

      <Box
        sx={{
          p: 2,
          border: '2px solid',
          borderColor: accepted ? 'success.main' : 'divider',
          borderRadius: 2,
          bgcolor: accepted ? '#f0fdf4' : '#fafbfe',
          transition: 'border-color 0.2s, background-color 0.2s',
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={accepted}
              onChange={e => onAcceptedChange(e.target.checked)}
              color="success"
              required
            />
          }
          label={
            <Typography variant="body2" fontWeight={700}>
              I have read and agree to the Dispatcher Class Registration Policy: All registration payments are non-refundable. If I cannot attend the class, my payment remains as a credit on my student account and can be used for a future dispatcher class. If the school cancels or reschedules this session, I may choose a full refund or a credit toward a future class.
            </Typography>
          }
        />
      </Box>

      <TextField
        fullWidth
        label="Electronic signature (full legal name)"
        value={signature}
        onChange={e => onSignatureChange(e.target.value)}
        required
        error={Boolean(signature && !isSignatureValid)}
        helperText={
          expectedName
            ? `Type "${expectedName}" exactly as it appears on your registration form.`
            : 'Type your full legal name to complete signature.'
        }
      />

      <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
        Credit card and electronic payments are processed over an encrypted connection by Stripe. Iman Trucking School does not store your full payment card number.
      </Alert>
    </Stack>
  )
}

export default DispatcherPolicyAgreement
