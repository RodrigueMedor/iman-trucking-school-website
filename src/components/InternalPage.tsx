import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import EmailRoundedIcon from '@mui/icons-material/EmailRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded'
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { pageTitles } from '../navigation'
import { useAuth } from '../contexts/AuthContext'
import { isStaffRole } from '../lib/adminAuth'
import { useContent } from '../contexts/ContentContext'
import { FinancingCallout } from './financing/FinancingCallout'
import { CdlFaqSection } from './CdlFaq'
import { WhyChooseIman } from './HomePage'
import { APPLY_PATH } from '../navigation'
import { cdlResourcePages } from '../config/cdlResourcePages'
import { TruckDriverPayData, TuitionPricing } from './CdlDataSections'
import { WebsiteRequestForm } from './WebsiteRequestForm'
import type { RequestType } from '../../shared/websiteRequests.mjs'

// The full public financing section lives on its dedicated page. The homepage
// hero carries the primary financing callout.
const FINANCING_PAGES = ['/tuition-financing/']

export type PageSection = {
  /** Anchor for #links (e.g. the CDL menu links into guide sections). */
  id?: string
  title: string
  body: string
  bullets?: string[]
}

export type PageContent = {
  eyebrow: string
  intro: string
  sections: PageSection[]
}

export const pageContent: Record<string, PageContent> = {
  '/tuition-financing/': {
    eyebrow: 'Paying for your training',
    intro: 'Understand the costs of CDL training at Iman Trucking School and the ways students pay for it, including financing through our partner.',
    sections: [
      {
        title: 'Tuition and fees',
        body: 'Tuition covers training, testing, administrative and materials fees, with optional housing. Current prices are shown on this page, and your student portal shows the exact amount before you pay securely online.',
        bullets: ['Training, testing, administrative and materials fees', 'Optional housing', 'Secure online payment from your student portal', 'Admissions can walk you through every cost'],
      },
      {
        title: 'Ways to pay',
        body: 'Students pay out of pocket, through employer programs such as Amazon Career Choice, or with financing from our third-party financing partner when they qualify.',
        bullets: ['Financing through Liberty Career Finance', 'Amazon Career Choice for eligible associates', 'Payment questions answered by admissions'],
      },
    ],
  },
  '/cdl-assessment/': {
    eyebrow: 'Know where you stand',
    intro: 'An English Language Proficiency (ELP) assessment checks your English and readiness before training or testing. Read about it freely here; create an account only when you are ready to request one.',
    sections: [
      {
        title: 'What the assessment covers',
        body: 'Every assessment starts with an online English Language Proficiency (ELP) test you take from your student portal, followed by an in-person evaluation scheduled by admissions. The ELP screening follows 49 CFR §391.11(b)(2) and is not a CDL test or certification.',
        bullets: ['Oral interview prompts', 'Traffic signs, including critical signs', 'Reading comprehension', 'Driver logs and vehicle defect reports'],
      },
      {
        title: 'Requirements',
        body: 'Have these ready before you request an assessment so admissions can review it quickly.',
        bullets: ['At least 18 years old', "A driver's license or Commercial Learner's Permit (CLP) to upload", 'A quiet place and 35–45 minutes for the online test', 'A valid email address and phone number'],
      },
      {
        title: 'Scheduling and fees',
        body: 'Tell us which days and times work for you when you apply; admissions confirms the date and location in your student portal. A $25 application fee can be paid online after you submit, and admissions will confirm any other assessment costs with you before your appointment.',
        bullets: ['Choose your preferred days and times', 'Track your status online', 'Date and location confirmed in your portal', 'Pay the application fee securely online'],
      },
      {
        title: 'How to apply',
        body: 'Select Apply for an ELP Assessment, then sign in or create a free account. You return straight to your request, can save it as a draft, and can track its status from your dashboard after you submit.',
      },
    ],
  },
  '/cdl-training/': {
    eyebrow: 'Professional driver preparation',
    intro: 'Iman’s Class A CDL program combines classroom instruction with range and road practice to build the safety, inspection and driving skills employers expect from entry-level drivers.',
    sections: [
      {
        title: 'Classroom and range instruction',
        body: 'The program covers regulations, trip planning, logbook fundamentals, vehicle systems and safe operating practices before students apply those lessons on the range.',
        bullets: ['Road signs and federal safety rules', 'Trip planning and documentation', 'Preventive maintenance awareness', 'Hazard recognition and defensive driving'],
      },
      {
        title: 'Supervised driving experience',
        body: 'Practice is built around the maneuvers students need for testing and for safer performance in real operating environments.',
        bullets: ['Straight-line and offset backing', 'Turns and lane control', 'Coupling and uncoupling', 'Road-driving practice'],
      },
      // Sections below are appended (not inserted) so the CMS overrides saved
      // for section-1 and section-2 keep pointing at the same content.
      {
        title: 'Schedules built around real life',
        body: 'Open start sessions, with their start and end dates, are listed when you apply in the student portal, and admissions confirms your schedule before you begin. Day, evening and weekend options help working adults train without putting the rest of life on hold.',
        bullets: ['Support from enrollment through graduation', 'Experienced instructors and structured practice', 'Preparation for the knowledge and skills tests', 'Track your application from your student portal'],
      },
      {
        title: 'Paying for training and starting your career',
        body: 'Tuition depends on the program you choose, and your student portal shows the exact amount before you pay. Qualified students can apply for financing through Liberty Career Finance, and our team offers career guidance and job-placement assistance as you finish training.',
        bullets: ['Secure online payments from your student portal', 'Financing through Liberty Career Finance for those who qualify', 'Amazon Career Choice for eligible associates', 'Career guidance and job-placement assistance'],
      },
    ],
  },
  '/how-to-get-a-cdl/': {
    eyebrow: 'Step-by-step CDL guide',
    intro: 'Everything you need to know about earning a Class A Commercial Driver’s License in Florida, from your learner’s permit to the skills test.',
    sections: [
      {
        id: 'introduction',
        title: 'Starting a career in commercial driving',
        body: 'Earning a Commercial Driver’s License (CDL) is the first step toward driving tractor-trailers and other heavy commercial vehicles professionally. The process combines Florida licensing steps with federal training rules, and it is easier to manage when you know the order. This guide walks through each step for a Class A CDL. Requirements can change, so confirm details with the Florida Department of Highway Safety and Motor Vehicles (FLHSMV) before you test.',
      },
      {
        id: 'what-is-a-cdl',
        title: 'What is a CDL and why is it required?',
        body: 'A CDL is a state-issued license for operating large or specialized commercial motor vehicles. Federal rules require it because these vehicles take more skill to control, stop and inspect safely. The class you need depends on the vehicle you will drive.',
        bullets: [
          'Class A: combination vehicles of 26,001 lbs or more when the towed unit is over 10,000 lbs, such as tractor-trailers',
          'Class B: single vehicles of 26,001 lbs or more, such as straight trucks and many buses',
          'Class C: smaller vehicles that carry 16 or more people or placarded hazardous materials',
          'Endorsements, such as tanker or hazardous materials, add to your license for specialized work',
        ],
      },
      {
        id: 'requirements',
        title: 'Class A CDL requirements',
        body: 'Commercial license requirements are set by the Federal Motor Carrier Safety Administration (FMCSA) and FLHSMV. In Florida, most Class A applicants need to meet the following before they can be licensed.',
        bullets: [
          'At least 18 years old; drivers under 21 may only drive within Florida',
          'At least 21 to drive interstate or haul hazardous materials',
          'A valid driver’s license and proof of Florida residency',
          'Medical certification from an examiner on FMCSA’s National Registry, when your driving category requires it',
          'Ability to read and speak English well enough to drive safely',
          'Entry-Level Driver Training completed before the skills test',
        ],
      },
      {
        id: 'clp',
        title: 'Getting your Commercial Learner’s Permit (CLP)',
        body: 'The CLP is your learning permit. You earn it by passing knowledge tests at a Florida driver license office; third-party testers cannot give knowledge tests. With a CLP you may drive a commercial vehicle on public roads only with a qualified CDL holder beside you, and you must hold the permit for at least 14 days before taking the skills test.',
        bullets: [
          'General Knowledge test',
          'Combination Vehicles test for Class A',
          'Air Brakes test if your vehicle has air brakes',
          'Endorsement tests only for the endorsements you need',
        ],
      },
      {
        id: 'exam-prep',
        title: 'Preparing for the CDL exam',
        body: 'Use the official Florida CDL handbook as your main study guide and work through practice questions until the material feels familiar. Structured training prepares you for the parts of the exam you cannot learn from a book: the vehicle inspection, basic control maneuvers and road driving.',
        bullets: [
          'Study the handbook sections for each test you will take',
          'Learn the inspection sequence and say it out loud',
          'Practice backing and turning until they are consistent',
          'Bring the required identification and arrive early on test day',
        ],
      },
      {
        id: 'eldt',
        title: 'Understanding ELDT requirements',
        body: 'Since February 7, 2022, federal rules require Entry-Level Driver Training (ELDT) for first-time Class A and Class B applicants, Class B drivers upgrading to Class A, and drivers adding passenger, school bus or hazardous materials endorsements. Training must come from a provider listed on FMCSA’s Training Provider Registry and be finished before the skills test (or, for hazardous materials, before that knowledge test). You can look up any school on the registry at tpr.fmcsa.dot.gov.',
        bullets: [
          'Theory instruction with a minimum assessment score of 80%',
          'Behind-the-wheel training on a range and on public roads',
          'Behind-the-wheel skills are judged on proficiency, not a minimum hour count',
          'The provider reports your completion to FMCSA',
        ],
      },
      {
        id: 'documents',
        title: 'Documents needed to apply for a CDL',
        body: 'Florida requires original documents, and the exact list depends on your situation. Check FLHSMV’s current requirements before your visit. Most applicants should expect to bring documents in these categories.',
        bullets: [
          'Proof of identity, such as a U.S. passport, birth certificate or permanent resident card',
          'Proof of your Social Security number',
          'Proof of your residential address',
          'Proof of Florida residency, such as a Florida license or ID held for more than six months',
          'Your current driver’s license',
          'Medical certification, if your driving category requires it',
        ],
      },
      {
        id: 'skills-test',
        title: 'The CDL skills test',
        body: 'Florida’s skills test has three parts. It is conducted in English and given by FLHSMV-certified third-party testers. The vehicle you test in matters: for example, testing in a truck with an automatic transmission adds a restriction to your license.',
        bullets: [
          'Pre-trip vehicle inspection: show that the vehicle is safe to drive and explain what you check',
          'Basic vehicle control: backing and maneuvering exercises in a marked area',
          'On-road test: driving in real traffic while the examiner scores your safety and control',
        ],
      },
      {
        id: 'after-the-test',
        title: 'After you pass',
        body: 'Once you pass the skills test, complete your CDL issuance at a Florida driver license office; fees apply. Keep your medical certification current, because a lapse can cost you your commercial driving privileges. Before you start driving, employers typically run a pre-employment drug test and check FMCSA’s Drug and Alcohol Clearinghouse.',
        bullets: [
          'Have your CDL issued (fees apply)',
          'Keep your medical certification current',
          'Add endorsements when your job requires them',
          'Prepare for employer road tests and drug screening',
        ],
      },
    ],
  },
  '/cdl-training-program-orlando-florida/': {
    eyebrow: 'Orlando, Florida',
    intro: 'Prepare for your CDL at a conveniently located Orlando training facility with flexible schedules and hands-on instruction.',
    sections: [
      {
        title: 'Local training with career reach',
        body: 'Our Orlando program is designed for Central Florida students who want practical training and access to opportunities in local, regional and over-the-road transportation.',
        bullets: ['Convenient Orlando-area location', 'Day, evening and weekend availability', 'Hands-on equipment practice', 'Admissions and career support'],
      },
      {
        title: 'Visit the training center',
        body: 'Meet the team, learn how training is organized and discuss a schedule that works for you.',
        bullets: ['21902 State Road 46', 'Mount Dora Florida 32757', 'Call (888) 991-4776'],
      },
    ],
  },
  '/about-us/': {
    eyebrow: 'About Iman',
    intro: 'Iman Trucking School provides hands-on Class A CDL training to help students build the knowledge, skill and confidence to begin a professional driving career.',
    sections: [
      {
        title: 'Who we are',
        body: 'We are a Central Florida CDL school focused on practical preparation: classroom fundamentals, supervised range practice and road driving, with admissions support from your first question through graduation.',
        bullets: ['Hands-on Class A CDL training', 'A training center serving Orlando and Central Florida', 'Online applications and a student portal', 'Financing through Liberty Career Finance for those who qualify'],
      },
      {
        title: 'Visit the training center',
        body: 'Meet the team, see the equipment and talk through a schedule that works for you.',
        bullets: ['21902 State Road 46, Mount Dora, Florida 32757', 'Call (888) 991-4776', 'Email info@imanlogistics.com'],
      },
    ],
  },
  '/amazon-career-choice/': {
    eyebrow: 'Education benefit opportunity',
    intro: 'Eligible Amazon employees may be able to use Career Choice education benefits toward approved career training.',
    sections: [
      {
        title: 'Use your benefit toward a new skill',
        body: 'Amazon Career Choice is designed to help eligible employees build in-demand skills. Benefit availability, eligibility and payment procedures are determined by Amazon.',
        bullets: ['Confirm eligibility in your Amazon employee portal', 'Speak with Iman admissions before requesting payment', 'Follow the current Career Choice authorization process', 'Keep copies of approvals and enrollment documents'],
      },
      {
        title: 'Admissions can help',
        body: 'Our team can explain program dates and the school information you may need when submitting your education request.',
      },
    ],
  },
  ...cdlResourcePages,
}

