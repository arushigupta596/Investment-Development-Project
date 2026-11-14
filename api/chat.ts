import type { IncomingMessage, ServerResponse } from 'node:http'
import { fromEnv, readJson, send } from '../server/core.js'

// Vercel's file system is read-only except /tmp, so the answer cache lives there (per instance).
const { chat } = fromEnv(process.env, '/tmp/ido-answers.json')

/** Vercel function: POST /api/chat */
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (req.method !== 'POST') return send(res, { status: 405, body: { error: 'POST only' } })
  try {
    send(res, await chat.answer(await readJson(req)))
  } catch (e) {
    send(res, { status: 500, body: { error: (e as Error).message } })
  }
}
