// Liberty Career Finance — third-party financing partner.
//
// These values come verbatim from Liberty's embed snippet. Do not change the
// application URL or the script attributes without Liberty's instruction.
export const LIBERTY = {
  containerId: 'liberty-self-application-btn',
  fontsHref: 'https://fonts.googleapis.com/css2?family=Syncopate:wght@700&family=Ubuntu:wght@300&display=swap',
  scriptId: 'selfApplicationScript',
  src: 'https://partnerportal.libertycareerfinance.net/js/embedded/selfapplicationbtn.min.js',
  c: 'gr',
  s: 'l',
  l: 'https://partnerportal.libertycareerfinance.net/Public/701a2261-27e5-46f0-a14c-3edf9cfc13f9/SelfApplication/7MzEjHKVFd',
} as const

export const FINANCING_PARTNER = 'Liberty Career Finance'
export const ADMISSIONS_PHONE = '(888) 991-4776'
export const ADMISSIONS_PHONE_HREF = 'tel:8889914776'

export const FINANCING_DISCLOSURE =
  `Financing is provided by ${FINANCING_PARTNER}, a third-party lender, not by Iman Trucking School. ` +
  'Eligibility, approval, rates and terms are determined by the lender. Iman Trucking School does not make ' +
  'credit decisions and does not receive or store your financing application. ' +
  `${FINANCING_PARTNER}'s own terms and privacy policy apply.`

export type LibertyStatus = 'ready' | 'failed'
const MESSAGE_SOURCE = 'iman-liberty'

/**
 * The document loaded into the sandboxed frame: Liberty's snippet exactly as
 * provided, plus load/error reporting so the page can show a fallback. The
 * frame has no access to the IMAN page (no allow-same-origin), so Liberty's
 * script cannot read the student's session.
 */
export function libertyFrameDocument(): string {
  const report = (status: string) =>
    `parent.postMessage({source:'${MESSAGE_SOURCE}',status:${status}},'*')`
  const onload = report(`document.querySelector('#${LIBERTY.containerId} button')?'ready':'failed'`)
  const onerror = report(`'failed'`)
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style>',
    '</head><body>',
    `<div id='${LIBERTY.containerId}'></div>`,
    `<link href='${LIBERTY.fontsHref}' rel='stylesheet' />`,
    `<script id="${LIBERTY.scriptId}" src="${LIBERTY.src}" c="${LIBERTY.c}" s="${LIBERTY.s}" l="${LIBERTY.l}"` +
      ` onload="${onload}" onerror="${onerror}"></script>`,
    '</body></html>',
  ].join('\n')
}

/** Reads a status message posted by the Liberty frame; anything else is ignored. */
export function parseLibertyMessage(data: unknown): LibertyStatus | null {
  if (!data || typeof data !== 'object') return null
  const { source, status } = data as { source?: unknown; status?: unknown }
  if (source !== MESSAGE_SOURCE) return null
  return status === 'ready' || status === 'failed' ? status : null
}
