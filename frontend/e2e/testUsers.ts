// Admin seeded into the throwaway E2E database (TicketManagementDb_E2E). playwright.config.ts
// passes these to the backend as SeedAdmin__* environment variables; tests import them to log in.
// Test-only credentials: they never reach the dev or production databases.
export const e2eAdmin = {
  email: 'admin@e2e.test',
  password: 'E2e-Admin-Passw0rd!',
  displayName: 'E2E Admin',
}
