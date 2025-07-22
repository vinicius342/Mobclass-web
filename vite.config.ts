import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // 👈 Corrige os caminhos dos assets no Firebase Hosting
  plugins: [react()],
})

