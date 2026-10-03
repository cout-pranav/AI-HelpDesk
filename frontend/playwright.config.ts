import { defineConfig, devices } from '@playwright/test'
import { e2eAdmin } from './e2e/testUsers.ts'

const isCI = !!process.env.CI

// E2E runs use their own ports and database so they never touch the dev servers (5280/5173)
// or the dev database. The backend runs in the Testing environment, which drops and
// re-migrates TicketManagementDb_E2E on every startup.
const apiUrl = 'http://localhost:5281'
const appUrl = 'http://localhost:5174'

export default defineConfig({
  testDir: './e2e',
  // One shared database, so run tests serially until they are written to be isolated.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: appUrl,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'Backend',
      // Builds into bin/e2e/ so a running dev backend (which locks bin/Debug) doesn't block it.
      command: 'dotnet run --launch-profile e2e -p:OutDir=bin/e2e/',
      cwd: '../backend/TicketManagement.Api',
      url: `${apiUrl}/api/health`,
      timeout: 180_000,
      reuseExistingServer: !isCI,
      env: {
        SeedAdmin__Email: e2eAdmin.email,
        SeedAdmin__Password: e2eAdmin.password,
        SeedAdmin__DisplayName: e2eAdmin.displayName,
      },
    },
    {
      name: 'Frontend',
      command: 'npx vite --mode e2e --port 5174 --strictPort',
      url: appUrl,
      reuseExistingServer: !isCI,
    },
  ],
})
