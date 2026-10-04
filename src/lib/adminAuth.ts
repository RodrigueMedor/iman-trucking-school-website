export const SUPER_ADMIN_EMAIL = (
  import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'rodriguemedor@yahoo.fr'
).trim().toLowerCase()

/** Roles allowed into the admin area. Every other account belongs in the student portal. */
export function isStaffRole(role?: string | null) {
  return role === 'super_admin' || role === 'instructor'
}

/** Where a signed-in account belongs: staff in the admin area, everyone else in the portal. */
export function homeForRole(role?: string | null) {
  if (role === 'super_admin') return '/admin/'
  if (role === 'instructor') return '/admin/cdl-instructor/'
  return '/portal/'
}

export function isSuperAdminEmail(email?: string | null) {
  return email?.trim().toLowerCase() === SUPER_ADMIN_EMAIL
}
