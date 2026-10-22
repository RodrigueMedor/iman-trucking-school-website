import { Box, Button, ButtonBase, Divider, Grid, Paper, Stack, Typography } from '@mui/material'
import LockRounded from '@mui/icons-material/LockRounded'
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded'
import CreditCardRounded from '@mui/icons-material/CreditCardRounded'
import RadioButtonCheckedRounded from '@mui/icons-material/RadioButtonCheckedRounded'
import RadioButtonUncheckedRounded from '@mui/icons-material/RadioButtonUncheckedRounded'
import { FinancingCallout } from '../components/financing/FinancingCallout'
import type { SelfPayOption } from './api'
import { cardSx, NAVY } from './ui'

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100)

/** How the course can be paid once its tuition account is open. */
export function payPlan(course: SelfPayOption['course']) {
  const parts = []
  if (course.deposit_cents > 0) parts.push(`${money(course.deposit_cents)} deposit option`)
  if (course.installments_enabled && course.installment_count > 1) parts.push(`${course.installment_count} installments`)
  return parts.length ? parts.join(' · ') : 'Paid in full'
}

/** Lets a newly registered student pay tuition by card instead of financing. */
export function SelfPayCard({ options, courseId, onCourse, opening, disabled, onPay }: {
  options: SelfPayOption[]; courseId: string; onCourse: (id: string) => void; opening: boolean; disabled: boolean; onPay: (option: SelfPayOption) => void
}) {
  // Default to the course on the student's application, else the first one.
  const selected = options.find(item => item.courseId === courseId) || options.find(item => item.application) || options[0]
  const flexible = selected.course.deposit_cents > 0 || (selected.course.installments_enabled && selected.course.installment_count > 1)

  return <Paper elevation={0} sx={{ ...cardSx, overflow: 'hidden' }}>
    <Box sx={{ px: { xs: 2.5, md: 4 }, py: { xs: 2.5, md: 3 }, color: 'white', background: `linear-gradient(120deg, ${NAVY} 0%, #1b2a7a 100%)` }}>
      <Typography variant="overline" fontWeight={900} letterSpacing=".14em" sx={{ opacity: 0.75 }}>Tuition</Typography>
      <Typography component="h2" variant="h5" fontWeight={950} letterSpacing="-.02em">Choose how to pay for your CDL training</Typography>
      <Typography sx={{ opacity: 0.85, mt: 0.5 }}>Pay securely by card today, or apply for financing with our lending partner.</Typography>
    </Box>

    <Grid container>
      <Grid size={{ xs: 12, md: 7 }} sx={{ p: { xs: 2.5, md: 4 }, borderRight: { md: 1 }, borderBottom: { xs: 1, md: 0 }, borderColor: 'divider' }}>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(8,8,95,.08)', color: 'primary.main' }}><CreditCardRounded /></Box>
            <Box>
              <Typography component="h3" variant="h6" color="primary.main" fontWeight={950} lineHeight={1.2}>Pay by card</Typography>
              <Typography variant="body2" color="text.secondary">No financing needed</Typography>
            </Box>
          </Stack>

          <Box>
            <Typography id="self-pay-program" variant="subtitle2" fontWeight={900} mb={1}>Select your program</Typography>
            <Stack spacing={1.25} role="radiogroup" aria-labelledby="self-pay-program">
              {options.map(item => {
                const active = item.courseId === selected.courseId
                return <ButtonBase key={item.courseId} role="radio" aria-checked={active} onClick={() => onCourse(item.courseId)} disabled={opening}
                  sx={{ width: '100%', textAlign: 'left', borderRadius: 2.5, border: 2, borderColor: active ? 'primary.main' : 'divider', bgcolor: active ? 'rgba(8,8,95,.035)' : 'background.paper', px: 2, py: 1.5, gap: 1.5, justifyContent: 'flex-start', transition: 'border-color .15s, background-color .15s', '&:hover': { borderColor: active ? 'primary.main' : 'text.disabled' } }}>
                  {active ? <RadioButtonCheckedRounded color="primary" /> : <RadioButtonUncheckedRounded sx={{ color: 'text.disabled' }} />}
                  <Box flex={1} minWidth={0}>
                    <Typography fontWeight={850}>{item.course.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.application ? `Application ${item.application.reference_no} · ` : ''}{payPlan(item.course)}</Typography>
                  </Box>
                  <Typography fontWeight={950} color={NAVY} whiteSpace="nowrap">{money(item.course.tuition_cents)}</Typography>
                </ButtonBase>
              })}
            </Stack>
          </Box>

          <Box sx={{ borderRadius: 2.5, bgcolor: '#f6f8fc', p: 2 }}>
            <Stack direction="row" justifyContent="space-between" gap={2}><Typography color="text.secondary">Program</Typography><Typography fontWeight={800} textAlign="right">{selected.course.name}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between" mt={0.75}><Typography color="text.secondary">Tuition</Typography><Typography fontWeight={800}>{money(selected.course.tuition_cents)}</Typography></Stack>
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
              <Typography fontWeight={900}>{flexible ? 'Total tuition' : 'Due today'}</Typography>
              <Typography variant="h5" fontWeight={950} color={NAVY}>{money(selected.course.tuition_cents)}</Typography>
            </Stack>
            {flexible && <Typography variant="body2" color="text.secondary" mt={0.75}>You'll choose to pay in full, pay the deposit, or pay by installment on the next step.</Typography>}
          </Box>

          <Button variant="contained" color="secondary" size="large" startIcon={<LockRounded />} disabled={opening || disabled} onClick={() => onPay(selected)} sx={{ py: 1.4, fontWeight: 900 }}>
            {opening ? 'Preparing secure checkout…' : flexible ? 'Continue to payment options' : `Pay ${money(selected.course.tuition_cents)} securely`}
          </Button>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 2.5 }} sx={{ color: 'text.secondary' }}>
            {[[<LockRounded key="l" fontSize="small" />, 'Encrypted checkout by Stripe'], [<CreditCardRounded key="c" fontSize="small" />, 'Visa, Mastercard, Amex, Discover'], [<ReceiptLongRounded key="r" fontSize="small" />, 'Instant receipt']].map(([icon, text]) =>
              <Stack key={text as string} direction="row" spacing={0.75} alignItems="center">{icon}<Typography variant="caption" fontWeight={700}>{text}</Typography></Stack>)}
          </Stack>
          <Typography variant="caption" color="text.secondary">IMAN never sees or stores your card details. You'll review and sign the tuition payment agreement before paying.</Typography>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, md: 5 }} sx={{ p: { xs: 2.5, md: 4 }, bgcolor: '#fbfcfe' }}>
        <FinancingCallout variant="inline" title="Prefer to finance?" showLearnMore={false} />
      </Grid>
    </Grid>
  </Paper>
}
