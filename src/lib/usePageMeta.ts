import { useEffect } from 'react'
import { pageMeta } from '../config/seo'

function setMeta(name: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.name = name
    document.head.appendChild(tag)
  }
  tag.content = content
}

function setCanonical(href: string | null) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!href) {
    link?.remove()
    return
  }
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = href
}

/** Keeps the document title, meta description and canonical link in sync with the route. */
export function usePageMeta(pathname: string) {
  useEffect(() => {
    const meta = pageMeta(pathname)
    document.title = meta.title
    setMeta('description', meta.description)
    setCanonical(meta.canonical)
  }, [pathname])
}
