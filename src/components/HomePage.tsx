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
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded'
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import DirectionsRoundedIcon from '@mui/icons-material/DirectionsRounded'
import EngineeringRoundedIcon from '@mui/icons-material/EngineeringRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded'
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded'
import QuizRoundedIcon from '@mui/icons-material/QuizRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded'
import TrafficRoundedIcon from '@mui/icons-material/TrafficRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import WorkRoundedIcon from '@mui/icons-material/WorkRounded'
import { Link as RouterLink } from 'react-router-dom'
import { useContent } from '../contexts/ContentContext'
import { HOME_FAQ_PREVIEW_COUNT } from '../config/cdlFaq'
import { APPLY_PATH } from '../navigation'
import { FaqAccordions, useCdlFaq } from './CdlFaq'

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

// General licensing information (not Iman-specific). Each item links to the
// matching section of the full guide so the homepage only summarizes it.
const cdlSteps = [
  { title: 'Understand CDL requirements', text: 'Check the age, license, residency and medical requirements for a Class A CDL in Florida.', to: '/how-to-get-a-cdl/#requirements' },
  { title: 'Get your learner’s permit', text: 'Pass the knowledge tests at a driver license office to earn your Commercial Learner’s Permit (CLP).', to: '/how-to-get-a-cdl/#clp' },
  { title: 'Complete required training', text: 'Finish Entry-Level Driver Training: theory instruction plus behind-the-wheel practice with a registered provider.', to: '/how-to-get-a-cdl/#eldt' },
  { title: 'Prepare your documents', text: 'Gather proof of identity, Social Security number, address and Florida residency, plus medical certification if required.', to: '/how-to-get-a-cdl/#documents' },
  { title: 'Pass the skills test', text: 'After holding your CLP for at least 14 days, pass the vehicle inspection, basic control and road tests.', to: '/how-to-get-a-cdl/#skills-test' },
  { title: 'Receive your CDL', text: 'Have your CDL issued at a Florida driver license office and keep your medical certification current.', to: '/how-to-get-a-cdl/#after-the-test' },
] as const

const cdlBasics = [
  { icon: VerifiedRoundedIcon, title: 'Why it is required', text: 'Heavy commercial vehicles take more skill to control, stop and inspect safely, so federal rules require a special license to drive them.' },
  { icon: LocalShippingRoundedIcon, title: 'Vehicles that need one', text: 'Tractor-trailers, many straight trucks and buses, and vehicles carrying placarded hazardous materials.' },
  { icon: BadgeRoundedIcon, title: 'Class A at a glance', text: 'Class A covers combination vehicles of 26,001 lbs or more when the trailer is over 10,000 lbs, the license most tractor-trailer drivers hold.' },
  { icon: WorkRoundedIcon, title: 'Career opportunities', text: 'Class A drivers work in local delivery, regional and long-haul routes, and specialized freight with the right endorsements.' },
] as const

const requirementsChecklist = [
  'A valid driver’s license',
  'At least 18 years old (21 to drive interstate or haul hazardous materials)',
  'Proof of identity and Florida residency',
  'Medical certification when your driving category requires it',
  'A Commercial Learner’s Permit held at least 14 days before the skills test',
  'Entry-Level Driver Training from a registered provider',
] as const

const documentsChecklist = [
  'Proof of identity',
  'Proof of Social Security number',
  'Proof of residential address',
  'Proof of Florida residency',
  'Your current driver’s license',
  'Medical certification, if required',
] as const

const skillsTestParts = [
  { icon: FactCheckRoundedIcon, title: 'Vehicle inspection', text: 'Show that the truck is safe to drive by inspecting it and explaining what you check and why.' },
  { icon: DirectionsRoundedIcon, title: 'Basic vehicle control', text: 'Complete backing and maneuvering exercises within a marked area while controlling the vehicle precisely.' },
  { icon: TrafficRoundedIcon, title: 'On-road driving', text: 'Drive in real traffic while the examiner scores your safety, observation and control.' },
] as const

const otherPrograms = [
  { icon: QuizRoundedIcon, title: 'English Language Proficiency (ELP)', text: 'An online English Language Proficiency test and in-person evaluation to check your readiness before training or testing.', action: 'About the assessment', to: '/cdl-assessment/' },
  { icon: AccountBalanceWalletRoundedIcon, title: 'Tuition & Financing', text: 'Program costs and financing through Liberty Career Finance for students who qualify.', action: 'See tuition options', to: '/tuition-financing/' },
  { icon: AssignmentTurnedInRoundedIcon, title: 'Amazon Career Choice', text: 'Eligible Amazon associates may be able to use Career Choice education benefits toward training.', action: 'Learn how it works', to: '/amazon-career-choice/' },
] as const

