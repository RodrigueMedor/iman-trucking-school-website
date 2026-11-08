import type { PageContent } from '../components/InternalPage'

// General CDL and career information. Sources: FLHSMV (Florida CDL and CDL
// medical certification pages), 49 CFR Parts 382, 383 and 391, FMCSA, and the
// U.S. Bureau of Labor Statistics (OEWS May 2025; Occupational Outlook
// Handbook, updated August 27, 2026). Iman-specific statements only repeat
// what the school already publishes. Re-check figures yearly.
export const cdlResourcePages: Record<string, PageContent> = {
  '/cdl-age-requirements/': {
    eyebrow: 'Eligibility',
    intro: 'How old you need to be for a commercial driver’s license in Florida, what changes at 21, and what drivers under 21 can do today.',
    sections: [
      {
        id: 'florida-minimums',
        title: 'Florida age minimums',
        body: 'Florida issues a CDL to applicants who are at least 18. Federal rules set a higher age for some kinds of driving, so your age affects where you can drive and what you can haul.',
        bullets: [
          '18 or older: you can apply for a CLP and CDL in Florida',
          'Under 21: your CDL is restricted to driving within Florida (intrastate)',
          '21 or older: you can drive across state lines (interstate)',
          '21 or older: required for a hazardous materials endorsement',
        ],
      },
      {
        id: 'under-21',
        title: 'Becoming a truck driver under 21',
        body: 'Drivers aged 18 to 20 can train, earn a Class A CDL and work for carriers whose routes stay inside Florida. Once you turn 21 and meet the other requirements, the intrastate restriction can be removed so you can drive interstate. A federal pilot program that let some under-21 drivers run interstate routes ended on November 7, 2025; any later exemptions are announced by FMCSA, so check fmcsa.dot.gov for the current status.',
        bullets: [
          'Look for Florida-based local and regional jobs',
          'Build a clean driving record while you are under 21',
          'Plan to remove the intrastate restriction when you turn 21',
          'Iman student accounts require applicants to be at least 18',
        ],
      },
      {
        id: 'no-maximum-age',
        title: 'Is there a maximum age?',
        body: 'There is no upper age limit for a CDL. What matters at any age is meeting the medical standards: commercial drivers must keep a current medical certification when their driving category requires it, so career changers can start later in life as long as they qualify medically.',
      },
    ],
  },
  '/cdl-medical-requirements/': {
    eyebrow: 'DOT physical',
    intro: 'What the Department of Transportation (DOT) medical exam involves, who needs one, and how Florida keeps your medical certification on file.',
    sections: [
      {
        id: 'who-needs-it',
        title: 'Who needs a DOT medical certificate',
        body: 'When you apply for a CLP or CDL in Florida, you self-certify the type of driving you will do. Drivers in the two “non-excepted” categories must keep a current medical certificate on file; drivers in the “excepted” categories do not.',
        bullets: [
          'Non-excepted interstate: medical certificate required',
          'Excepted interstate: exempt from federal medical certification',
          'Non-excepted intrastate (Florida only): medical certificate required',
          'Excepted intrastate: exempt from state medical certification',
        ],
      },
      {
        id: 'the-exam',
        title: 'What the exam checks',
        body: 'The physical must be done by a medical examiner listed on FMCSA’s National Registry of Certified Medical Examiners. The examiner reviews your health history and checks the standards in 49 CFR 391.41, then decides whether you qualify and for how long.',
        bullets: [
          'Vision: at least 20/40 in each eye, with or without glasses, and a 70° field of view',
          'Ability to recognize red, green and amber traffic signal colors',
          'Hearing, by whispered-voice test or hearing test',
          'Blood pressure, pulse and a urinalysis',
          'Overall health, medications and any conditions that could affect safe driving',
        ],
      },
      {
        id: 'how-long',
        title: 'How long a certificate lasts',
        body: 'A medical certificate is valid for up to 24 months. The examiner can issue a shorter certificate when a condition, such as high blood pressure, needs closer monitoring. Some conditions, including insulin-treated diabetes and certain vision problems, have specific federal rules or exemption programs, so bring records from your own doctor to the exam.',
      },
      {
        id: 'florida-records',
        title: 'How Florida receives your results',
        body: 'Since June 23, 2025, medical examiners send DOT exam results to FMCSA electronically, and the information reaches your Florida driver record. Florida suggests carrying your paper certificate for about 15 days until your record updates.',
        bullets: [
          'Keep your certificate current before it expires',
          'A lapsed certificate can lead to losing commercial privileges',
          'Drivers who cannot stay certified must downgrade to a non-commercial license',
        ],
      },
    ],
  },
  '/cdl-jobs/': {
    eyebrow: 'Careers',
    intro: 'The kinds of jobs a Class A CDL opens up, what employers check before you drive, and how Iman supports students as they finish training.',
    sections: [
      {
        id: 'career-paths',
        title: 'Common Class A career paths',
        body: 'A Class A CDL qualifies you for many kinds of driving. Each has a different schedule, home time and pay structure, so compare them before you choose your first job.',
        bullets: [
          'Over-the-road (long-haul): multi-day trips across states, often away from home for days or weeks',
          'Regional: routes within a region, usually home on weekends',
          'Local and dedicated: daily routes, often home every night',
          'Team driving: two drivers share one truck to keep it moving longer',
          'Tanker, doubles/triples or hazmat freight with the right endorsements',
          'Flatbed, refrigerated and less-than-truckload (LTL) freight',
        ],
      },
      {
        id: 'hiring-checks',
        title: 'What employers check before you drive',
        body: 'Federal rules require carriers to screen new drivers. Expect these steps after you receive a job offer and before you drive for a company.',
        bullets: [
          'A pre-employment drug test',
          'A query of FMCSA’s Drug and Alcohol Clearinghouse, which needs your consent',
          'A review of your driving record',
          'A road test or an accepted equivalent',
          'A current medical certificate, when your driving category requires it',
        ],
      },
      {
        id: 'career-services',
        title: 'Career support at Iman',
        body: 'Our team offers career guidance and job-placement assistance as you finish training, helping you understand employer expectations, application steps and the realities of different driving roles. Employment is never guaranteed, and hiring decisions are made by employers.',
        bullets: [
          'Guidance on choosing between local, regional and long-haul work',
          'Help preparing for employer applications and interviews',
          'Questions answered by admissions at (888) 991-4776',
        ],
      },
    ],
  },
  '/truck-driver-pay-florida/': {
    eyebrow: 'Earnings data',
    intro: 'What heavy and tractor-trailer truck drivers earn in Florida and the Orlando area, based on the latest U.S. Bureau of Labor Statistics wage survey.',
    sections: [
      {
        id: 'what-affects-pay',
        title: 'What affects a driver’s pay',
        body: 'Wages vary widely. The figures above are survey estimates for all heavy and tractor-trailer truck drivers, not a promise of what any job or graduate will earn. Ask each employer how they pay and what a typical week looks like.',
        bullets: [
          'Pay method: per mile, per hour, per load or salary',
          'Type of driving: local, regional or over-the-road',
          'Experience and a clean safety record',
          'Endorsements such as tanker or hazardous materials',
          'Freight type, such as refrigerated or flatbed',
          'Sign-on bonuses, benefits and home time',
        ],
      },
    ],
  },
  '/truck-driving-career-benefits/': {
    eyebrow: 'Is trucking right for you?',
    intro: 'The advantages of a professional driving career, along with the realities to weigh before you commit.',
    sections: [
      {
        id: 'demand',
        title: 'Steady demand for drivers',
        body: 'The U.S. Bureau of Labor Statistics projects employment of heavy and tractor-trailer truck drivers to grow about 4% from 2025 to 2035, with about 214,500 openings each year, mostly to replace drivers who retire or change careers.',
      },
      {
        id: 'advantages',
        title: 'Advantages of the career',
        body: 'Trucking offers a path into a skilled trade without a college degree, and many drivers value the independence of the work.',
        bullets: [
          'Training measured in weeks or months, not years',
          'A Florida median wage of $50,640 a year (BLS, May 2025)',
          'Choice of local, regional or long-haul work',
          'Room to grow with endorsements and experience',
          'Independence and time on the road',
          'Skills that are needed across many industries',
        ],
      },
      {
        id: 'realities',
        title: 'Realities to consider',
        body: 'A good decision weighs the demands of the job too. Federal hours-of-service rules limit how long you can drive, long-haul routes can keep you away from home, and drivers must stay medically qualified.',
        bullets: [
          'Up to 11 hours of driving within a 14-hour work window, then 10 hours off',
          'Nights, weekends and holidays are common',
          'Long-haul jobs can mean days or weeks away from home',
          'A DOT physical at least every two years',
          'Random drug and alcohol testing',
          'Physically demanding work with real safety risks',
        ],
      },
    ],
  },
  '/choosing-a-cdl-school/': {
    eyebrow: 'Compare before you enroll',
    intro: 'The questions worth asking any truck driving school, including us, before you commit your time and money.',
    sections: [
      {
        id: 'eldt-provider',
        title: 'Is the school a registered ELDT provider?',
        body: 'First-time Class A applicants must complete Entry-Level Driver Training with a provider listed on FMCSA’s Training Provider Registry before the skills test. Training from an unlisted provider does not count, so search the school by name at tpr.fmcsa.dot.gov before you pay.',
      },
      {
        id: 'state-license',
        title: 'Is the school licensed in Florida?',
        body: 'Florida’s Commission for Independent Education licenses many private career schools. Ask whether the school is licensed or exempt, and confirm it with the Commission.',
      },
      {
        id: 'training-time',
        title: 'How much time will you spend behind the wheel?',
        body: 'Federal rules judge behind-the-wheel training on proficiency rather than a set number of hours, so schools vary widely. Ask for specifics.',
        bullets: [
          'Hours of range and public-road driving per student',
          'How many students share each truck',
          'Manual or automatic transmission (testing in an automatic adds a license restriction)',
          'Class sizes and schedule options',
        ],
      },
      {
        id: 'pricing',
        title: 'Is the price itemized and in writing?',
        body: 'A trustworthy school shows exactly what you will pay before you sign. Ask for every fee, the refund policy and, if you finance, the lender’s terms in writing.',
        bullets: ['Training, testing, administrative and materials fees', 'Housing or other optional costs', 'Refund and cancellation policy', 'Financing terms from the lender itself'],
      },
      {
        id: 'testing-and-jobs',
        title: 'What happens at testing time and after?',
        body: 'Ask where and when you will take the skills test, what career support includes, and be cautious of anyone who guarantees a job or a passing score. Hiring decisions belong to employers, and examiners score the test.',
      },
      {
        id: 'asking-iman',
        title: 'Asking Iman',
        body: 'Our itemized tuition, including optional housing, is published on our Tuition & Financing page. Call admissions at (888) 991-4776 or visit the training center to ask us any of the questions on this page.',
      },
    ],
  },
  '/eldt-credit-transfer/': {
    eyebrow: 'Already started training?',
    intro: 'How Entry-Level Driver Training you completed with another provider is recorded, what federal rules allow, and how to ask whether it can count toward training at Iman.',
    sections: [
      {
        id: 'how-eldt-is-recorded',
        title: 'How ELDT completion is recorded',
        body: 'ELDT has two parts, theory and behind-the-wheel. When you finish a part, your training provider reports it to FMCSA’s Training Provider Registry, and Florida checks that record before your skills test. Only training from a provider listed on the registry counts.',
      },
      {
        id: 'what-can-transfer',
        title: 'What federal rules allow',
        body: 'Federal rules let you complete theory and behind-the-wheel training with different registered providers, with some limits. Each provider reports only the part it delivered.',
        bullets: [
          'Theory with one registered provider and behind-the-wheel with another is allowed',
          'Behind-the-wheel range and public-road training must come from the same provider',
          'A part left unfinished at one provider generally has to be completed with the new provider',
          'Florida can add requirements beyond the federal rules',
        ],
      },
      {
        id: 'asking-iman',
        title: 'Asking Iman about prior training',
        body: 'If you completed part of ELDT or other CDL training elsewhere, tell us before you apply using the form below, or call admissions. Have your training certificate or completion details ready, and we will explain how it affects your training plan and cost at Iman.',
        bullets: ['Send the online form below', 'Call (888) 991-4776', 'Have your provider’s name and completion dates ready'],
      },
    ],
  },
  '/graduate-verification/': {
    eyebrow: 'For employers and agencies',
    intro: 'How employers, licensing agencies and other schools can confirm that someone trained at Iman Trucking School.',
    sections: [
      {
        id: 'request',
        title: 'Requesting a verification',
        body: 'Use the online form below, or contact the school by email or phone, with the graduate’s full name and approximate training dates. To protect students’ privacy, we may need the graduate’s written permission before sharing training records.',
        bullets: ['Send the online form below', 'Email info@imanlogistics.com', 'Call (888) 991-4776', 'Have the graduate’s signed release ready if you have one'],
      },
      {
        id: 'eldt-records',
        title: 'Federal ELDT records',
        body: 'Entry-Level Driver Training completion is reported by the training provider to FMCSA’s Training Provider Registry, where state licensing agencies confirm it before the CDL skills test. A CDL itself is verified with the issuing state.',
      },
      {
        id: 'for-graduates',
        title: 'For graduates',
        body: 'Need proof of training for an employer? Contact admissions and tell us where the verification should be sent.',
      },
    ],
  },
  '/careers/': {
    eyebrow: 'Work at Iman',
    intro: 'Interested in teaching future truck drivers or joining the Iman team? Here is how to reach us and what federal rules require of CDL instructors.',
    sections: [
      {
        id: 'working-at-iman',
        title: 'Working at Iman',
        body: 'To ask about current openings for instructors or other roles, send the form below, or email info@imanlogistics.com with your résumé and the position you are interested in. You can also call (888) 991-4776.',
      },
      {
        id: 'cdl-instructor',
        title: 'CDL instructor requirements',
        body: 'Federal Entry-Level Driver Training rules (49 CFR 380.605) set minimum qualifications for theory and behind-the-wheel instructors. Florida and individual schools can require more.',
        bullets: [
          'A CDL of the same or higher class, with every endorsement needed for the training',
          'At least 2 years of experience driving a vehicle that requires that CDL, or 2 years as a behind-the-wheel instructor',
          'Any Florida instructor qualifications that apply',
          'No instruction for 2 years after a CDL is reinstated following a disqualifying offense',
          'Range-only instructors and theory instructors may qualify with a CDL they held previously',
        ],
      },
    ],
  },
  '/student-complaints/': {
    eyebrow: 'Student support',
    intro: 'How to raise a concern about your training or experience at Iman Trucking School, and where to go if it is not resolved.',
    sections: [
      {
        id: 'contact-the-school',
        title: 'Start with the school',
        body: 'Most concerns are resolved fastest by talking with us directly. Use the form below to describe the problem in writing, including dates, the people involved and the outcome you are asking for. You will receive a reference number, and admissions tracks every submission until it is resolved. Keep copies of any documents.',
        bullets: ['Send the online form below', 'Email info@imanlogistics.com', 'Call (888) 991-4776', 'Keep your enrollment agreement, receipts and other documents'],
      },
      {
        id: 'florida-cie',
        title: 'Florida Commission for Independent Education',
        body: 'For schools licensed by Florida’s Commission for Independent Education (CIE), students who have used the school’s process without a satisfactory result can file a complaint with the Commission, which contacts the school for its response. Complaints sent to the Commission become public records. See fldoe.org/policy/cie/student-concerns or email CIEINFO@fldoe.org.',
      },
      {
        id: 'fmcsa',
        title: 'Federal training requirements',
        body: 'Concerns that a registered Entry-Level Driver Training provider is not meeting federal requirements can be reported to the Federal Motor Carrier Safety Administration, which can remove noncompliant providers from the Training Provider Registry.',
      },
    ],
  },
}
