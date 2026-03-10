import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/hf': {
        target: 'https://router.huggingface.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hf/, ''),
      },
      // ← Gradio Space proxy (update target once Space is created)
      '/api/space': {
        target: 'https://mohit7739-tinyllama-python-coder.hf.space',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/space/, ''),
      },
    },
  },
})
