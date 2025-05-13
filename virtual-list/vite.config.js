import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://picsum.photos',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // 处理重定向
            if (proxyRes.headers.location) {
              const redirectUrl = proxyRes.headers.location;
              if (redirectUrl.includes('fastly.picsum.photos')) {
                // 直接使用 fastly 的 URL
                proxyRes.headers.location = redirectUrl;
              }
            }
          });
        },
        followRedirects: true
      },
      '/placeholder': {
        target: 'https://via.placeholder.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/placeholder/, '')
      }
    }
  }
})
