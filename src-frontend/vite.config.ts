import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const DEV_PORT = 6767
const API_PORT = 6868

export default defineConfig({
  clearScreen: false,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: DEV_PORT,
    strictPort: true,
    hmr: {
      host: '127.0.0.1',
      port: DEV_PORT,
      protocol: 'ws',
    },
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
        ws: true,
      },
    },
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})
