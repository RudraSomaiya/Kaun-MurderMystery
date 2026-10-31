import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    root: 'game',
    base: './',
    plugins: [react()],
    // web-llm is a 6 MB chunk, loaded only when the in-browser model is picked
    build: { outDir: '../dist', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 7000 },
    worker: { format: 'es' },
    server: {
      port: 5173,
      // dev only: lets the game talk to Groq without the key ever reaching the browser
      proxy: env.GROQ_API_KEY
        ? { '/groq': { target: 'https://api.groq.com', changeOrigin: true, rewrite: (p) => p.replace(/^\/groq/, ''), headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` } } }
        : undefined,
    },
  }
})
