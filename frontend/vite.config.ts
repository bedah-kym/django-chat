import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['d3'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/static/spa/',
  build: {
    outDir: '../Backend/staticfiles/spa',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/jsx') || (id.includes('node_modules/react/') && !id.includes('node_modules/react-dom'))) return 'react'
          if (id.includes('node_modules/react-router') || id.includes('node_modules/@remix-run')) return 'router'
          if (id.includes('node_modules/framer-motion')) return 'framer'
          if (id.includes('node_modules/@radix-ui')) return 'radix'
          if (id.includes('node_modules/d3')) return 'd3'
          if (id.includes('node_modules/emoji-mart')) return 'emoji'
          if (id.includes('node_modules/wavesurfer')) return 'wavesurfer'
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Use 127.0.0.1 (IPv4) not localhost: on Windows + Docker Desktop, Node
      // resolves localhost to IPv6 ::1, whose wslrelay forwarder hangs.
      '/api': 'http://127.0.0.1:8000',
      // Proxy the whole /chatbot/ namespace, not just /chatbot/api/, so
      // /chatbot/invite/ and /chatbot/rooms/:id/export/ also reach the backend.
      '/chatbot': 'http://127.0.0.1:8000',
      '/accounts': 'http://127.0.0.1:8000',
      '/auth': 'http://127.0.0.1:8000',
      '/notifications': 'http://127.0.0.1:8000',
      '/payments': 'http://127.0.0.1:8000',
      '/travel': 'http://127.0.0.1:8000',
      '/uploads': 'http://127.0.0.1:8000',
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      },
    },
  },
})
