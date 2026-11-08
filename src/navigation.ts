// Single source for the header (desktop and mobile), footer and page titles.
export type NavLink = readonly [label: string, path: string]

export const APPLY_PATH = '/portal/apply/training'

export type NavGroup = { heading: string; links: readonly NavLink[] }

// The CDL Training menu is grouped so programs and licensing steps stay easy
// to scan. Programs come from the school (see docs/website-restructuring).
export const cdlTrainingGroups: readonly NavGroup[] = [
  {
    heading: 'Training programs',
    links: [
      ['Class A CDL Training', '/cdl-training/'],
      ['Class B CDL Training', '/class-b-cdl-training/'],
      ['Box Truck Training (Non-CDL)', '/box-truck-training/'],
      ['Hotshot Training', '/hotshot-training/'],
      ['English Language Proficiency (ELP)', '/cdl-assessment/'],
      ['Tuition & Financing', '/tuition-financing/'],
    ],
  },
  {
    heading: 'Getting your CDL',
    links: [
      ['How to Get a CDL', '/how-to-get-a-cdl/'],
      ['Class A CDL Requirements', '/how-to-get-a-cdl/#requirements'],
      ['Age Requirements & Under 21', '/cdl-age-requirements/'],
      ['Medical Requirements', '/cdl-medical-requirements/'],
      ['CDL Permit (CLP)', '/how-to-get-a-cdl/#clp'],
      ['CDL Training & ELDT', '/how-to-get-a-cdl/#eldt'],
      ['CDL Skills Test', '/how-to-get-a-cdl/#skills-test'],
    ],
  },
]

export const cdlTrainingLinks: readonly NavLink[] = cdlTrainingGroups.flatMap(group => group.links)

export const careerLinks: readonly NavLink[] = [
  ['CDL Jobs & Career Services', '/cdl-jobs/'],
  ['Truck Driver Pay in Florida', '/truck-driver-pay-florida/'],
  ['Truck Driving Career Benefits', '/truck-driving-career-benefits/'],
]

// IMAN's counterpart to the reference site's school menu. Fleet training and
// news are added once IMAN confirms it offers them / has coverage.
export const imanSchoolGroups: readonly NavGroup[] = [
  {
    heading: 'About Iman',
    links: [
      ['About Us', '/about-us/'],
      ['Orlando Training Center', '/cdl-training-program-orlando-florida/'],
      ['Graduate Testimonials', '/testimonials/'],
      ['School Gallery', '/gallery/'],
      ['Choosing a CDL School', '/choosing-a-cdl-school/'],
      ['Privacy Policy', '/privacy-policy/'],
    ],
  },
  {
    heading: 'Students & graduates',
    links: [
      ['Student Payments', '/payment/'],
      ['Career Services & Job Placement', '/cdl-jobs/#career-services'],
      ['ELDT Credit Transfer', '/eldt-credit-transfer/'],
      ['Graduate Verification', '/graduate-verification/'],
      ['Student Complaints', '/student-complaints/'],
    ],
  },
  {
    heading: 'Work with Iman',
    links: [
      ['Careers', '/careers/'],
      ['CDL Instructor Requirements', '/careers/#cdl-instructor'],
    ],
  },
]

export const imanSchoolLinks: readonly NavLink[] = imanSchoolGroups.flatMap(group => group.links)

// One-line summaries shown under the main links in the desktop menu. Each is
// taken from that page's own description (src/config/seo.ts).
export const navDescriptions: Record<string, string> = {
  '/cdl-training/': 'Classroom, range and road training',
  '/class-b-cdl-training/': 'What a Class B license covers',
  '/box-truck-training/': 'Box trucks that need no CDL',
  '/hotshot-training/': 'For CDL and non-CDL drivers',
  '/cdl-assessment/': 'Online test plus in-person evaluation',
  '/tuition-financing/': 'Tuition, housing and ways to pay',
  '/cdl-jobs/': 'Career paths and student support',
  '/truck-driver-pay-florida/': 'Florida and Orlando wage data',
  '/truck-driving-career-benefits/': 'Job outlook and what to consider',
}

/** The highlighted card beside a menu's links. */
export type NavFeature = { eyebrow: string; title: string; body: string; action: NavLink }

