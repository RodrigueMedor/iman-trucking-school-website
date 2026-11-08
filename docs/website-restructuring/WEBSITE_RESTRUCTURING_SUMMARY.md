# Website Restructuring Summary

Branch `feature/cdl-training-enhancement` (uncommitted, not deployed). This builds on the earlier CDL enhancement in `docs/cdl-training/`.

## Pages updated

| Page | Change |
|---|---|
| `/` | Restructured into the 10 requested sections (below) |
| `/cdl-training/` | Now the Class A CDL Training overview (IMAN's program). Keeps CMS sections 1–2, adds schedules and paying/career sections, and a "New to the CDL process?" block linking to the guide. The regulatory sections and FAQ moved to the guide |
| `/how-to-get-a-cdl/` **(new)** | H1 "How to Get Your Class A CDL License". Nine anchored sections in the requested order, an "On this page" list, full FAQ with FAQPage JSON-LD, and next-step links |
| `/about-us/` **(new)** | Who we are, visiting the training center, the "Why choose Iman" grid (moved from the homepage) and links to testimonials and gallery |
| `/contact-us/` | Card headings are now h2 (visual unchanged) |
| `/kreyol/` | Button now goes to `/cdl-training/` instead of a retired URL |
| 8 retired pages | 301 redirects (see the navigation report) |

## Homepage sections

1. **Hero**: "Start Your Journey Toward a Commercial Driver's License". Apply Now and How to Get a CDL buttons. Same slideshow, financing callout and stats strip.
2. **What is a CDL?**: intro plus 4 cards (why it's required, vehicles, Class A, careers).
3. **How to get your CDL**: 6 step cards, each linking to its guide section.
4. **CDL training at Iman**: the existing navy program band and curriculum list, with an ELDT note.
5–6. **CDL requirements and documents**: two checklists linking to the guide.
7. **The CDL skills test**: 3 cards.
8. **Other training and student services**: CDL Assessment, Tuition & Financing, Amazon Career Choice.
9. **FAQ preview**: first 4 of the shared FAQ, with "See all CDL questions".
10. **Ready to Take the Next Step?**: Apply Now and Contact Us, plus the existing Orlando campus card.

## Sections removed from the homepage

- "A clear path starts with the right first move" (3 cards; replaced by the steps).
- "Why choose Iman" grid (moved to About Us, with the same CMS keys).
- "Accelerate your earnings with a CDL in just 4 weeks" band (replaced by the final CTA).

## Components reused

PageHero, StandardContent (numbered sections, check-bullet cards, sticky admissions card), EnrollmentCallout, the homepage card, avatar, navy band and red CTA styles, MUI Accordion, the header `DesktopMenu` and drawer accordions, `school_content` CMS, FinancingBenefits and FinancingBar, and the portal application. **No new dependencies.** `theme.ts`, `styles.css`, the logo and the images are unchanged.

## Files

| File | Change |
|---|---|
| `src/navigation.ts` | Single nav config (header, drawer, footer, page list) |
| `src/components/Header.tsx` | Renders the config; Apply Now button; Sign in outlined |
| `src/components/Footer.tsx` | Training, School and Contact columns; Apply Now |
| `src/components/HomeHero.tsx` | Headline, body, CTAs |
| `src/components/HomePage.tsx` | New section order; exports `WhyChooseIman` |
| `src/components/InternalPage.tsx` | Guide, About and overview content; section anchors; "On this page"; retired page content removed |
| `src/components/CdlFaq.tsx` (new) | Shared FAQ hook, accordions and section |
| `src/config/cdlFaq.ts` | Rewritten FAQ (14 questions) |
| `src/config/seo.ts` | Descriptions for the 16 live pages |
| `src/App.tsx` | Redirect routes; scroll to `#section` |
| `src/pages/AdminContent.tsx` | FAQ entries under page `how-to-get-a-cdl` |
| `shared/redirects.mjs` + `.d.mts` (new) | Redirect map |
| `server.js` | 301 redirects; `.txt`/`.xml` content types |
| `public/.htaccess` | 301 redirects |
| `public/robots.txt`, `public/sitemap.xml` (new) | SEO |
| `tests/cdl-content.test.ts` | 12 tests: SEO, sitemap, nav links and anchors, redirects, `.htaccess` sync, FAQ |

No database, Stripe, webhook, email, SMS, auth or environment changes.

## Tests performed

| Check | Result |
|---|---|
| `npx vitest run` | 173/173 passed |
| `npm run build` | Passed |
| Headless Chrome, 14 public pages | Each has exactly one h1, its own title and canonical, no console errors; FAQ JSON-LD only on the guide |
| Headless Chrome interaction script (CDP) | All 7 guide anchors land below the sticky header on direct load. The CDL Training dropdown link navigates to `#skills-test` and the menu closes. A same-page jump to `#clp` works. The Other Training menu opens and moves focus into it. There is exactly one Apply Now in the header. The mobile drawer matches the desktop groups and has no horizontal scroll at 390px. Client redirect `/class-a-cdl/` → `/cdl-training/` works. All internal links point to live routes. (Two script failures were my own wrong expectations, not site bugs: an early read before the menu rendered, and an expected 12 mobile links instead of 11.) |
| `node server.js` + curl | All 8 retired URLs return 301 with the correct target, and the query string is kept; robots and sitemap are served correctly |
| Screenshots reviewed | Homepage desktop (full), guide desktop, homepage mobile |
| Student application, admin dashboard, Stripe test mode | **Not run.** This local run has no Supabase or Stripe env. The application and admin code are unchanged apart from the wizard hint text and the CMS FAQ list. Recommend a staging pass |
| Real device and keyboard tab-through by a person | **Not run** (the Chrome extension was not connected) |

## Remaining issues and decisions

1. **Dispatcher / broker**: retired or never existed. Should "Other Training" stay with only the CDL Assessment?
2. **Verify before launch**: IMAN's FMCSA Training Provider Registry listing (not claimed anywhere), the "4 weeks" hero stat and day/evening/weekend claim (existing), Florida's exact document list, and the after-the-test issuance wording. See also `docs/cdl-training/CDL_IMPLEMENTATION_SUMMARY.md`.
3. **CMS**: orphaned content rows for retired pages remain in `school_content` (harmless). Delete them in the admin if you want a tidy list.
4. **SEO**: the 301s move ranking signals to the consolidated pages; expect some short-term movement. Submit `sitemap.xml` in Google Search Console after deploying.
5. `src/components/LegacyPage.tsx` and `public/legacy/` are still unrouted dead code. They were left alone.

## Addendum: Roadmaster menu items (2026-11-05)

**New pages:**
- `/cdl-age-requirements/`
- `/cdl-medical-requirements/`
- `/cdl-jobs/`
- `/truck-driver-pay-florida/`
- `/truck-driving-career-benefits/`

**Content and data:**
- Content is in `src/config/cdlResourcePages.ts` and editable in the admin as `section-N`.
- Wage data is in `src/config/truckDriverPay.ts` (BLS OEWS May 2025, from the BLS public API).
- The live tuition sheet on `/tuition-financing/` comes from `src/components/CdlDataSections.tsx`. It reuses the portal's `CdlPricingSheet`, whose checkout panel is now optional, and portal behavior is unchanged.

**Navigation:**
- New "Truck Driver Career" dropdown.
- CDL Training dropdown gains Age and Medical.
- New footer "Career" column.
- Guide and overview links updated.
- Sitemap now lists 21 pages.

**Tests:** 176/176 pass. The headless Chrome script passes:
- 9-item CDL dropdown
- 3 mobile groups with 16 links
- header fits at 1200 and 1280px
- live tuition sheet shows $2,599 / $600 / $80 / $150 = $3,429, or $3,929 with housing
- 0 console errors

All 21 pages have one h1, a correct canonical and a unique title.

**Action for an admin:** the production content entry `tuition-financing / section-1` (and its bullets) still holds the old default text: "Contact admissions for current tuition… Registration fee payable online… Optional application fee". It shows below the new price sheet and overrides the updated code default. Edit it in Admin → Website content, or delete that entry so the new default appears. It was not changed from here, because this work makes no production database writes.

**Still needs IMAN facts before publishing:** partner carriers (Choice of Employers), tuition reimbursement, veterans/GI Bill approval, fleet/company training, ELDT credit transfer, loan payments, graduate verification, instructor and staff careers, complaint procedure (and Florida CIE licensing status), news, blog, and a video tour.

## Addendum: Iman School menu (2026-11-05)

The "About Us" link became an "Iman School ▾" dropdown with 8 items, and a new page, `/choosing-a-cdl-school/`, was added (22 pages in the sitemap).

**Checks:**
- Tests: 176/176 pass.
- Browser script: all checks pass, including the 8-item menu, the Career Services anchor, 4 mobile groups with 23 links, the header fitting at 1200px, and 0 console errors.

## Addendum: remaining school-menu pages (2026-11-05)

**New pages** (all in `cdlResourcePages.ts`, all editable in the admin):
- `/eldt-credit-transfer/`
- `/graduate-verification/`
- `/careers/` (with a `#cdl-instructor` section)
- `/student-complaints/`

The Iman School menu now has 13 items, and the sitemap lists 26 pages.

**Sources:** FMCSA ELDT guidance (theory and behind-the-wheel can use different registered providers; range and public-road training must be with one provider), 49 CFR 380.605 (instructor qualifications), and the Florida CIE student-concerns page.

**No unconfirmed IMAN policies are stated.** These pages only route people to IMAN's existing email and phone.

**Checks:**
- Tests: 176/176 pass.
- Browser script: 0 console errors. Each new page has one h1. The header still fits at 1200px.

**Still not added (needs IMAN facts):**
- In the News
- Fleet / company training

**Confirm before launch:**
- Whether IMAN is CIE-licensed. If it is, the complaints page can say so directly.
- Whether IMAN accepts prior ELDT training and has a verification-release requirement, so those pages can state IMAN's actual policy.

## Addendum: Student payments and website requests (2026-11-05)

### Student Payment page (`/payment/`) uses the existing Stripe flow

No new payment code, payment type, webhook or table. The page sends students into the portal's existing **Tuition & Payments** (`/portal/billing/`):

1. Sign in or register (`?next=/portal/billing/`; the sign-in page explains why).
2. See the balance, or choose a program and optional housing.
3. Sign the tuition agreement and pay through Stripe Checkout.
4. Get a receipt in the portal.

The page adapts to who is viewing it:

| Viewer | What they see |
|---|---|
| Signed-in student | "Go to my balance" |
| Staff | "Open tuition accounts" |
| Visitor | Sign in / create account |

It also shows the live price sheet and the existing "other ways to pay" (offline payments recorded by admissions, Liberty financing). The back office is unchanged: Admin → Tuition Accounts already holds Stripe payments, offline payments, waivers, voids and receipts.

### Website requests: online forms with a back-office inbox

| Piece | Location |
|---|---|
| Forms | `/graduate-verification/`, `/student-complaints/`, `/careers/`, `/eldt-credit-transfer/` (`src/components/WebsiteRequestForm.tsx`) |
| Validation | `shared/websiteRequests.mjs` (shared by browser and server) |
| API | `POST /api/website-requests`: public, 5 requests per 10 minutes per IP, honeypot, duplicate check (same email, type and message within 5 minutes returns the first reference), saved with the service role, admissions emailed through the existing Resend setup (`APPLICATION_EMAIL_TO`), reply-to set to the visitor |
| Back office | **Admin → Website requests** (`/admin/website-requests/`): sidebar link and dashboard card; filter by type and status; search; status + internal notes; "Reply by email"; warning when a verification has no graduate permission |
| Database | `supabase/migrations/202611050001_website_requests.sql`: `cdl_website_requests` with `WR-…` reference numbers. Only admins (`is_super_admin()`) can read it. Staff can change only status and notes; visitor content can't be edited or deleted. The trigger stamps `updated_by` and `resolved_at`. Anon, students and instructors have no access |
| Content fix | `supabase/migrations/202611050002_public_page_content.sql`: replaces the stale tuition text only if it still matches the old wording; admin edits are never overwritten |

No new environment variables are needed.

### Tests

- **Unit tests:** 187/187 pass (11 new: validation for each type, honeypot, DB constraint sync, the API's 503 and rate-limit behavior).
- **Database:** `supabase/tests/website_requests_rls.sql` was added to `scripts/test-db.sh`. The full migration history was applied to a throwaway local Postgres 14:
  - The new migrations applied and are safe to re-run.
  - The content update spares admin edits.
  - All access assertions passed.
  - Only the three tuition migrations that need Postgres 15+ were skipped there; the new table doesn't depend on them.
- **Browser:**
  - Each form shows inline errors and stays usable after a server error, with no console errors.
  - The payment page links to sign-in and registration with `next=/portal/billing/` and shows live prices.
  - The sign-in page shows the billing hint.
- **Not run:** an end-to-end submission into a real database, and the Docker suite. Staging was unreachable: `usttwlcdmcgkavpjucph.supabase.co` returns NXDOMAIN, so the project looks paused or deleted.

### Production rollout order (needs approval)

1. Apply `202611050001_website_requests.sql` to production. It is additive and safe before the code ships.
2. Deploy the website and API.
3. Apply `202611050002_public_page_content.sql` right after the deploy, so the new tuition text appears together with the live price sheet.
4. Submit a test request on the live site, confirm it appears in Admin → Website requests and that admissions gets the email, then mark it Closed.

## Addendum: Programs managed from the back office (2026-11-05)

**Admin → Courses & pricing** (super admin) now manages the whole catalog:

| Feature | Back office | API |
|---|---|---|
| Add a course | **Add course**: code, name, description, fee label, offered on/off. New courses start at $0 | `POST /api/admin/courses` |
| Edit a course | **Details**: name, description, training-fee label, **Offer this course** switch | `PATCH /api/admin/courses/:id` |
| Price a course | **Edit pricing**: fees, housing, deposit, installments. Versioned history (unchanged) | existing |
| Start sessions | **Start sessions** section: add or edit name, dates, open/closed. Sessions are never deleted | `GET/POST /api/admin/sessions`, `PATCH /api/admin/sessions/:id` |

When a course is **offered and priced**, it flows through the existing system with no further code:
- website price sheets
- training application program list
- portal billing and Stripe Checkout
- admin tuition accounts
- receipts

Box truck and hotshot pages switch their main button from "Request information" to **Apply Now**, and show their own live price sheet.

Website page text (curriculum, schedule wording) stays editable in **Admin → Website content**.

**Database:** `supabase/migrations/202611050003_training_programs.sql`
- Adds `cdl_courses.training_fee_label`, so a non-CDL program isn't billed as "CDL Training".
- Adds three courses, **inactive at $0** until priced:
  - `BOX-TRUCK`: Box Truck Training (Non-CDL)
  - `HOTSHOT-NON-CDL`: Hotshot Training (Non-CDL)
  - `HOTSHOT-CDL`: Hotshot Training (CDL)

Price sheets in the site and the portal are titled by program (for example "BOX TRUCK TRAINING"); CDL courses keep "CDL TRAINING".

**Tests:**
- Unit: 196/196 pass (fee label, sheet titles, auth on the new admin endpoints).
- Database: the full chain of 37 migrations applied on throwaway Postgres 14. The three courses insert inactive with labels and pricing history. Pricing bumps the version. The public can't see inactive courses. The migration is safe to re-run. Portal, identity and website-request access tests passed. The tuition access test fails **only** because the PG14 workaround strips the PG15 view option it relies on; it was not changed by this work.

**Production rollout order:**
1. `202611050001`
2. `202611050003`
3. Deploy the site
4. `202611050002`
5. Set prices and turn courses on in Admin → Courses & pricing

## Addendum: "Account not set up" in the student portal (2026-11-05)

**Cause:** the production Supabase project is shared with the Iman Logistics app. Its sign-up trigger (`on_auth_user_created` → `handle_new_user`, not in this repo) creates every new profile as `employee`, and it runs before the school trigger, which kept that role. The portal then depended on the API repair (`POST /api/me/student-account`) on first sign-in. That repair isn't available on Netlify, so affected accounts saw "Account not set up".

**Production data fix (approved by the owner):** only `rodrigue.medor@gmail.com` was converted to a verified student, through the school trigger (app role `student`). Six other `employee` accounts were left unchanged; the live site converts them on their next portal sign-in.

**Permanent fix:**
- The school sign-up form sends `signup_source = 'iman_trucking_school'`.
- `supabase/migrations/202611050004_school_signups_are_students.sql` redefines `handle_iman_auth_user` (based on `202610070001`, which matches production exactly) to convert only an `employee` profile with that tag, and only to `student`. Unverified accounts stay inactive until verified. Other roles and Logistics sign-ups are unchanged, and the Logistics trigger is untouched.
- `supabase/tests/school_signup.sql` reproduces the Logistics trigger. It passes with the migration and fails without it, matching the production symptom.

**Screen change:** "Account not set up" and "Account inactive" now show the signed-in email, a **Sign out and use another account** button, and the admissions phone number.

**Production rollout order:**
1. `202611050001`
2. `202611050003`
3. `202611050004`
4. Deploy the site
5. `202611050002`
6. `202611070001` (see below; applies on its own, before or after the deploy)

Status 2026-11-07: steps 1, 2, 3 and 5 are applied in production; the site is not yet deployed to Hostinger; step 6 is applied (2026-11-07).

### Logistics accounts are kept out of the school (2026-11-07)

In Iman Logistics `employee` and `admin` are real staff roles, but the school treated them as leftovers:
- `handle_iman_auth_user` gave every Logistics account a `cdl_users` row with role `student` and a `cdl_students` row.
- `POST /api/me/student-account` turned any `employee` or `admin` account that signed in to the school site into a student, which would lock that person out of Logistics.

**Fix:**
- `supabase/migrations/202611070001_logistics_accounts_not_students.sql`: an untagged `employee` or `admin` profile keeps only its profile row. Tagged school sign-ups and accounts with a school role in `app_metadata` are unchanged.
- `shared/studentAccount.mjs` (used by the repair endpoint): converts an account with no profile, or an `employee` account Logistics did not create, and never `admin` or any other role. Logistics has no public sign-up; its super admin creates every staff account and logs `user.create` in `audit_logs`, which is how the endpoint recognises them. Untagged school sign-ups from the current live site (main does not send the tag) are still converted on first sign-in.
- Tests: `tests/student-account.test.ts`, and `supabase/tests/school_signup.sql` now also checks that Logistics employees and admins get no school records.

Every `employee` account in production on 2026-11-07 (6) is a school sign-up made before the tag, since Logistics had created none. Their existing school records are left as they are.