// Copied from the school's WordPress gallery and resized for the web.
export const galleryImages = Array.from({ length: 32 }, (_, index) => `/images/gallery/gallery-${String(index + 1).padStart(2, '0')}.jpg`)

export const testimonials = [
  {
    quote: 'The instructors were patient, professional and focused on helping me understand every step of the process.',
    name: 'Iman Trucking School graduate',
  },
  {
    quote: 'The hands-on practice helped me become more confident with inspections, backing and driving on the road.',
    name: 'Class A CDL student',
  },
  {
    quote: 'From enrollment through training, the team made me feel supported and motivated to complete my goal.',
    name: 'Recent program participant',
  },
]

export const legalContent: Record<string, { intro: string; sections: PageSection[] }> = {
  '/privacy-policy/': {
    intro: 'This notice explains how information submitted through this website may be collected, used and protected.',
    sections: [
      { title: 'Information we collect', body: 'We may collect contact details, enrollment information and technical website data that visitors voluntarily provide or that is generated through normal website use.' },
      { title: 'How information is used', body: 'Information may be used to answer inquiries, provide admissions support, improve services and communicate about relevant programs.' },
      { title: 'Your choices', body: 'You may contact the school to request corrections or ask questions about information you previously submitted.' },
    ],
  },
  '/terms-of-use-page/': {
    intro: 'These terms describe the conditions for using the Iman Trucking School website and its informational resources.',
    sections: [
      { title: 'Educational information', body: 'Website content is provided for general informational purposes. Program schedules, pricing, eligibility and regulatory requirements may change.' },
      { title: 'Acceptable use', body: 'Visitors may not misuse the website, attempt unauthorized access or interfere with services provided to other users.' },
      { title: 'External services', body: 'Financing, maps, forms and other third-party services may be governed by their own terms and privacy practices. Financing applications are submitted directly to our financing partner, Liberty Career Finance, under its own terms and privacy policy; Iman Trucking School does not receive or store them.' },
    ],
  },
}

