import { pageTitles } from '../navigation'

export const SITE_ORIGIN = 'https://imantruckingschool.com'
export const DEFAULT_TITLE = 'Iman Trucking School | The Road to Success'
export const DEFAULT_DESCRIPTION = 'Earn your Class A CDL with hands-on training, flexible financing, and career-focused support at Iman Trucking School.'

// One distinct description per public page so pages that cover related
// topics do not compete for the same search intent.
export const pageDescriptions: Record<string, string> = {
  '/': DEFAULT_DESCRIPTION,
  '/cdl-training/': 'Class A CDL training at Iman Trucking School: classroom instruction, range and road practice, flexible schedules, tuition and career support.',
  '/how-to-get-a-cdl/': 'How to get a Class A CDL in Florida, step by step: requirements, the learner’s permit, ELDT, documents to bring, the skills test and what happens after.',
  '/class-b-cdl-training/': 'Class B CDL training at Iman Trucking School: what a Class B license covers, Class B vs Class A, the licensing steps and current tuition.',
  '/box-truck-training/': 'Non-CDL box truck training at Iman Trucking School: when a box truck needs no CDL in Florida, federal rules that still apply, and how to enroll.',
  '/hotshot-training/': 'Hotshot training at Iman Trucking School for CDL and non-CDL drivers: when hotshot work needs a CDL, running your own operation, and how to enroll.',
  '/cdl-training-program-orlando-florida/': 'Class A CDL training for Orlando and Central Florida students at the Iman Trucking School training center in Mount Dora, Florida.',
  '/cdl-age-requirements/': 'CDL age requirements in Florida: 18 for an intrastate CDL, 21 for interstate and hazmat, and what drivers under 21 can do today.',
  '/cdl-medical-requirements/': 'What the DOT physical checks, who needs a medical certificate in Florida, how long it lasts and how results reach your driver record.',
  '/cdl-jobs/': 'Class A CDL jobs and career paths, what employers check before you drive, and the career support Iman Trucking School offers students.',
  '/truck-driver-pay-florida/': 'How much truck drivers earn in Florida and the Orlando area, from the latest U.S. Bureau of Labor Statistics wage data, and what affects pay.',
  '/truck-driving-career-benefits/': 'The benefits of a truck driving career, job outlook from the Bureau of Labor Statistics, and the realities to consider before you start.',
  '/tuition-financing/': 'Current CDL tuition and fees at Iman Trucking School, optional housing, and ways to pay, including Liberty Career Finance and Amazon Career Choice.',
  '/cdl-assessment/': 'Request an English Language Proficiency (ELP) assessment: an online ELP test plus an in-person evaluation to check your readiness before training or testing.',
  '/amazon-career-choice/': 'How eligible Amazon employees may be able to use Career Choice education benefits toward CDL training at Iman Trucking School.',
  '/about-us/': 'About Iman Trucking School: hands-on Class A CDL training in Central Florida, what students can expect, and how to visit the training center.',
  '/choosing-a-cdl-school/': 'How to choose a CDL school: check ELDT registration, Florida licensing, behind-the-wheel time, itemized pricing and job-support claims before you enroll.',
  '/eldt-credit-transfer/': 'How Entry-Level Driver Training from another provider is recorded, what federal rules allow you to transfer, and how to ask Iman about prior training.',
  '/graduate-verification/': 'How employers, licensing agencies and schools can verify that someone trained at Iman Trucking School, and how ELDT records are checked.',
  '/careers/': 'Careers at Iman Trucking School and the federal qualifications for CDL theory and behind-the-wheel instructors under 49 CFR 380.605.',
  '/student-complaints/': 'How to raise a concern with Iman Trucking School, and when to contact Florida’s Commission for Independent Education or FMCSA.',
  '/testimonials/': 'What students say about the instruction, hands-on practice and support at Iman Trucking School.',
  '/gallery/': 'Photos of students, instructors, trucks and hands-on CDL training at Iman Trucking School.',
  '/contact-us/': 'Contact Iman Trucking School admissions by phone or email, or visit the training center at 21902 State Road 46, Mount Dora, Florida.',
  '/contact-form/': 'Request CDL enrollment information and an Iman Trucking School admissions representative will follow up with you.',
  '/payment/': 'Pay Iman Trucking School tuition securely online with Stripe from your student portal, or ask admissions about other ways to pay.',
  '/kreyol/': 'Enfòmasyon sou fòmasyon CDL Iman Trucking School an Kreyòl.',
  '/privacy-policy/': 'How Iman Trucking School collects, uses and protects information submitted through this website.',
  '/terms-of-use-page/': 'Terms for using the Iman Trucking School website and its informational resources.',
}

export type PageMeta = { title: string; description: string; canonical: string | null }

/** Resolves the document title, description and canonical URL for a route. */
export function pageMeta(pathname: string): PageMeta {
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`
  const label = pageTitles[normalized]
  if (!label) return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, canonical: null }
  return {
    title: normalized === '/' ? DEFAULT_TITLE : label.includes('Iman Trucking School') ? label : `${label} | Iman Trucking School`,
    description: pageDescriptions[normalized] ?? DEFAULT_DESCRIPTION,
    canonical: `${SITE_ORIGIN}${normalized}`,
  }
}
