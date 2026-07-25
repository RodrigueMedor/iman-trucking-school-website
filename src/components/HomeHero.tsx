import { Box, Button, Container, Stack, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { Link as RouterLink } from 'react-router-dom'

export function HomeHero() {
  return <>
    <Box
      component="section"
      sx={{
        position: 'relative',
        minHeight: { xs: 620, md: 700 },
        display: 'grid',
        alignItems: 'center',
        overflow: 'hidden',
        color: 'white',
        backgroundImage: 'linear-gradient(90deg, rgba(4,18,38,.96) 0%, rgba(4,18,38,.82) 43%, rgba(4,18,38,.18) 78%), url(/images/home-hero.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: { xs: '62% center', md: 'center 45%' },
      }}
    >
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 65%, rgba(4,18,38,.75))' }} />
      <Container sx={{ position: 'relative', py: { xs: 9, md: 12 } }}>
        <Box maxWidth={700}>
          <Typography component="p" sx={{ display: 'inline-flex', px: 1.5, py: .75, mb: 2.5, border: '1px solid rgba(255,255,255,.28)', borderRadius: 20, bgcolor: 'rgba(255,255,255,.08)', backdropFilter: 'blur(8px)', fontSize: '.78rem', fontWeight: 900, letterSpacing: '.11em', textTransform: 'uppercase' }}>
            Orlando’s career-focused CDL school
          </Typography>
          <Typography component="h1" variant="h1" sx={{ color: 'white', fontSize: { xs: '3rem', sm: '4rem', md: '5.2rem' }, lineHeight: .98, maxWidth: 680 }}>
            Your road to a professional driving career.
          </Typography>
          <Typography sx={{ mt: 3, mb: 3.5, maxWidth: 610, color: 'rgba(255,255,255,.82)', fontSize: { xs: '1.05rem', md: '1.2rem' }, lineHeight: 1.7 }}>
            Build real-world driving skills with experienced instructors, hands-on Class A CDL training, and support from enrollment through graduation.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button component={RouterLink} to="/contact-form/" variant="contained" color="secondary" size="large" endIcon={<ArrowForwardRoundedIcon />} sx={{ minHeight: 54, px: 3, boxShadow: '0 15px 35px rgba(214,31,44,.3)' }}>
              Start your application
            </Button>
            <Button component={RouterLink} to="/our-program/" variant="outlined" size="large" sx={{ minHeight: 54, px: 3, color: 'white', borderColor: 'rgba(255,255,255,.5)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,.08)' } }}>
              Explore the program
            </Button>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }} mt={4}>
            {['Hands-on training', 'Flexible schedules', 'Financing available'].map(item => (
              <Stack key={item} direction="row" spacing={.8} alignItems="center">
                <CheckCircleRoundedIcon sx={{ color: '#ff5964', fontSize: 20 }} />
                <Typography fontWeight={800} fontSize=".88rem">{item}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Container>
    </Box>
    <Box sx={{ bgcolor: 'white', borderBottom: '1px solid', borderColor: 'divider' }}>
      <Container>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={2} py={2.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Stack direction="row" spacing={-.4}>{[1, 2, 3, 4, 5].map(star => <StarRoundedIcon key={star} sx={{ color: '#f5a623' }} />)}</Stack>
            <Box><Typography fontWeight={900} color="primary.main">Trusted by aspiring drivers</Typography><Typography variant="body2" color="text.secondary">Practical training. Personal support. Career confidence.</Typography></Box>
          </Stack>
          <Stack direction="row" spacing={{ xs: 2.5, sm: 5 }}>
            <Box><Typography fontWeight={900} fontSize="1.45rem" color="primary.main">4 weeks</Typography><Typography variant="caption" color="text.secondary">Focused CDL training</Typography></Box>
            <Box><Typography fontWeight={900} fontSize="1.45rem" color="primary.main">Class A</Typography><Typography variant="caption" color="text.secondary">Career-ready program</Typography></Box>
            <Box><Typography fontWeight={900} fontSize="1.45rem" color="primary.main">Orlando</Typography><Typography variant="caption" color="text.secondary">Convenient location</Typography></Box>
          </Stack>
        </Stack>
      </Container>
    </Box>
  </>
}
