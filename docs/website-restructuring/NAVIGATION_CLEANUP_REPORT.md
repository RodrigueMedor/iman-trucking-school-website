# Navigation Cleanup Report

All navigation now comes from one config, `src/navigation.ts`, which the desktop header, mobile drawer and footer all read. Unit tests check that every link points to a live page or a real guide section, that no menu has duplicate links, and that no dropdown is empty.

## Before → after

| Before | After |
|---|---|
| Home | **Home** |
| Truck Driving School ▾ (5) | **CDL Training ▾**: CDL Training Overview, How to Get a CDL, Class A CDL Requirements, Age Requirements & Under 21, Medical Requirements, CDL Permit (CLP), CDL Training & ELDT, CDL Skills Test, Tuition & Financing |
| Our Program ▾ (6) | **Other Training ▾**: CDL Assessment |
| CDL Assessment | (moved into Other Training) |
| Apply for Training | **Apply Now** (single red button, right side) |
| — | **About Us** |
| — | **Truck Driver Career ▾**: CDL Jobs & Career Services, Truck Driver Pay in Florida, Truck Driving Career Benefits |
| Contact Us | **Contact Us** |
| Gallery | (moved to footer and About Us) |
| Sign in (red primary button) | Sign in (outlined), so Apply Now is the one primary action |

Mobile: the drawer renders the same groups and links, with Apply Now and Sign in at the bottom.

## Removed from the header

| Item | Reason | Where it is now |
|---|---|---|
| Truck Driving School dropdown | Duplicated program pages | Pages consolidated (see redirects) |
| Our Program dropdown | Duplicated the CDL Training group | CDL Training dropdown |
| Truck Driving School, Our Program, Class A CDL, CDL Training School links | Same search intent as `/cdl-training/` | 301 to `/cdl-training/` |
| Orlando Truck Driving School | Duplicate of the Orlando CDL page | 301 to `/cdl-training-program-orlando-florida/` (footer) |
| CDL License Information, How to Become a Truck Driver | Same intent as the new guide | 301 to `/how-to-get-a-cdl/` |
| CDL Permit Tests | Thin page; now a guide section | 301 to `/how-to-get-a-cdl/#clp` |
| Amazon Career Choice | Funding option, not a program | Footer, homepage "Other training and student services", Tuition page |
| Gallery | Secondary | Footer, About Us |

## Consolidated

