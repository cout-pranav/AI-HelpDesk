import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // ngrok tunnels to the dev server; the leading dot allows any subdomain
    allowedHosts: ['.ngrok-free.dev'],
    // Lets one tunnel serve the API too (SendGrid's webhook, and the app when VITE_API_BASE_URL is empty)
    proxy: { '/api': 'http://localhost:5280' },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
})
