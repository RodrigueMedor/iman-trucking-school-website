import { Box, Button, Container, Link, Paper, Skeleton, Stack, Typography } from '@mui/material'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import { Link as RouterLink } from 'react-router-dom'
import { FINANCING_DISCLOSURE, FINANCING_PARTNER, LIBERTY } from '../../config/financing'
import { LibertyFinancingButton } from './LibertyFinancingButton'
import { useAuth } from '../../contexts/AuthContext'
import { recordFinancingReferral } from '../../portal/api'
import { useCallback } from 'react'

type Variant = 'section' | 'card' | 'inline' | 'hero'

/**
 * "Need Help Paying for CDL Training?" — IMAN's framing around the partner's
 * application button, with the third-party disclosure.
 *  - section: full-width band on public pages
 *  - card:    a self-contained card (dashboard, confirmation)
 *  - inline:  a quiet note inside the application form
 */
export function FinancingCallout({
  variant = 'section',
  title = 'Need Help Paying for CDL Training?',
  showLearnMore = true,
}: {
  variant?: Variant
  title?: string
  showLearnMore?: boolean
}) {
  const compact = variant !== 'section'
  const hero = variant === 'hero'
  const { loading, profileReady, session, profile } = useAuth()
  const authPending = loading || Boolean(session && !profileReady)
  const studentCanApply = Boolean(session && profile?.active && profile.role === 'student')
  const recordReferral = useCallback(() => {
    void recordFinancingReferral().catch(error => console.error('Unable to record financing referral:', error))
  }, [])

  const body = (
    <Stack spacing={hero ? 1.75 : compact ? 1.5 : 2} sx={{ minWidth: 0, position: 'relative', zIndex: 1 }}>
      {hero && (
        <Typography
          variant="overline"
          sx={{
            alignSelf: 'flex-start', px: 1.25, py: 0.35, borderRadius: 10,
            bgcolor: 'rgba(214,31,44,.1)', color: 'secondary.main',
            fontWeight: 950, letterSpacing: '.11em', lineHeight: 1.6,
          }}
        >
          Financing available
        </Typography>
      )}
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ width: hero ? 50 : compact ? 40 : 48, height: hero ? 50 : compact ? 40 : 48, flexShrink: 0, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: hero ? 'secondary.main' : 'rgba(214,31,44,.1)', color: hero ? 'white' : 'secondary.main', boxShadow: hero ? '0 10px 24px rgba(214,31,44,.28)' : 'none' }}>
          <PaymentsRoundedIcon />
        </Box>
        <Box>
          {!compact && (
            <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".12em" lineHeight={1.4} display="block">
              Tuition financing
            </Typography>
          )}
          <Typography component="h2" variant={hero ? 'h5' : compact ? 'h6' : 'h4'} color="primary.main" fontWeight={950} letterSpacing="-.025em" lineHeight={1.15}>
            {title}
          </Typography>
        </Box>
      </Stack>
      <Typography color="text.secondary" lineHeight={1.7}>
        Financing options may be available to qualified students through our financing partner, <strong>{FINANCING_PARTNER}</strong>.
        {variant === 'inline' ? ' Applying is optional and does not affect your IMAN application.' : ''}
      </Typography>
      {authPending ? (
        <Stack spacing={1} aria-label="Checking student account">
          <Skeleton variant="rounded" width="100%" height={48} />
          <Skeleton width="75%" />
        </Stack>
      ) : studentCanApply ? (
        <>
          <LibertyFinancingButton onApply={recordReferral} />
          <Typography variant="body2" color="text.secondary">
            Opens {FINANCING_PARTNER}'s secure application in a new window. Keep this page open to continue with Iman Trucking School.{' '}
            <Link href={LIBERTY.l} target="_blank" rel="noopener noreferrer" fontWeight={700} color="primary.light" onClick={recordReferral}>
              Button not working? Open the application directly.
            </Link>
          </Typography>
        </>
      ) : (
        <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: hero ? 'rgba(7,26,51,.055)' : '#f3f6fa', border: 1, borderColor: 'divider' }}>
          <Typography fontWeight={900} color="primary.main">Start with your IMAN student account</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5, lineHeight: 1.6 }}>
            Create an account or sign in, confirm your current CDL eligibility category, then begin your CDL Training application before continuing securely to {FINANCING_PARTNER}.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              component={RouterLink}
              to="/portal/register?next=%2Fportal%2Fapply%2Ftraining%3Ffrom%3Dfinancing"
              variant="contained"
              color="secondary"
              startIcon={<PersonAddRoundedIcon />}
            >
              Create account
            </Button>
            <Button
              component={RouterLink}
              to="/portal/sign-in?next=%2Fportal%2Fapply%2Ftraining%3Ffrom%3Dfinancing"
              variant="outlined"
              color="primary"
              startIcon={<LoginRoundedIcon />}
            >
              Sign in
            </Button>
          </Stack>
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" component="p" sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5, lineHeight: 1.6 }}>
        {FINANCING_DISCLOSURE}
        {showLearnMore && (
          <>
            {' '}
            <Link component={RouterLink} to="/tuition-financing/" fontWeight={700} color="primary.light">Learn about tuition &amp; financing</Link>
          </>
        )}
      </Typography>
    </Stack>
  )

  if (variant === 'inline') {
    return (
      <Box sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, border: 1, borderColor: 'divider', bgcolor: '#f7f9fc' }}>
        {body}
      </Box>
    )
  }
  if (variant === 'hero') {
    return (
      <Box
        component="aside"
        aria-label="CDL training financing"
        sx={{
          position: 'relative', overflow: 'hidden', p: { xs: 2.5, sm: 3 },
          borderRadius: 4, bgcolor: 'rgba(255,255,255,.96)',
          border: '1px solid rgba(255,255,255,.75)',
          borderTop: '5px solid', borderTopColor: 'secondary.main',
          boxShadow: '0 28px 70px rgba(0,0,0,.3)',
          backdropFilter: 'blur(18px)',
          '&::after': {
            content: '""', position: 'absolute', width: 180, height: 180,
            right: -85, top: -90, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(214,31,44,.15), rgba(214,31,44,0) 70%)',
          },
        }}
      >
        {body}
      </Box>
    )
  }
  if (variant === 'card') {
    return (
      <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3, border: 1, borderColor: 'divider', boxShadow: '0 10px 30px rgba(8,8,95,.06)' }}>
        {body}
      </Paper>
    )
  }
  return (
    <Box component="section" aria-label="Tuition financing" sx={{ py: { xs: 6, md: 8 }, bgcolor: 'white' }}>
      <Container>
        <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 4, border: '1px solid #e5e8ef', borderLeft: '6px solid', borderLeftColor: 'secondary.main', boxShadow: '0 20px 55px rgba(7,26,51,.08)' }}>
          {body}
        </Paper>
      </Container>
    </Box>
  )
}
