-- Public page text that changed with the website restructuring. Saved
-- content rows override the website's built-in text, so rows still holding
-- the old wording are refreshed here:
--   1. Tuition & Financing, section 1: the page now shows live, itemized
--      prices, but the saved text still says "Contact admissions for current
--      tuition" and lists registration/application fees that are now $0.
--   2. CDL Assessment, section 4: the assessment is now presented as
--      "English Language Proficiency (ELP)" with an "Apply for an ELP
--      Assessment" button.
--
-- Each update applies only while the row still matches the old built-in
-- text word for word, so an administrator's own edits are never
-- overwritten. Safe to run more than once. Run right after the website
-- deploy. Rollback: restore the old text shown in each WHERE clause.

update public.school_content
set
  body = 'Tuition covers training, testing, administrative and materials fees, with optional housing. Current prices are shown on this page, and your student portal shows the exact amount before you pay securely online.',
  bullets = E'Training, testing, administrative and materials fees\nOptional housing\nSecure online payment from your student portal\nAdmissions can walk you through every cost',
  updated_at = now()
where page = 'tuition-financing'
  and section_key = 'section-1'
  and body = 'Tuition depends on the program and schedule you choose. Contact admissions for current tuition. The registration and application fees can be paid securely online from your student portal.'
  and bullets = E'Program-specific tuition\nRegistration fee payable online\nOptional application fee after you apply\nAdmissions can walk you through every cost';

-- The CDL Assessment is now presented as "English Language Proficiency (ELP)"
-- and its button reads "Apply for an ELP Assessment". Same rule: update the
-- saved "How to apply" text only while it still matches the old wording.
update public.school_content
set
  body = 'Select Apply for an ELP Assessment, then sign in or create a free account. You return straight to your request, can save it as a draft, and can track its status from your dashboard after you submit.',
  updated_at = now()
where page = 'cdl-assessment'
  and section_key = 'section-4'
  and body = 'Select Apply for a CDL Assessment, then sign in or create a free account. You return straight to your request, can save it as a draft, and can track its status from your dashboard after you submit.';
