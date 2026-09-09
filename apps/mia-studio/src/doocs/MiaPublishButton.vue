<script setup lang="ts">
import { Download, ImagePlus, Loader2, RefreshCw, Send, Sparkles } from '@lucide/vue'
import { useStorage } from '@vueuse/core'
import { buildAIHeaders, resolveEndpointUrl } from '@/composables/useAIFetch'
import useAIImageConfigStore from '@/stores/aiImageConfig'
import { processClipboardContent } from '@/services/export'
import { getArticleSyncInfo, updateArticleMetadata } from '@/storage/repositories/documents'
import { buildCoverPrompt, DEFAULT_COVER_RULES } from './cover-prompt.mjs'
import { uploadMiaImage } from './mia-upload'
import { useEditorStore } from '@/stores/editor'
import { usePostStore } from '@/stores/post'
import { useThemeStore } from '@/stores/theme'

const editorStore = useEditorStore()
const postStore = usePostStore()
const themeStore = useThemeStore()
const publishing = ref(false)
const uploadingCover = ref(false)
const coverInput = ref<HTMLInputElement | null>(null)
const aiCoverOpen = ref(false)
const aiDirection = ref(``)
const aiCoverRules = useStorage(`mia-cover-rules`, DEFAULT_COVER_RULES)
const generatingCover = ref(false)
const savingGeneratedCover = ref(false)
const generatedCoverFile = ref<File | null>(null)
const generatedCoverUrl = ref(``)
const aiImageStore = useAIImageConfigStore()
const { endpoint: aiEndpoint, apiKey: aiApiKey, model: aiModel, type: aiType } = storeToRefs(aiImageStore)
const coverArticleTitle = computed(() => postStore.currentPost?.title || `未命名文章`)

function openAICover() {
  editorStore.flushContentToPostStore()
  aiDirection.value = ``
  aiCoverOpen.value = true
}

async function imageToFile(source: string): Promise<File> {
  const response = await fetch(source)
  if (!response.ok)
    throw new Error(`AI 图片下载失败 (${response.status})`)
  const bitmap = await createImageBitmap(await response.blob())
  const canvas = document.createElement(`canvas`)
  canvas.width = 900
  canvas.height = 383
  const context = canvas.getContext(`2d`)
  if (!context)
    throw new Error(`浏览器不支持图片裁切`)
  const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height)
  const width = bitmap.width * scale
  const height = bitmap.height * scale
  context.fillStyle = `#ffffff`
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, `image/jpeg`, 0.9))
  bitmap.close()
  if (!blob)
    throw new Error(`AI 封面裁切失败`)
  return new File([blob], `ai-cover.jpg`, { type: `image/jpeg` })
}

function replaceGeneratedCover(file: File | null) {
  if (generatedCoverUrl.value)
    URL.revokeObjectURL(generatedCoverUrl.value)
  generatedCoverFile.value = file
  generatedCoverUrl.value = file ? URL.createObjectURL(file) : ``
}

function downloadGeneratedCover() {
  if (!generatedCoverUrl.value)
    return
  const link = document.createElement(`a`)
  link.href = generatedCoverUrl.value
  link.download = `mia-cover-900x383.jpg`
  link.click()
}

async function confirmGeneratedCover() {
  if (!generatedCoverFile.value || savingGeneratedCover.value)
    return
  savingGeneratedCover.value = true
  try {
    editorStore.flushContentToPostStore()
    await postStore.persistImmediately()
    const post = postStore.currentPost
    if (!post)
      throw new Error(`当前没有可设置封面的文章`)
    const url = await uploadMiaImage(generatedCoverFile.value)
    await updateArticleMetadata(post.id, { cover: url })
    replaceGeneratedCover(null)
    aiCoverOpen.value = false
    toast.success(`AI 封面已保存到腾讯云`)
  }
  catch (error) {
    toast.error(`AI 封面保存失败：${error instanceof Error ? error.message : String(error)}`)
  }
  finally {
    savingGeneratedCover.value = false
  }
}

