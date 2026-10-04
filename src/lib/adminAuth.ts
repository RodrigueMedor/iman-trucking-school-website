export const SUPER_ADMIN_EMAIL = (
  import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'rodriguemedor@yahoo.fr'
).trim().toLowerCase()

/** Where a signed-in account belongs: students in the portal, staff in the admin area. */
export function homeForRole(role?: string | null) {
  if (role === 'student') return '/portal/'
  if (role === 'instructor') return '/admin/cdl-instructor/'
  return '/admin/'
}

export function isSuperAdminEmail(email?: string | null) {
  return email?.trim().toLowerCase() === SUPER_ADMIN_EMAIL
}
