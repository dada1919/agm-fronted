import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    // 将你的ngrok域名添加到允许列表
    allowedHosts: ['nonpenetrating-holly-unmathematically.ngrok-free.dev']
  }
})