async function generateCover() {
  if (generatingCover.value)
    return
  generatingCover.value = true
  try {
    if (!aiEndpoint.value || !aiModel.value)
      throw new Error(`请先在 doocs/md 的 AI 图片设置中配置服务和模型`)
    editorStore.flushContentToPostStore()
    const post = postStore.currentPost
    if (!post)
      throw new Error(`当前没有可生成封面的文章`)
    const { metadata } = getArticleSyncInfo(post.id)
    const prompt = buildCoverPrompt({
      title: post.title,
      summary: metadata.summary,
      content: editorStore.getContent() || post.content,
      direction: aiDirection.value,
      rules: aiCoverRules.value,
    })
    const response = await fetch(resolveEndpointUrl(aiEndpoint.value, `image`), {
      method: `POST`,
      headers: buildAIHeaders(aiApiKey.value, aiType.value),
      body: JSON.stringify({ model: aiModel.value, prompt, size: `1792x1024`, n: 1 }),
    })
    if (!response.ok)
      throw new Error(`${response.status}: ${await response.text()}`)
    const body = await response.json()
    const source = body?.data?.[0]?.url || (body?.data?.[0]?.b64_json ? `data:image/png;base64,${body.data[0].b64_json}` : ``)
    if (!source)
      throw new Error(`AI 没有返回图片`)
    const file = await imageToFile(source)
    if (!aiCoverOpen.value)
      return
    replaceGeneratedCover(file)
    toast.success(`AI 封面已生成，请预览后确认`)
  }
  catch (error) {
    toast.error(`AI 封面生成失败：${error instanceof Error ? error.message : String(error)}`)
  }
  finally {
    generatingCover.value = false
  }
}

watch(aiCoverOpen, (open) => {
  if (!open)
    replaceGeneratedCover(null)
})

onBeforeUnmount(() => replaceGeneratedCover(null))

async function uploadCover(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ``
  if (!file || uploadingCover.value)
    return
  uploadingCover.value = true
  try {
    editorStore.flushContentToPostStore()
    await postStore.persistImmediately()
    const post = postStore.currentPost
    if (!post)
      throw new Error(`当前没有可设置封面的文章`)
    const url = await uploadMiaImage(file)
    await updateArticleMetadata(post.id, { cover: url })
    toast.success(`封面已保存到腾讯云`)
  }
  catch (error) {
    toast.error(`封面上传失败：${error instanceof Error ? error.message : String(error)}`)
  }
  finally {
    uploadingCover.value = false
  }
}

