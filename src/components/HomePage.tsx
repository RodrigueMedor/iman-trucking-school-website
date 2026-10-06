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
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import EngineeringRoundedIcon from '@mui/icons-material/EngineeringRounded'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded'
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded'
import QuizRoundedIcon from '@mui/icons-material/QuizRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import WorkRoundedIcon from '@mui/icons-material/WorkRounded'
import { Link as RouterLink } from 'react-router-dom'
import { useContent } from '../contexts/ContentContext'

export const advantages = [
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

export const curriculum = [
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
  const location = content('home', 'location', {
    section_label: 'ORLANDO CAMPUS',
    title: 'Train in Orlando',
    body: '21902 State Road 46\nMount Dora Florida 32757\n\nHave questions before applying? Our team is ready to help you understand your next step.',
    button_text: '(888) 991-4776',
    button_url: 'tel:8889914776',
  })
  const advantageItems = advantages.map((item, index) => ({
    ...item,
    managed: content('home', `advantage-${index + 1}`, {
      section_label: `Why choose item ${index + 1}`,
      title: item.title,
      body: item.text,
      sort_order: index + 10,
    }),
  }))
  const curriculumItems = curriculum.map((item, index) => content('home', `curriculum-${index + 1}`, {
    section_label: `Curriculum item ${index + 1}`,
    title: item,
    sort_order: index + 30,
  }))
  return (
    <>
      <Box component="section" sx={{ position: 'relative', bgcolor: 'white', py: { xs: 8, md: 11 }, overflow: 'hidden' }}>
        <Box aria-hidden="true" sx={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', right: -180, top: -180, bgcolor: 'rgba(214,31,44,.045)' }} />
        <Container>
          <Box maxWidth={790} mb={{ xs: 4.5, md: 6 }}>
            <Chip icon={<VerifiedRoundedIcon />} label="Choose your next step" color="secondary" variant="outlined" sx={{ mb: 2.5, fontWeight: 850, bgcolor: 'rgba(214,31,44,.04)' }} />
            <Typography component="h2" variant="h2" sx={{ fontSize: { xs: '2.25rem', md: '3.55rem' }, color: 'primary.main' }}>A clear path starts with the right first move.</Typography>
            <Typography sx={{ mt: 2.25, color: 'text.secondary', fontSize: '1.05rem', maxWidth: 700 }}>Whether you are comparing programs, planning how to pay, or ready to move forward, start with the information that matters most to you.</Typography>
          </Box>
          <Grid container spacing={2.25}>
            {[
              { icon: SchoolRoundedIcon, number: '01', eyebrow: 'Understand the training', title: 'Explore Class A CDL', text: 'See the skills, schedule, and hands-on experience included in the program.', action: 'View the program', to: '/class-a-cdl/' },
              { icon: AccountBalanceWalletRoundedIcon, number: '02', eyebrow: 'Plan with confidence', title: 'Review tuition & financing', text: 'Learn about program costs and the financing path available to qualified students.', action: 'See tuition options', to: '/tuition-financing/' },
              { icon: QuizRoundedIcon, number: '03', eyebrow: 'Find your starting point', title: 'Take the readiness check', text: 'Answer a few questions and get a clearer picture of your next CDL step.', action: 'Start the assessment', to: '/cdl-assessment/' },
            ].map(({ icon: Icon, number, eyebrow, title, text, action, to }, index) => (
              <Grid key={title} size={{ xs: 12, md: 4 }}>
                <Card sx={{ height: '100%', p: { xs: 3, md: 3.5 }, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: index === 2 ? 'rgba(214,31,44,.35)' : 'divider', bgcolor: index === 2 ? '#fffafb' : 'white', boxShadow: index === 2 ? '0 22px 55px rgba(169,13,24,.12)' : '0 14px 40px rgba(7,26,51,.06)', transition: 'transform .25s ease, box-shadow .25s ease', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 24px 55px rgba(7,26,51,.12)' } }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
                    <Avatar variant="rounded" sx={{ width: 54, height: 54, bgcolor: index === 2 ? 'secondary.main' : 'rgba(7,26,51,.07)', color: index === 2 ? 'white' : 'primary.main' }}><Icon /></Avatar>
                    <Typography fontWeight={950} color="rgba(7,26,51,.12)" fontSize="2rem">{number}</Typography>
                  </Stack>
                  <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".08em">{eyebrow}</Typography>
                  <Typography component="h3" variant="h5" color="primary.main" fontWeight={900} mt={.6}>{title}</Typography>
                  <Typography color="text.secondary" mt={1.25} mb={3}>{text}</Typography>
                  <Button component={RouterLink} to={to} variant={index === 2 ? 'contained' : 'text'} color={index === 2 ? 'secondary' : 'primary'} endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 'auto', px: index === 2 ? 2.25 : 0 }}>{action}</Button>
                </Card>
              </Grid>
            ))}
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
            {advantageItems.map(({ icon: Icon, managed }, index) => (
              <Grid key={managed.section_key} size={{ xs: 12, sm: 6, lg: 4 }}>
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
                  <Typography variant="h6" color="primary.main" fontWeight={900} mt={2.5}>{managed.title}</Typography>
                  <Typography color="text.secondary" mt={1}>{managed.body}</Typography>
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
                {curriculumItems.map((item) => (
                  <Stack
                    key={item.section_key}
                    direction="row"
                    spacing={1.5}
                    alignItems="flex-start"
                    sx={{ p: 1.75, borderRadius: 2, bgcolor: 'rgba(255,255,255,.065)', border: '1px solid rgba(255,255,255,.1)' }}
                  >
                    <CheckCircleRoundedIcon sx={{ mt: .15, color: '#ff6670', flex: '0 0 auto' }} />
                    <Typography color="rgba(255,255,255,.86)" fontWeight={650}>{item.title}</Typography>
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
                <Typography component="h2" variant="h4" color="primary.main" fontWeight={900} mt={2}>{location.title}</Typography>
                <Typography color="text.secondary" mt={1.5} sx={{ whiteSpace: 'pre-line' }}>{location.body}</Typography>
                <Button component="a" href={location.button_url || 'tel:8889914776'} variant="outlined" startIcon={<PhoneRoundedIcon />} sx={{ mt: 3 }}>
                  {location.button_text}
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  )
}
