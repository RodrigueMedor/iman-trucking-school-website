import { Box, Button, Link, Stack, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded'
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded'
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded'
import { Link as RouterLink } from 'react-router-dom'
import { ADMISSIONS_PHONE, ADMISSIONS_PHONE_HREF, FINANCING_DISCLOSURE } from '../../config/financing'
import { FinancingAction } from './FinancingCallout'

// Brand colors as used across the site: the header/logo navy and the logo red.
export const ROYAL = '#08085f'
export const RED = '#d61f2c'
const reducedMotion = '@media (prefers-reduced-motion: reduce)'

const BENEFITS = [
  { icon: SavingsRoundedIcon, title: 'Flexible Payments', body: 'Pay in full by card, or explore third-party financing that fits your budget.' },
  { icon: EditNoteRoundedIcon, title: 'Easy Application', body: 'A simple online process, with our team guiding you from the start.' },
  { icon: SupportAgentRoundedIcon, title: 'Personalized Support', body: 'Our admissions team helps you find the best option for your situation.' },
] as const

/** The three payment benefit cards in the homepage hero. */
export function FinancingBenefits() {
  return (
    <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: { xs: 1.5, md: 2 } }}>
      {BENEFITS.map(({ icon: Icon, title, body }) => (
        <Box
          component="li"
          key={title}
          sx={{
            p: { xs: 2.25, md: 2.5 }, borderRadius: '20px', bgcolor: 'rgba(255,255,255,.94)', backdropFilter: 'blur(8px)',
            border: '1px solid #e9ecf4', boxShadow: '0 18px 40px -28px rgba(8,8,95,.45)', textAlign: 'left',
            display: 'flex', flexDirection: { xs: 'row', sm: 'column' }, gap: 1.5, alignItems: 'flex-start',
            transition: 'transform .25s ease, box-shadow .25s ease, border-color .25s ease',
            '&:hover': { transform: 'translateY(-4px)', borderColor: 'rgba(214,31,44,.3)', boxShadow: '0 26px 50px -28px rgba(8,8,95,.55)' },
            '&:hover .benefit-icon': { background: `linear-gradient(135deg, #ef3a47, ${RED})`, color: 'white' },
            [reducedMotion]: { transition: 'none', '&:hover': { transform: 'none' } },
          }}
        >
          <Box className="benefit-icon" sx={{ width: 50, height: 50, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(214,31,44,.09)', color: RED, boxShadow: 'inset 0 0 0 6px rgba(255,255,255,.7)', transition: 'all .25s ease' }}>
            <Icon sx={{ fontSize: 25 }} />
          </Box>
          <Box>
            <Typography component="h3" sx={{ color: ROYAL, fontWeight: 900, fontSize: { xs: '1.02rem', md: '1.1rem' }, letterSpacing: '-.01em' }}>{title}</Typography>
            <Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: '.9rem', lineHeight: 1.55 }}>{body}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

/**
 * The financing call-to-action bar, the visitor's next step (Liberty's
 * application for students, account creation for everyone else) and the
 * lender disclosure.
 */
export function FinancingBar() {
  return (
    <Box id="financing">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        spacing={{ xs: 2.5, md: 3 }}
        sx={{
          p: { xs: 2.5, sm: 3 }, borderRadius: '24px',
          background: 'linear-gradient(100deg, #fdf0f1 0%, #ffffff 45%, #ffffff 100%)',
          border: '1px solid #ecdfe2', boxShadow: '0 24px 60px -30px rgba(8,8,95,.45)',
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ width: 60, height: 60, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'white', color: ROYAL, boxShadow: '0 10px 24px -10px rgba(8,8,95,.45), inset 0 0 0 2px rgba(214,31,44,.25)' }}>
            <PaymentsRoundedIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box sx={{ minWidth: 0, textAlign: 'left' }}>
            <Typography component="h2" sx={{ color: ROYAL, fontWeight: 950, fontSize: { xs: '1.2rem', md: '1.35rem' }, letterSpacing: '-.02em', lineHeight: 1.2 }}>
              Explore Your Financing Options Today
            </Typography>
            <Typography sx={{ mt: 0.4, color: 'text.secondary', fontSize: '.92rem' }}>Take the next step toward a better future with a CDL career.</Typography>
          </Box>
        </Stack>
        <Box sx={{ display: { xs: 'none', md: 'block' }, alignSelf: 'stretch', width: '1px', bgcolor: '#e5e8f0' }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ flexShrink: 0 }}>
          <Button
            component={RouterLink}
            to="/tuition-financing/"
            variant="contained"
            color="secondary"
            size="large"
            endIcon={<ArrowForwardRoundedIcon sx={{ transition: 'transform .2s ease' }} />}
            sx={{
              minHeight: 54, px: 3, whiteSpace: 'nowrap',
              background: `linear-gradient(135deg, #e8323f 0%, ${RED} 55%, #b5131f 100%)`,
              boxShadow: '0 14px 30px -10px rgba(214,31,44,.6)',
              '&:hover': { boxShadow: '0 18px 36px -10px rgba(214,31,44,.75)', '& .MuiButton-endIcon': { transform: 'translateX(3px)' } },
            }}
          >
            Explore Financing Options
          </Button>
          <Button
            component="a"
            href={ADMISSIONS_PHONE_HREF}
            variant="outlined"
            size="large"
            startIcon={<PhoneInTalkRoundedIcon />}
            aria-label={`Talk to admissions at ${ADMISSIONS_PHONE}`}
            sx={{ minHeight: 54, px: 3, whiteSpace: 'nowrap', color: ROYAL, borderWidth: 1.5, borderColor: ROYAL, '&:hover': { borderWidth: 1.5, borderColor: ROYAL, bgcolor: 'rgba(8,8,95,.05)' } }}
          >
            Talk to Admissions
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ mt: 1.75, px: { xs: 0.5, md: 1 }, textAlign: 'left' }}>
        <FinancingAction row />
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5, fontSize: '.7rem', lineHeight: 1.55 }}>
          {FINANCING_DISCLOSURE}{' '}
          <Link component={RouterLink} to="/tuition-financing/" fontWeight={700} color="primary.light">Learn about tuition &amp; financing</Link>
        </Typography>
      </Box>
    </Box>
  )
}
