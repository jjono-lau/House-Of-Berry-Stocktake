import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages needs asset URLs to include the repository name
  base: '/House-Of-Berry-Stocktake/',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
