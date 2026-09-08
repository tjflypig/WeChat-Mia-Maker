<script setup lang="ts">
import { BookText, Command, GitBranch, Keyboard, PackageOpen } from '@lucide/vue'
import { useUIStore } from '@/stores/ui'
import { ctrlSign, shiftSign } from '../../../../vendor/doocs-md/packages/shared/src/configs'

withDefaults(defineProps<{ asSub?: boolean }>(), { asSub: false })

const { t } = useI18n()
const uiStore = useUIStore()
const projectUrl = `https://github.com/tjflypig/WeChat-Mia-Maker`

function open(url: string) {
  window.open(url, `_blank`, `noopener,noreferrer`)
}
</script>

<template>
  <MenubarSub v-if="asSub">
    <MenubarSubTrigger>
      {{ t('menu.help') }}
    </MenubarSubTrigger>
    <MenubarSubContent class="min-w-56">
      <MenubarItem class="pr-2" @click="uiStore.toggleShowCommandPalette(true)">
        <Command class="mr-2 h-4 w-4 shrink-0" />
        <span class="min-w-0 flex-1">{{ t('menu.commandPalette') }}</span>
        <MenubarShortcut class="shrink-0 pl-4">
          <span class="inline-flex items-center gap-0.5">
            <kbd class="bg-gray-2 px-1 dark:bg-stone-9">{{ ctrlSign }}</kbd>
            <kbd class="bg-gray-2 px-1 dark:bg-stone-9">{{ shiftSign }}</kbd>
            <kbd class="bg-gray-2 px-1 dark:bg-stone-9">.</kbd>
          </span>
        </MenubarShortcut>
      </MenubarItem>
      <MenubarItem @click="uiStore.toggleShowKeyboardShortcutsDialog(true)">
        <Keyboard class="mr-2 h-4 w-4" />
        {{ t('menu.keyboardShortcuts') }}
      </MenubarItem>
      <MenubarSeparator />
      <MenubarItem @click="uiStore.toggleShowMarkdownHelpDialog(true)">
        <BookText class="mr-2 h-4 w-4" />
        {{ t('menu.syntaxHelp') }}
      </MenubarItem>
      <MenubarSeparator />
      <MenubarItem @click="open(projectUrl)">
        <GitBranch class="mr-2 h-4 w-4" />
        Mia Studio 项目
      </MenubarItem>
      <MenubarItem @click="open('https://github.com/doocs/md')">
        <PackageOpen class="mr-2 h-4 w-4" />
        排版引擎：doocs/md
      </MenubarItem>
    </MenubarSubContent>
  </MenubarSub>

  <MenubarMenu v-else>
    <MenubarTrigger>{{ t('menu.help') }}</MenubarTrigger>
    <MenubarContent align="start" class="min-w-56">
      <MenubarItem class="pr-2" @click="uiStore.toggleShowCommandPalette(true)">
        <Command class="mr-2 h-4 w-4 shrink-0" />
        <span class="min-w-0 flex-1">{{ t('menu.commandPalette') }}</span>
        <MenubarShortcut class="shrink-0 pl-4">
          <span class="inline-flex items-center gap-0.5">
            <kbd class="bg-gray-2 px-1 dark:bg-stone-9">{{ ctrlSign }}</kbd>
            <kbd class="bg-gray-2 px-1 dark:bg-stone-9">{{ shiftSign }}</kbd>
            <kbd class="bg-gray-2 px-1 dark:bg-stone-9">.</kbd>
          </span>
        </MenubarShortcut>
      </MenubarItem>
      <MenubarItem @click="uiStore.toggleShowKeyboardShortcutsDialog(true)">
        <Keyboard class="mr-2 h-4 w-4" />
        {{ t('menu.keyboardShortcuts') }}
      </MenubarItem>
      <MenubarSeparator />
      <MenubarItem @click="uiStore.toggleShowMarkdownHelpDialog(true)">
        <BookText class="mr-2 h-4 w-4" />
        {{ t('menu.syntaxHelp') }}
      </MenubarItem>
      <MenubarSeparator />
      <MenubarItem @click="open(projectUrl)">
        <GitBranch class="mr-2 h-4 w-4" />
        Mia Studio 项目
      </MenubarItem>
      <MenubarItem @click="open('https://github.com/doocs/md')">
        <PackageOpen class="mr-2 h-4 w-4" />
        排版引擎：doocs/md
      </MenubarItem>
    </MenubarContent>
  </MenubarMenu>
</template>
