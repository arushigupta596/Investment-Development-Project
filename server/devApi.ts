/**
 * Serves the /api routes from the local dev server (npm run dev) and `vite preview`,
 * using the same logic as the Vercel functions in api/. Settings come from .env.
 */
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import { resolve } from 'node:path'
import { fromEnv, readJson, send } from './core.js'

export function devApiPlugin(env: Record<string, string | undefined>): Plugin {
  const { auth, chat } = fromEnv(env, resolve(process.cwd(), 'server/.cache/answers.json'))
  const mount = (server: ViteDevServer | PreviewServer) => {
    const post = (path: string, fn: (body: any, ip: string) => Promise<ReturnType<typeof chat.health>> | ReturnType<typeof chat.health>) =>
      server.middlewares.use(path, async (req, res) => {
        if (req.method !== 'POST') return send(res, { status: 405, body: { error: 'POST only' } })
        try {
          send(res, await fn(await readJson(req), req.socket.remoteAddress ?? 'local'))
        } catch (e) {
          send(res, { status: 400, body: { error: (e as Error).message } })
        }
      })
    post('/api/login', (b, ip) => auth.login(b, ip))
    post('/api/verify', (b) => auth.verify(b))
    post('/api/chat', (b) => chat.answer(b))
    server.middlewares.use('/api/health', (_req, res) => send(res, chat.health()))
  }
  return { name: 'ido-dev-api', configureServer: mount, configurePreviewServer: mount }
}
