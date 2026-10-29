import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> }

// Version affichée dans Réglages : date du build et commit déployé.
const date = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const VERSION = `${date}${process.env.GITHUB_SHA ? ' · ' + process.env.GITHUB_SHA.slice(0, 7) : ''}`

export default defineConfig({
  base: './',
  define: { __VERSION__: JSON.stringify(VERSION) },
  plugins: [react()],
  test: { globals: true },
})
