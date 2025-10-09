import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base ABSOLUTA
export default defineConfig({
  base: '/',          // garante /assets/... no index gerado
  plugins: [react()],
  build: { outDir: 'dist' }
})

