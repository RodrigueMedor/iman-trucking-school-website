// The site's single CDL FAQ. The full list renders on /how-to-get-a-cdl/ (with
// FAQPage structured data); the homepage previews the first few. Regulatory
// answers follow FMCSA (49 CFR Parts 380, 383, 391) and FLHSMV guidance;
// school-specific answers only restate what Iman already publishes or enforces
// in the portal. Open items are listed in WEBSITE_RESTRUCTURING_SUMMARY.md.
export type FaqItem = { question: string; answer: string }

export const FAQ_PAGE_KEY = 'how-to-get-a-cdl'
export const HOME_FAQ_PREVIEW_COUNT = 4

export const cdlFaq: FaqItem[] = [
  {
    question: 'What is a CDL?',
    answer: 'A Commercial Driver’s License (CDL) is a state-issued license that allows you to drive large or specialized commercial vehicles. A Class A CDL covers combination vehicles such as tractor-trailers, where the total weight is 26,001 pounds or more and the trailer is over 10,000 pounds.',
  },
  {
    question: 'How do I get a Class A CDL?',
    answer: 'Confirm you meet the requirements, pass the knowledge tests to get your Commercial Learner’s Permit (CLP), complete Entry-Level Driver Training with a registered provider, hold your CLP for at least 14 days, pass the three-part skills test, and then have your CDL issued at a Florida driver license office.',
  },
  {
    question: 'What is a Commercial Learner’s Permit (CLP)?',
    answer: 'The CLP is a learning permit you earn by passing the CDL knowledge tests at a Florida driver license office. It lets you practice driving a commercial vehicle on public roads with a qualified CDL holder beside you. You must hold it for at least 14 days before you can take the skills test.',
  },
  {
    question: 'What is ELDT and does it apply to me?',
    answer: 'Since February 7, 2022, federal rules require Entry-Level Driver Training for anyone getting a Class A or Class B CDL for the first time, upgrading from Class B to Class A, or adding a passenger, school bus or hazardous materials endorsement. Training must come from a provider on FMCSA’s Training Provider Registry and be completed before the skills test (or, for hazardous materials, before that knowledge test). Some drivers are exempt; the registry site at tpr.fmcsa.dot.gov has a tool to check.',
  },
  {
    question: 'What documents do I need?',
    answer: 'Florida requires original documents proving your identity, Social Security number, residential address and Florida residency, plus your current driver’s license and, if your driving category requires it, medical certification. The exact list depends on your situation, so check FLHSMV’s current requirements before your visit.',
  },
  {
    question: 'What does the CDL skills test include?',
    answer: 'Florida’s skills test has three parts: a pre-trip vehicle inspection, basic vehicle control maneuvers and an on-road driving test. It is conducted in English and given by FLHSMV-certified third-party testers.',
  },
  {
    question: 'How long does the CDL process take?',
    answer: 'It varies. You must hold your CLP for at least 14 days before the skills test, and the rest depends on your training schedule and testing availability. Iman’s open start sessions show their start and end dates when you apply, and admissions can help you plan a realistic timeline.',
  },
  {
    question: 'How can I apply for training at Iman?',
    answer: 'Select Apply Now, create or sign in to your free student account, and complete the training application. You can save a draft and track your status from your student portal. If you have questions first, contact admissions at (888) 991-4776.',
  },
  {
    question: 'How old do I have to be to get a CDL in Florida?',
    answer: 'Florida issues a CDL at age 18, but drivers under 21 are restricted to driving within Florida (intrastate). You must be at least 21 to drive across state lines or to hold a hazardous materials endorsement.',
  },
  {
    question: 'Do I need a DOT medical card?',
    answer: 'If your driving category requires medical certification, you must pass a Department of Transportation physical from a medical examiner listed on FMCSA’s National Registry. Since June 23, 2025, examiners send the results to FMCSA electronically. Florida explains the self-certification categories when you apply for your permit.',
  },
  {
    question: 'How much does CDL training cost, and can I get financing?',
    answer: 'Current tuition, with the training, testing, administrative and materials fees and optional housing, is listed on our Tuition & Financing page, and your student portal shows the exact amount before you pay. Students who qualify can apply for financing through our partner, Liberty Career Finance, and eligible Amazon associates may be able to use Amazon Career Choice.',
  },
  {
    question: 'Who can create an Iman student account?',
    answer: 'Student accounts are available to U.S. citizens and lawful permanent residents. If you are not sure whether you qualify, contact admissions before you register.',
  },
  {
    question: 'Should I take the English Language Proficiency (ELP) assessment first?',
    answer: 'The ELP assessment is optional. It checks your English Language Proficiency and readiness and is a good starting point if you want to know where you stand before training or testing. It is not a CDL test or certification.',
  },
  {
    question: 'Do you help graduates find driving jobs?',
    answer: 'Yes. Our team offers job-placement assistance and career guidance as you finish training. Employment is never guaranteed, and hiring decisions are made by employers.',
  },
]

/** schema.org FAQPage JSON-LD for the given questions and answers. */
export function faqStructuredData(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}
