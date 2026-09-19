import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = ''
    request.on('data', chunk => {
      body += chunk
      if (body.length > 1_000_000) reject(new Error('Request too large'))
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function localAssessmentApi() {
  return {
    name: 'local-assessment-api',
    configureServer(server: any) {
      const dataDirectory = path.resolve(process.cwd(), '.local-data')
      const dataFile = path.join(dataDirectory, 'elp-submissions.json')
      server.middlewares.use('/api/dev/elp-submissions', async (request: IncomingMessage, response: any) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        try {
          await mkdir(dataDirectory, { recursive: true })
          let items: any[] = []
          try { items = JSON.parse(await readFile(dataFile, 'utf8')) } catch {}
          if (request.method === 'GET') return response.end(JSON.stringify(items))
          if (request.method === 'POST') {
            const submission = JSON.parse(await readBody(request))
            if (!submission?.id) { response.statusCode = 400; return response.end(JSON.stringify({ error: 'Submission ID is required.' })) }
            items = [submission, ...items.filter(item => item.id !== submission.id)]
            await writeFile(dataFile, JSON.stringify(items, null, 2), 'utf8')
            return response.end(JSON.stringify({ ok: true }))
          }
          response.statusCode = 405; response.end(JSON.stringify({ error: 'Method not allowed.' }))
        } catch (error) {
          response.statusCode = 500; response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Storage error' }))
        }
      })
    },
  }
}

function paymentsApiDevServer() {
  return {
    name: 'payments-api-dev-server',
    async configureServer(server: any) {
      try {
        const { app } = await import('./server-express.js')
        server.middlewares.use((req: any, res: any, next: any) => {
          if (req.url && req.url.startsWith('/api/') && !req.url.startsWith('/api/dev/')) {
            app(req, res, next)
          } else {
            next()
          }
        })
      } catch (e) {
        console.warn('Failed to attach payments API middleware to Vite dev server:', e)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react(), localAssessmentApi(), paymentsApiDevServer()],
    resolve: { dedupe: ['react', 'react-dom'] },
    optimizeDeps: { include: ['react', 'react-dom', 'react/jsx-runtime'] },
    server: {
      // Direct in-server middleware handles /api, with fallback to :3001 if external
      proxy: {
        '/api/external-proxy-fallback': { target: 'http://localhost:3001', changeOrigin: true },
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || ''),
      'import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_STRIPE_PUBLISHABLE_KEY || ''),
    }
  }
})
