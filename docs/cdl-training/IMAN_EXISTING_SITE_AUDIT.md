# IMAN Trucking School — Existing Site Audit

Audited 2026-11-05 against local `main` (2154b3e). Production (https://imantruckingschool.com) serves the same React app. Its bundle contains the same routes, financing, portal, billing and identity features, and `/api/health` reports Stripe, webhook, database and email OK, with SMS and chat off.

## Architecture

| Area | Implementation |
|---|---|
| Frontend | React 19 + Vite 7 + TypeScript, Material UI 7, react-router 7 (`src/App.tsx`) |
| Public pages | One `InternalPage` template driven by `pageContent` (`src/components/InternalPage.tsx`) and `pageTitles` (`src/navigation.ts`); homepage `HomeHero` + `HomePage` |
| CMS | `school_content` table via `ContentContext`; admin editor at `/admin/content/` overrides `section-N` / `custom-*` keys per page |
| API | Express (`server-express.js`) served with the static build by `server.js` on Hostinger Node |
| Database/Auth | Supabase (Postgres + Auth + Storage), 34 migrations in `supabase/migrations/`, RLS tests in `supabase/tests/` |
| Payments | Stripe Checkout (registration, application, tuition), webhooks at `/api/stripe-webhook`, Liberty Career Finance referrals |
| Identity | Stripe Identity gate on applications (existing students exempt) |
| Email/SMS | Resend (on in prod); Twilio (off in prod) |
| Leads | GoHighLevel/LeadConnector form in `EnrollmentModal` and `/contact-form/`; LeadConnector chat widget; "Ask Iman" chat (Netlify function, off in prod) |
| Translation | Google Translate (EN / Kreyòl / ES) via header selector |
| Deploy | GitHub Action `deploy-hostinger.yml`; Netlify drafts for staging |
| Tests | Vitest unit tests (`tests/*.test.ts`), Docker integration and RLS suites |

## Navigation

- Header "Programs" menu: Our Program, CDL Training, CDL Training School (→ advantages page), Class A CDL, Amazon Career Choice, Tuition & Financing.
- Header "Truck Driving" menu: Truck Driving School, Orlando Truck Driving School, CDL License Information, CDL Permit Tests, How to Become a Truck Driver.
- Direct links: CDL Assessment, Apply for Training, Contact Us, Gallery. Portal/admin account button, language selector, social links.
- Footer: Programs (first 4 of `programLinks`), Resources (first 4 of `resourceLinks`), address, phone, Privacy, Terms.

## Public CDL content (before this change)

| Route | Content |
|---|---|
| `/` | Hero with financing, rotating truck imagery, "Why choose Iman" (6), curriculum list (6), "CDL in just 4 weeks" enrollment band, Orlando campus card |
| `/our-program/` | 2 sections (program overview, schedules) |
| `/class-a-cdl/` | 2 sections (what Class A covers, how Iman prepares) |
| `/cdl-training/` | 2 short sections (classroom/range, supervised driving) |
| `/cdl-training-program-orlando-florida/` | 2 sections (local training, visit) |
| `/truck-driving-school/`, `/truck-driving-school-orlando-florida/` | 2 sections each |
| `/cdl-license-information/`, `/cdl-permit-tests/`, `/how-to-become-a-truck-driver/`, `/advantages-of-attending-a-cdl-training-school/` | 2 sections each (general guidance) |
| `/tuition-financing/` | Tuition/ways to pay + Liberty financing callout |
| `/cdl-assessment/` | ELP assessment details (49 CFR 391.11(b)(2)) |
| `/amazon-career-choice/` | Benefit guidance |
| `/contact-us/`, `/contact-form/`, `/payment/`, `/gallery/`, `/testimonials/`, `/kreyol/`, legal pages | Supporting pages |

Dispatcher/broker programs: the dispatcher registration was retired (migration `202610030003_drop_dispatcher.sql`; `/dispatcher-registration/` redirects home). No Freight Broker or Dispatch Masterclass pages exist in this codebase.

## Enrollment and student workflows

- Account: `/portal/register` (name, email, citizenship/LPR eligibility, password; email verification).
- Training application wizard `/portal/apply/training`: profile (name, email, phone, DOB 18+, address), license status (None / Regular / CLP / CDL + number + state + upload), program (course) and start session, optional statement, financing callout, payment policy signature, Stripe Identity.
- Assessment application `/portal/apply/assessment` + online ELP test.
- Portal: dashboard, applications, documents, billing (tuition by card, receipts), identity, schedule, profile.

## Admin back office (`/admin/`)

Dashboard, Website content (CMS), CDL scores, CDL applications (review, status, statement, course/session, ELP), CDL enrollments, instructor dashboard, tuition accounts (offline payments, waivers, voids), identity verifications, financing referrals and course pricing (super admin), create instructor (super admin).

## Design system (preserved)

- Theme (`src/theme.ts`): primary navy `#071a33`, secondary red `#d61f2c`, background `#f7f9fc`; Inter; rounded 14px; buttons 10px radius, no uppercase.
- Page hero: navy-to-red gradient over truck photo, breadcrumb, uppercase chip eyebrow, 950-weight H1.
- Content: numbered section badges, two-column check-bullet cards (`#fafbfc`, `#e7eaf0` border), sticky admissions card, gradient enrollment CTA card.

## Findings relevant to this work

1. **SEO**: every route shared one `<title>` and meta description, and no page had a canonical URL. `LegacyPage.tsx` sets titles but is not routed (dead code; left untouched).
2. **Headings**: section titles were styled as h3 with no h2, so internal pages jumped from h1 to h3.
3. **No FAQ** anywhere on the public site.
4. `/cdl-training/` had only two short sections; requirements, CLP, ELDT, testing and schedule information were missing or scattered.
5. Overlapping search intent: `/cdl-training-program-orlando-florida/` vs `/truck-driving-school-orlando-florida/`, and `/our-program/` vs `/cdl-training/` vs `/truck-driving-school/`.
6. Mobile: MUI responsive grid throughout; header uses a drawer on small screens.
