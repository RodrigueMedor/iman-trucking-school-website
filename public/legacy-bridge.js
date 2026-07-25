(() => {
  const sendHeight = () => {
    const main = document.querySelector('main') || document.body
    const mainBottom = main.getBoundingClientRect().bottom + window.scrollY
    const height = Math.ceil(Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      main.scrollHeight,
      mainBottom,
    ))
    window.parent.postMessage({ type: 'iman-frame-height', height }, window.location.origin)
  }

  document.addEventListener('click', event => {
    const enrollmentTrigger = event.target.closest?.('[data-iman-open-enrollment]')
    if (enrollmentTrigger) {
      event.preventDefault()
      window.parent.postMessage({ type: 'iman-open-enrollment' }, window.location.origin)
      return
    }
    const link = event.target.closest?.('a[href]')
    if (!link) return
    const href = link.getAttribute('href')
    if (!href || href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:')) return
    const url = new URL(href, window.location.origin)
    if (url.origin !== window.location.origin || url.pathname.startsWith('/wp-')) return
    event.preventDefault()
    window.parent.postMessage({ type: 'iman-navigate', path: `${url.pathname}${url.search}${url.hash}` }, window.location.origin)
  })

  window.addEventListener('load', () => {
    sendHeight()
    window.setTimeout(sendHeight, 500)
    window.setTimeout(sendHeight, 1800)
  })
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendHeight, { once: true })
  } else {
    sendHeight()
  }
  new ResizeObserver(sendHeight).observe(document.documentElement)
})()
