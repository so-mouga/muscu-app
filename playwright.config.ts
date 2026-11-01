import { defineConfig, devices } from '@playwright/test'

/**
 * Tests du parcours principal dans un vrai navigateur, sur l'appli construite (`npm run build`) :
 * ce qui ferait perdre des données si ça cassait. Lancés avant chaque mise en ligne.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4173/',
    viewport: { width: 384, height: 832 },
    hasTouch: true,
    isMobile: true,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
  },
})