function openEnrollment() {
  window.postMessage({ type: 'iman-open-enrollment' }, window.location.origin)
}

function PageHero({ title, eyebrow, intro }: { title: string; eyebrow: string; intro: string }) {
  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        color: 'white',
        bgcolor: '#07075a',
        backgroundImage:
          'linear-gradient(105deg, rgba(6,13,38,.98) 0%, rgba(8,8,95,.94) 58%, rgba(156,25,38,.78) 100%), url("/images/home-hero-2.jpg")',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        py: { xs: 8, md: 11 },
        '&::after': {
          content: '""',
          position: 'absolute',
          right: '-8%',
          bottom: '-65%',
          width: 420,
          height: 420,
          border: '70px solid rgba(255,255,255,.035)',
          borderRadius: '50%',
        },
      }}
    >
      <Container sx={{ position: 'relative', zIndex: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={3} color="rgba(255,255,255,.68)">
          <HomeRoundedIcon sx={{ fontSize: 16 }} />
          <Typography component={RouterLink} to="/" color="inherit" variant="caption" fontWeight={800} sx={{ textDecoration: 'none' }}>
            Home
          </Typography>
          <Typography variant="caption">/</Typography>
          <Typography variant="caption" color="white" fontWeight={800}>{title}</Typography>
        </Stack>
        <Chip
          icon={<SchoolRoundedIcon />}
          label={eyebrow}
          sx={{
            mb: 2.5,
            color: 'white',
            bgcolor: 'rgba(255,255,255,.09)',
            border: '1px solid rgba(255,255,255,.18)',
            fontWeight: 850,
            letterSpacing: '.07em',
            textTransform: 'uppercase',
            '& .MuiChip-icon': { color: '#ff6069' },
          }}
        />
        <Typography component="h1" sx={{ maxWidth: 850, fontSize: { xs: '2.45rem', md: '4.15rem' }, fontWeight: 950, lineHeight: 1.02, letterSpacing: '-.05em' }}>
          {title}
        </Typography>
        <Typography sx={{ maxWidth: 720, mt: 2.5, color: 'rgba(255,255,255,.76)', fontSize: { xs: '1rem', md: '1.15rem' }, lineHeight: 1.75 }}>
          {intro}
        </Typography>
      </Container>
    </Box>
  )
}

