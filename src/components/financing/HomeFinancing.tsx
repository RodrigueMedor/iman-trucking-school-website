import { Box, Button, Link, Stack, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded'
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded'
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded'
import { Link as RouterLink } from 'react-router-dom'
import { ADMISSIONS_PHONE, ADMISSIONS_PHONE_HREF, FINANCING_DISCLOSURE, FINANCING_PARTNER } from '../../config/financing'
import { FinancingAction } from './FinancingCallout'

// Brand colors as used across the site: the header/logo navy and the logo red.
const ROYAL = '#08085f'
const RED = '#d61f2c'
const reducedMotion = '@media (prefers-reduced-motion: reduce)'

const BENEFITS = [
  { icon: SavingsRoundedIcon, title: 'Flexible Payments', body: 'Pay in full by card, or explore financing.' },
  { icon: EditNoteRoundedIcon, title: 'Easy Application', body: 'Simple online process, guided by our team.' },
  { icon: SupportAgentRoundedIcon, title: 'Personalized Support', body: 'Admissions helps you find the best option.' },
] as const

/**
 * Financing panel along the bottom of the homepage hero: the payment
 * headline, three benefits, the financing and admissions calls to action,
 * the visitor's next step and the lender disclosure.
 */
export function HomeFinancing() {
  return (
    <Box
      component="aside"
      id="financing"
      aria-labelledby="home-financing-title"
      sx={{
        position: 'relative', mt: { xs: 5, md: 7 }, borderRadius: { xs: '22px', md: '28px' }, overflow: 'hidden', color: 'text.primary',
        bgcolor: 'rgba(255,255,255,.96)', backdropFilter: 'blur(18px)',
        border: '1px solid rgba(255,255,255,.7)', boxShadow: '0 30px 80px -30px rgba(0,0,0,.65)',
        '&::before': { content: '""', position: 'absolute', left: 0, right: 0, top: 0, height: 4, background: `linear-gradient(90deg, ${RED}, #ff6b74 45%, ${ROYAL})` },
      }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.15fr 1.1fr auto' }, gap: { xs: 2.5, lg: 3.5 }, alignItems: 'center', p: { xs: 2.5, sm: 3, lg: 3.5 } }}>
        <Box>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ display: 'inline-flex', px: 1.25, py: 0.4, borderRadius: 20, bgcolor: 'rgba(214,31,44,.08)' }}>
            <SchoolRoundedIcon sx={{ fontSize: 16, color: RED }} />
            <Typography component="span" sx={{ color: RED, fontSize: '.66rem', fontWeight: 950, letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Flexible training payment options
            </Typography>
          </Stack>
          <Typography id="home-financing-title" component="h2" sx={{ mt: 1.25, color: ROYAL, fontWeight: 950, letterSpacing: '-.03em', lineHeight: 1.08, fontSize: { xs: '1.6rem', sm: '1.9rem', lg: '2rem' } }}>
            Your CDL Dream. <Box component="span" sx={{ color: RED }}>Your Future.</Box> Your Payment Plan.
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: '.9rem', lineHeight: 1.55 }}>
            Financing may be available to qualified students through <Box component="strong" sx={{ color: ROYAL }}>{FINANCING_PARTNER}</Box>.
          </Typography>
        </Box>

        <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)', lg: '1fr' }, gap: { xs: 1.25, lg: 0.75 } }}>
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <Box
              component="li"
              key={title}
              sx={{
                p: { xs: 1.75, lg: 1.1 }, px: { lg: 1.5 }, borderRadius: '16px', bgcolor: '#f6f7fb', border: '1px solid #eceef5',
                display: 'flex', flexDirection: { xs: 'row', sm: 'column', lg: 'row' }, gap: { xs: 1, lg: 1.5 }, alignItems: { xs: 'flex-start', lg: 'center' },
                transition: 'transform .25s ease, box-shadow .25s ease, background-color .25s ease',
                '&:hover': { transform: { xs: 'translateY(-3px)', lg: 'translateX(3px)' }, bgcolor: 'white', boxShadow: '0 16px 34px -20px rgba(8,8,95,.5)' },
                '&:hover .benefit-icon': { bgcolor: RED, color: 'white' },
                [reducedMotion]: { transition: 'none', '&:hover': { transform: 'none' } },
              }}
            >
              <Box className="benefit-icon" sx={{ width: 38, height: 38, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(214,31,44,.1)', color: RED, transition: 'all .25s ease' }}>
                <Icon sx={{ fontSize: 20 }} />
              </Box>
              <Box>
                <Typography component="h3" sx={{ color: ROYAL, fontWeight: 900, fontSize: '.92rem', lineHeight: 1.25 }}>{title}</Typography>
                <Typography sx={{ mt: 0.25, color: 'text.secondary', fontSize: '.8rem', lineHeight: 1.45 }}>{body}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Stack spacing={1.1} sx={{ minWidth: { lg: 250 } }}>
          <Button
            component={RouterLink}
            to="/tuition-financing/"
            variant="contained"
            color="secondary"
            size="large"
            endIcon={<ArrowForwardRoundedIcon sx={{ transition: 'transform .2s ease' }} />}
            sx={{
              minHeight: 52, whiteSpace: 'nowrap',
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
            sx={{ minHeight: 50, whiteSpace: 'nowrap', color: ROYAL, borderWidth: 1.5, borderColor: ROYAL, '&:hover': { borderWidth: 1.5, borderColor: ROYAL, bgcolor: 'rgba(8,8,95,.05)' } }}
          >
            Talk to Admissions
          </Button>
        </Stack>
      </Box>

      {/* The visitor's next step and the lender disclosure. */}
      <Box sx={{ px: { xs: 2.5, sm: 3, lg: 3.5 }, py: { xs: 2, lg: 1.75 }, borderTop: '1px solid #eceef5', bgcolor: 'rgba(246,247,251,.9)' }}>
        <FinancingAction row />
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.25, fontSize: '.68rem', lineHeight: 1.5 }}>
          {FINANCING_DISCLOSURE}{' '}
          <Link component={RouterLink} to="/tuition-financing/" fontWeight={700} color="primary.light">Learn about tuition &amp; financing</Link>
        </Typography>
      </Box>
    </Box>
  )
}
