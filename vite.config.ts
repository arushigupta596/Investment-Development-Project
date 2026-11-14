import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { openRouterPlugin } from './server/openrouter'
import { authPlugin } from './server/auth'

export default defineConfig(({ mode }) => {
  // Load all env vars server-side only; nothing here is exposed to the client bundle.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), authPlugin({ username: env.IDO_USERNAME, password: env.IDO_PASSWORD }), openRouterPlugin({ apiKey: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL || undefined })],
    server: { port: 5180 },
  }
})
