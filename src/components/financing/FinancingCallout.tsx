import { Box, Container, Link, Paper, Stack, Typography } from '@mui/material'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import { Link as RouterLink } from 'react-router-dom'
import { FINANCING_DISCLOSURE, FINANCING_PARTNER, LIBERTY } from '../../config/financing'
import { LibertyFinancingButton } from './LibertyFinancingButton'

type Variant = 'section' | 'card' | 'inline'

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

  const body = (
    <Stack spacing={compact ? 1.5 : 2} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ width: compact ? 40 : 48, height: compact ? 40 : 48, flexShrink: 0, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(214,31,44,.1)', color: 'secondary.main' }}>
          <PaymentsRoundedIcon />
        </Box>
        <Box>
          {!compact && (
            <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".12em" lineHeight={1.4} display="block">
              Tuition financing
            </Typography>
          )}
          <Typography component="h2" variant={compact ? 'h6' : 'h4'} color="primary.main" fontWeight={950} letterSpacing="-.02em">
            {title}
          </Typography>
        </Box>
      </Stack>
      <Typography color="text.secondary" lineHeight={1.7}>
        Financing options may be available to qualified students through our financing partner, <strong>{FINANCING_PARTNER}</strong>.
        {variant === 'inline' ? ' Applying is optional and does not affect your IMAN application.' : ''}
      </Typography>
      <LibertyFinancingButton />
      <Typography variant="body2" color="text.secondary">
        Opens {FINANCING_PARTNER}'s secure application in a new window. Keep this page open to continue with Iman Trucking School.{' '}
        <Link href={LIBERTY.l} target="_blank" rel="noopener noreferrer" fontWeight={700} color="primary.light">
          Button not working? Open the application directly.
        </Link>
      </Typography>
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
