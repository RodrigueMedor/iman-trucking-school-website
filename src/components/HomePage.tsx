import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded'
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import EngineeringRoundedIcon from '@mui/icons-material/EngineeringRounded'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded'
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import WorkRoundedIcon from '@mui/icons-material/WorkRounded'
import { Link as RouterLink } from 'react-router-dom'
import { useContent } from '../contexts/ContentContext'

const advantages = [
  {
    icon: SchoolRoundedIcon,
    title: 'Comprehensive CDL Training',
    text: 'Build the knowledge and confidence required for a Class A CDL through focused classroom instruction and practical training.',
  },
  {
    icon: EngineeringRoundedIcon,
    title: 'Experienced Instructors',
    text: 'Learn from professionals who understand the road, the industry, and how to guide new drivers through every stage.',
  },
  {
    icon: LocalShippingRoundedIcon,
    title: 'Modern Training Equipment',
    text: 'Practice with industry-standard trucks and trailers so your training feels relevant to the work you are preparing to do.',
  },
  {
    icon: CalendarMonthRoundedIcon,
    title: 'Flexible Scheduling',
    text: 'Day, evening, and weekend options help make professional training possible around work and family responsibilities.',
  },
  {
    icon: WorkRoundedIcon,
    title: 'Job Placement Assistance',
    text: 'Receive career support and access to employer connections that can help you move from training into the workforce.',
  },
  {
    icon: SupportAgentRoundedIcon,
    title: 'Personal Student Support',
    text: 'From your first question through graduation, our team is available to provide clear guidance and encouragement.',
  },
] as const

const curriculum = [
  'Hands-on driving experience at our facility and on public roads',
  'Pre-trip inspection preparation for the CDL skills exam',
  'Map reading, trip planning, road signs, and DOT regulations',
  'Route planning, logbook management, and compliance fundamentals',
  'Preventive maintenance and tractor-trailer safety awareness',
  'Backing, turning, coupling, and uncoupling a 53-foot trailer',
] as const

function openEnrollment() {
  window.postMessage({ type: 'iman-open-enrollment' }, window.location.origin)
}

