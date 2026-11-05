# CDL Gap Analysis and Duplicate Audit

Inputs: `CDL_REFERENCE_ANALYSIS.md` (reference + regulations) and `IMAN_EXISTING_SITE_AUDIT.md`.

## Feature comparison matrix

| Feature | Roadmaster Reference | Existing IMAN Feature | Gap | Action |
|---|---|---|---|---|
| CDL training overview | Class A program, theory + BTW | `/cdl-training/`, `/our-program/` | Partial (thin) | **Update** `/cdl-training/` as the hub |
| Class A CDL | Class A only | `/class-a-cdl/` | Complete | Keep |
| How training works | Not described | Not described | Missing | **Add** step-by-step section |
| Curriculum | Topic list | Homepage curriculum + `/cdl-training/` sections | Complete | Keep |
| Classroom instruction | Classroom + labs | Covered | Complete | Keep |
| Behind-the-wheel | Range + road | Covered | Complete | Keep |
| Duration & scheduling | "About a month" | Homepage "4 weeks"; day/evening/weekend; sessions in portal | Partial | **Update**: explain sessions in the portal (no new duration claim) |
| Eligibility & requirements | Linked pages (age, medical) | Account eligibility in sign-up; age in wizard; general text on license page | Missing on public site | **Add** "Who can enroll" (regulatory + IMAN account rule) |
| CDL permit preparation | Separate page | `/cdl-permit-tests/` | Partial | **Add** CLP section on hub (14-day rule, Class A tests); keep page |
| ELDT | Blog only | One bullet on license page | Missing | **Add** ELDT section with registry pointer |
| FMCSA requirements | "DOT laws" | ELP on assessment page | Partial | **Add** within requirements/ELDT |
| Testing & licensing | CLP → skills test | Bullets on license/how-to pages | Partial | **Add** skills-test parts (step list + FAQ) |
| Tuition & payment | Separate cost page | `/tuition-financing/`, portal billing | Complete | Keep; link from hub |
| Financing | In-house, reimbursement, AIT, Amazon | Liberty Career Finance, Amazon Career Choice | Complete | Keep (no Roadmaster options transferred) |
| Employer partnerships | Four carriers named | None named | Not applicable | **Do not add** (needs business confirmation) |
| Career services / job placement | Pages, no stats | "Job-placement assistance" claim | Partial | Keep claim; FAQ adds "not guaranteed" |
| Enrollment procedure | Apply anchor | Full portal application wizard | Complete | Keep. Wizard hint asks for driving experience and preferred schedule |
| Location info | Address, phones, map, tour | Contact page, map, Orlando page | Complete | Keep |
| FAQ | None (location); some on requirements page | None | Missing | **Add** CDL FAQ (11 Q&As) + FAQPage JSON-LD |
| Contact/inquiry | Call, apply | Phone, GHL form modal, contact page, chat widget | Complete | Keep |
| Student support | Classrooms/labs | Admissions card, portal, housing option in tuition | Complete | Keep |
| CTAs | Apply, call | Apply / Request information CTA card on every page | Complete | Keep |
| Mobile registration | Unknown | Responsive portal wizard | Complete | Keep |
| Admin: inquiries/applications/status | Not visible | CDL applications, enrollments, tuition, identity | Complete | Keep. FAQ entries are added to the CMS editor |
| SEO titles/descriptions/canonical | n/a | One global title/description | Missing | **Add** per-route title, description, canonical |
| Heading hierarchy | n/a | h1 → h3 | Incorrect | **Fix** section titles to h2 (no visual change) |
| Accreditation/licensing statement | Florida CIE licensed | None | Unknown | **Needs verification**, not published |
| Veterans / Spanish program / team / fleet | Linked programs | None | Not applicable | Not added |

## Duplicate audit

| Check | Result | Decision |
|---|---|---|
| Duplicate CDL training pages | `/cdl-training/`, `/our-program/`, `/truck-driving-school/` overlap in topic | No new page created. `/cdl-training/` becomes the detailed hub; each page has its own meta description. Consolidation via redirect needs owner approval (URLs may have backlinks). |
| Duplicate Orlando pages | `/cdl-training-program-orlando-florida/` and `/truck-driving-school-orlando-florida/` target the same local intent | **Flagged.** Recommended: 301 the truck-driving-school Orlando URL to the CDL Orlando URL. Not done without approval. |
| Duplicate nav items | Header "CDL Training School" label links to the advantages page, close to "CDL Training" | Flagged (label rename suggested); unchanged |
| Duplicate course cards / FAQs | None found; FAQ is new and only on `/cdl-training/` | OK |
| Duplicate contact/enrollment forms | GHL form (modal + `/contact-form/`) shares one form ID; portal application is the only application | OK, no new form |
| Duplicate API routes / DB tables | None added | OK |
| Duplicate admin functionality | None added; FAQ uses the existing content editor | OK |
| Duplicate components | FAQ uses MUI Accordion (already used in Header); no new shared component | OK |
| Dead code | `src/components/LegacyPage.tsx` and `public/legacy/*` are not routed | Flagged; untouched |
