import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'tradoc-demo-meta',
      transformIndexHtml(html) {
        if (mode !== 'demo') return html
        return {
          html,
          tags: [
            {
              tag: 'meta',
              attrs: { name: 'robots', content: 'noindex, nofollow, noarchive' },
              injectTo: 'head'
            }
          ]
        }
      }
    }
  ],
  server: {
    host: '127.0.0.1',
    port: 2499,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.TRADOC_API_PORT || '8000'}`,
        changeOrigin: true,
        ws: true
      }
    }
  },
  preview: {
    host: '127.0.0.1',
    port: 2499,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
}))