export function HomePage() {
  const { content } = useContent()
  const overview = content('home', 'overview', {
    section_label: 'A better way to begin your driving career',
    title: 'Training built for the road ahead.',
    body: 'At Iman Trucking School, we combine practical Class A CDL instruction, experienced guidance, and personalized support to help students prepare for a professional career in trucking.',
    button_text: 'Request information',
    button_url: '/contact-form/',
  })
  const why = content('home', 'why-choose', {
    section_label: 'Why choose Iman',
    title: 'Everything you need to train with confidence.',
    body: 'A supportive, practical learning experience designed around the needs of aspiring professional drivers.',
  })
  const program = content('home', 'program', {
    section_label: 'Class A CDL program',
    title: 'Practical preparation for real driving responsibilities.',
    body: 'Our program brings classroom fundamentals and hands-on practice together, helping students understand the vehicle, the rules, and the decisions professional drivers make every day.',
    button_text: 'Explore Class A CDL',
    button_url: '/class-a-cdl/',
  })
  const enrollment = content('home', 'enrollment', {
    section_label: 'ENROLLMENT',
    title: 'Accelerate your earnings with a CDL in just 4 weeks.',
    body: 'Speak with admissions about upcoming classes, scheduling options, program requirements, and the support available to help you begin.',
    button_text: 'Open enrollment form',
    button_url: '/contact-form/',
  })
  return (
    <>
      <Box component="section" sx={{ bgcolor: 'white', py: { xs: 8, md: 12 } }}>
        <Container>
          <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center">
            <Grid size={{ xs: 12, md: 5 }}>
              <Chip
                icon={<VerifiedRoundedIcon />}
                label={overview.section_label}
                color="secondary"
                variant="outlined"
                sx={{ mb: 2.5, fontWeight: 850, bgcolor: 'rgba(214,31,44,.04)' }}
              />
              <Typography component="h2" variant="h2" sx={{ fontSize: { xs: '2.25rem', md: '3.55rem' }, color: 'primary.main' }}>
                {overview.title}
              </Typography>
              <Typography sx={{ mt: 2.5, color: 'text.secondary', fontSize: '1.05rem' }}>
                {overview.body}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mt={3.5}>
                <Button onClick={openEnrollment} variant="contained" color="secondary" endIcon={<ArrowForwardRoundedIcon />}>
                  {overview.button_text}
                </Button>
                <Button component={RouterLink} to="/our-program/" variant="outlined">
                  View our program
                </Button>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Box
                sx={{
                  position: 'relative',
                  minHeight: { xs: 390, sm: 500 },
                  borderRadius: { xs: 3, md: 5 },
                  backgroundImage: 'linear-gradient(180deg, transparent 48%, rgba(7,26,51,.84)), url(/images/home-hero-2.jpg)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  boxShadow: '0 30px 70px rgba(7,26,51,.18)',
                  overflow: 'hidden',
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    position: 'absolute',
                    right: { xs: 16, sm: 28 },
                    bottom: { xs: 16, sm: 28 },
                    left: { xs: 16, sm: 'auto' },
                    width: { sm: 310 },
                    p: 2.25,
                    color: 'white',
                    bgcolor: 'rgba(7,26,51,.86)',
                    border: '1px solid rgba(255,255,255,.18)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: 'secondary.main' }}><SchoolRoundedIcon /></Avatar>
                    <Box>
                      <Typography fontWeight={900}>Career-focused training</Typography>
                      <Typography variant="body2" color="rgba(255,255,255,.7)">Learn skills you can take to the road.</Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box component="section" sx={{ bgcolor: '#f5f7fb', py: { xs: 8, md: 12 } }}>
        <Container>
          <Box textAlign="center" maxWidth={780} mx="auto" mb={{ xs: 5, md: 7 }}>
            <Typography color="secondary.main" fontWeight={900} letterSpacing=".12em" textTransform="uppercase" variant="overline">
              {why.section_label}
            </Typography>
            <Typography component="h2" variant="h2" sx={{ mt: 1, fontSize: { xs: '2.15rem', md: '3.4rem' }, color: 'primary.main' }}>
              {why.title}
            </Typography>
            <Typography color="text.secondary" mt={2}>
              {why.body}
            </Typography>
          </Box>
          <Grid container spacing={2.5}>
            {advantages.map(({ icon: Icon, title, text }, index) => (
              <Grid key={title} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card
                  sx={{
                    height: '100%',
                    p: 3.25,
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: '0 12px 35px rgba(7,26,51,.06)',
                    transition: 'transform .25s ease, box-shadow .25s ease, border-color .25s ease',
                    '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 24px 50px rgba(7,26,51,.12)', borderColor: 'rgba(214,31,44,.3)' },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Avatar variant="rounded" sx={{ width: 52, height: 52, bgcolor: 'rgba(214,31,44,.09)', color: 'secondary.main' }}>
                      <Icon />
                    </Avatar>
                    <Typography color="rgba(7,26,51,.08)" fontWeight={900} fontSize="2rem">{String(index + 1).padStart(2, '0')}</Typography>
                  </Stack>
                  <Typography variant="h6" color="primary.main" fontWeight={900} mt={2.5}>{title}</Typography>
                  <Typography color="text.secondary" mt={1}>{text}</Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box component="section" sx={{ bgcolor: 'primary.main', color: 'white', py: { xs: 8, md: 12 }, overflow: 'hidden' }}>
        <Container>
          <Grid container spacing={{ xs: 5, md: 9 }} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography color="#ff6670" fontWeight={900} letterSpacing=".12em" textTransform="uppercase" variant="overline">
                {program.section_label}
              </Typography>
              <Typography component="h2" variant="h2" sx={{ mt: 1, color: 'white', fontSize: { xs: '2.2rem', md: '3.5rem' } }}>
                {program.title}
              </Typography>
              <Typography color="rgba(255,255,255,.7)" mt={2.5} fontSize="1.05rem">
                {program.body}
              </Typography>
              <Button component={RouterLink} to={program.button_url || '/class-a-cdl/'} variant="contained" color="secondary" endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 3.5 }}>
                {program.button_text}
              </Button>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={1.35}>
                {curriculum.map((item) => (
                  <Stack
                    key={item}
                    direction="row"
                    spacing={1.5}
                    alignItems="flex-start"
                    sx={{ p: 1.75, borderRadius: 2, bgcolor: 'rgba(255,255,255,.065)', border: '1px solid rgba(255,255,255,.1)' }}
                  >
                    <CheckCircleRoundedIcon sx={{ mt: .15, color: '#ff6670', flex: '0 0 auto' }} />
                    <Typography color="rgba(255,255,255,.86)" fontWeight={650}>{item}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box component="section" sx={{ bgcolor: 'white', py: { xs: 8, md: 12 } }}>
        <Container>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper
                sx={{
                  height: '100%',
                  p: { xs: 3.5, md: 5 },
                  color: 'white',
                  background: 'linear-gradient(135deg, #d61f2c 0%, #a90d18 100%)',
                  boxShadow: '0 25px 55px rgba(169,13,24,.2)',
                }}
              >
                <AutoStoriesRoundedIcon sx={{ fontSize: 42, color: 'rgba(255,255,255,.8)' }} />
                <Typography component="h2" variant="h3" sx={{ mt: 2, color: 'white', fontSize: { xs: '2rem', md: '2.75rem' } }}>
                  {enrollment.title}
                </Typography>
                <Typography mt={2} color="rgba(255,255,255,.8)" maxWidth={650}>
                  {enrollment.body}
                </Typography>
                <Button onClick={openEnrollment} variant="contained" sx={{ mt: 3.5, bgcolor: 'white', color: 'secondary.dark', '&:hover': { bgcolor: '#f6f7fb' } }} endIcon={<ArrowForwardRoundedIcon />}>
                  {enrollment.button_text}
                </Button>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Paper variant="outlined" sx={{ height: '100%', p: { xs: 3.5, md: 5 }, borderColor: 'divider' }}>
                <LocationOnRoundedIcon color="secondary" sx={{ fontSize: 38 }} />
                <Typography component="h2" variant="h4" color="primary.main" fontWeight={900} mt={2}>Train in Orlando</Typography>
                <Typography color="text.secondary" mt={1.5}>
                  5104 N Orange Blossom Trail, Suite 205<br />Orlando, FL 32810
                </Typography>
                <Typography color="text.secondary" mt={2}>
                  Have questions before applying? Our team is ready to help you understand your next step.
                </Typography>
                <Button component="a" href="tel:8889914776" variant="outlined" startIcon={<PhoneRoundedIcon />} sx={{ mt: 3 }}>
                  (888) 991-4776
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  )
}
