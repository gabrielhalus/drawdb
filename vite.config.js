import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* global process */

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The API and the frontend share an origin in production. Proxying `/api`
    // during development keeps that true, which is what lets the session
    // cookie be sent on same-origin requests from the Vite dev server.
    proxy: {
      '/api': {
        target: process.env.DEV_API_TARGET || 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
})
