import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { devApiPlugin } from './server/devApi'

export default defineConfig(({ mode }) => {
  // Load all env vars server-side only; nothing here is exposed to the client bundle.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devApiPlugin(env)],
    server: { port: 5180 },
  }
})