async function request(path: string, options: RequestInit) {
  const response = await fetch(`/v1${path}`, {
    credentials: `same-origin`,
    ...options,
    headers: {
      'content-type': `application/json`,
      ...options.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new Error(body?.error?.message || `请求失败 (${response.status})`)
  return body
}

async function publishToWechat() {
  if (publishing.value)
    return
  publishing.value = true
  try {
    editorStore.flushContentToPostStore()
    await postStore.persistImmediately()
    const post = postStore.currentPost
    if (!post)
      throw new Error(`当前没有可发布的文章`)
    const { etag, metadata } = getArticleSyncInfo(post.id)
    if (!etag)
      throw new Error(`文章尚未同步到腾讯云，请稍后再试`)

    const rendered = await processClipboardContent(themeStore.primaryColor)
    if (!rendered.html.trim())
      throw new Error(`doocs/md 没有生成可发布的 HTML`)
    if (rendered.hasPendingAsyncContent)
      throw new Error(`图表或公式仍在渲染，请完成后再发布`)

    const preflight = await request(`/articles/${encodeURIComponent(post.id)}/publish/preflight`, {
      method: `POST`,
      headers: { 'if-match': `"${etag}"` },
      body: JSON.stringify({ html: rendered.html, title: post.title, cover: metadata.cover || `` }),
    })
    const confirmed = window.confirm(
      `确认推送到微信公众号草稿箱？\n\n《${preflight.title}》\n版本：${preflight.revision}\n图片：${preflight.imageCount} 张\n渲染 HTML：${preflight.htmlBytes} 字节\n\n确认后将调用微信接口。`,
    )
    if (!confirmed) {
      toast.info(`已取消发布`)
      return
    }

    const result = await request(`/articles/${encodeURIComponent(post.id)}/publish/confirm`, {
      method: `POST`,
      body: JSON.stringify({ confirmationId: preflight.confirmationId }),
    })
    if (result.receiptWarning)
      toast.warning(result.receiptWarning)
    else
      toast.success(`已推送到微信草稿箱并保存发布快照：${result.title}`)
  }
  catch (error) {
    toast.error(`发布失败：${error instanceof Error ? error.message : String(error)}`)
  }
  finally {
    publishing.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <input ref="coverInput" type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="sr-only" @change="uploadCover">
    <Button
      variant="outline"
      class="h-9 max-md:w-9 max-md:px-0"
      :disabled="uploadingCover || publishing"
      :aria-busy="uploadingCover"
      aria-label="上传文章封面"
      @click="coverInput?.click()"
    >
      <Loader2 v-if="uploadingCover" class="size-4 animate-spin md:mr-2" />
      <ImagePlus v-else class="size-4 md:mr-2" />
      <span class="max-md:hidden">封面</span>
    </Button>
    <Button
      variant="outline"
      class="h-9 max-md:w-9 max-md:px-0"
      :disabled="uploadingCover || publishing || generatingCover"
      aria-label="AI 生成文章封面"
      @click="openAICover"
    >
      <Sparkles class="size-4 md:mr-2" />
      <span class="max-md:hidden">AI 封面</span>
    </Button>
    <Button
      variant="default"
      class="mia-publish-button h-9 max-md:w-9 max-md:px-0"
      :disabled="publishing || uploadingCover"
      :aria-busy="publishing"
      aria-label="发布到微信草稿箱"
      @click="publishToWechat"
    >
      <Loader2 v-if="publishing" class="size-4 animate-spin md:mr-2" />
      <Send v-else class="size-4 md:mr-2" />
      <span class="max-md:hidden">发到草稿</span>
    </Button>

    <Dialog v-model:open="aiCoverOpen">
      <DialogContent class="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI 生成封面</DialogTitle>
          <DialogDescription>将根据《{{ coverArticleTitle }}》的标题、摘要和正文生成，确认后才会设为封面。</DialogDescription>
        </DialogHeader>
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <Label for="mia-cover-rules">固定规则</Label>
            <Button
              type="button"
              variant="ghost"
              class="h-9 px-3 text-xs"
              :disabled="generatingCover || savingGeneratedCover || aiCoverRules === DEFAULT_COVER_RULES"
              @click="aiCoverRules = DEFAULT_COVER_RULES"
            >
              恢复默认
            </Button>
          </div>
          <Textarea id="mia-cover-rules" v-model="aiCoverRules" rows="6" :disabled="generatingCover || savingGeneratedCover" />
          <p class="text-xs text-muted-foreground">修改后会自动保存在当前浏览器。需要封面文字时，请删除“不要出现任何文字”这条。</p>
        </div>
        <div class="space-y-2">
          <Label for="mia-cover-direction">补充画面要求 <span class="text-muted-foreground">（可选）</span></Label>
          <Textarea id="mia-cover-direction" v-model="aiDirection" rows="3" placeholder="例如：人物不露脸，突出桌面上的实验装置…" :disabled="generatingCover || savingGeneratedCover" />
          <p class="text-xs text-muted-foreground">会和上方规则、文章标题、摘要及正文一起发送给图片模型。</p>
        </div>

        <div v-if="generatedCoverUrl || generatingCover" class="relative aspect-[900/383] w-full overflow-hidden rounded-md border bg-muted">
          <img
            v-if="generatedCoverUrl"
            :src="generatedCoverUrl"
            alt="AI 生成的微信文章封面预览"
            width="900"
            height="383"
            class="h-full w-full object-cover"
          >
          <div v-if="generatingCover" class="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 text-sm" role="status">
            <Loader2 class="size-5 animate-spin" />
            正在生成封面…
          </div>
        </div>

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button v-if="generatedCoverUrl" variant="outline" class="h-11" :disabled="generatingCover || savingGeneratedCover" @click="downloadGeneratedCover">
            <Download class="mr-2 size-4" />
            下载预览
          </Button>
          <span v-else />
          <div class="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" class="h-11" :disabled="generatingCover || savingGeneratedCover" @click="aiCoverOpen = false">取消</Button>
            <Button :variant="generatedCoverUrl ? 'outline' : 'default'" class="h-11" :disabled="generatingCover || savingGeneratedCover" :aria-busy="generatingCover" @click="generateCover">
              <Loader2 v-if="generatingCover" class="mr-2 size-4 animate-spin" />
              <RefreshCw v-else-if="generatedCoverUrl" class="mr-2 size-4" />
              <Sparkles v-else class="mr-2 size-4" />
              {{ generatingCover ? '生成中…' : generatedCoverUrl ? '重新生成' : '生成预览' }}
            </Button>
            <Button v-if="generatedCoverUrl" class="h-11" :disabled="generatingCover || savingGeneratedCover" :aria-busy="savingGeneratedCover" @click="confirmGeneratedCover">
              <Loader2 v-if="savingGeneratedCover" class="mr-2 size-4 animate-spin" />
              <ImagePlus v-else class="mr-2 size-4" />
              {{ savingGeneratedCover ? '保存中…' : '设为封面' }}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
