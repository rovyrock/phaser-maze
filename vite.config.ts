import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin, type ViteDevServer } from 'vite'

const MIME: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
}

function serveContent(): Plugin {
  const contentRoot = path.resolve('content')
  const attach = (server: ViteDevServer) => {
    server.middlewares.use('/content', (req, res, next) => {
      const raw = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')
      const file = path.resolve(contentRoot, raw.replace(/^\/+/, ''))
      const inside = file === contentRoot || file.startsWith(contentRoot + path.sep)
      if (!inside || !existsSync(file) || statSync(file).isDirectory()) {
        next()
        return
      }
      res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cache-Control', 'public, max-age=3600')
      createReadStream(file).pipe(res)
    })
  }
  return {
    name: 'serve-content',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

export default defineConfig({
  base: './',
  publicDir: false,
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  plugins: [serveContent()],
})
