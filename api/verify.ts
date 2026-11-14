import type { IncomingMessage, ServerResponse } from 'node:http'
import { fromEnv, readJson, send } from '../server/core.js'

const { auth } = fromEnv(process.env)

/** Vercel function: POST /api/verify */
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (req.method !== 'POST') return send(res, { status: 405, body: { error: 'POST only' } })
  try {
    send(res, auth.verify(await readJson(req)))
  } catch (e) {
    send(res, { status: 400, body: { error: (e as Error).message } })
  }
}
