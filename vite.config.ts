import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png}']
      },
      manifest: {
        name: 'Quiet Signal',
        short_name: 'Quiet Signal',
        description: 'A private memory deck for notes, quotes, photos, and voice moments.',
        theme_color: '#f7f4ef',
        background_color: '#f7f4ef',
        display: 'standalone',
        start_url: '/today',
        share_target: {
          action: '/share-target',
          method: 'GET',
          params: {
            title: 'title',
            text: 'text',
            url: 'url'
          }
        },
        shortcuts: [
          {
            name: 'Sprachnotiz',
            short_name: 'Audio',
            description: 'Direkt eine Sprachnotiz im Rauschen erfassen.',
            url: '/today?capture=audio',
            icons: [{ src: '/pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml' }]
          },
          {
            name: 'Foto-Notiz',
            short_name: 'Foto',
            description: 'Direkt eine Foto-Notiz im Rauschen erfassen.',
            url: '/today?capture=photo',
            icons: [{ src: '/pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml' }]
          },
          {
            name: 'Textnotiz',
            short_name: 'Text',
            description: 'Direkt eine Textnotiz im Rauschen erfassen.',
            url: '/today?capture=text',
            icons: [{ src: '/pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml' }]
          }
        ],
        icons: [
          {
            src: '/pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
