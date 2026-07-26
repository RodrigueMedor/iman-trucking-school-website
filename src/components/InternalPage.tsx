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

type PageSection = {
  title: string
  body: string
  bullets?: string[]
}

type PageContent = {
  eyebrow: string
  intro: string
  sections: PageSection[]
}

const programOverview = [
  'Hands-on practice with industry-standard equipment',
  'Pre-trip inspection and vehicle safety preparation',
  'Backing, turning, coupling and road-driving skills',
  'Classroom instruction for CDL knowledge and regulations',
  'Flexible day, evening and weekend scheduling',
  'Career guidance and job-placement assistance',
]

const pageContent: Record<string, PageContent> = {
  '/our-program/': {
    eyebrow: 'Career-focused training',
    intro: 'Build the practical knowledge, safe-driving habits and confidence required to pursue a professional Class A driving career.',
    sections: [
      {
        title: 'A focused path to your Class A CDL',
        body: 'Our training combines classroom learning with supervised practice so students understand both the rules of the road and the skills required behind the wheel.',
        bullets: programOverview,
      },
      {
        title: 'Training designed around real life',
        body: 'Day, evening and weekend options help working adults prepare for a new career without putting the rest of life on hold.',
        bullets: ['Support from enrollment through graduation', 'Experienced instructors and structured practice', 'Preparation for written and road examinations'],
      },
    ],
  },
  '/class-a-cdl/': {
    eyebrow: 'License information',
    intro: 'A Class A Commercial Driver’s License opens the door to operating combination vehicles and pursuing a wide range of professional driving opportunities.',
    sections: [
      {
        title: 'What a Class A CDL allows you to drive',
        body: 'A Class A CDL is generally required for combination vehicles with a gross combination weight rating of 26,001 pounds or more when the towed vehicle exceeds 10,000 pounds.',
        bullets: ['Tractor-trailers and semi-trucks', 'Truck and trailer combinations', 'Certain tanker, flatbed and specialized vehicles with the proper endorsements'],
      },
      {
        title: 'How Iman helps you prepare',
        body: 'Students receive structured preparation for knowledge testing, vehicle inspection, basic control skills and on-road driving.',
        bullets: programOverview.slice(0, 4),
      },
    ],
  },
  '/cdl-training/': {
    eyebrow: 'Professional driver preparation',
    intro: 'Learn the essential safety, inspection and driving skills employers expect from entry-level commercial drivers.',
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
        bullets: ['5104 N Orange Blossom Trail, Suite 205', 'Orlando, FL 32810', 'Call (888) 991-4776'],
      },
    ],
  },
  '/truck-driving-school/': {
    eyebrow: 'A practical career education',
    intro: 'Choose a trucking school that combines professional instruction, real equipment and personalized support.',
    sections: [
      {
        title: 'Why professional training matters',
        body: 'A structured CDL program helps students develop repeatable safety habits and practice complex maneuvers with qualified supervision.',
        bullets: ['Guided preparation instead of learning alone', 'Practice on commercial equipment', 'Feedback from experienced instructors', 'A clear progression toward testing'],
      },
      {
        title: 'Support beyond the classroom',
        body: 'Our admissions and career teams help students understand the process, stay focused during training and prepare for the transition into employment.',
        bullets: ['Enrollment guidance', 'Flexible scheduling', 'Financing options', 'Job-placement assistance'],
      },
    ],
  },
  '/truck-driving-school-orlando-florida/': {
    eyebrow: 'Train in Central Florida',
    intro: 'Start your professional driving journey at an Orlando trucking school focused on practical skills, safety and student success.',
    sections: [
      {
        title: 'Built for aspiring Orlando drivers',
        body: 'Our location gives Central Florida students access to structured CDL instruction without leaving the region.',
        bullets: ['Hands-on Class A training', 'Experienced instructors', 'Flexible class schedules', 'Career-focused student support'],
      },
      {
        title: 'Take the next step',
        body: 'Speak with admissions about eligibility, upcoming start dates, financing and the documents needed to begin.',
      },
    ],
  },
  '/cdl-license-information/': {
    eyebrow: 'Understand the process',
    intro: 'Learn the major steps involved in earning a commercial driver’s license and preparing for a professional driving career.',
    sections: [
      {
        title: 'The typical CDL pathway',
        body: 'Requirements vary by state and personal circumstances, but most applicants follow a similar progression.',
        bullets: ['Meet state eligibility and identification requirements', 'Obtain a Commercial Learner’s Permit', 'Complete applicable Entry-Level Driver Training', 'Pass vehicle inspection, control-skills and road tests'],
      },
      {
        title: 'Licenses and endorsements',
        body: 'The vehicle you plan to operate and the cargo you plan to carry determine the license class and endorsements you may need.',
        bullets: ['Class A for many combination vehicles', 'Passenger or school bus endorsements where applicable', 'Tanker, doubles/triples or hazardous-material endorsements for specialized work'],
      },
    ],
  },
  '/cdl-permit-tests/': {
    eyebrow: 'Prepare with confidence',
    intro: 'A Commercial Learner’s Permit is an important early milestone. Focus your study on the knowledge areas that support safe commercial driving.',
    sections: [
      {
        title: 'What to study',
        body: 'Use your state commercial driver handbook as the primary source and build a consistent study routine.',
        bullets: ['General commercial-driving knowledge', 'Air-brake systems when applicable', 'Combination-vehicle operation', 'Road signs, safe speeds and hazard awareness'],
      },
      {
        title: 'Test-day preparation',
        body: 'Confirm required identification, arrive early and read each question carefully. Permit requirements and fees should always be verified with the appropriate state licensing agency.',
      },
    ],
  },
  '/how-to-become-a-truck-driver/': {
    eyebrow: 'Your next career move',
    intro: 'A professional driving career begins with understanding the requirements, choosing the right training and completing the licensing process.',
    sections: [
      {
        title: 'Five steps toward the driver’s seat',
        body: 'The process becomes easier to manage when you approach it one milestone at a time.',
        bullets: ['Confirm your eligibility and gather documents', 'Earn your Commercial Learner’s Permit', 'Complete required CDL training', 'Pass your skills and road tests', 'Evaluate employers and begin your career'],
      },
      {
        title: 'Build a strong foundation',
        body: 'Employers value drivers who combine technical skill with reliability, communication, sound judgment and a serious commitment to safety.',
      },
    ],
  },
  '/advantages-of-attending-a-cdl-training-school/': {
    eyebrow: 'Why structured training works',
    intro: 'A professional CDL school gives aspiring drivers equipment access, qualified instruction and a clearer path through the licensing process.',
    sections: [
      {
        title: 'Train with purpose',
        body: 'Every lesson and driving exercise should build toward safer performance and greater test-day confidence.',
        bullets: ['Organized curriculum and measurable progress', 'Direct coaching and corrective feedback', 'Access to appropriate commercial vehicles', 'Practice with inspections and required maneuvers'],
      },
      {
        title: 'Prepare for employment',
        body: 'Career-focused schools also help students understand employer expectations, application steps and the realities of different driving roles.',
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
}

const galleryImages = [
  '4Z8A0112-scaled.jpg',
  '4Z8A0189-scaled.jpg',
  '4Z8A0214-scaled.jpg',
  '4Z8A0295-scaled.jpg',
  '4Z8A0357-scaled.jpg',
  '4Z8A0446-scaled.jpg',
  '4Z8A0518-scaled.jpg',
  '4Z8A0587-scaled.jpg',
].map((name) => `https://imantruckingschool.com/wp-content/uploads/2025/02/${name}`)

const testimonials = [
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

const legalContent: Record<string, { intro: string; sections: PageSection[] }> = {
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
      { title: 'External services', body: 'Financing, maps, forms and other third-party services may be governed by their own terms and privacy practices.' },
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
  return (
    <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: '#f4f6fa' }}>
      <Container>
        <Card sx={{ overflow: 'hidden', borderRadius: 4, color: 'white', bgcolor: '#08085f', backgroundImage: 'linear-gradient(120deg, #08085f 0%, #11177f 70%, #d62531 160%)', boxShadow: '0 26px 70px rgba(8,8,95,.18)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={3} p={{ xs: 4, md: 6 }}>
            <Box>
              <Typography variant="overline" color="#ff7379" fontWeight={900} letterSpacing=".13em">Your next step</Typography>
              <Typography variant="h3" fontWeight={950} letterSpacing="-.04em" mt={0.75}>Ready to move your career forward?</Typography>
              <Typography color="rgba(255,255,255,.7)" mt={1.5}>Request program information and speak with the admissions team.</Typography>
            </Box>
            <Button onClick={openEnrollment} variant="contained" color="secondary" size="large" endIcon={<ArrowForwardRoundedIcon />} sx={{ flex: '0 0 auto', px: 3.5, py: 1.5, boxShadow: '0 14px 30px rgba(214,31,44,.28)' }}>
              Start your application
            </Button>
          </Stack>
        </Card>
      </Container>
    </Box>
  )
}

function StandardContent({ content }: { content: PageContent }) {
  return (
    <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: 'white' }}>
      <Container>
        <Grid container spacing={{ xs: 5, md: 8 }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={7}>
              {content.sections.map((section, index) => (
                <Box key={section.title}>
                  <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
                    <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 1.5, color: 'white', bgcolor: index === 0 ? 'secondary.main' : 'primary.main', fontWeight: 950 }}>
                      {String(index + 1).padStart(2, '0')}
                    </Box>
                    <Typography variant="h3" color="primary.main" fontWeight={950} letterSpacing="-.035em">{section.title}</Typography>
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
            <Card sx={{ position: { md: 'sticky' }, top: { md: 118 }, border: '1px solid #e5e8ef', borderRadius: 3, boxShadow: '0 20px 55px rgba(7,26,51,.09)' }}>
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
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

function GalleryPage() {
  return (
    <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: '#f5f7fa' }}>
      <Container>
        <Grid container spacing={2}>
          {galleryImages.map((src, index) => (
            <Grid key={src} size={{ xs: 12, sm: 6, md: index < 2 ? 6 : 4 }}>
              <Box
                component="img"
                src={src}
                alt={`Iman Trucking School training and student experience ${index + 1}`}
                loading="lazy"
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
  return (
    <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: '#f5f7fa' }}>
      <Container>
        <Grid container spacing={3}>
          {testimonials.map(({ quote, name }) => (
            <Grid key={quote} size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%', border: '1px solid #e5e8ef', borderRadius: 3, boxShadow: '0 16px 40px rgba(7,26,51,.08)' }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography color="secondary.main" fontSize="1.4rem" letterSpacing=".15em">★★★★★</Typography>
                  <Typography color="#26364a" fontSize="1.05rem" lineHeight={1.8} mt={2}>“{quote}”</Typography>
                  <Typography color="primary.main" fontWeight={900} mt={3}>{name}</Typography>
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
            [LocationOnRoundedIcon, 'Visit the school', '5104 N Orange Blossom Trail, Suite 205, Orlando, FL 32810'],
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
                    <Typography variant="h5" color="primary.main" fontWeight={950} mt={2.5}>{title as string}</Typography>
                    <Typography color="text.secondary" lineHeight={1.7} mt={1}>{value as string}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
        <Card sx={{ mt: 4, overflow: 'hidden', borderRadius: 3, boxShadow: '0 20px 55px rgba(7,26,51,.11)' }}>
          <Box component="iframe" title="Iman Trucking School location" src="https://www.google.com/maps?q=5104%20N%20Orange%20Blossom%20Trail%20Orlando%20FL%2032810&output=embed" loading="lazy" sx={{ display: 'block', width: '100%', height: 430, border: 0 }} />
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

function PaymentPage() {
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#f5f7fa' }}>
      <Container maxWidth="sm">
        <Card sx={{ textAlign: 'center', borderRadius: 4, border: '1px solid #e5e8ef', boxShadow: '0 22px 65px rgba(7,26,51,.12)' }}>
          <CardContent sx={{ p: { xs: 4, md: 6 } }}>
            <Box sx={{ display: 'grid', width: 64, height: 64, mx: 'auto', placeItems: 'center', borderRadius: '50%', color: 'white', bgcolor: 'secondary.main' }}>
              <SchoolRoundedIcon fontSize="large" />
            </Box>
            <Typography variant="h4" color="primary.main" fontWeight={950} mt={3}>Student payment assistance</Typography>
            <Typography color="text.secondary" lineHeight={1.75} mt={2}>For payment instructions or help confirming your student account, contact the school before submitting funds.</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" mt={4}>
              <Button component="a" href="tel:8889914776" variant="contained" color="secondary" startIcon={<PhoneRoundedIcon />}>Call the school</Button>
              <Button component="a" href="mailto:info@imanlogistics.com" variant="outlined" startIcon={<EmailRoundedIcon />}>Email support</Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}

export function InternalPage() {
  const { pathname } = useLocation()
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`
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
    intro = 'Get clear assistance with payment instructions and student-account questions.'
  } else if (normalized === '/kreyol/') {
    eyebrow = 'Nou pale Kreyòl'
    intro = 'Chwazi Kreyòl nan selektè lang lan pou tradui tout sit la, fòm yo ak enfòmasyon sou pwogram nan.'
  } else if (legal) {
    eyebrow = 'Website information'
    intro = legal.intro
  }

  const resolvedContent = content ?? (legal ? { eyebrow, intro, sections: legal.sections } : null)

  return (
    <>
      <PageHero title={title} eyebrow={eyebrow} intro={intro} />
      {resolvedContent && <StandardContent content={resolvedContent} />}
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
                <Button component={RouterLink} to="/our-program/" variant="contained" color="secondary" endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 4 }}>Gade pwogram nan</Button>
              </CardContent>
            </Card>
          </Container>
        </Box>
      )}
      {normalized !== '/contact-form/' && normalized !== '/payment/' && <EnrollmentCallout />}
    </>
  )
}
