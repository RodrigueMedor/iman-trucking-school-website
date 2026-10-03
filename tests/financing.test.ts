import { describe, expect, it } from 'vitest'
import { LIBERTY, libertyFrameDocument, parseLibertyMessage } from '../src/config/financing'

// The exact snippet Liberty Career Finance provided. These values must never
// change without Liberty's instruction.
const PROVIDED = {
  containerId: 'liberty-self-application-btn',
  fontsHref: 'https://fonts.googleapis.com/css2?family=Syncopate:wght@700&family=Ubuntu:wght@300&display=swap',
  scriptId: 'selfApplicationScript',
  src: 'https://partnerportal.libertycareerfinance.net/js/embedded/selfapplicationbtn.min.js',
  c: 'gr',
  s: 'l',
  l: 'https://partnerportal.libertycareerfinance.net/Public/701a2261-27e5-46f0-a14c-3edf9cfc13f9/SelfApplication/7MzEjHKVFd',
}

describe('Liberty snippet', () => {
  it('keeps every value Liberty provided', () => {
    expect(LIBERTY).toEqual(PROVIDED)
  })

  it('embeds the snippet unchanged in the frame document', () => {
    const html = libertyFrameDocument()
    expect(html).toContain(`<div id='${PROVIDED.containerId}'></div>`)
    expect(html).toContain(`<link href='${PROVIDED.fontsHref}' rel='stylesheet' />`)
    expect(html).toContain(
      `<script id="${PROVIDED.scriptId}" src="${PROVIDED.src}" c="${PROVIDED.c}" s="${PROVIDED.s}" l="${PROVIDED.l}"`,
    )
    // The container exists before Liberty's script runs, which looks it up once on load.
    expect(html.indexOf(`id='${PROVIDED.containerId}'`)).toBeLessThan(html.indexOf(`id="${PROVIDED.scriptId}"`))
  })

  it('reports load success or failure to the parent page', () => {
    const html = libertyFrameDocument()
    expect(html).toMatch(/onerror="[^"]*iman-liberty[^"]*failed/)
    expect(html).toMatch(/onload="[^"]*iman-liberty/)
  })

  it('contains no IMAN data or student information', () => {
    expect(libertyFrameDocument()).not.toMatch(/supabase|access_token|refresh_token|student_id|user_id|localStorage|cookie/i)
  })
})

describe('parseLibertyMessage', () => {
  it('accepts the frame status messages', () => {
    expect(parseLibertyMessage({ source: 'iman-liberty', status: 'ready' })).toBe('ready')
    expect(parseLibertyMessage({ source: 'iman-liberty', status: 'failed' })).toBe('failed')
    expect(parseLibertyMessage({ source: 'iman-liberty', status: 'clicked' })).toBe('clicked')
  })
  it('ignores anything else', () => {
    expect(parseLibertyMessage({ source: 'other', status: 'ready' })).toBeNull()
    expect(parseLibertyMessage({ source: 'iman-liberty', status: 'hacked' })).toBeNull()
    expect(parseLibertyMessage('ready')).toBeNull()
    expect(parseLibertyMessage(null)).toBeNull()
  })

  it('reports when the Liberty application button is clicked', () => {
    expect(libertyFrameDocument()).toMatch(/addEventListener\('click'[^]*iman-liberty[^]*clicked/)
  })
})
