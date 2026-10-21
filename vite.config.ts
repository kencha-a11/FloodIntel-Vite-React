import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const devApiTarget = process.env.VITE_DEV_API_TARGET || 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
      },
      '/storage': {
        target: devApiTarget,
        changeOrigin: true,
      },
    },
  },
})
