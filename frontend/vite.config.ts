import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/static/spa/',
  build: {
    outDir: '../Backend/staticfiles/spa',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/chatbot/api': 'http://localhost:8000',
      '/notifications': 'http://localhost:8000',
      '/payments': 'http://localhost:8000',
      '/travel': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
