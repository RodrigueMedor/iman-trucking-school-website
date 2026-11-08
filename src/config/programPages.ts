import type { PageContent } from '../components/InternalPage'

// Training program pages. That Iman offers these programs comes from the
// school (Class B is also an active course in the portal); curriculum,
// schedules and box-truck/hotshot tuition are not published until the school
// confirms them, so those pages send visitors to admissions. Licensing facts
// follow FLHSMV and FMCSA (49 CFR 383.91 license classes, 390.5 commercial
// motor vehicle, 393 Subpart I cargo securement).
export const programPages: Record<string, PageContent> = {
  '/class-b-cdl-training/': {
    eyebrow: 'Straight trucks, buses and more',
    intro: 'Earn a Class B CDL to drive large single-unit vehicles such as straight trucks, dump trucks and buses. Iman offers Class B CDL training alongside its Class A program.',
    sections: [
      {
        id: 'what-it-covers',
        title: 'What a Class B CDL lets you drive',
        body: 'A Class B CDL covers single vehicles with a gross vehicle weight rating of 26,001 pounds or more, including when they tow a trailer rated 10,000 pounds or less.',
        bullets: ['Straight and box trucks over 26,000 lbs', 'Dump trucks and cement mixers', 'Garbage and recycling trucks', 'Buses, with a passenger or school bus endorsement'],
      },
      {
        id: 'class-a-or-b',
        title: 'Class B or Class A?',
        body: 'Class B fits drivers who want to operate one large vehicle, often on local routes. A Class A CDL lets you drive most Class B vehicles too and opens tractor-trailer jobs, so compare your goals before you choose. If you start with Class B and later upgrade to Class A, federal rules require Class A Entry-Level Driver Training for the upgrade.',
      },
      {
        id: 'licensing-steps',
        title: 'Getting your Class B CDL',
        body: 'The steps mirror the Class A process, with tests taken for a Class B vehicle.',
        bullets: [
          'General Knowledge test, plus Air Brakes if your vehicle has air brakes',
          'A Commercial Learner’s Permit held at least 14 days before the skills test',
          'Class B Entry-Level Driver Training from a registered provider',
          'A three-part skills test in a Class B vehicle',
        ],
      },
      {
        id: 'class-b-at-iman',
        title: 'Class B training at Iman',
        body: 'Current Class B tuition is shown below and in your student portal. Apply online, choose Class B training and a start session, and admissions will confirm your schedule.',
      },
    ],
  },
  '/box-truck-training/': {
    eyebrow: 'Non-CDL program',
    intro: 'Learn to operate a box truck safely and professionally without a commercial driver’s license, for delivery, moving and local freight work.',
    sections: [
      {
        id: 'no-cdl-needed',
        title: 'When a box truck does not require a CDL',
        body: 'In Florida, a regular Class E license covers a box truck when its gross vehicle weight rating is 26,000 pounds or less, it does not carry hazardous materials that require placards, and it is not designed to carry 16 or more people. Larger trucks require a Class B CDL.',
        bullets: ['Gross vehicle weight rating of 26,000 lbs or less', 'No placarded hazardous materials', 'Designed for fewer than 16 people, including the driver', 'Over 26,000 lbs: a Class B CDL is required'],
      },
      {
        id: 'federal-rules',
        title: 'Federal rules can still apply',
        body: 'Even without a CDL, a truck rated over 10,000 pounds used for business across state lines is a commercial motor vehicle under federal rules. Depending on the operation, the driver or company may need a USDOT number, a DOT medical certificate and compliance with hours-of-service limits. Check FMCSA’s requirements for your situation.',
      },
      {
        id: 'driver-skills',
        title: 'Skills box truck drivers rely on',
        body: 'Box trucks are larger, taller and heavier than the vehicles most people learn on. These are the skills that keep drivers and deliveries safe.',
        bullets: [
          'Pre-trip inspections and basic vehicle checks',
          'Backing, turning and docking in tight spaces',
          'Securing and balancing cargo',
          'Clearance awareness for bridges, drive-thrus and overhangs',
          'Following distance and braking with a loaded truck',
          'Delivery paperwork and trip records',
        ],
      },
      {
        id: 'box-truck-at-iman',
        title: 'Box truck training at Iman',
        body: 'Iman offers box truck training for drivers who do not need a CDL. When online enrollment is open, current tuition appears on this page and you can apply and pay from your student portal. Contact admissions for the curriculum and schedule.',
      },
    ],
  },
  '/hotshot-training/': {
    eyebrow: 'CDL and non-CDL options',
    intro: 'Hotshot drivers haul time-sensitive loads with a heavy-duty pickup and a flatbed or gooseneck trailer. Iman offers hotshot training for drivers with and without a CDL.',
    sections: [
      {
        id: 'what-is-hotshot',
        title: 'What hotshot trucking is',
        body: 'Hotshot carriers move smaller, often urgent loads, such as equipment, machinery and building materials, using a one-ton or larger pickup and a flatbed, gooseneck or similar trailer. Many hotshot drivers run their own small business.',
      },
      {
        id: 'cdl-or-non-cdl',
        title: 'Do you need a CDL for hotshot work?',
        body: 'It depends on the combined weight rating of your truck and trailer. Most non-CDL hotshot setups keep the combined rating at 26,000 pounds or less. A Class A CDL is generally required when the combined rating is 26,001 pounds or more and the trailer is rated over 10,000 pounds.',
        bullets: [
          'Combined rating of 26,000 lbs or less: usually no CDL',
          'Combined 26,001 lbs or more with a trailer over 10,000 lbs: Class A CDL',
          'Placarded hazardous materials: a CDL with the hazmat endorsement',
          'Go by the weight ratings on the truck and trailer labels, not just today’s load',
        ],
      },
      {
        id: 'running-an-operation',
        title: 'Running your own hotshot operation',
        body: 'Hotshot drivers who haul for others across state lines generally need a USDOT number and FMCSA operating authority, plus insurance. Vehicles over 10,000 pounds in interstate business also bring DOT medical, inspection and hours-of-service rules, with or without a CDL.',
        bullets: [
          'USDOT number',
          'Operating authority (MC number) for for-hire interstate loads',
          'Liability insurance at FMCSA minimums, plus cargo coverage customers often require',
          'DOT medical certificate and hours-of-service compliance',
        ],
      },
      {
        id: 'driver-skills',
        title: 'Skills hotshot drivers rely on',
        body: 'Hotshot loads are often heavy, oddly shaped and on a tight clock, so safe handling matters as much as speed.',
        bullets: [
          'Hitching gooseneck and bumper-pull trailers',
          'Securing loads with chains, straps and binders',
          'Distributing weight and staying within ratings',
          'Pre-trip and en-route inspections',
          'Backing and maneuvering a long combination',
          'Planning trips around weight and route limits',
        ],
      },
      {
        id: 'hotshot-at-iman',
        title: 'Hotshot training at Iman',
        body: 'Iman offers hotshot training for both CDL and non-CDL drivers. When online enrollment is open, current tuition appears on this page and you can apply and pay from your student portal. Contact admissions for the curriculum and schedule, and to find out which option fits your truck and trailer.',
      },
    ],
  },
}
