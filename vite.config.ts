import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { photoUrl, searchPlaces } from './server/places.ts'

// Serves /api/places during `npm run dev`, mirroring the Vercel function in api/places.ts.
function placesDevApi(key: string | undefined): Plugin {
  return {
    name: 'nomi-places-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/places', async (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost')
        const num = (k: string) => (url.searchParams.get(k) ? Number(url.searchParams.get(k)) : null)
        res.setHeader('Content-Type', 'application/json')
        try {
          const results = await searchPlaces(url.searchParams.get('q') ?? '', num('lat'), num('lng'), key)
          res.end(JSON.stringify({ results }))
        } catch (e) {
          console.error(e)
          res.statusCode = 502
          res.end(JSON.stringify({ error: 'Restaurant search is unavailable right now.' }))
        }
      })
      server.middlewares.use('/api/photo', async (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost')
        try {
          const target = await photoUrl(url.searchParams.get('name') ?? '', Number(url.searchParams.get('w') ?? 800), key)
          if (!target) { res.statusCode = 404; res.end(); return }
          res.statusCode = 302
          res.setHeader('Location', target)
          res.end()
        } catch (e) {
          console.error(e)
          res.statusCode = 502
          res.end()
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), placesDevApi(env.GOOGLE_PLACES_API_KEY)],
    server: { host: true },
  }
})
