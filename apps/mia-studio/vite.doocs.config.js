import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

const doocsSource = fileURLToPath(new URL(`../../vendor/doocs-md/apps/web/src`, import.meta.url))
const cloudDocuments = fileURLToPath(new URL(`./src/doocs/cloud-documents.ts`, import.meta.url))

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: { isCustomElement: tag => tag === `math-field` },
      },
    }),
    tailwindcss(),
    AutoImport({
      imports: [`vue`, `pinia`, `@vueuse/core`, `vue-i18n`],
      dirs: [
        `${doocsSource}/stores`,
        `${doocsSource}/lib/toast`,
        `${doocsSource}/composables`,
      ],
    }),
    Components({ dirs: [`${doocsSource}/components`] }),
  ],
  resolve: {
    alias: [
      { find: `@/storage/repositories/documents`, replacement: cloudDocuments },
      { find: `@`, replacement: doocsSource },
    ],
    dedupe: [`@codemirror/state`, `@codemirror/view`, `vue`, `pinia`],
  },
  server: {
    host: `127.0.0.1`,
    port: 4173,
    proxy: { '/v1': `http://127.0.0.1:8787` },
  },
  build: {
    chunkSizeWarningLimit: 2500,
  },
})
