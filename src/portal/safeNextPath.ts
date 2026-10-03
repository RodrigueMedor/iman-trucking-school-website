const PORTAL_PREFIX = '/portal/'

/**
 * Returns `raw` only when it is a same-origin path inside the student portal.
 * Anything else (absolute URLs, protocol-relative `//host`, backslashes,
 * paths outside /portal/) falls back so a crafted `?next=` cannot redirect
 * a student off-site or into the admin area.
 */
export function safeNextPath(raw: string | null | undefined, fallback = PORTAL_PREFIX): string {
  if (!raw || typeof raw !== 'string') return fallback
  if (raw.includes('\\') || raw.includes('//') || /[\u0000-\u001f]/.test(raw)) return fallback
  if (!raw.startsWith(PORTAL_PREFIX)) return fallback
  return raw
}
