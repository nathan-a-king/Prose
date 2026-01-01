import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries - always loaded
          'vendor-react': ['react', 'react-dom'],

          // Routing - always loaded
          'vendor-router': ['react-router-dom'],

          // Markdown rendering - lazy loaded with MarkdownPreview
          'vendor-markdown': [
            'react-markdown',
            'remark-gfm',
            'rehype-highlight'
          ],

          // Syntax highlighting - lazy loaded with markdown
          'vendor-highlight': ['highlight.js']
        }
      }
    }
  }
})