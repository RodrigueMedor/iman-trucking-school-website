// Retired public URLs and where their content now lives. Used by the React
// router (client-side redirect) and by server.js (HTTP 301) so search engines
// transfer existing rankings to the consolidated pages. public/.htaccess
// mirrors this list for Apache hosting; tests keep the two in sync.
export const permanentRedirects = {
  '/our-program/': '/cdl-training/',
  '/class-a-cdl/': '/cdl-training/',
  '/truck-driving-school/': '/cdl-training/',
  '/advantages-of-attending-a-cdl-training-school/': '/cdl-training/',
  '/truck-driving-school-orlando-florida/': '/cdl-training-program-orlando-florida/',
  '/cdl-license-information/': '/how-to-get-a-cdl/',
  '/how-to-become-a-truck-driver/': '/how-to-get-a-cdl/',
  '/cdl-permit-tests/': '/how-to-get-a-cdl/#clp',
}

/** Returns the redirect target for a path (with or without trailing slash), or null. */
export function redirectFor(pathname) {
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`
  return permanentRedirects[normalized] ?? null
}
