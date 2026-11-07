// Which accounts the school may turn into student accounts.
//
// Production shares one database with the Iman Logistics back office. Its
// sign-up trigger creates every new profile as 'employee', and in Logistics
// 'employee' and 'admin' are real staff roles. The school portal must never
// take an account away from Logistics, so it converts only:
//   - an account with no profile at all,
//   - an 'employee' account that the Logistics back office did not create.
//     Logistics has no public sign-up: its super admin creates every staff
//     account, which writes a 'user.create' row to audit_logs. Any other
//     'employee' account is a school sign-up, tagged by the form
//     (signup_source = 'iman_trucking_school') or made before it sent the tag.
// Accounts Logistics created, 'admin' and every other role are left unchanged,
// whatever their user-editable metadata says.

/** Roles that already belong in the school portal or admin area. */
export const PORTAL_ROLES = new Set(['student', 'super_admin', 'instructor'])

/**
 * @param {{ role: string | null, createdByLogistics: boolean }} account
 * @returns {'already-set-up' | 'convert' | 'refuse'}
 */
export function studentAccountDecision({ role, createdByLogistics }) {
  if (role && PORTAL_ROLES.has(role)) return 'already-set-up'
  if (!role) return 'convert'
  if (role !== 'employee' || createdByLogistics) return 'refuse'
  // Tagged sign-ups, and older untagged ones made before the form sent the tag.
  return 'convert'
}
