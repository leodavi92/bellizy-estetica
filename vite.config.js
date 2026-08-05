import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon.png'],
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // Aumenta limite para 5MB
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      manifest: {
        name: 'Musa Agenda',
        short_name: 'Musa Agenda',
        description: 'Agendamento Online de Estética e Beleza',
        theme_color: '#db2777',
        background_color: '#fdf2f8',
        display: 'standalone',
        icons: [
          {
            src: 'icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    strictPort: false,
    open: true,
    host: true,
    cors: true,
    hmr: {
      overlay: true
    },
    watch: {
      usePolling: true,
      interval: 500
    }
  },
  preview: {
    port: 4173,
    strictPort: false,
    host: true
  },
  build: {
    chunkSizeWarningLimit: 3000, // Aumenta o limite de aviso para 3000kb
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
})
