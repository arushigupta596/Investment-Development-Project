/**
 * Vite dev-server plugin that proxies the assistant to OpenRouter.
 * The API key is read from .env on the server and never sent to the browser.
 *
 *   GET  /api/health  -> { live, model }
 *   POST /api/chat    -> { text, chart?, table?, followUps?, cached }
 */
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

interface Opts {
  apiKey?: string
  model?: string
}

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

const json = (res: ServerResponse, code: number, body: unknown) => {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
const readBody = (req: IncomingMessage) =>
  new Promise<string>((ok, fail) => {
    let s = ''
    req.on('data', (c) => {
      s += c
      if (s.length > 2_000_000) req.destroy()
    })
    req.on('end', () => ok(s))
    req.on('error', fail)
  })

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

export function openRouterPlugin({ apiKey, model = 'anthropic/claude-sonnet-4.5' }: Opts): Plugin {
  const cacheFile = resolve(process.cwd(), 'server/.cache/answers.json')
  let cache: Record<string, unknown> = {}
  try {
    if (existsSync(cacheFile)) cache = JSON.parse(readFileSync(cacheFile, 'utf8'))
  } catch {
    cache = {}
  }
  const save = () => {
    try {
      mkdirSync(dirname(cacheFile), { recursive: true })
      writeFileSync(cacheFile, JSON.stringify(cache, null, 1))
    } catch {
      /* cache is best-effort */
    }
  }

  return {
    name: 'ido-openrouter',
    configureServer(server) {
      server.middlewares.use('/api/health', (_req, res) => json(res, 200, { live: !!apiKey, model: apiKey ? model : null }))
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, { error: 'POST only' })
        if (!apiKey) return json(res, 503, { error: 'OPENROUTER_API_KEY is not set' })
        try {
          const { question, history = [], context } = JSON.parse(await readBody(req)) as { question: string; history?: { role: 'user' | 'assistant'; content: string }[]; context: string }
          const ctxHash = createHash('sha1').update(context).digest('hex').slice(0, 12)
          const key = createHash('sha1').update(`${model}|${ctxHash}|${question.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()}`).digest('hex')
          if (!history.length && cache[key]) return json(res, 200, { ...(cache[key] as object), cached: true })

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
          if (!r.ok) {
            const detail = (await r.text()).slice(0, 300)
            return json(res, 502, { error: `OpenRouter ${r.status}`, detail })
          }
          const data = (await r.json()) as { choices?: { message?: { content?: string } }[] }
          const content = data.choices?.[0]?.message?.content ?? ''
          const answer = parseAnswer(content)
          if (!history.length) {
            cache[key] = answer
            save()
          }
          json(res, 200, { ...answer, cached: false })
        } catch (e) {
          json(res, 500, { error: (e as Error).message })
        }
      })
    },
  }
}
