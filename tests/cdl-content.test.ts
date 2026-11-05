import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { APPLY_PATH, careerLinks, cdlTrainingLinks, imanSchoolLinks, footerSchoolLinks, footerTrainingLinks, mainNavigation, otherTrainingLinks, pageTitles } from '../src/navigation'
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, pageDescriptions, pageMeta } from '../src/config/seo'
import { cdlFaq, faqStructuredData } from '../src/config/cdlFaq'
import { pageContent } from '../src/components/InternalPage'
import { permanentRedirects, redirectFor } from '../shared/redirects.mjs'
import { groupCoursePricing } from '../src/components/CdlDataSections'
import { floridaPay } from '../src/config/truckDriverPay'
import { cdlResourcePages } from '../src/config/cdlResourcePages'

const basePath = (path: string) => path.split('#')[0]
const anchor = (path: string) => path.split('#')[1]
const allNavLinks = [
  ...mainNavigation.flatMap(item => 'links' in item ? item.links.map(([, path]) => path) : [item.path]),
  ...footerTrainingLinks.map(([, path]) => path),
  ...footerSchoolLinks.map(([, path]) => path),
]

describe('page SEO metadata', () => {
  it('gives every public page its own description', () => {
    for (const path of Object.keys(pageTitles)) {
      expect(pageDescriptions[path], path).toBeTruthy()
      expect(pageDescriptions[path].length, path).toBeLessThanOrEqual(200)
    }
    const values = Object.values(pageDescriptions)
    expect(new Set(values).size).toBe(values.length)
  })

  it('builds the title and canonical URL from the route', () => {
    expect(pageMeta('/how-to-get-a-cdl')).toEqual({
      title: 'How to Get Your Class A CDL License | Iman Trucking School',
      description: pageDescriptions['/how-to-get-a-cdl/'],
      canonical: 'https://imantruckingschool.com/how-to-get-a-cdl/',
    })
    expect(pageMeta('/').title).toBe(DEFAULT_TITLE)
    expect(pageMeta('/contact-us/').title).toBe('Contact Iman Trucking School')
  })

  it('falls back to site defaults without a canonical for portal and admin routes', () => {
    for (const path of ['/portal/', '/portal/apply/training', '/admin/']) {
      expect(pageMeta(path)).toEqual({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, canonical: null })
    }
  })

  it('lists exactly the public pages in the sitemap', () => {
    const sitemap = readFileSync('public/sitemap.xml', 'utf8')
    const locs = [...sitemap.matchAll(/<loc>https:\/\/imantruckingschool\.com([^<]+)<\/loc>/g)].map(match => match[1])
    expect(locs.sort()).toEqual(Object.keys(pageTitles).sort())
  })
})

describe('navigation', () => {
  it('only links to live pages, real guide sections or the application', () => {
    for (const path of allNavLinks) {
      if (path === APPLY_PATH) continue
      expect(pageTitles[basePath(path)], path).toBeTruthy()
      const id = anchor(path)
      if (id) expect(pageContent[basePath(path)].sections.some(section => section.id === id), path).toBe(true)
    }
  })

  it('has no duplicate links within a menu and no empty dropdowns', () => {
    for (const links of [cdlTrainingLinks, careerLinks, imanSchoolLinks, otherTrainingLinks, footerTrainingLinks, footerSchoolLinks]) {
      expect(links.length).toBeGreaterThan(0)
      expect(new Set(links.map(([, path]) => path)).size).toBe(links.length)
    }
  })

  it('gives every guide section a unique anchor', () => {
    const ids = pageContent['/how-to-get-a-cdl/'].sections.map(section => section.id)
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('retired URL redirects', () => {
  it('point at live pages and never at another redirect', () => {
    for (const [from, to] of Object.entries(permanentRedirects)) {
      expect(pageTitles[from], `${from} must not also be a live page`).toBeUndefined()
      expect(pageTitles[basePath(to)], to).toBeTruthy()
      expect(permanentRedirects[basePath(to)]).toBeUndefined()
    }
    expect(redirectFor('/our-program')).toBe('/cdl-training/')
    expect(redirectFor('/cdl-training/')).toBeNull()
  })

  it('are mirrored in netlify.toml for test deploys', () => {
    const toml = readFileSync('netlify.toml', 'utf8')
    for (const [from, to] of Object.entries(permanentRedirects)) {
      expect(toml, from).toContain(`from = "${from}"\n  to = "${to}"\n  status = 301`)
    }
  })

  it('are mirrored in the Apache .htaccess', () => {
    const htaccess = readFileSync('public/.htaccess', 'utf8')
    for (const [from, to] of Object.entries(permanentRedirects)) {
      expect(htaccess, from).toContain(`RewriteRule ^${from.slice(1, -1)}/?$ ${to} [R=301`)
    }
  })
})

describe('CDL FAQ', () => {
  it('has unique, non-empty questions', () => {
    const questions = cdlFaq.map(item => item.question)
    expect(new Set(questions).size).toBe(questions.length)
    for (const item of cdlFaq) {
      expect(item.question.endsWith('?')).toBe(true)
      expect(item.answer.length).toBeGreaterThan(40)
    }
  })

  it('never mentions the reference school', () => {
    const text = JSON.stringify([cdlFaq, pageContent]).toLowerCase()
    expect(text).not.toContain('roadmaster')
  })

  it('produces schema.org FAQPage data', () => {
    const data = faqStructuredData(cdlFaq.slice(0, 1))
    expect(data['@type']).toBe('FAQPage')
    expect(data.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: cdlFaq[0].question,
      acceptedAnswer: { '@type': 'Answer', text: cdlFaq[0].answer },
    })
  })
})

describe('tuition and pay data', () => {
  const course = (code: string, overrides: Record<string, unknown> = {}) => ({
    id: code, code, name: `CDL ${code}`, currency: 'usd', pricing_version: 1,
    training_cents: 259900, testing_fee_cents: 60000, administrative_fee_cents: 8000, materials_fee_cents: 15000, housing_fee_cents: 50000,
    ...overrides,
  })

  it('groups programs with identical fees onto one price sheet', () => {
    const groups = groupCoursePricing([course('CDL-A'), course('CDL-B')])
    expect(groups).toHaveLength(1)
    expect(groups[0].names).toEqual(['CDL CDL-A', 'CDL CDL-B'])
    expect(groups[0].pricing.totalWithoutHousingCents).toBe(342900)
    expect(groups[0].pricing.totalWithHousingCents).toBe(392900)
  })

  it('splits programs with different fees and skips unpriced ones', () => {
    const groups = groupCoursePricing([course('CDL-A'), course('CDL-B', { training_cents: 300000 }), course('X', { training_cents: 0, testing_fee_cents: 0, administrative_fee_cents: 0, materials_fee_cents: 0 })])
    expect(groups).toHaveLength(2)
  })

  it('keeps the wage figures in the page text consistent with the data', () => {
    const text = JSON.stringify(cdlResourcePages)
    expect(text).toContain(`$${floridaPay.median.toLocaleString('en-US')}`)
    expect(floridaPay.percentile10).toBeLessThan(floridaPay.median)
    expect(floridaPay.median).toBeLessThan(floridaPay.percentile90)
  })
})
