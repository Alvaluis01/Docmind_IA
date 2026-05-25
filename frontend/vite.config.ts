// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Permite conexiones desde cualquier IP en tu red local
    allowedHosts: [
      'unrippled-jeanett-impedingly.ngrok-free.dev', // Añade tu dominio de ngrok
      'localhost',
      '127.0.0.1',
    ],
  },
})