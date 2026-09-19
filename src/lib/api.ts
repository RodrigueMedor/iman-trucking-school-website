export function getApiUrl(path: string) {
  // Vite exposes env vars on import.meta.env when built. Fall back to empty string.
  const base = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || ''
  if (!base) return path
  // Trim trailing slash from base and ensure path begins with '/'
  const trimmed = String(base).replace(/\/+$/g, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${trimmed}${p}`
}