const cardSx = {
  height: '100%',
  p: { xs: 3, md: 3.5 },
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: '0 14px 40px rgba(7,26,51,.06)',
  transition: 'transform .25s ease, box-shadow .25s ease',
  '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 24px 55px rgba(7,26,51,.12)' },
} as const

function SectionHeading({ label, title, body, center = false, id }: { label: string; title: string; body?: string; center?: boolean; id?: string }) {
  return (
    <Box maxWidth={center ? 780 : 790} mx={center ? 'auto' : 0} textAlign={center ? 'center' : 'left'} mb={{ xs: 4.5, md: 6 }}>
      <Typography color="secondary.main" fontWeight={900} letterSpacing=".12em" textTransform="uppercase" variant="overline">{label}</Typography>
      <Typography id={id} component="h2" variant="h2" sx={{ mt: 1, fontSize: { xs: '2.15rem', md: '3.4rem' }, color: 'primary.main' }}>{title}</Typography>
      {body && <Typography color="text.secondary" mt={2} fontSize="1.05rem">{body}</Typography>}
    </Box>
  )
}

/** The "Why choose Iman" grid. Shown on the About Us page; edits live under the home page keys. */
export function WhyChooseIman() {
  const { content } = useContent()
  const why = content('home', 'why-choose', {
    section_label: 'Why choose Iman',
    title: 'Everything you need to train with confidence.',
    body: 'A supportive, practical learning experience designed around the needs of aspiring professional drivers.',
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
  return (
    <Box component="section" sx={{ bgcolor: '#f5f7fb', py: { xs: 8, md: 12 } }}>
      <Container>
        <SectionHeading center label={why.section_label} title={why.title} body={why.body} />
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
                  <Typography aria-hidden color="rgba(7,26,51,.08)" fontWeight={900} fontSize="2rem">{String(index + 1).padStart(2, '0')}</Typography>
                </Stack>
                <Typography component="h3" variant="h6" color="primary.main" fontWeight={900} mt={2.5}>{managed.title}</Typography>
                <Typography color="text.secondary" mt={1}>{managed.body}</Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

function Checklist({ items }: { items: readonly string[] }) {
  return (
    <Stack component="ul" spacing={1.25} sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {items.map(item => (
        <Stack key={item} component="li" direction="row" spacing={1.2} alignItems="flex-start" sx={{ p: 1.75, border: '1px solid #e7eaf0', borderRadius: 2, bgcolor: '#fafbfc' }}>
          <CheckCircleRoundedIcon sx={{ mt: 0.15, color: 'secondary.main', fontSize: 20 }} />
          <Typography color="#26364a" fontWeight={700} lineHeight={1.55}>{item}</Typography>
        </Stack>
      ))}
    </Stack>
  )
}

export function HomePage() {
  const { content } = useContent()
  const program = content('home', 'program', {
    section_label: 'CDL training at Iman',
    title: 'Practical preparation for real driving responsibilities.',
    body: 'Iman’s Class A program brings classroom (theory) instruction and behind-the-wheel practice together, preparing you for the knowledge tests, the vehicle inspection, basic control maneuvers and road driving.',
    button_text: 'View CDL training',
    button_url: '/cdl-training/',
  })
  const enrollment = content('home', 'enrollment', {
    section_label: 'NEXT STEP',
    title: 'Ready to Take the Next Step?',
    body: 'Apply online in minutes and track your status from your student portal, or talk with admissions about upcoming start dates, requirements and financing.',
  })
  const location = content('home', 'location', {
    section_label: 'ORLANDO CAMPUS',
    title: 'Train in Orlando',
    body: '21902 State Road 46\nMount Dora Florida 32757\n\nHave questions before applying? Our team is ready to help you understand your next step.',
    button_text: '(888) 991-4776',
    button_url: 'tel:8889914776',
  })
  const curriculumItems = curriculum.map((item, index) => content('home', `curriculum-${index + 1}`, {
    section_label: `Curriculum item ${index + 1}`,
    title: item,
    sort_order: index + 30,
  }))
  const faqPreview = useCdlFaq().slice(0, HOME_FAQ_PREVIEW_COUNT)
  // Legacy content entries may point at retired URLs; those still redirect,
  // but link straight to the new page.
  const programUrl = program.button_url && program.button_url !== '/class-a-cdl/' ? program.button_url : '/cdl-training/'

  return (
    <>
      {/* 2. What is a CDL? */}
      <Box component="section" aria-labelledby="what-is-a-cdl" sx={{ position: 'relative', bgcolor: 'white', py: { xs: 8, md: 11 }, overflow: 'hidden' }}>
        <Box aria-hidden="true" sx={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', right: -180, top: -180, bgcolor: 'rgba(214,31,44,.045)' }} />
        <Container>
          <Grid container spacing={{ xs: 4, md: 7 }} alignItems="center">
            <Grid size={{ xs: 12, md: 5 }}>
              <Chip icon={<VerifiedRoundedIcon />} label="CDL basics" color="secondary" variant="outlined" sx={{ mb: 2.5, fontWeight: 850, bgcolor: 'rgba(214,31,44,.04)' }} />
              <Typography id="what-is-a-cdl" component="h2" variant="h2" sx={{ fontSize: { xs: '2.25rem', md: '3.4rem' }, color: 'primary.main' }}>What is a CDL?</Typography>
              <Typography sx={{ mt: 2.25, color: 'text.secondary', fontSize: '1.05rem' }}>
                A Commercial Driver’s License (CDL) is the state-issued license you need to drive large or specialized commercial vehicles. A Class A CDL is the license for tractor-trailers and the starting point for most professional trucking careers.
              </Typography>
              <Button component={RouterLink} to="/how-to-get-a-cdl/#what-is-a-cdl" endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 2.5, px: 0 }}>Read the full CDL guide</Button>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Grid container spacing={2.25}>
                {cdlBasics.map(({ icon: Icon, title, text }) => (
                  <Grid key={title} size={{ xs: 12, sm: 6 }}>
                    <Card sx={cardSx}>
                      <Avatar variant="rounded" sx={{ width: 48, height: 48, bgcolor: 'rgba(7,26,51,.07)', color: 'primary.main' }}><Icon /></Avatar>
                      <Typography component="h3" variant="h6" color="primary.main" fontWeight={900} mt={2}>{title}</Typography>
                      <Typography color="text.secondary" mt={1}>{text}</Typography>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* 3. How to get your CDL */}
      <Box component="section" aria-labelledby="how-to-get-your-cdl" sx={{ bgcolor: '#f5f7fb', py: { xs: 8, md: 12 } }}>
        <Container>
          <SectionHeading id="how-to-get-your-cdl" label="Step by step" title="How to get your CDL" body="Six milestones take you from your first question to a Class A license. Each step links to the details in our CDL guide." />
          <Grid container spacing={2.25}>
            {cdlSteps.map(({ title, text, to }, index) => (
              <Grid key={title} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card sx={{ ...cardSx, display: 'flex', flexDirection: 'column', ...(index === 5 && { borderColor: 'rgba(214,31,44,.35)', bgcolor: '#fffafb' }) }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
                    <Avatar variant="rounded" sx={{ width: 54, height: 54, bgcolor: index === 5 ? 'secondary.main' : 'rgba(7,26,51,.07)', color: index === 5 ? 'white' : 'primary.main', fontWeight: 950 }}>{index + 1}</Avatar>
                    <Typography aria-hidden fontWeight={950} color="rgba(7,26,51,.12)" fontSize="2rem">{String(index + 1).padStart(2, '0')}</Typography>
                  </Stack>
                  <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".08em">Step {index + 1}</Typography>
                  <Typography component="h3" variant="h5" color="primary.main" fontWeight={900} mt={.6}>{title}</Typography>
                  <Typography color="text.secondary" mt={1.25} mb={3}>{text}</Typography>
                  <Button component={RouterLink} to={to} endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 'auto', px: 0, alignSelf: 'flex-start' }} aria-label={`Learn more: ${title}`}>Learn more</Button>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* 4. CDL training at Iman (Iman's own program) */}
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
              <Typography color="rgba(255,255,255,.7)" mt={1.5} fontSize="1.05rem">
                First-time Class A applicants must also complete federal Entry-Level Driver Training before the skills test.{' '}
                <Typography component={RouterLink} to="/how-to-get-a-cdl/#eldt" color="white" fontWeight={800}>How ELDT works</Typography>
              </Typography>
              <Button component={RouterLink} to={programUrl} variant="contained" color="secondary" endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 3.5 }}>
                {program.button_text || 'View CDL training'}
              </Button>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack component="ul" spacing={1.35} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {curriculumItems.map((item) => (
                  <Stack
                    key={item.section_key}
                    component="li"
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

      {/* 5 & 6. Requirements and documents */}
      <Box component="section" aria-labelledby="cdl-requirements" sx={{ bgcolor: 'white', py: { xs: 8, md: 12 } }}>
        <Container>
          <SectionHeading id="cdl-requirements" label="Before you apply" title="CDL requirements and documents" body="A quick checklist for Florida Class A applicants. Requirements are set by FMCSA and FLHSMV and can change, so confirm the current list with FLHSMV before you test." />
          <Grid container spacing={3}>
            {[
              { icon: AssignmentTurnedInRoundedIcon, title: 'Requirements checklist', items: requirementsChecklist, to: '/how-to-get-a-cdl/#requirements', action: 'Full requirements' },
              { icon: DescriptionRoundedIcon, title: 'Documents you may need', items: documentsChecklist, to: '/how-to-get-a-cdl/#documents', action: 'Document details' },
            ].map(({ icon: Icon, title, items, to, action }) => (
              <Grid key={title} size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ height: '100%', p: { xs: 3, md: 4 }, borderColor: 'divider' }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" mb={2.5}>
                    <Avatar variant="rounded" sx={{ width: 48, height: 48, bgcolor: 'rgba(214,31,44,.09)', color: 'secondary.main' }}><Icon /></Avatar>
                    <Typography component="h3" variant="h5" color="primary.main" fontWeight={900}>{title}</Typography>
                  </Stack>
                  <Checklist items={items} />
                  <Button component={RouterLink} to={to} endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 2.5, px: 0 }}>{action}</Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* 7. The skills test */}
      <Box component="section" aria-labelledby="cdl-skills-test" sx={{ bgcolor: '#f5f7fb', py: { xs: 8, md: 12 } }}>
        <Container>
          <SectionHeading id="cdl-skills-test" label="Test day" title="The CDL skills test" body="Florida’s skills test has three parts, conducted in English by FLHSMV-certified third-party testers." />
          <Grid container spacing={2.25}>
            {skillsTestParts.map(({ icon: Icon, title, text }) => (
              <Grid key={title} size={{ xs: 12, md: 4 }}>
                <Card sx={cardSx}>
                  <Avatar variant="rounded" sx={{ width: 52, height: 52, bgcolor: 'rgba(214,31,44,.09)', color: 'secondary.main' }}><Icon /></Avatar>
                  <Typography component="h3" variant="h5" color="primary.main" fontWeight={900} mt={2.5}>{title}</Typography>
                  <Typography color="text.secondary" mt={1.25}>{text}</Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Button component={RouterLink} to="/how-to-get-a-cdl/#skills-test" endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 3, px: 0 }}>Prepare for the skills test</Button>
        </Container>
      </Box>

      {/* 8. Other Iman programs and student services */}
      <Box component="section" aria-labelledby="other-programs" sx={{ bgcolor: 'white', py: { xs: 8, md: 12 } }}>
        <Container>
          <SectionHeading id="other-programs" label="More from Iman" title="Other training and student services" />
          <Grid container spacing={2.25}>
            {otherPrograms.map(({ icon: Icon, title, text, action, to }) => (
              <Grid key={title} size={{ xs: 12, md: 4 }}>
                <Card sx={{ ...cardSx, display: 'flex', flexDirection: 'column' }}>
                  <Avatar variant="rounded" sx={{ width: 54, height: 54, bgcolor: 'rgba(7,26,51,.07)', color: 'primary.main' }}><Icon /></Avatar>
                  <Typography component="h3" variant="h5" color="primary.main" fontWeight={900} mt={2.5}>{title}</Typography>
                  <Typography color="text.secondary" mt={1.25} mb={3}>{text}</Typography>
                  <Button component={RouterLink} to={to} endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 'auto', px: 0, alignSelf: 'flex-start' }}>{action}</Button>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* 9. FAQ preview (the full list lives on the CDL guide) */}
      {faqPreview.length > 0 && (
        <Box component="section" aria-labelledby="home-faq" sx={{ bgcolor: '#f5f7fb', py: { xs: 8, md: 12 } }}>
          <Container maxWidth="md">
            <SectionHeading center id="home-faq" label="Questions" title="Frequently asked questions" />
            <FaqAccordions items={faqPreview} />
            <Box textAlign="center" mt={3}>
              <Button component={RouterLink} to="/how-to-get-a-cdl/#faq" variant="outlined" endIcon={<ArrowForwardRoundedIcon />}>See all CDL questions</Button>
            </Box>
          </Container>
        </Box>
      )}

      {/* 10. Final call to action */}
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
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mt={3.5}>
                  <Button component={RouterLink} to={APPLY_PATH} variant="contained" sx={{ bgcolor: 'white', color: 'secondary.dark', '&:hover': { bgcolor: '#f6f7fb' } }} endIcon={<ArrowForwardRoundedIcon />}>
                    Apply Now
                  </Button>
                  <Button component={RouterLink} to="/contact-us/" variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,.6)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,.08)' } }}>
                    Contact Us
                  </Button>
                </Stack>
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
