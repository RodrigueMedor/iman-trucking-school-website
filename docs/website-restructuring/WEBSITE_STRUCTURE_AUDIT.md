# Website Structure Audit (before restructuring)

Audited 2026-11-05 on branch `feature/cdl-training-enhancement` (based on `main` 2154b3e). Production (imantruckingschool.com) runs the same React build. See also `docs/cdl-training/IMAN_EXISTING_SITE_AUDIT.md` for architecture, enrollment, admin and payment details.

## Original header navigation

Desktop and mobile were defined separately in `src/components/Header.tsx`, using hard-coded lists.

| Position | Item | Type | Links |
|---|---|---|---|
| 1 | Home | Link | `/` |
| 2 | Truck Driving School | Dropdown | Truck Driving School `/truck-driving-school/`, Orlando Truck Driving School `/truck-driving-school-orlando-florida/`, CDL License Information `/cdl-license-information/`, CDL Permit Tests `/cdl-permit-tests/`, How to Become a Truck Driver `/how-to-become-a-truck-driver/` |
| 3 | Our Program | Dropdown | Our Program `/our-program/`, CDL Training `/cdl-training/`, CDL Training School `/advantages-of-attending-a-cdl-training-school/`, Class A CDL `/class-a-cdl/`, Amazon Career Choice `/amazon-career-choice/`, Tuition & Financing `/tuition-financing/` |
| 4 | CDL Assessment | Link | `/cdl-assessment/` |
| 5 | Apply for Training | Link | `/portal/apply/training` |
| 6 | Contact Us | Link | `/contact-us/` |
| 7 | Gallery | Link | `/gallery/` |
| Right | Language selector, **Sign in / My Portal** (red primary button) | | |
| Top bar | Phone, email, Facebook / X / Instagram | | |

`src/navigation.ts` also exported `programLinks`, `resourceLinks` and `utilityLinks`. The footer used the first four of the first two; `utilityLinks` was **unused**.

## Original footer

Logo and description, **"Start your application" → `/contact-form/`** (an information-request form, not the application), Programs (Our Program, Class A CDL, CDL Training, Tuition & Financing), Resources (CDL License Information, CDL Permit Tests, How to Become a Driver, Why Attend CDL School), contact details, Privacy, Terms.

## Original public pages (22)

| URL | Purpose | Overlap / issue |
|---|---|---|
| `/` | Homepage | Hero CTA "Check your CDL readiness"; "clear path" cards; why-choose grid; program/curriculum; "4 weeks" enrollment band; location |
| `/our-program/` | Program overview | Same intent as `/cdl-training/` and `/truck-driving-school/` |
| `/class-a-cdl/` | Class A licence + prep | Overlaps program pages |
| `/cdl-training/` | Training details | Hub candidate |
| `/truck-driving-school/` | Why train at a school | Overlaps program pages |
| `/advantages-of-attending-a-cdl-training-school/` | Why train at a school | Duplicate intent of `/truck-driving-school/`; menu label "CDL Training School" confused with "CDL Training" |
| `/cdl-training-program-orlando-florida/` | Orlando location | Local SEO page |
| `/truck-driving-school-orlando-florida/` | Orlando location | Duplicate of the above |
| `/cdl-license-information/` | Licensing pathway | Overlaps how-to page |
| `/cdl-permit-tests/` | CLP study tips | Thin (2 short sections) |
| `/how-to-become-a-truck-driver/` | 5 steps | Overlaps licensing page |
| `/amazon-career-choice/` | Funding option | Keep |
| `/tuition-financing/` | Tuition + Liberty financing | Keep (business function) |
| `/cdl-assessment/` | Paid ELP assessment | Keep (business function) |
| `/testimonials/`, `/gallery/` | Social proof | Keep |
| `/contact-us/`, `/contact-form/` | Contact, GHL lead form | Keep |
| `/payment/` | Payment help | Keep |
| `/kreyol/` | Kreyòl landing | Keep; site-wide translation is in the header |
| `/privacy-policy/`, `/terms-of-use-page/` | Legal | Keep (footer) |

No About page existed. There was no FAQ anywhere, and every page shared one `<title>` and meta description (fixed in the earlier CDL work on this branch).

## Business functions found (all preserved)

- Student portal: account, training and assessment applications, documents, billing (Stripe tuition), identity verification, schedule, profile.
- Admin: dashboard, website content CMS, CDL applications, enrollments, scores, instructors, tuition accounts, identity verifications, financing referrals, course pricing.
- Stripe Checkout and webhooks; Liberty Career Finance referrals; Resend email; Twilio SMS (off in prod); GoHighLevel lead form and chat widget; Google Translate.
- **Dispatcher training**: retired in October 2026. Commits c6173df and 2d7d600 removed the UI and API, and migration `202610030003_drop_dispatcher.sql` deleted its data. Only redirects for `/dispatcher-registration/` and the old admin URLs remain. **No freight broker program** exists in the code or on the live site.
- Unrouted code: `src/components/LegacyPage.tsx` and `public/legacy/*` (old WordPress copies). Left untouched.

## CMS content in production (read-only check)

`school_content` has 82 published rows. There are **no** rows for `home/hero`, `home/why-choose`, `home/program` or `home/enrollment`, so new defaults for those sections show immediately. Rows exist for `cdl-training` section-1/2 (kept in place), the home advantage and curriculum items (still used), and the retired pages (now orphaned and harmless; they stay in the admin's "All pages" list).

## Design system (unchanged)

Primary navy `#071a33`, header navy `#08085f`, secondary red `#d61f2c`, background `#f7f9fc`, Inter, 14px radius, buttons with a 10px radius and no uppercase. Page hero is a navy-to-red gradient over a truck photo. Cards use a 1px divider border, soft shadow and a hover lift. Responsive breakpoints: header drawer below `lg`, MUI grid `xs/sm/md/lg`.
