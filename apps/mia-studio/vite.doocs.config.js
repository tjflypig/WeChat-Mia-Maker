import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

const doocsSource = fileURLToPath(new URL(`../../vendor/doocs-md/apps/web/src`, import.meta.url))
const cloudDocuments = fileURLToPath(new URL(`./src/doocs/cloud-documents.ts`, import.meta.url))
const doocsStyles = fileURLToPath(new URL(`./src/doocs-source.css`, import.meta.url))
const publishButton = fileURLToPath(new URL(`./src/doocs/MiaPublishButton.vue`, import.meta.url))
const helpDropdown = fileURLToPath(new URL(`./src/doocs/MiaHelpDropdown.vue`, import.meta.url))
const miaUpload = fileURLToPath(new URL(`./src/doocs/mia-upload.ts`, import.meta.url))

export default defineConfig({
  plugins: [
    {
      name: `mia-doocs-publish-button`,
      enforce: `pre`,
      transform(code, id) {
        if (!id.split(`?`)[0].endsWith(`/components/editor/editor-header/index.vue`))
          return null
        return code
          .replace(`import HelpDropdown from './HelpDropdown.vue'`, `import HelpDropdown from ${JSON.stringify(helpDropdown)}`)
          .replace(
            `<script setup lang="ts">`,
            `<script setup lang="ts">\nimport PostInfo from ${JSON.stringify(publishButton)}`,
          )
          .replace(`<PostInfo class="hidden md:inline-flex" />`, `<PostInfo class="inline-flex" />`)
      },
    },
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
      { find: `@/assets/index.css`, replacement: doocsStyles },
      { find: `@/storage/repositories/documents`, replacement: cloudDocuments },
      { find: /^@\/services\/upload$/, replacement: miaUpload },
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
