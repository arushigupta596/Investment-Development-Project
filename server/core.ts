/**
 * Server-side logic shared by the local dev server (Vite plugins in server/auth.ts and server/openrouter.ts)
 * and the Vercel serverless functions in api/. Secrets are read from environment variables only.
 *
 *   POST /api/login   { username, password }      -> { ok, token } | 401 | 429
 *   POST /api/verify  { token }                    -> { ok }
 *   GET  /api/health                               -> { live, model }
 *   POST /api/chat    { question, history, context } -> { text, chart?, table?, followUps?, cached }
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface Result {
  status: number
  body: unknown
}

// ---------- http helpers ----------
export function send(res: ServerResponse, r: Result) {
  res.statusCode = r.status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(r.body))
}

/** Reads a JSON body. Vercel has usually parsed it already (req.body); the dev server has not. */
export async function readJson<T>(req: IncomingMessage & { body?: unknown }, limit = 2_000_000): Promise<T> {
  if (req.body !== undefined) return (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as T
  const raw = await new Promise<string>((ok, fail) => {
    let s = ''
    req.on('data', (c) => {
      s += c
      if (s.length > limit) req.destroy()
    })
    req.on('end', () => ok(s))
    req.on('error', fail)
  })
  return JSON.parse(raw || '{}') as T
}

// ---------- IDO sign-in ----------
const TTL_MS = 12 * 3600_000
const MAX_FAILS = 5
const LOCK_MS = 60_000

const same = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function createAuth({ username, password, secret }: { username?: string; password?: string; secret?: string }) {
  // Tokens must verify on any server instance (Vercel runs many), so the signing key is stable:
  // AUTH_SECRET if set, otherwise derived from the credentials (changing the password signs everyone out).
  const key = secret ? Buffer.from(secret) : password ? createHash('sha256').update(`ido-auth|${username}|${password}`).digest() : randomBytes(32)
  const sign = (payload: string) => createHmac('sha256', key).update(payload).digest('base64url')
  const fails = new Map<string, { n: number; until: number }>()

  return {
    login(body: { username?: string; password?: string }, ip = 'local'): Result {
      if (!username || !password) return { status: 503, body: { error: 'Sign-in is not configured: set IDO_USERNAME and IDO_PASSWORD.' } }
      const f = fails.get(ip)
      if (f && f.until > Date.now()) return { status: 429, body: { error: 'Too many attempts. Try again in a minute.' } }
      const ok = same(String(body.username ?? '').trim().toLowerCase(), username.trim().toLowerCase()) && same(String(body.password ?? ''), password)
      if (!ok) {
        const n = (f && !(f.until && f.until <= Date.now()) ? f.n : 0) + 1
        fails.set(ip, { n, until: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 })
        return { status: 401, body: { error: 'Incorrect username or password.' } }
      }
      fails.delete(ip)
      const payload = Buffer.from(JSON.stringify({ role: 'ido', exp: Date.now() + TTL_MS })).toString('base64url')
      return { status: 200, body: { ok: true, token: `${payload}.${sign(payload)}` } }
    },
    verify(body: { token?: string }): Result {
      try {
        const [payload, sig] = String(body.token ?? '').split('.')
        if (!payload || !sig || !same(sig, sign(payload))) return { status: 401, body: { ok: false } }
        const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp: number }
        return exp > Date.now() ? { status: 200, body: { ok: true } } : { status: 401, body: { ok: false } }
      } catch {
        return { status: 401, body: { ok: false } }
      }
    },
  }
}

