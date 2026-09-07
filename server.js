import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'
import { URL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const distPath = path.resolve(__dirname, 'dist')

// Read environment variables at server startup
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY

console.log('Environment check:')
console.log('VITE_SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET')
console.log('VITE_SUPABASE_PUBLISHABLE_KEY:', supabaseKey ? 'SET' : 'NOT SET')

const configScript = supabaseUrl && supabaseKey
  ? `<script>window.__SUPABASE_URL__="${supabaseUrl}";window.__SUPABASE_KEY__="${supabaseKey}";</script>`
  : ''

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`)
  let filePath = path.join(distPath, parsedUrl.pathname)

  // Serve index.html for all routes (SPA)
  if (parsedUrl.pathname === '/' || !path.extname(parsedUrl.pathname)) {
    filePath = path.join(distPath, 'index.html')
  }

  const ext = path.extname(filePath)
  const contentType = mimeTypes[ext] || 'application/octet-stream'

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File not found, serve index.html for SPA routing
        fs.readFile(path.join(distPath, 'index.html'), (err, content) => {
          if (err) {
            res.writeHead(404)
            res.end('Not found')
            return
          }
          const html = content.toString().replace('</head>', `${configScript}</head>`)
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(html)
        })
      } else {
        res.writeHead(500)
        res.end('Server error')
      }
      return
    }

    // Inject config script into index.html
    if (ext === '.html') {
      const html = content.toString().replace('</head>', `${configScript}</head>`)
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(html)
    } else {
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(content)
    }
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`)
  console.log(`Supabase configured: ${!!supabaseUrl && !!supabaseKey}`)
})
