# CDL Implementation Summary

> **Superseded in part (2026-11-05):** the website restructuring moved the regulatory sections and the FAQ from `/cdl-training/` to the new `/how-to-get-a-cdl/` guide, renamed the FAQ CMS keys to `how-to-get-a-cdl / faq-N`, and consolidated the overlapping pages with 301 redirects. See `docs/website-restructuring/WEBSITE_RESTRUCTURING_SUMMARY.md`.

Branch: `feature/cdl-training-enhancement` (from `main` 2154b3e). Not deployed.

## Added

- **`/cdl-training/` hub content**: six new sections, appended after the two existing ones so that CMS overrides keyed `section-1`/`section-2` still line up. The new sections are: How CDL training works (step by step), Who can enroll, Your Commercial Learner's Permit, Entry-Level Driver Training, Schedules and start dates, and Paying for training and starting your career. All six can be edited in `/admin/content/` as `section-3`…`section-8`.
- **CDL training FAQ** (11 questions) on `/cdl-training/#faq`, with schema.org `FAQPage` JSON-LD and a "Related CDL resources" link grid for internal linking. Each question appears in the admin content editor as `cdl-training / faq-N`. Saving one as a draft hides it.
- **Per-page SEO**: a unique title, meta description and canonical URL for every public route. Portal and admin routes reset to the site default and get no canonical.
- **Unit tests**: `tests/cdl-content.test.ts` checks that every page has a unique description, that titles and canonicals are built correctly, that the FAQ is well formed, and that no reference-school text appears.

## Updated

- Section titles and the enrollment CTA heading on internal pages are now `<h2>` (visual style unchanged), which fixes the h1 → h3 jump on every internal page.
- The training application's "Anything you'd like admissions to know?" field now has a hint asking for driving experience and preferred day/evening/weekend schedule. Admins already see this text in CDL Applications.

## Reused (not duplicated)

Existing page template, hero, numbered sections, check-bullet cards, CTA card, theme colors and typography, MUI Accordion, the `school_content` CMS, the portal application wizard (name, email, phone, program, start session, permit status, questions), admin CDL Applications, and the tuition, financing and Stripe flows.

## Consolidated

Nothing was removed or redirected. Overlapping pages are flagged in `CDL_GAP_ANALYSIS.md` and need owner approval.

## Files changed

| File | Change |
|---|---|
| `src/components/InternalPage.tsx` | New `/cdl-training/` sections, `CdlTrainingFaq` component, h2 headings |
| `src/config/cdlFaq.ts` (new) | FAQ content + JSON-LD builder |
| `src/config/seo.ts` (new) | Page descriptions + `pageMeta()` |
| `src/lib/usePageMeta.ts` (new) | Syncs title, description and canonical on navigation |
| `src/App.tsx` | Calls `usePageMeta` |
| `src/pages/AdminContent.tsx` | Lists FAQ entries in the content inventory |
| `src/portal/pages/ApplicationWizard.tsx` | Helper text on the statement field |
| `tests/cdl-content.test.ts` (new) | Unit tests |
| `docs/cdl-training/*.md` (new) | These deliverables |

## Database, integrations, payments

- **No migrations or schema changes.** FAQ overrides use the existing `school_content` table.
- Stripe, webhooks, Liberty financing, identity verification, Resend, Twilio, GHL forms, the Hostinger deploy and environment variables are **untouched**.

## Tests and checks

| Check | Result |
|---|---|
| `npx vitest run` | 11 files, 167 tests passed (6 new) |
| `npm run build` (`tsc -b` + Vite) | Passed (existing >500 kB chunk warning only) |
| Headless Chrome render of `/cdl-training/` (production build) | Title, description, canonical, 1 h1, h2 sections, 11 FAQ items and JSON-LD present; desktop screenshot reviewed |
| Regression render of `/`, `/our-program/`, `/class-a-cdl/`, `/tuition-financing/`, `/cdl-assessment/`, Orlando page, `/contact-us/`, `/portal/sign-in`, `/admin/login/`, retired dispatcher URL | All load. Titles and canonicals correct; retired URL still redirects home |
| Docker integration and RLS suites | **Not run** (no backend or DB changes) |
| Interactive browser checks (accordion keyboard, console errors, real mobile device) | **Not run.** The Claude in Chrome extension was not connected. MUI Accordion is keyboard-accessible by default. |
| Real payments, SMS, production records | None created |

## Needs business verification before publishing more detail

| Item | Why | Status |
|---|---|---|
| Is IMAN listed on FMCSA's Training Provider Registry for Class A (and B)? | The ELDT section points students to the registry. IMAN's listing is not claimed. | **Needs Verification** |
| Florida Commission for Independent Education license status | Roadmaster publishes theirs. Do not claim IMAN's without confirmation. | **Needs Verification** |
| Program length ("4 weeks" on homepage) and day/evening/weekend availability | Existing IMAN claims, reused but not newly verified | **Needs Verification** |
| Class B program | The tuition setup prices Class A and B, but public pages only describe Class A | **Needs Verification** |
| Job-placement assistance scope, employer partners | Existing claim kept; no partners named | **Needs Verification** |
| Third-party skills testing on site | Not claimed | **Needs Verification** |
| Housing option ($500) | Exists in tuition billing; not added to public pages | **Needs Verification** |
| Regulatory citations | FMCSA and eCFR blocked automated fetches; facts match FLHSMV pages and the published 49 CFR text | Re-check 49 CFR 380.603/609, 383.25(e) and 391.11 before launch |

## Recommendations (not implemented, need approval)

1. 301-redirect `/truck-driving-school-orlando-florida/` → `/cdl-training-program-orlando-florida/`.
2. Rename the header item "CDL Training School" to "Why CDL School".
3. Add `noindex` to `/portal/*` and `/admin/*`.
4. Add structured `driving_experience` and `preferred_schedule` fields to applications (migration + wizard + admin) if admissions needs them as filters rather than free text.

## Deployment readiness

Ready for review. No migrations or env changes are needed. Deploying is the normal frontend build plus Hostinger deploy, and it waits for your approval. This branch is independent of the pending production tuition migrations.