function EnrollmentCallout() {
  const { pathname } = useLocation()
  const assessment = pathname.replace(/\/?$/, '/') === '/cdl-assessment/'
  return (
    <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: '#f4f6fa' }}>
      <Container>
        <Card sx={{ overflow: 'hidden', borderRadius: 4, color: 'white', bgcolor: '#08085f', backgroundImage: 'linear-gradient(120deg, #08085f 0%, #11177f 70%, #d62531 160%)', boxShadow: '0 26px 70px rgba(8,8,95,.18)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={3} p={{ xs: 4, md: 6 }}>
            <Box>
              <Typography variant="overline" color="#ff7379" fontWeight={900} letterSpacing=".13em">Your next step</Typography>
              <Typography component="h2" variant="h3" fontWeight={950} letterSpacing="-.04em" mt={0.75}>Ready to move your career forward?</Typography>
              <Typography color="rgba(255,255,255,.7)" mt={1.5}>Apply online in minutes, save your progress, and track your status from your student portal.</Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ flex: '0 0 auto' }}>
              <Button component={RouterLink} to={assessment ? '/portal/apply/assessment' : '/portal/apply/training'} variant="contained" color="secondary" size="large" endIcon={<ArrowForwardRoundedIcon />} sx={{ px: 3.5, py: 1.5, boxShadow: '0 14px 30px rgba(214,31,44,.28)' }}>
                {assessment ? 'Apply for an ELP Assessment' : 'Apply for CDL Training'}
              </Button>
              <Button onClick={openEnrollment} variant="outlined" size="large" sx={{ px: 3, py: 1.5, color: 'white', borderColor: 'rgba(255,255,255,.5)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,.08)' } }}>
                Request information
              </Button>
            </Stack>
          </Stack>
        </Card>
      </Container>
    </Box>
  )
}