export type NavItem =
  | { label: string; path: string }
  | { label: string; links: readonly NavLink[]; groups?: readonly NavGroup[]; feature?: NavFeature }

export const mainNavigation: readonly NavItem[] = [
  { label: 'Home', path: '/' },
  {
    label: 'CDL Training',
    links: cdlTrainingLinks,
    groups: cdlTrainingGroups,
    feature: {
      eyebrow: 'Start your CDL',
      title: 'Ready to get behind the wheel?',
      body: 'Apply online, and our admissions team guides you from the start.',
      action: ['Apply Now', APPLY_PATH],
    },
  },
  {
    label: 'Truck Driver Career',
    links: careerLinks,
    feature: {
      eyebrow: 'Career services',
      title: 'Plan the road after training',
      body: 'See the career paths open to new Class A drivers and the support Iman offers students.',
      action: ['Explore career services', '/cdl-jobs/#career-services'],
    },
  },
  {
    label: 'Iman School',
    links: imanSchoolLinks,
    groups: imanSchoolGroups,
    feature: {
      eyebrow: 'Visit us',
      title: 'Our training center',
      body: '21902 State Road 46, Mount Dora, Florida, serving Orlando and Central Florida.',
      action: ['Contact admissions', '/contact-us/'],
    },
  },
  { label: 'Contact Us', path: '/contact-us/' },
]

export const footerTrainingLinks: readonly NavLink[] = [
  ['Class A CDL Training', '/cdl-training/'],
  ['Class B CDL Training', '/class-b-cdl-training/'],
  ['Box Truck Training (Non-CDL)', '/box-truck-training/'],
  ['Hotshot Training', '/hotshot-training/'],
  ['How to Get a CDL', '/how-to-get-a-cdl/'],
  ['English Language Proficiency (ELP)', '/cdl-assessment/'],
  ['Tuition & Financing', '/tuition-financing/'],
  ['Amazon Career Choice', '/amazon-career-choice/'],
  ['Orlando CDL Program', '/cdl-training-program-orlando-florida/'],
]

export const footerSchoolLinks: readonly NavLink[] = [
  ['About Us', '/about-us/'],
  ['Testimonials', '/testimonials/'],
  ['Gallery', '/gallery/'],
  ['Contact Us', '/contact-us/'],
  ['Student Payment', '/payment/'],
  ['Kreyòl', '/kreyol/'],
]

export const pageTitles: Record<string, string> = {
  '/': 'Iman Trucking School',
  '/cdl-training/': 'Class A CDL Training',
  '/how-to-get-a-cdl/': 'How to Get Your Class A CDL License',
  '/class-b-cdl-training/': 'Class B CDL Training',
  '/box-truck-training/': 'Box Truck Training (Non-CDL)',
  '/hotshot-training/': 'Hotshot Training',
  '/cdl-training-program-orlando-florida/': 'CDL Training Program in Orlando',
  '/cdl-age-requirements/': 'CDL Age Requirements in Florida',
  '/cdl-medical-requirements/': 'CDL Medical Requirements',
  '/cdl-jobs/': 'CDL Jobs & Career Services',
  '/truck-driver-pay-florida/': 'Truck Driver Pay in Florida',
  '/truck-driving-career-benefits/': 'Truck Driving Career Benefits',
  '/tuition-financing/': 'Tuition & Financing',
  '/cdl-assessment/': 'English Language Proficiency (ELP)',
  '/amazon-career-choice/': 'Amazon Career Choice',
  '/about-us/': 'About Iman Trucking School',
  '/choosing-a-cdl-school/': 'How to Choose a CDL School',
  '/eldt-credit-transfer/': 'ELDT Credit Transfer',
  '/graduate-verification/': 'Graduate Verification',
  '/careers/': 'Careers at Iman',
  '/student-complaints/': 'Student Complaints',
  '/testimonials/': 'Student Testimonials',
  '/gallery/': 'School Gallery',
  '/contact-us/': 'Contact Iman Trucking School',
  '/contact-form/': 'Enrollment Contact Form',
  '/payment/': 'Student Payment',
  '/kreyol/': 'Iman Trucking School — Kreyòl',
  '/privacy-policy/': 'Privacy Policy',
  '/terms-of-use-page/': 'Terms of Use',
}
