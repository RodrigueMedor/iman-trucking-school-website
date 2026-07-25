import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const root = new URL('../', import.meta.url)
const legacyRoot = new URL('../public/legacy/', import.meta.url)
const cssRoot = new URL('../public/legacy-assets/css/', import.meta.url)
const fontRoot = new URL('../public/legacy-assets/fonts/', import.meta.url)
await mkdir(cssRoot, { recursive: true })
await mkdir(fontRoot, { recursive: true })

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : path
  }))
  return files.flat()
}

const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 16)
const normalizeUrl = value => (value.startsWith('//') ? `https:${value}` : value).replaceAll('&#038;', '&')
const htmlFiles = (await walk(legacyRoot.pathname)).filter(file => file.endsWith('.html'))
const htmlByFile = new Map(await Promise.all(htmlFiles.map(async file => [file, await readFile(file, 'utf8')])))
const stylesheetPattern = /(?:https:)?\/\/imantruckingschool\.com\/wp-content\/[^"'<>]+?\.css(?:\?[^"'<>]*)?/g
const stylesheetUrls = new Set()

for (const html of htmlByFile.values()) {
  for (const match of html.matchAll(stylesheetPattern)) stylesheetUrls.add(match[0])
}

for (const originalCssUrl of stylesheetUrls) {
  const cssUrl = normalizeUrl(originalCssUrl)
  const response = await fetch(cssUrl)
  if (!response.ok) {
    console.warn(`Skipped stylesheet ${cssUrl}: ${response.status}`)
    continue
  }
  let css = await response.text()
  const fontPattern = /(?:https:)?\/\/imantruckingschool\.com\/wp-content\/[^)"'\s]+\.(?:woff2?|ttf|eot)(?:\?[^)"'\s]*)?/g
  const fontUrls = [...new Set([...css.matchAll(fontPattern)].map(match => match[0]))]

  for (const originalFontUrl of fontUrls) {
    const fontUrl = normalizeUrl(originalFontUrl)
    const fontResponse = await fetch(fontUrl)
    if (!fontResponse.ok) {
      console.warn(`Skipped font ${fontUrl}: ${fontResponse.status}`)
      continue
    }
    const extension = extname(new URL(fontUrl).pathname) || '.woff2'
    const fontName = `${hash(fontUrl)}${extension}`
    await writeFile(new URL(fontName, fontRoot), Buffer.from(await fontResponse.arrayBuffer()))
    css = css.split(originalFontUrl).join(`/legacy-assets/fonts/${fontName}`)
  }

  const cssName = `${hash(cssUrl)}.css`
  await writeFile(new URL(cssName, cssRoot), css)
  for (const [file, html] of htmlByFile) {
    htmlByFile.set(file, html.split(originalCssUrl).join(`/legacy-assets/css/${cssName}`))
  }
}

await Promise.all([...htmlByFile].map(([file, html]) => writeFile(file, html)))
console.log(`Localized ${stylesheetUrls.size} stylesheets for ${htmlFiles.length} pages.`)