- Eight overlapping CDL pages became two: `/cdl-training/` (IMAN's program) and `/how-to-get-a-cdl/` (licensing guide).
- Two Orlando pages became one.
- FAQ: a single source, shown in full on the guide (the only page with FAQ structured data) and previewed on the homepage.
- The `/cdl-training/` FAQ and its regulatory sections from the earlier CDL work were moved to the guide, so they are no longer duplicated.

## Preserved

Home, Tuition & Financing, CDL Assessment, Amazon Career Choice, Orlando CDL page, Testimonials, Gallery, Contact Us, Contact form (via "Request information" buttons), Student Payment, Kreyòl, Privacy, Terms, the language selector, the Sign in / My Portal / Admin button, the phone, email and social links in the top bar, and all portal and admin routes.

## Added

| Item | Reason |
|---|---|
| `/how-to-get-a-cdl/` | Main educational guide (spec phase 4) |
| `/about-us/` | Requested nav item. Built only from existing published content: footer description, "why choose" grid, address |
| Apply Now button (header, drawer, footer, hero, final CTA) | One clear application path: the existing portal application |
| Footer "Training" and "School" columns | Holds the pages removed from the header, plus Privacy and Terms |
| `robots.txt`, `sitemap.xml` | Sitemap lists the 16 live pages; robots blocks `/admin/` and `/portal/` |

## Redirects created

Defined once in `shared/redirects.mjs` and served as **HTTP 301** by `server.js` (Hostinger Node), mirrored in `public/.htaccess` (Apache), and as client-side redirects in the router. Query strings are kept. Verified with curl against `node server.js`.

| From | To |
|---|---|
| `/our-program/` | `/cdl-training/` |
| `/class-a-cdl/` | `/cdl-training/` |
| `/truck-driving-school/` | `/cdl-training/` |
| `/advantages-of-attending-a-cdl-training-school/` | `/cdl-training/` |
| `/truck-driving-school-orlando-florida/` | `/cdl-training-program-orlando-florida/` |
| `/cdl-license-information/` | `/how-to-get-a-cdl/` |
| `/how-to-become-a-truck-driver/` | `/how-to-get-a-cdl/` |
| `/cdl-permit-tests/` | `/how-to-get-a-cdl/#clp` |

The existing redirects (`/cdl-login/`, `/cdl-register/`, `/class-application/`, `/cdl-readiness/`, `/dispatcher-registration/`, …) are unchanged.

## Not done (needs your decision)

- **Dispatcher / Freight Broker training**: not in the menu because the dispatcher program was retired in October 2026 (including its data) and no broker program exists. "Other Training" currently holds only the CDL Assessment; add items to `otherTrainingLinks` if a program returns.

## Iman School menu (added 2026-11-05)

The top-level "About Us" link became an **Iman School ▾** dropdown (13 items after the second addendum), IMAN's counterpart to the reference site's school menu:

- About Us
- Choosing a CDL School (new, general guidance)
- Graduate Testimonials
- School Gallery
- Career Services & Job Placement (`/cdl-jobs/#career-services`)
- Orlando Training Center
- Student Payments
- Privacy Policy

It fits the desktop header down to 1200px and appears as a fourth group in the mobile drawer.

| Reference school-menu item | IMAN |
|---|---|
| CDL Mills vs (school) | `/choosing-a-cdl-school/`: a neutral checklist (TPR listing, Florida CIE licensing, behind-the-wheel time, itemized pricing, testing and job claims). It makes no claims about competitors and no unverified claims about IMAN |
| Graduate Testimonials | `/testimonials/` |
| Career Services, Job Placement | `/cdl-jobs/#career-services` |
| Loan payments | `/payment/` (payment help); financing is on Tuition & Financing |
| Privacy Policy | `/privacy-policy/` |
| ELDT Credit Transfer | `/eldt-credit-transfer/`: federal rules on splitting theory and behind-the-wheel between registered providers; "contact admissions" about prior training (no transfer policy claimed) |
| Graduate Verifications | `/graduate-verification/`: request through the school's existing email and phone; written permission may be needed; how ELDT records are checked |
| CDL Instructor, Careers | `/careers/` (+ `#cdl-instructor`): contact to ask about openings (no openings claimed); federal qualifications from 49 CFR 380.605 |
| Complaints | `/student-complaints/`: school first, then Florida CIE *for CIE-licensed schools* (IMAN's licensing status is unconfirmed), then FMCSA for ELDT provider concerns |
| In the News, Fleet Training | **Not added.** There is no IMAN news coverage or confirmed fleet/company training to publish |

## Other Training removed (2026-11-05)

At the owner's request, the "Other Training ▾" dropdown was removed and **CDL Assessment** moved into **CDL Training ▾** (after CDL Skills Test). The header is now: Home · CDL Training ▾ · Truck Driver Career ▾ · Iman School ▾ · Contact Us · Apply Now. The mobile drawer mirrors it. The CDL Assessment page, URL and footer link are unchanged.

## Training programs added (2026-11-05)

From the school's program list (team message, 2026-11-05):
- Class B Training
- Box Truck Training (non-CDL)
- Hotshot Training (CDL and non-CDL)

The reference site offers none of these; its own FAQ says it teaches only Class A.

| New page | Notes |
|---|---|
| `/class-b-cdl-training/` | What Class B covers, Class B vs A, licensing steps; live tuition (Class B is an active portal course, $3,429) |
| `/box-truck-training/` | Florida Class E vs Class B threshold (26,000 lbs), federal rules over 10,000 lbs interstate, driver skills; enrollment through admissions |
| `/hotshot-training/` | CDL vs non-CDL by combined rating, USDOT/MC/insurance for owner-operators, driver skills; enrollment through admissions |

The **CDL Training ▾** menu is now grouped:
- **Training programs:** Class A, Class B, Box Truck (Non-CDL), Hotshot, ELP, Tuition & Financing
- **Getting your CDL:** How to Get a CDL, Class A requirements, age, medical, CLP, ELDT, skills test

The mobile drawer shows the same groups. The homepage "Other training and student services" and the footer list the new programs. Box truck and hotshot pages use "Request information" instead of "Apply for CDL Training", because they are not portal courses.

**Needs the school's confirmation before more is published:** curriculum, length, schedule and tuition for box truck and hotshot training; whether hotshot training is offered for both CDL and non-CDL drivers, as the team message suggests.
