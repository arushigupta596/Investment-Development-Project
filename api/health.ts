import type { IncomingMessage, ServerResponse } from 'node:http'
import { fromEnv, send } from '../server/core.js'

const { chat } = fromEnv(process.env)

/** Vercel function: GET /api/health */
export default function handler(_req: IncomingMessage, res: ServerResponse) {
  send(res, chat.health())
}
