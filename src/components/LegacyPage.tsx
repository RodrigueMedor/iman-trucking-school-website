import { useEffect, useRef, useState } from 'react'
import { Box, LinearProgress } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { pageTitles } from '../navigation'

export function LegacyPage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(900)
  const [loading, setLoading] = useState(true)
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`
  const source = normalized === '/' ? '/legacy/index.html' : `/legacy${normalized}index.html`
  const financingUrl = 'https://coach.lending.online/iman-trucking-school'

  const prepareFrameLinks = () => {
    setLoading(false)
    const frameDocument = frameRef.current?.contentDocument
    if (!frameDocument) return

    frameDocument
      .querySelectorAll<HTMLAnchorElement>(`a[href="${financingUrl}"]`)
      .forEach((link) => {
        link.target = '_blank'
        link.rel = 'noopener noreferrer'

        if (link.dataset.newTabReady === 'true') return
        link.dataset.newTabReady = 'true'
        link.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()
          const financingTab = window.open(financingUrl, '_blank')
          if (financingTab) financingTab.opener = null
        })
      })
  }

  useEffect(() => {
    setLoading(true)
    setHeight(900)
    document.title = `${pageTitles[normalized] || 'Iman Trucking School'} | Iman Trucking School`

    const syncFrame = () => {
      const documentElement = frameRef.current?.contentDocument?.documentElement
      const body = frameRef.current?.contentDocument?.body
      if (!documentElement || !body) return

      const measuredHeight = Math.max(
        documentElement.scrollHeight,
        documentElement.offsetHeight,
        body.scrollHeight,
        body.offsetHeight,
      )

      if (measuredHeight > 0) {
        setHeight(Math.max(500, measuredHeight))
        setLoading(false)
      }
    }

    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !event.data) return
      if (event.data.type === 'iman-frame-height' && typeof event.data.height === 'number') {
        setHeight(Math.max(500, event.data.height))
        setLoading(false)
      }
      if (event.data.type === 'iman-navigate' && typeof event.data.path === 'string') navigate(event.data.path)
    }
    window.addEventListener('message', receive)
    const frameSync = window.setInterval(syncFrame, 300)
    const stopFrameSync = window.setTimeout(() => window.clearInterval(frameSync), 12_000)
    const loadingFallback = window.setTimeout(() => setLoading(false), 1_500)

    return () => {
      window.removeEventListener('message', receive)
      window.clearInterval(frameSync)
      window.clearTimeout(stopFrameSync)
      window.clearTimeout(loadingFallback)
    }
  }, [normalized, navigate])

  return <Box position="relative" minHeight={500}>
    {loading && <LinearProgress aria-label="Loading page" sx={{ position: 'absolute', inset: '0 0 auto', zIndex: 1 }} />}
    <Box component="iframe" ref={frameRef} key={source} src={source} title={pageTitles[normalized] || 'Iman Trucking School page'} onLoad={prepareFrameLinks} sx={{ display: 'block', width: '100%', height, border: 0, bgcolor: 'background.default' }} />
  </Box>
}
