import type { IncomingMessage, ServerResponse } from 'node:http'
import { fromEnv, readJson, send } from '../server/core.js'

const { auth } = fromEnv(process.env)

/** Vercel function: POST /api/login */
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (req.method !== 'POST') return send(res, { status: 405, body: { error: 'POST only' } })
  try {
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown'
    send(res, auth.login(await readJson(req), ip))
  } catch (e) {
    send(res, { status: 400, body: { error: (e as Error).message } })
  }
}
