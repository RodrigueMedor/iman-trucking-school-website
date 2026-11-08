# Roadmaster CDL Guide → IMAN Content Mapping

Reference: https://www.roadmaster.com/how-to-get-a-cdl-license/ (reviewed 2026-11-05). Only the **order of topics** was used. All IMAN text is original, and no Roadmaster text, images, branding, locations or services were carried over. A unit test fails if "roadmaster" appears in the published page content or FAQ.

## Reference sequence

| # | Reference heading (summarized) | What it covers |
|---|---|---|
| 1 | H1 "How to Get Your Class A CDL License" + intro | CDL as a career change |
| 2 | What a CDL is and why you need one | License for large commercial vehicles |
| 3 | First step: Commercial Learner's Permit | Written knowledge test; drive only with a CDL holder |
| 4 | Preparing for the exam | Training from a Training Provider Registry provider (plus self-promotion) |
| 5 | Necessary documents | Identity, residency, license, medical certificate; check with DMV |
| 6 | Skills test and beyond | Inspection, low-speed maneuvers, road test |
| — | FAQ | None on the reference |

## Mapping

| Reference topic | IMAN guide `/how-to-get-a-cdl/` | IMAN homepage summary | Notes / added facts (source) |
|---|---|---|---|
| Intro | `#introduction` "Starting a career in commercial driving" | Hero: "Start Your Journey Toward a Commercial Driver's License" | Points readers to FLHSMV for current rules |
| What is a CDL | `#what-is-a-cdl` with Class A/B/C + endorsements | "What is a CDL?" (4 cards: why, vehicles, Class A, careers) | Class definitions per 49 CFR 383.91 |
| *(not on reference)* | `#requirements` "Class A CDL requirements" | Requirements checklist card | FLHSMV age 18 / under-21 intrastate; 21 interstate and hazmat; residency; medical (FLHSMV medical page); English (49 CFR 391.11) |
| CLP | `#clp` | Step 2 card | Knowledge tests at a driver license office only (FLHSMV third-party FAQ); 14-day hold (49 CFR 383.25(e)); Class A tests (FLHSMV) |
| Preparing for the exam | `#exam-prep` | — | Study tips only. The reference's school promotion is **not** transferred |
| ELDT (part of "Preparing") | `#eldt` (own section) | Step 3 card + note in "CDL training at Iman" | Effective 2022-02-07, TPR, 80% theory, proficiency-based behind-the-wheel (49 CFR 380 Subpart F; tpr.fmcsa.dot.gov). **IMAN's TPR listing is not claimed** |
| Documents | `#documents` | Step 4 card + "Documents you may need" checklist | FLHSMV: original documents for identity, SSN and address; CDL/CLP residency documents. Marked as non-exhaustive |
| Skills test | `#skills-test` | "The CDL skills test" (3 cards) + Step 5 | FLHSMV: three parts, in English, third-party testers; automatic-transmission restriction (49 CFR 383.95) |
| "And beyond" | `#after-the-test` "After you pass" | Step 6 card | Issuance at a driver license office; medical lapse consequences (FLHSMV); employer drug test and Clearinghouse query (49 CFR 382) |
| *(no FAQ on reference)* | `#faq`, 14 questions, FAQPage JSON-LD | First 4 questions + "See all" | Single source `src/config/cdlFaq.ts` |
| CTA | Enrollment callout (Apply for CDL Training / Request information) + "Next steps" links | "Ready to Take the Next Step?" Apply Now / Contact Us | Uses the existing portal application; no new form |

## IMAN-specific content kept separate from general licensing information

- **IMAN offerings** (only existing published claims): `/cdl-training/` (classroom and range, supervised driving, schedules, tuition and financing, career support), the homepage section "CDL training at Iman" (existing curriculum list), and About Us (existing "why choose" grid, address).
- **General licensing information**: the guide, the homepage CDL sections and the FAQ regulatory answers. Written as general guidance with "confirm with FLHSMV."

## Roadmaster site menu coverage (added 2026-11-05)

The reference page also carries Roadmaster's site-wide menus (about 90 links). Each item was handled as follows.

| Roadmaster menu item | IMAN | Status |
|---|---|---|
| How to get a CDL, Class A CDL, Class A requirements, CDL License, CDL Permit, CDL Exam, CDL Classes, ELDT | `/how-to-get-a-cdl/` (sections) | Done |
| Age Requirements, Truck Driver Under 21 | `/cdl-age-requirements/` (one page) | **Added**: FLHSMV ages; the federal under-21 pilot (SDAP) ended 2025-11-07 |
| Medical Requirements | `/cdl-medical-requirements/` | **Added**: 49 CFR 391.41–.45, FLHSMV categories, electronic reporting since 2025-06-23 |
| Truck Driving School Cost | `/tuition-financing/` live price sheet | **Added**: reads the same `cdl_courses` rows the portal charges (Class A and B $3,429; +$500 optional housing) |
| Truck Driver Pay by State | `/truck-driver-pay-florida/` | **Added**: BLS OEWS May 2025 (FL median $50,640; Orlando $50,250; U.S. $58,640) |
| Truck Driving Career Benefits | `/truck-driving-career-benefits/` | **Added**: BLS outlook (4% growth 2025–35, about 214,500 openings a year) plus realities |
| CDL Jobs, Career Services, Job Placement, Team Truck Driving | `/cdl-jobs/` (one page) | **Added**: general career paths, federal hiring checks, IMAN's existing "job-placement assistance" claim (no guarantee). Team driving is described as a job type, not an IMAN program |
| Amazon Career Choice, Graduate Testimonials, Privacy | Existing pages | Done |
| Virtual Tours | `/gallery/` | Existing photos; a real tour needs IMAN video |
| Spanish-language program | Header translation (EN/KR/ES) | No Spanish *program* is claimed |
| Choice of Employers, Tuition Reimbursement, Veterans' training, Fleet training, ELDT credit transfer, Loan payments, Graduate verification, CDL Instructor, Careers, Complaints, News, Blog | — | **Needs IMAN facts.** Not published (see the summary) |
| Locations (20), virtual tours by city, pay pages for other states, "CDL Mills vs Roadmaster" | — | Not applicable (Roadmaster-only) |
