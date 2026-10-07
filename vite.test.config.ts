import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'

// Compile la suite de tests en un seul fichier ESM exécutable par Node
// (`node test-dist/run.mjs`). Les modules testés n'importent Electron que de
// façon paresseuse, via `electron/runtime.ts`.
export default defineConfig({
  plugins: [
    electron({
      main: {
        entry: 'tests/run.ts',
        vite: {
          build: {
            outDir: 'test-dist',
            emptyOutDir: true,
            minify: false,
            rolldownOptions: {
              // `electron` n'existe pas hors d'Electron : l'import doit rester
              // intact pour échouer proprement à l'exécution.
              external: ['electron'],
              output: { entryFileNames: 'run.mjs' },
            },
          },
        },
      },
    }),
  ],
})