function StandardContent({ content, withFaq = false }: { content: PageContent; withFaq?: boolean }) {
  const anchored = content.sections.filter((section): section is PageSection & { id: string } => Boolean(section.id))
  // A table of contents only helps on longer pages.
  const toc = anchored.length >= 3 ? anchored : []
  return (
    <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: 'white' }}>
      <Container>
        <Grid container spacing={{ xs: 5, md: 8 }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={7}>
              {content.sections.map((section, index) => (
                <Box key={section.title} id={section.id} sx={{ scrollMarginTop: 110 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
                    <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 1.5, color: 'white', bgcolor: index === 0 ? 'secondary.main' : 'primary.main', fontWeight: 950 }}>
                      {String(index + 1).padStart(2, '0')}
                    </Box>
                    <Typography component="h2" variant="h3" color="primary.main" fontWeight={950} letterSpacing="-.035em">{section.title}</Typography>
                  </Stack>
                  <Typography color="text.secondary" fontSize="1.04rem" lineHeight={1.8}>{section.body}</Typography>
                  {section.bullets && (
                    <Grid container spacing={1.5} mt={2}>
                      {section.bullets.map((bullet) => (
                        <Grid key={bullet} size={{ xs: 12, sm: 6 }}>
                          <Stack direction="row" spacing={1.2} alignItems="flex-start" sx={{ height: '100%', p: 2, border: '1px solid #e7eaf0', borderRadius: 2, bgcolor: '#fafbfc' }}>
                            <CheckCircleRoundedIcon sx={{ mt: 0.15, color: 'secondary.main', fontSize: 20 }} />
                            <Typography color="#26364a" fontWeight={700} lineHeight={1.55}>{bullet}</Typography>
                          </Stack>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Box>
              ))}
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3} sx={{ position: { md: 'sticky' }, top: { md: 118 } }}>
            {toc.length > 0 && (
              <Card component="nav" aria-label="On this page" sx={{ border: '1px solid #e5e8ef', borderRadius: 3, boxShadow: '0 20px 55px rgba(7,26,51,.09)' }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".12em">On this page</Typography>
                  <Stack component="ol" spacing={1} sx={{ m: 0, mt: 1, pl: 2.5 }}>
                    {toc.map(section => (
                      <Typography key={section.id} component="li" color="primary.main" fontWeight={700} lineHeight={1.5}>
                        <Typography component={RouterLink} to={`#${section.id}`} color="inherit" fontWeight="inherit" sx={{ textDecoration: 'none', '&:hover': { color: 'secondary.main', textDecoration: 'underline' } }}>{section.title}</Typography>
                      </Typography>
                    ))}
                    {withFaq && (
                      <Typography component="li" color="primary.main" fontWeight={700} lineHeight={1.5}>
                        <Typography component={RouterLink} to="#faq" color="inherit" fontWeight="inherit" sx={{ textDecoration: 'none', '&:hover': { color: 'secondary.main', textDecoration: 'underline' } }}>Frequently asked questions</Typography>
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}
            <Card sx={{ border: '1px solid #e5e8ef', borderRadius: 3, boxShadow: '0 20px 55px rgba(7,26,51,.09)' }}>
              <CardContent sx={{ p: 3.5 }}>
                <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".12em">Admissions</Typography>
                <Typography variant="h5" color="primary.main" fontWeight={950} mt={0.5}>Questions about getting started?</Typography>
                <Typography color="text.secondary" mt={1.5} lineHeight={1.7}>Our team can help with schedules, enrollment requirements and financing information.</Typography>
                <Divider sx={{ my: 2.5 }} />
                <Stack spacing={1.5}>
                  <Button component="a" href="tel:8889914776" variant="outlined" startIcon={<PhoneRoundedIcon />} fullWidth>(888) 991-4776</Button>
                  <Button onClick={openEnrollment} variant="contained" color="secondary" endIcon={<ArrowForwardRoundedIcon />} fullWidth>Request information</Button>
                </Stack>
              </CardContent>
            </Card>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

const guideLinks = [
  ['How to Get a CDL', '/how-to-get-a-cdl/'],
  ['Class A CDL Requirements', '/how-to-get-a-cdl/#requirements'],
  ['Age Requirements & Under 21', '/cdl-age-requirements/'],
  ['Medical Requirements', '/cdl-medical-requirements/'],
  ['CDL Permit (CLP)', '/how-to-get-a-cdl/#clp'],
  ['CDL Training & ELDT', '/how-to-get-a-cdl/#eldt'],
  ['CDL Skills Test', '/how-to-get-a-cdl/#skills-test'],
  ['Tuition & Financing', '/tuition-financing/'],
  ['CDL Jobs & Career Services', '/cdl-jobs/'],
  ['Truck Driver Pay in Florida', '/truck-driver-pay-florida/'],
] as const

function RelatedLinks({ title, links }: { title: string; links: ReadonlyArray<readonly [string, string]> }) {
  return <>
    <Typography component="h2" variant="h6" color="primary.main" fontWeight={900} mt={6} mb={2}>{title}</Typography>
    <Grid container spacing={1.5}>
      {links.map(([label, to]) => (
        <Grid key={to} size={{ xs: 12, sm: 6, md: 4 }}>
          <Button component={RouterLink} to={to} variant="outlined" fullWidth endIcon={<ArrowForwardRoundedIcon />} sx={{ justifyContent: 'space-between', bgcolor: 'white' }}>
            {label}
          </Button>
        </Grid>
      ))}
    </Grid>
  </>
}

/** On the training overview: points to the licensing guide instead of repeating it. */
function CdlGuideCallout() {
  return (
    <Box component="section" aria-labelledby="cdl-guide-title" sx={{ py: { xs: 7, md: 10 }, bgcolor: '#f5f7fa' }}>
      <Container maxWidth="md">
        <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".12em">Licensing steps</Typography>
        <Typography id="cdl-guide-title" component="h2" variant="h3" color="primary.main" fontWeight={950} letterSpacing="-.035em" mt={0.5}>
          New to the CDL process?
        </Typography>
        <Typography color="text.secondary" fontSize="1.04rem" lineHeight={1.8} mt={1.5}>
          Our step-by-step guide explains the Class A requirements, the learner’s permit, Entry-Level Driver Training, the documents to bring and what happens on skills-test day.
        </Typography>
        <RelatedLinks title="CDL guide and resources" links={guideLinks} />
      </Container>
    </Box>
  )
}

// Pages that take an online request (saved and triaged in Admin → Website requests).
const REQUEST_FORM_PAGES: Record<string, RequestType> = {
  '/graduate-verification/': 'GRADUATE_VERIFICATION',
  '/student-complaints/': 'STUDENT_COMPLAINT',
  '/careers/': 'CAREERS',
  '/eldt-credit-transfer/': 'ELDT_TRANSFER',
}

const resourceLinks = [
  ['How to Get a CDL', '/how-to-get-a-cdl/'],
  ['Age Requirements & Under 21', '/cdl-age-requirements/'],
  ['Medical Requirements', '/cdl-medical-requirements/'],
  ['CDL Jobs & Career Services', '/cdl-jobs/'],
  ['Truck Driver Pay in Florida', '/truck-driver-pay-florida/'],
  ['Truck Driving Career Benefits', '/truck-driving-career-benefits/'],
  ['Tuition & Financing', '/tuition-financing/'],
  ['CDL Training Overview', '/cdl-training/'],
  ['Choosing a CDL School', '/choosing-a-cdl-school/'],
] as const

/** "Keep reading" links on the CDL information pages, excluding the current page. */
function ResourceLinksSection({ current }: { current: string }) {
  return (
    <Box component="section" sx={{ pb: { xs: 7, md: 10 }, pt: { xs: 1, md: 2 }, bgcolor: 'white' }}>
      <Container>
        <RelatedLinks title="Keep reading" links={resourceLinks.filter(([, path]) => path !== current)} />
      </Container>
    </Box>
  )
}

function AboutExtras() {
  return <>
    <WhyChooseIman />
    <Box sx={{ pb: { xs: 7, md: 10 }, bgcolor: '#f5f7fb' }}>
      <Container maxWidth="md">
        <RelatedLinks title="See Iman for yourself" links={[['Student Testimonials', '/testimonials/'], ['School Gallery', '/gallery/'], ['Orlando CDL Program', '/cdl-training-program-orlando-florida/']]} />
      </Container>
    </Box>
  </>
}

function GalleryPage() {
  const { content } = useContent()
  // Photos whose file is missing (e.g. old WordPress uploads) are hidden
  // instead of rendering as empty cards.
  const [failed, setFailed] = useState<Set<string>>(() => new Set())
  const images = galleryImages
    .map((src, index) => content('gallery', `image-${index + 1}`, { section_label: `Gallery image ${index + 1}`, image_url: src }))
    .filter(item => item.image_url && !failed.has(item.image_url))
  const hide = (url: string) => setFailed(current => new Set(current).add(url))
  if (!images.length) return null
  return (
    <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: '#f5f7fa' }}>
      <Container>
        <Grid container spacing={2}>
          {images.map((item, index) => (
            <Grid key={item.section_key} size={{ xs: 12, sm: 6, md: index < 2 ? 6 : 4 }}>
              <Box
                component="img"
                src={item.image_url}
                alt={`Iman Trucking School training and student experience ${index + 1}`}
                loading="lazy"
                onError={() => hide(item.image_url)}
                sx={{
                  display: 'block',
                  width: '100%',
                  height: index < 2 ? { xs: 270, md: 400 } : 285,
                  objectFit: 'cover',
                  borderRadius: 3,
                  boxShadow: '0 16px 40px rgba(7,26,51,.12)',
                  transition: 'transform .25s ease, box-shadow .25s ease',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 22px 50px rgba(7,26,51,.18)' },
                }}
              />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

function TestimonialsPage() {
  const { content } = useContent()
  const items = testimonials.map((item, index) => content('testimonials', `testimonial-${index + 1}`, { section_label: `Testimonial ${index + 1}`, title: item.name, body: item.quote }))
  return (
    <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: '#f5f7fa' }}>
      <Container>
        <Grid container spacing={3}>
          {items.map(item => (
            <Grid key={item.section_key} size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%', border: '1px solid #e5e8ef', borderRadius: 3, boxShadow: '0 16px 40px rgba(7,26,51,.08)' }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography color="secondary.main" fontSize="1.4rem" letterSpacing=".15em">★★★★★</Typography>
                  <Typography color="#26364a" fontSize="1.05rem" lineHeight={1.8} mt={2}>“{item.body}”</Typography>
                  <Typography color="primary.main" fontWeight={900} mt={3}>{item.title}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

function ContactPage() {
  return (
    <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: '#f5f7fa' }}>
      <Container>
        <Grid container spacing={4}>
          {[
            [LocationOnRoundedIcon, 'Visit the school', '21902 State Road 46, Mount Dora Florida 32757'],
            [PhoneRoundedIcon, 'Call admissions', '(888) 991-4776'],
            [EmailRoundedIcon, 'Email the team', 'info@imanlogistics.com'],
          ].map(([Icon, title, value]) => {
            const ContactIcon = Icon as typeof PhoneRoundedIcon
            return (
              <Grid key={title as string} size={{ xs: 12, md: 4 }}>
                <Card sx={{ height: '100%', border: '1px solid #e5e8ef', borderRadius: 3, boxShadow: '0 16px 40px rgba(7,26,51,.08)' }}>
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'grid', width: 50, height: 50, placeItems: 'center', borderRadius: 2, color: 'white', bgcolor: 'secondary.main', boxShadow: '0 10px 22px rgba(214,31,44,.22)' }}>
                      <ContactIcon />
                    </Box>
                    <Typography component="h2" variant="h5" color="primary.main" fontWeight={950} mt={2.5}>{title as string}</Typography>
                    <Typography color="text.secondary" lineHeight={1.7} mt={1}>{value as string}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
        <Card sx={{ mt: 4, overflow: 'hidden', borderRadius: 3, boxShadow: '0 20px 55px rgba(7,26,51,.11)' }}>
          <Box component="iframe" title="Iman Trucking School location" src="https://www.google.com/maps?q=21902%20State%20Road%2046%20Mount%20Dora%20Florida%2032757&output=embed" loading="lazy" sx={{ display: 'block', width: '100%', height: 430, border: 0 }} />
        </Card>
      </Container>
    </Box>
  )
}

function ContactFormPage() {
  return (
    <Box sx={{ py: { xs: 5, md: 8 }, bgcolor: '#f5f7fa' }}>
      <Container maxWidth="md">
        <Card sx={{ overflow: 'hidden', borderRadius: 4, border: '1px solid #e5e8ef', boxShadow: '0 24px 70px rgba(7,26,51,.13)' }}>
          <Box sx={{ p: { xs: 3, md: 4 }, color: 'white', bgcolor: 'primary.main' }}>
            <Typography variant="h4" fontWeight={950}>Request enrollment information</Typography>
            <Typography color="rgba(255,255,255,.72)" mt={1}>Complete the secure form and an admissions team member will follow up with you.</Typography>
          </Box>
          <Box component="iframe" src="https://api.leadconnectorhq.com/widget/form/RmDjUNgSA8rKuhQFsrUU" title="Iman Trucking School enrollment form" sx={{ display: 'block', width: '100%', minHeight: 1306, border: 0, bgcolor: 'white' }} />
        </Card>
      </Container>
    </Box>
  )
}

const BILLING_PATH = '/portal/billing/'
const paymentSteps = [
  ['Sign in or create a free account', 'Use the same student account you apply with.'],
  ['Open Tuition & Payments', 'See your balance, or choose your program and optional housing if you have not started yet.'],
  ['Sign and pay securely', 'Sign the tuition payment agreement, then pay by card through Stripe Checkout. Iman never sees or stores your card details.'],
  ['Keep your receipt', 'Your receipt and payment history stay in your student portal.'],
] as const

/** Student payments run through the existing portal billing + Stripe Checkout flow. */
function PaymentPage() {
  const { session, profile } = useAuth()
  const staff = isStaffRole(profile?.role)
  const next = encodeURIComponent(BILLING_PATH)
  return (
    <>
      <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: 'white' }}>
        <Container>
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 7 }}>
              <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".12em">Pay online</Typography>
              <Typography component="h2" variant="h3" color="primary.main" fontWeight={950} letterSpacing="-.035em" mt={0.5}>Pay your tuition with Stripe</Typography>
              <Stack component="ol" spacing={2} sx={{ listStyle: 'none', m: 0, mt: 3, p: 0 }}>
                {paymentSteps.map(([title, body], index) => (
                  <Stack key={title} component="li" direction="row" spacing={2} alignItems="flex-start">
                    <Box aria-hidden sx={{ flex: '0 0 auto', width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 1.5, color: 'white', bgcolor: index === 0 ? 'secondary.main' : 'primary.main', fontWeight: 950 }}>{String(index + 1).padStart(2, '0')}</Box>
                    <Box><Typography component="h3" fontWeight={900} color="primary.main">{title}</Typography><Typography color="text.secondary">{body}</Typography></Box>
                  </Stack>
                ))}
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ border: '1px solid #e5e8ef', borderRadius: 3, boxShadow: '0 20px 55px rgba(7,26,51,.09)' }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".12em">Student account</Typography>
                  {staff ? <>
                    <Typography variant="h5" color="primary.main" fontWeight={950} mt={0.5}>You are signed in as staff</Typography>
                    <Typography color="text.secondary" mt={1.5}>Review balances, record offline payments and apply waivers in the back office.</Typography>
                    <Button component={RouterLink} to="/admin/tuition-accounts/" variant="contained" color="secondary" endIcon={<ArrowForwardRoundedIcon />} fullWidth sx={{ mt: 2.5 }}>Open tuition accounts</Button>
                  </> : session ? <>
                    <Typography variant="h5" color="primary.main" fontWeight={950} mt={0.5}>Ready when you are</Typography>
                    <Typography color="text.secondary" mt={1.5}>Go straight to your balance and pay securely online.</Typography>
                    <Button component={RouterLink} to={BILLING_PATH} variant="contained" color="secondary" endIcon={<ArrowForwardRoundedIcon />} fullWidth sx={{ mt: 2.5 }}>Go to my balance</Button>
                  </> : <>
                    <Typography variant="h5" color="primary.main" fontWeight={950} mt={0.5}>Sign in to pay</Typography>
                    <Typography color="text.secondary" mt={1.5}>Payments are tied to your student account so every payment is applied to the right balance.</Typography>
                    <Stack spacing={1.5} mt={2.5}>
                      <Button component={RouterLink} to={`/portal/sign-in?next=${next}`} variant="contained" color="secondary" endIcon={<ArrowForwardRoundedIcon />} fullWidth>Sign in to pay</Button>
                      <Button component={RouterLink} to={`/portal/register?next=${next}`} variant="outlined" fullWidth>Create a free account</Button>
                    </Stack>
                  </>}
                  <Divider sx={{ my: 2.5 }} />
                  <Typography fontWeight={900} color="primary.main">Other ways to pay</Typography>
                  <Typography variant="body2" color="text.secondary" mt={0.75} lineHeight={1.7}>Admissions can accept cash, check or money order and record it on your account. Students who qualify can finance through Liberty Career Finance.</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mt={1.5}>
                    <Button component="a" href="tel:8889914776" size="small" startIcon={<PhoneRoundedIcon />}>(888) 991-4776</Button>
                    <Button component={RouterLink} to="/tuition-financing/" size="small" endIcon={<ArrowForwardRoundedIcon />}>Tuition & financing</Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>
      <TuitionPricing />
    </>
  )
}

export function InternalPage() {
  const { pathname } = useLocation()
  const { entries, content: managedContent } = useContent()
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`
  const pageKey = normalized.replace(/^\/|\/$/g, '')
  const title = pageTitles[normalized] ?? 'Iman Trucking School'
  const content = pageContent[normalized]
  const legal = legalContent[normalized]

  let eyebrow = content?.eyebrow ?? 'Iman Trucking School'
  let intro = content?.intro ?? 'Explore resources, student experiences and support from Iman Trucking School.'

  if (normalized === '/gallery/') {
    eyebrow = 'Life at Iman'
    intro = 'See students, instructors, equipment and hands-on training experiences from the Iman Trucking School community.'
  } else if (normalized === '/testimonials/') {
    eyebrow = 'Student experiences'
    intro = 'Hear what students value about the instruction, practice and support they receive during their CDL journey.'
  } else if (normalized === '/contact-us/') {
    eyebrow = 'We are here to help'
    intro = 'Connect with admissions, visit the Orlando location or request more information about training.'
  } else if (normalized === '/contact-form/') {
    eyebrow = 'Start your journey'
    intro = 'Tell us how to reach you and an admissions representative will help you explore the next step.'
  } else if (normalized === '/payment/') {
    eyebrow = 'Student services'
    intro = 'Pay your tuition securely online with Stripe from your student portal, or ask admissions about other ways to pay.'
  } else if (normalized === '/kreyol/') {
    eyebrow = 'Nou pale Kreyòl'
    intro = 'Chwazi Kreyòl nan selektè lang lan pou tradui tout sit la, fòm yo ak enfòmasyon sou pwogram nan.'
  } else if (legal) {
    eyebrow = 'Website information'
    intro = legal.intro
  }

  const resolvedContent = content ?? (legal ? { eyebrow, intro, sections: legal.sections } : null)
  const hero = managedContent(pageKey, 'hero', { section_label: eyebrow, title, body: intro })
  const baseSections = resolvedContent?.sections.map((section, index) => {
    const item = managedContent(pageKey, `section-${index + 1}`, {
      section_label: `Content section ${index + 1}`,
      title: section.title,
      body: section.body,
      bullets: section.bullets?.join('\n') ?? '',
      sort_order: index + 10,
    })
    return { id: section.id, title: item.title, body: item.body, bullets: item.bullets ? item.bullets.split('\n').map(value => value.trim()).filter(Boolean) : undefined }
  }) ?? []
  const managedSections = entries
    .filter(item => item.page === pageKey && item.published && item.section_key.startsWith('custom-'))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(item => ({ title: item.title, body: item.body, bullets: item.bullets ? item.bullets.split('\n').map(value => value.trim()).filter(Boolean) : undefined }))
  const displayContent = resolvedContent || managedSections.length
    ? { eyebrow: hero.section_label, intro: hero.body, sections: [...baseSections, ...managedSections] }
    : null

  return (
    <>
      <PageHero title={hero.title || title} eyebrow={hero.section_label || eyebrow} intro={hero.body || intro} />
      {normalized === '/tuition-financing/' && <TuitionPricing />}
      {normalized === '/truck-driver-pay-florida/' && <TruckDriverPayData />}
      {displayContent && <StandardContent content={displayContent} withFaq={normalized === '/how-to-get-a-cdl/'} />}
      {REQUEST_FORM_PAGES[normalized] && <WebsiteRequestForm key={normalized} type={REQUEST_FORM_PAGES[normalized]} />}
      {normalized in cdlResourcePages && <ResourceLinksSection current={normalized} />}
      {normalized === '/cdl-training/' && <CdlGuideCallout />}
      {normalized === '/how-to-get-a-cdl/' && (
        <CdlFaqSection>
          <RelatedLinks title="Next steps" links={[['Age Requirements & Under 21', '/cdl-age-requirements/'], ['Medical Requirements', '/cdl-medical-requirements/'], ['CDL Training Overview', '/cdl-training/'], ['Tuition & Financing', '/tuition-financing/'], ['CDL Jobs & Career Services', '/cdl-jobs/'], ['English Language Proficiency (ELP)', '/cdl-assessment/'], ['Apply Now', APPLY_PATH], ['Contact Us', '/contact-us/']]} />
        </CdlFaqSection>
      )}
      {normalized === '/about-us/' && <AboutExtras />}
      {normalized === '/gallery/' && <GalleryPage />}
      {normalized === '/testimonials/' && <TestimonialsPage />}
      {normalized === '/contact-us/' && <ContactPage />}
      {normalized === '/contact-form/' && <ContactFormPage />}
      {normalized === '/payment/' && <PaymentPage />}
      {normalized === '/kreyol/' && (
        <Box sx={{ py: 9, bgcolor: 'white' }}>
          <Container maxWidth="md">
            <Card sx={{ borderRadius: 4, border: '1px solid #e5e8ef', boxShadow: '0 20px 55px rgba(7,26,51,.1)' }}>
              <CardContent sx={{ p: { xs: 4, md: 6 }, textAlign: 'center' }}>
                <Typography variant="h3" color="primary.main" fontWeight={950}>Byenveni nan Iman Trucking School</Typography>
                <Typography color="text.secondary" fontSize="1.05rem" lineHeight={1.8} mt={2}>Sèvi ak meni lang ki anlè paj la pou wè tout enfòmasyon sou fòmasyon CDL, admisyon ak finansman an Kreyòl.</Typography>
                <Button component={RouterLink} to="/cdl-training/" variant="contained" color="secondary" endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 4 }}>Gade pwogram nan</Button>
              </CardContent>
            </Card>
          </Container>
        </Box>
      )}
      {FINANCING_PAGES.includes(normalized) && <FinancingCallout showLearnMore={normalized !== '/tuition-financing/'} />}
      {normalized !== '/contact-form/' && normalized !== '/payment/' && <EnrollmentCallout />}
    </>
  )
}
