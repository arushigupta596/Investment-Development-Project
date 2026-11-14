/**
 * Local sign-in for the IDO Group Finance role.
 * Credentials come from .env (IDO_USERNAME / IDO_PASSWORD) and are checked on the server only.
 *
 *   POST /api/login   { username, password } -> { ok, token } | 401
 *   POST /api/verify  { token }              -> { ok }
 *
 * Tokens are HMAC-signed with a per-process secret, expire after 12 hours,
 * and stop working when the dev server restarts.
 */
import type { Plugin, ViteDevServer, PreviewServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const TTL_MS = 12 * 3600_000
const MAX_FAILS = 5
const LOCK_MS = 60_000

const json = (res: ServerResponse, code: number, body: unknown) => {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}
const readBody = (req: IncomingMessage) =>
  new Promise<string>((ok, fail) => {
    let s = ''
    req.on('data', (c) => {
      s += c
      if (s.length > 10_000) req.destroy()
    })
    req.on('end', () => ok(s))
    req.on('error', fail)
  })
const same = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function authPlugin({ username, password }: { username?: string; password?: string }): Plugin {
  const secret = randomBytes(32)
  const sign = (payload: string) => createHmac('sha256', secret).update(payload).digest('base64url')
  const fails = new Map<string, { n: number; until: number }>()

  const mount = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/api/login', async (req, res) => {
      if (req.method !== 'POST') return json(res, 405, { error: 'POST only' })
      if (!username || !password) return json(res, 503, { error: 'IDO_USERNAME and IDO_PASSWORD are not set in .env' })
      const ip = req.socket.remoteAddress ?? 'local'
      const f = fails.get(ip)
      if (f && f.until > Date.now()) return json(res, 429, { error: 'Too many attempts. Try again in a minute.' })
      let body: { username?: string; password?: string } = {}
      try {
        body = JSON.parse(await readBody(req))
      } catch {
        return json(res, 400, { error: 'Bad request' })
      }
      const ok = same(String(body.username ?? '').trim().toLowerCase(), username.trim().toLowerCase()) && same(String(body.password ?? ''), password)
      if (!ok) {
        const n = (f && !(f.until && f.until <= Date.now()) ? f.n : 0) + 1
        fails.set(ip, { n, until: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 })
        return json(res, 401, { error: 'Incorrect username or password.' })
      }
      fails.delete(ip)
      const payload = Buffer.from(JSON.stringify({ role: 'ido', exp: Date.now() + TTL_MS })).toString('base64url')
      json(res, 200, { ok: true, token: `${payload}.${sign(payload)}` })
    })
    server.middlewares.use('/api/verify', async (req, res) => {
      if (req.method !== 'POST') return json(res, 405, { error: 'POST only' })
      try {
        const { token = '' } = JSON.parse(await readBody(req)) as { token?: string }
        const [payload, sig] = token.split('.')
        if (!payload || !sig || !same(sig, sign(payload))) return json(res, 401, { ok: false })
        const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp: number }
        json(res, exp > Date.now() ? 200 : 401, { ok: exp > Date.now() })
      } catch {
        json(res, 401, { ok: false })
      }
    })
  }

  return { name: 'ido-auth', configureServer: mount, configurePreviewServer: mount }
}
