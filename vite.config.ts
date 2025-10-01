import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages deployment requires the base to match the repository name
  // Set to '/' for development, '/sculpt-3D/' for production build
  base: command === 'build' ? '/sculpt-3D/' : '/',
}))