// ---------- assistant (OpenRouter) ----------
const SYSTEM = `You are the IDO Portfolio Assistant for the Investment & Development Office (IDO) of Ras Al Khaimah.
You answer questions from IDO Group Finance about its portfolio companies: financial performance, the month-end close,
the finance data pipeline (feeds -> journals -> ledger -> trial balance -> statements -> reconciliation) and revenue assurance
(is reported revenue supported by the ledger, invoices and contracts, and bank statements?).

Rules:
- Use ONLY the JSON data provided. Never invent companies, numbers or events. If the data cannot answer, say so plainly.
- Prefer totals already given in the data (e.g. totalsByFindingType, valueAtRisk, checks[].amount) over adding numbers yourself. If you must add, add every item and double-check.
- Do not use em dashes or en dashes; use commas, colons or full stops instead.
- Write in plain English for a busy executive: lead with the answer, then 2-5 short bullet points. Use **bold** for key figures.
- Money is AED. Write amounts like "AED 12.4M" or "AED 850K". Percentages with one decimal.
- All data is fictional demo data as of 12 Nov 2026; the current month is October 2026.
- Include a chart for any comparison, ranking, breakdown or trend (most answers), and a table when the user needs detail. Keep tables under 20 rows.
- A chart has ONE unit: never mix percentages and AED (or counts) in the same chart. Put mixed metrics in the table instead.

Reply with a single JSON object and nothing else:
{
  "text": "markdown answer (bold with **, bullets with '- ', paragraphs separated by blank lines)",
  "chart": { "type": "bar" | "hbar" | "line" | "area" | "pie", "title": "...", "xKey": "field for x axis or category",
             "series": [{ "key": "field", "name": "Label" }], "data": [{ ... }], "unit": "aed" | "pct" | "number" },
  "table": { "columns": ["..."], "rows": [["...", 1]] },
  "followUps": ["up to 3 short follow-up questions"]
}
"chart" and "table" are optional. For chart data use raw numbers (AED amounts in full, percentages as numbers like 92.4 with unit "pct"). Months as "YYYY-MM".`

function parseAnswer(raw: string) {
  const content = raw.trimStart().startsWith('{') ? raw : '{' + raw
  const s = content.replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '')
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  try {
    const o = JSON.parse(s.slice(a, b + 1))
    if (typeof o.text === 'string') return o
  } catch {
    /* fall through */
  }
  return { text: raw.trim().replace(/^\{\s*/, '') }
}

export function createChat({ apiKey, model = 'anthropic/claude-sonnet-4.5', cacheFile }: { apiKey?: string; model?: string; cacheFile?: string }) {
  let cache: Record<string, unknown> = {}
  try {
    if (cacheFile && existsSync(cacheFile)) cache = JSON.parse(readFileSync(cacheFile, 'utf8'))
  } catch {
    cache = {}
  }
  const save = () => {
    if (!cacheFile) return
    try {
      mkdirSync(dirname(cacheFile), { recursive: true })
      writeFileSync(cacheFile, JSON.stringify(cache, null, 1))
    } catch {
      /* cache is best-effort */
    }
  }

  return {
    health(): Result {
      return { status: 200, body: { live: !!apiKey, model: apiKey ? model : null } }
    },
    async answer(body: { question?: string; history?: { role: 'user' | 'assistant'; content: string }[]; context?: string }): Promise<Result> {
      if (!apiKey) return { status: 503, body: { error: 'OPENROUTER_API_KEY is not set' } }
      const question = String(body.question ?? '')
      const history = Array.isArray(body.history) ? body.history : []
      const context = String(body.context ?? '')
      if (!question) return { status: 400, body: { error: 'question is required' } }
      const ctxHash = createHash('sha1').update(context).digest('hex').slice(0, 12)
      const key = createHash('sha1').update(`${model}|${ctxHash}|${question.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()}`).digest('hex')
      if (!history.length && cache[key]) return { status: 200, body: { ...(cache[key] as object), cached: true } }

      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'IDO Finance Supervisor (demo)' },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 2500,
          messages: [
            {
              role: 'system',
              content: [
                { type: 'text', text: SYSTEM },
                // the large data block is marked cacheable so repeat questions are cheaper and faster
                { type: 'text', text: `PORTFOLIO DATA (JSON):\n${context}`, cache_control: { type: 'ephemeral' } },
              ],
            },
            ...history.slice(-6),
            { role: 'user', content: `${question}\n\n(Reply with the JSON object only, including a chart and/or table when they help.)` },
            // prefill so the model continues a JSON object instead of writing free text
            { role: 'assistant', content: '{' },
          ],
        }),
      })
      if (!r.ok) return { status: 502, body: { error: `OpenRouter ${r.status}`, detail: (await r.text()).slice(0, 300) } }
      const data = (await r.json()) as { choices?: { message?: { content?: string } }[] }
      const answer = parseAnswer(data.choices?.[0]?.message?.content ?? '')
      if (!history.length) {
        cache[key] = answer
        save()
      }
      return { status: 200, body: { ...answer, cached: false } }
    },
  }
}

/** One shared instance per server process, configured from environment variables. */
export const fromEnv = (env: Record<string, string | undefined>, cacheFile?: string) => ({
  auth: createAuth({ username: env.IDO_USERNAME, password: env.IDO_PASSWORD, secret: env.AUTH_SECRET }),
  chat: createChat({ apiKey: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL || undefined, cacheFile }),
})
