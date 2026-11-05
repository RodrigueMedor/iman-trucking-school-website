-- The Tuition & Financing page now shows live, itemized prices. Its first
-- content section still holds the earlier built-in text ("Contact admissions
-- for current tuition", registration/application fees that are now $0),
-- which overrides the updated default in the website code.
--
-- Updates that row only while it still matches the old built-in text word
-- for word, so an administrator's own edits are never overwritten. Safe to
-- run more than once. Rollback: restore the old body/bullets shown below.

update public.school_content
set
  body = 'Tuition covers training, testing, administrative and materials fees, with optional housing. Current prices are shown on this page, and your student portal shows the exact amount before you pay securely online.',
  bullets = E'Training, testing, administrative and materials fees\nOptional housing\nSecure online payment from your student portal\nAdmissions can walk you through every cost',
  updated_at = now()
where page = 'tuition-financing'
  and section_key = 'section-1'
  and body = 'Tuition depends on the program and schedule you choose. Contact admissions for current tuition. The registration and application fees can be paid securely online from your student portal.'
  and bullets = E'Program-specific tuition\nRegistration fee payable online\nOptional application fee after you apply\nAdmissions can walk you through every cost';
