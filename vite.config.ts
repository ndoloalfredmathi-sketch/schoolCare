import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main.ts',
      },
      preload: {
        input: 'electron/preload.ts',
        // Le preload est compilé en CommonJS (require) par le plugin, mais son
        // extension par défaut suit le "type": "module" du package.json et devient
        // ".mjs" — un fichier que Node traite comme ESM. Electron échoue alors à
        // charger le preload et window.schoolCare reste undefined.
        // On force donc une extension cohérente avec le format réellement produit.
        vite: {
          build: {
            rolldownOptions: {
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs',
              },
            },
          },
        },
      },
    }),
  ],
  base: './',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
